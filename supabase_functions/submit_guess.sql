-- Supabase RPC function: submit_guess
-- Reject guesses after the room deadline (horario_limite)
-- This function is called via supabase.rpc('submit_guess', ...)
DROP FUNCTION IF EXISTS public.submit_guess(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.submit_guess(
    p_room_id UUID,
    p_bettor_name TEXT,
    p_bettor_pix_key TEXT,
    p_home_score INTEGER DEFAULT NULL,
    p_away_score INTEGER DEFAULT NULL,
    p_guess_data JSONB DEFAULT NULL
) RETURNS TABLE(
    id UUID,
    room_id UUID,
    bettor_name TEXT,
    bettor_pix_key TEXT,
    home_score INTEGER,
    away_score INTEGER,
    dynamic_cents INTEGER,
    final_value NUMERIC,
    payment_status TEXT,
    created_at TIMESTAMPTZ,
    guess_data JSONB
) AS $$
DECLARE
    v_deadline TIMESTAMPTZ;
    v_cota NUMERIC(10,2);
    v_dynamic_cents INTEGER;
    v_final_value NUMERIC(10,2);
    v_inserted_id UUID;
    v_created_at TIMESTAMPTZ;
    v_home_score INTEGER;
    v_away_score INTEGER;
    v_guess_data JSONB;
BEGIN
    -- Obter prazo e valor da cota da sala
    SELECT horario_limite, valor_da_cota INTO v_deadline, v_cota 
    FROM rooms 
    WHERE rooms.id = p_room_id;

    -- Validar prazo limite
    IF v_deadline IS NOT NULL AND now() > v_deadline THEN
        RAISE EXCEPTION 'O prazo limite para palpites nesta sala já expirou.';
    END IF;

    -- Obter a contagem atual de palpites na sala para definir centavos de 1 a 99 sequencialmente
    SELECT COUNT(*) INTO v_dynamic_cents 
    FROM guesses 
    WHERE guesses.room_id = p_room_id;
    
    v_dynamic_cents := (v_dynamic_cents % 99) + 1;
    
    -- Calcular o valor final (cota + centavos)
    v_final_value := v_cota + (v_dynamic_cents::numeric / 100.0);
    v_created_at := now();

    -- Processar placares e guess_data para compatibilidade de futebol
    v_guess_data := p_guess_data;
    v_home_score := p_home_score;
    v_away_score := p_away_score;

    -- Se for futebol tradicional antigo (enviando scores e sem JSON)
    IF v_home_score IS NOT NULL AND v_away_score IS NOT NULL AND v_guess_data IS NULL THEN
        v_guess_data := jsonb_build_object('home_score', v_home_score, 'away_score', v_away_score);
    -- Se for enviado como JSON contendo os scores (futebol novo)
    ELSIF v_guess_data IS NOT NULL AND v_guess_data ? 'home_score' AND v_guess_data ? 'away_score' THEN
        v_home_score := (v_guess_data->>'home_score')::integer;
        v_away_score := (v_guess_data->>'away_score')::integer;
    END IF;

    -- Inserir palpite
    INSERT INTO guesses (
        room_id,
        bettor_name,
        bettor_pix_key,
        home_score,
        away_score,
        dynamic_cents,
        final_value,
        payment_status,
        created_at,
        guess_data
    ) VALUES (
        p_room_id,
        p_bettor_name,
        p_bettor_pix_key,
        v_home_score,
        v_away_score,
        v_dynamic_cents,
        v_final_value,
        'pending',
        v_created_at,
        v_guess_data
    ) RETURNING guesses.id INTO v_inserted_id;

    -- Retornar os dados inseridos
    RETURN QUERY 
    SELECT 
        v_inserted_id,
        p_room_id,
        p_bettor_name,
        p_bettor_pix_key,
        v_home_score,
        v_away_score,
        v_dynamic_cents,
        v_final_value,
        'pending'::TEXT,
        v_created_at,
        v_guess_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
