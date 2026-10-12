-- ============================================================================
-- 97 — ROLLBACK: definizioni LIVE del 2026-10-12, prima della 97.
-- ============================================================================

begin;

CREATE OR REPLACE FUNCTION public.registra_apertura_binder_pubblico(p_binder_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    VALUES (v_owner_id, 'sito', 'aperto', jsonb_build_object('binder_id', p_binder_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.registra_apertura_scaffale_pubblico(p_scaffale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_owner_id uuid;
    v_pubblico boolean;
begin
    select owner_id, (stato_pubblicazione = 'pubblico')
    into v_owner_id, v_pubblico
    from public.scaffali where id = p_scaffale_id;

    if v_owner_id is null or not v_pubblico then
        return;
    end if;

    insert into public.activity_log (user_id, source, action, details)
    values (v_owner_id, 'sito', 'scaffale_pubblico_aperto', jsonb_build_object('scaffale_id', p_scaffale_id));
end;
$function$;

commit;
