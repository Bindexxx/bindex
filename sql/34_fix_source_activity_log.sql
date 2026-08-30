-- ============================================================================
-- Migrazione 34 — Fix valore 'source' non valido in activity_log
-- ============================================================================
-- BUG TROVATO 2026-08-30: activity_log ha un CHECK esistente
--   activity_log_source_check: source = ANY (ARRAY['sito','estensione'])
-- che NON era noto/documentato prima d'ora. La RPC
-- registra_apertura_binder_pubblico (migration 33) scrive
-- source='binder-pubblico', valore non ammesso dal CHECK — ogni apertura
-- anonima di un binder pubblico ha sempre fallito silenziosamente
-- (l'errore non è mai visibile al visitatore anonimo, la funzione lo
-- inghiotte apposta) da quando la RPC è stata creata.
--
-- FIX: cambiato 'binder-pubblico' → 'sito' (il significato reale della
-- colonna è "da dove arriva l'evento", non una categoria libera — la
-- categoria resta distinta nel campo 'action', qui invariato: 'aperto').
-- Nessuna DROP necessaria: firma e tipo di ritorno invariati, CREATE OR
-- REPLACE basta e non tocca i permessi GRANT già concessi.
-- ============================================================================

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

-- Verifica dopo l'esecuzione (facoltativa, per conferma manuale):
-- select pg_get_functiondef(oid) from pg_proc where proname = 'registra_apertura_binder_pubblico';
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'activity_log'::regclass and conname = 'activity_log_source_check';
