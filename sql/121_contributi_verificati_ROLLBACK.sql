-- ============================================================================
-- 121 ROLLBACK — registra_aiuto_gruppo com'era il 2026-10-24, policy di
-- scrittura del log com'era, indice tolto (DROP: da eseguire a mano).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text DEFAULT 'coda_carte'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_io UUID := auth.uid();
BEGIN
    IF v_io IS NULL THEN
        RETURN; -- non autenticato: niente da registrare
    END IF;

    -- LAVORARE UNA PROPRIA RIGA NON E' UN CONTRIBUTO. Il worker autonomo
    -- risolve sempre le proprie carte, a prescindere dal flag "Aiuta il
    -- gruppo": senza questo controllo il contatore misurerebbe "quanto uso
    -- l'app" invece di "quanto aiuto gli altri". Il controllo sta QUI e non
    -- nel client apposta: e' la regola che definisce il dato.
    IF p_owner_riga IS NULL OR p_owner_riga = v_io THEN
        RETURN;
    END IF;

    INSERT INTO activity_log (user_id, source, action, details)
    VALUES (
        v_io,
        'estensione',
        'aiuto_gruppo',
        jsonb_build_object(
            'riga_id', p_riga_id,
            -- Serve a contare le PERSONE aiutate, non solo le carte. E'
            -- visibile solo a chi ha scritto la riga (e' la sua), quindi
            -- non incrina il livello intermedio.
            'owner', p_owner_riga::text,
            'tipo', p_tipo
        )
    );
END;
$function$;

alter policy "utente crea le proprie voci di log" on public.activity_log
  with check (( select auth.uid() as uid) = user_id);

drop index if exists public.activity_log_aiuto_gruppo_unico;
