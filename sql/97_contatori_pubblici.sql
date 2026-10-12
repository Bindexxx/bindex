-- ============================================================================
-- 97 — CONTATORI PUBBLICI (S7, piano 2026-10-12)
-- Scritto partendo dalle definizioni LIVE lette il 2026-10-12 (connettore in
-- sola lettura). Da eseguire con OK esplicito di Claudio.
--
-- PROBLEMA: registra_apertura_binder_pubblico e registra_apertura_scaffale_
-- pubblico sono chiamabili da chiunque (anche senza login: servono alle
-- pagine pubbliche) e a ogni chiamata aggiungono una riga in activity_log del
-- proprietario. Nessun limite: chiamandole a ripetizione si riempie il
-- registro attività (e le notifiche "qualcuno ha aperto il tuo binder").
--
-- COSA FA: la stessa apertura dello stesso binder/scaffale si registra al
-- massimo una volta ogni 10 minuti. Per il resto le funzioni sono IDENTICHE
-- (stessi controlli, stessi permessi: CREATE OR REPLACE li conserva).
-- La ricerca usa l'indice esistente activity_log_user_idx (user_id, created_at).
--
-- PER ANNULLARE: sql/97_contatori_pubblici_ROLLBACK.sql
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
    -- (97) Al massimo una apertura registrata ogni 10 minuti per binder.
    IF EXISTS (
        SELECT 1 FROM activity_log
        WHERE user_id = v_owner_id
          AND created_at > now() - interval '10 minutes'
          AND action = 'aperto'
          AND details->>'binder_id' = p_binder_id::text
    ) THEN
        RETURN;
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

    -- (97) Al massimo una apertura registrata ogni 10 minuti per scaffale.
    if exists (
        select 1 from public.activity_log
        where user_id = v_owner_id
          and created_at > now() - interval '10 minutes'
          and action = 'scaffale_pubblico_aperto'
          and details->>'scaffale_id' = p_scaffale_id::text
    ) then
        return;
    end if;

    insert into public.activity_log (user_id, source, action, details)
    values (v_owner_id, 'sito', 'scaffale_pubblico_aperto', jsonb_build_object('scaffale_id', p_scaffale_id));
end;
$function$;

commit;

-- VERIFICA (dopo): permessi invariati (anon e authenticated true come prima)
-- select proname, has_function_privilege('anon', oid, 'EXECUTE') anon, has_function_privilege('authenticated', oid, 'EXECUTE') auth
--   from pg_proc where pronamespace = 'public'::regnamespace and proname like 'registra_apertura_%';
