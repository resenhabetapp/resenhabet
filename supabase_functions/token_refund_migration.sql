-- 1. Novas colunas na tabela de salas (rooms)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS reembolso_token boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS custo_do_token numeric(10,2) NOT NULL DEFAULT 0.00;

-- 2. Nova coluna para rastreamento FIFO nas transações de token
ALTER TABLE public.token_transactions ADD COLUMN IF NOT EXISTS consumed_tokens integer NOT NULL DEFAULT 0;

-- 3. Atualização/Criação da função do trigger de consumo de token na criação de salas com suporte a FIFO
CREATE OR REPLACE FUNCTION public.handle_room_token_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_token_cost numeric(10,2) := 1.00; -- Valor padrão de fallback (R$ 1,00)
    v_purchase_id UUID;
    v_user_tokens integer;
BEGIN
    -- Verificar saldo total do usuário no perfil
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = NEW.creator_id;
    IF v_user_tokens IS NULL OR v_user_tokens < 1 THEN
        RAISE EXCEPTION 'Saldo de tokens insuficiente para criar uma nova resenha.';
    END IF;

    -- Lógica FIFO: Encontrar a compra mais antiga concluída que ainda tenha tokens não consumidos
    SELECT id, COALESCE(price / NULLIF(amount, 0), 1.00)
    INTO v_purchase_id, v_token_cost
    FROM public.token_transactions
    WHERE user_id = NEW.creator_id 
      AND type = 'purchase' 
      AND status = 'completed'
      AND amount > consumed_tokens
    ORDER BY created_at ASC
    LIMIT 1;

    -- Se encontrou uma compra válida, consome 1 token dela incrementando consumed_tokens
    IF v_purchase_id IS NOT NULL THEN
        UPDATE public.token_transactions
        SET consumed_tokens = consumed_tokens + 1
        WHERE id = v_purchase_id;
    END IF;

    -- Salva o custo do token correspondente na sala (se o reembolso estiver ativo)
    IF NEW.reembolso_token IS TRUE THEN
        NEW.custo_do_token := v_token_cost;
    ELSE
        NEW.custo_do_token := 0.00;
    END IF;

    -- Deduzir 1 token do saldo geral do perfil
    UPDATE public.profiles
    SET tokens = tokens - 1
    WHERE id = NEW.creator_id;

    -- Registrar transação de consumo com o custo FIFO correspondente
    INSERT INTO public.token_transactions (user_id, amount, type, status, price)
    VALUES (NEW.creator_id, -1, 'room_creation', 'completed', v_token_cost);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Garantir que o trigger está associado à tabela rooms
-- Nota: Nós tentamos dropar triggers com os nomes mais comuns de implementação anterior para evitar duplicações
DROP TRIGGER IF EXISTS tr_deduct_token ON public.rooms;
DROP TRIGGER IF EXISTS deduct_token_trigger ON public.rooms;
DROP TRIGGER IF EXISTS trigger_deduct_token ON public.rooms;

CREATE TRIGGER tr_deduct_token
BEFORE INSERT ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.handle_room_token_deduction();

-- 5. Atualização da função de encerramento da sala (settle_room)
-- Settle the room, set official results, calculate/return winners, and deduct/return token refund if active.
CREATE OR REPLACE FUNCTION public.settle_room(
    p_room_id UUID,
    p_home_score INTEGER DEFAULT NULL,
    p_away_score INTEGER DEFAULT NULL,
    p_result_data JSONB DEFAULT NULL
) RETURNS TABLE(
    winner_name TEXT,
    winner_pix_key TEXT,
    prize_value NUMERIC
) AS $$
DECLARE
    v_sport TEXT;
    v_bet_type TEXT;
    v_cota NUMERIC(10,2);
    v_total_pool NUMERIC(10,2);
    v_total_confirmed INTEGER;
    v_winners_count INTEGER;
    v_prize_per_winner NUMERIC(10,2);
    v_regra_empate TEXT;
    v_regra_banca_comissionada BOOLEAN;
    v_comissao_porcentagem INTEGER;
    v_pix_key TEXT;
    v_commission NUMERIC(10,2) DEFAULT 0.00;
    v_line NUMERIC;
    v_reembolso_token BOOLEAN;
    v_custo_do_token NUMERIC(10,2);
BEGIN
    -- Obter dados da sala (incluindo reembolso e custo do token)
    SELECT sport, bet_type, valor_da_cota, regra_empate, regra_banca_comissionada, comissao_porcentagem, pix_key, reembolso_token, custo_do_token
    INTO v_sport, v_bet_type, v_cota, v_regra_empate, v_regra_banca_comissionada, v_comissao_porcentagem, v_pix_key, v_reembolso_token, v_custo_do_token
    FROM rooms 
    WHERE rooms.id = p_room_id;

    -- Atualizar scores oficiais e status da sala
    UPDATE rooms 
    SET home_score = p_home_score,
        away_score = p_away_score,
        status = 'settled',
        event_data = COALESCE(event_data, '{}'::jsonb) || jsonb_build_object('result', p_result_data)
    WHERE rooms.id = p_room_id;

    -- Obter o número total de cotas confirmadas e o pote
    SELECT COUNT(*), SUM(final_value) 
    INTO v_total_confirmed, v_total_pool
    FROM guesses 
    WHERE room_id = p_room_id AND payment_status = 'confirmed';

    -- Se não houver cotas confirmadas, retornar vazio
    IF v_total_confirmed = 0 OR v_total_confirmed IS NULL THEN
        RETURN;
    END IF;

    -- Utilizar o valor da cota multiplicada pelas confirmadas para o rateio
    v_total_pool := v_total_confirmed * v_cota;

    -- Determinar a linha para Basquete over/under
    IF v_sport = 'Basquete' AND v_bet_type = 'pontos_total' AND p_result_data IS NOT NULL THEN
        v_line := (p_result_data->>'line')::numeric;
    END IF;

    -- Criar tabela temporária para os acertadores
    CREATE TEMP TABLE temp_winners AS
    SELECT id, bettor_name, bettor_pix_key
    FROM guesses
    WHERE room_id = p_room_id 
      AND payment_status = 'confirmed'
      AND (
          -- Futebol: Placar Exato
          (v_sport = 'Futebol' AND v_bet_type = 'placar_exato' AND home_score = p_home_score AND away_score = p_away_score)
          OR
          -- Futebol: Resultado Final
          (v_sport = 'Futebol' AND v_bet_type = 'resultado_final' AND (
              (p_home_score > p_away_score AND guess_data->>'winner' = 'home') OR
              (p_home_score = p_away_score AND guess_data->>'winner' = 'draw') OR
              (p_home_score < p_away_score AND guess_data->>'winner' = 'away')
          ))
          OR
          -- Tênis: Vencedor
          (v_sport = 'Tênis' AND v_bet_type = 'vencedor' AND (
              (p_home_score > p_away_score AND guess_data->>'winner' = 'player_a') OR
              (p_home_score < p_away_score AND guess_data->>'winner' = 'player_b')
          ))
          OR
          -- Tênis: Placar de Sets
          (v_sport = 'Tênis' AND v_bet_type = 'placar_sets' AND 
              guess_data->>'sets_score' = (p_home_score::text || 'x' || p_away_score::text)
          )
          OR
          -- Basquete: Vencedor
          (v_sport = 'Basquete' AND v_bet_type = 'vencedor' AND (
              (p_home_score > p_away_score AND guess_data->>'winner' = 'home') OR
              (p_home_score < p_away_score AND guess_data->>'winner' = 'away')
          ))
          OR
          -- Basquete: Pontos Total Over/Under
          (v_sport = 'Basquete' AND v_bet_type = 'pontos_total' AND (
              ((p_home_score + p_away_score) > v_line AND guess_data->>'over_under' = 'over') OR
              ((p_home_score + p_away_score) < v_line AND guess_data->>'over_under' = 'under')
          ))
          OR
          -- Vôlei: Vencedor
          (v_sport = 'Vôlei' AND v_bet_type = 'vencedor' AND (
              (p_home_score > p_away_score AND guess_data->>'winner' = 'home') OR
              (p_home_score < p_away_score AND guess_data->>'winner' = 'away')
          ))
          OR
          -- Vôlei: Placar de Sets
          (v_sport = 'Vôlei' AND v_bet_type = 'placar_sets' AND 
              guess_data->>'sets_score' = (p_home_score::text || 'x' || p_away_score::text)
          )
          OR
          -- Fórmula 1: Vencedor da Corrida
          (v_sport = 'Fórmula 1' AND v_bet_type = 'vencedor_corrida' AND 
              guess_data->>'winner' = p_result_data->>'winner'
          )
          OR
          -- Fórmula 1: Pódio (Top 3)
          (v_sport = 'Fórmula 1' AND v_bet_type = 'podio' AND 
              guess_data->'podium' = p_result_data->'podium'
          )
      );

    SELECT COUNT(*) INTO v_winners_count FROM temp_winners;

    -- Calcular o prêmio por vencedor
    IF v_winners_count > 0 THEN
        -- 1. Aplicar reembolso do token de criação, se ativo
        IF v_reembolso_token AND v_custo_do_token > 0.00 THEN
            v_total_pool := v_total_pool - v_custo_do_token;
        END IF;

        -- 2. Aplicar comissão se a regra estiver ativa
        IF v_regra_banca_comissionada AND v_comissao_porcentagem > 0 THEN
            v_commission := ROUND(v_total_pool * (v_comissao_porcentagem::numeric / 100.0), 2);
            v_total_pool := v_total_pool - v_commission;
        END IF;

        -- 3. Calcular a cota final de prêmio por vencedor
        v_prize_per_winner := ROUND((v_total_pool / v_winners_count)::numeric, 2);
        
        -- Retornar reembolso do token para o organizador como a primeira linha se ativo
        IF v_reembolso_token AND v_custo_do_token > 0.00 THEN
            RETURN QUERY 
            SELECT 'Reembolso de Token'::TEXT, v_pix_key, v_custo_do_token;
        END IF;

        -- Retornar comissão do organizador se aplicável
        IF v_commission > 0 THEN
            RETURN QUERY 
            SELECT 'Comissão do Organizador'::TEXT, v_pix_key, v_commission;
        END IF;

        -- Retornar os vencedores oficiais
        RETURN QUERY 
        SELECT bettor_name, bettor_pix_key, v_prize_per_winner
        FROM temp_winners;
    ELSE
        RETURN;
    END IF;

    -- Limpar tabela temporária
    DROP TABLE temp_winners;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Aumentar o tamanho máximo do nome do apostador para 60 caracteres
ALTER TABLE public.guesses ALTER COLUMN bettor_name TYPE varchar(60);

-- 7. Adicionar coluna external_id para conciliação com o Asaas
ALTER TABLE public.token_transactions ADD COLUMN IF NOT EXISTS external_id text NULL;
