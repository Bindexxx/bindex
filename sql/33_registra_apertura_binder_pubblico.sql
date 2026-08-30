-- 33_registra_apertura_binder_pubblico.sql
-- Esegui manualmente su Bindexxx prima di caricare i file JS che la chiamano.

CREATE OR REPLACE FUNCTION registra_apertura_binder_pubblico(p_binder_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id uuid;
    v_pubblico boolean;
BEGIN
    -- Valida che il binder esista e sia DAVVERO pubblico ORA — non fidarsi
    -- ciecamente dell'input: un binder_id valido ma privato non deve
    -- generare un evento.
    SELECT owner_id, (stato_pubblicazione = 'pubblico')
    INTO v_owner_id, v_pubblico
    FROM binders WHERE id = p_binder_id;

    IF v_owner_id IS NULL OR NOT v_pubblico THEN
        RETURN; -- silenzioso: nessun errore visibile al visitatore anonimo
    END IF;

    INSERT INTO activity_log (user_id, source, action, details)
    VALUES (v_owner_id, 'binder-pubblico', 'aperto', jsonb_build_object('binder_id', p_binder_id));
END;
$$;

GRANT EXECUTE ON FUNCTION registra_apertura_binder_pubblico(uuid) TO anon;
