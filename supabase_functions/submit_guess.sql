-- Supabase RPC function: submit_guess
-- Reject guesses after the room deadline (horario_limite)
-- This function is called via supabase.rpc('submit_guess', ...)
CREATE OR REPLACE FUNCTION public.submit_guess(
    p_room_id UUID,
    p_bettor_name TEXT,
    p_bettor_pix_key TEXT,
    p_home_score INTEGER,
    p_away_score INTEGER
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
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_deadline TIMESTAMPTZ;
    v_cota NUMERIC(10,2);
    v_dynamic_cents INTEGER;
    v_final_value NUMERIC(10,2);
    v_inserted_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Obter prazo e valor da cota da sala
    SELECT horario_limite, valor_da_cota INTO v_deadline, v_cota 
    FROM rooms 
    WHERE rooms.id = p_room_id;

    -- Validar prazo limite
    IF v_deadline IS NOT NULL AND now() > v_deadline THEN
        RAISE EXCEPTION 'O prazo limite para palpites nesta sala já expirou.';
    END IF;

    -- Gerar centavos dinâmicos de 0 a 99
    v_dynamic_cents := FLOOR(RANDOM() * 100);
    
    -- Calcular o valor final (cota + centavos)
    v_final_value := v_cota + (v_dynamic_cents::numeric / 100.0);
    v_created_at := now();

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
        created_at
    ) VALUES (
        p_room_id,
        p_bettor_name,
        p_bettor_pix_key,
        p_home_score,
        p_away_score,
        v_dynamic_cents,
        v_final_value,
        'pending',
        v_created_at
    ) RETURNING guesses.id INTO v_inserted_id;

    -- Retornar os dados inseridos
    RETURN QUERY 
    SELECT 
        v_inserted_id,
        p_room_id,
        p_bettor_name,
        p_bettor_pix_key,
        p_home_score,
        p_away_score,
        v_dynamic_cents,
        v_final_value,
        'pending'::TEXT,
        v_created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
