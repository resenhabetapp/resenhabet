-- Supabase RPC function: settle_room
-- Settle the room, set official results, and calculate/return winners for all sports and bet types.
DROP FUNCTION IF EXISTS public.settle_room(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.settle_room(uuid, integer, integer, jsonb);

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
BEGIN
    -- Obter dados da sala
    SELECT sport, bet_type, valor_da_cota, regra_empate, regra_banca_comissionada, comissao_porcentagem, pix_key
    INTO v_sport, v_bet_type, v_cota, v_regra_empate, v_regra_banca_comissionada, v_comissao_porcentagem, v_pix_key
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
        -- Aplicar comissão se a regra estiver ativa
        IF v_regra_banca_comissionada AND v_comissao_porcentagem > 0 THEN
            v_commission := ROUND(v_total_pool * (v_comissao_porcentagem::numeric / 100.0), 2);
            v_total_pool := v_total_pool - v_commission;
        END IF;

        v_prize_per_winner := ROUND((v_total_pool / v_winners_count)::numeric, 2);
        
        -- Retornar comissão do organizador como a primeira linha se aplicável
        IF v_commission > 0 THEN
            RETURN QUERY 
            SELECT 'Comissão do Organizador'::TEXT, v_pix_key::TEXT, v_commission::NUMERIC;
        END IF;

        RETURN QUERY 
        SELECT bettor_name::TEXT, bettor_pix_key::TEXT, v_prize_per_winner::NUMERIC
        FROM temp_winners;
    ELSE
        RETURN;
    END IF;

    -- Limpar tabela temporária
    DROP TABLE temp_winners;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
