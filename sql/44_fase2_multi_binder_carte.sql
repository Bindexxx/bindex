-- ============================================================================
-- CardSync Pro — 44: Fase 2 — Multi-Binder reale per le carte
--
-- Obiettivo (roadmap generale, Fase 2): una carta può stare in più Binder
-- contemporaneamente. Oggi non può: UNIQUE(owner_id, carta_id) lo impedisce,
-- nonostante binder_id esista già in binder_carte dal 2026-08-25.
--
-- SCOPERTO PRIMA DI SCRIVERE (Regola d'Oro #3, verificato dal vivo):
--  - TUTTE le 54 righe esistenti di binder_carte hanno binder_id NULL — sono
--    righe legacy da prima che il sistema multi-binder esistesse. Il codice
--    NUOVO (data/binder.repository.js, toggleBinderMembership) valorizza
--    sempre binder_id per le righe che scrive — le 54 NULL sono storia, non
--    un bug attivo.
--  - Nessun owner ha più di un binder tipo='extra' (verificato con query
--    dedicata) — nonostante UNIQUE(owner_id,tipo,location_valore) su
--    binders NON protegga davvero da doppioni quando location_valore è
--    NULL (Postgres tratta i NULL come sempre distinti in una UNIQUE) — è
--    una falla teorica nel vincolo, ma non ha mai prodotto doppioni reali.
--    Per questo il backfill sotto usa un controllo EXISTS esplicito, MAI
--    "INSERT ... ON CONFLICT (owner_id,tipo,location_valore)" — quel
--    pattern non si attiverebbe comunque su location_valore NULL e
--    creerebbe un secondo binder 'extra' silenzioso.
--  - Nessun altro punto del codice (grep su tutto ui/*.js e data/*.js)
--    legge binder_carte assumendo "un solo binder per carta": l'unico altro
--    punto oltre a binder.repository.js è ui/cards.ui.js, e filtra già
--    esplicitamente per binder_id (_binderExtraId) — continua a funzionare
--    identico dopo questa migration, zero modifiche client necessarie per
--    il meccanismo di base.
--
-- ORDINE (backfill PRIMA del vincolo, mai il contrario — un NOT NULL/UNIQUE
-- su dati non ancora sistemati fallirebbe a metà, lasciando lo schema in
-- uno stato intermedio incoerente):
--   1. Crea il binder 'extra' mancante per ogni owner con righe binder_id
--      NULL (nessuno dovrebbe mancarne, dato che il flusso normale del sito
--      lo crea alla prima apertura — ma un utente con SOLO righe legacy mai
--      più tornato sul sito potrebbe non averlo mai avuto).
--   2. Backfill: binder_id = l'id di quel binder 'extra', per ogni riga NULL.
--   3. Verifica di sicurezza: 0 righe NULL rimaste, altrimenti l'intera
--      migration si annulla (RAISE EXCEPTION dentro una transazione — se la
--      tua sessione SQL non è già in una transazione esplicita, ricordati
--      che ogni singola istruzione di Supabase SQL Editor è comunque
--      atomica di suo, ma questo blocco va eseguito TUTTO INSIEME, non a
--      pezzi, altrimenti il controllo di sicurezza non ha senso).
--   4. binder_id diventa NOT NULL.
--   5. Sostituzione del vincolo UNIQUE.
-- ============================================================================

DO $$
DECLARE
    v_id_extra uuid;
    v_owner record;
    v_residue integer;
BEGIN
    -- 1) Crea 'extra' mancanti
    FOR v_owner IN
        SELECT DISTINCT bc.owner_id
        FROM public.binder_carte bc
        WHERE bc.binder_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.binders b WHERE b.owner_id = bc.owner_id AND b.tipo = 'extra')
    LOOP
        INSERT INTO public.binders (owner_id, tipo, nome) VALUES (v_owner.owner_id, 'extra', 'Il mio binder');
    END LOOP;

    -- 2) Backfill binder_id
    UPDATE public.binder_carte bc
    SET binder_id = (SELECT b.id FROM public.binders b WHERE b.owner_id = bc.owner_id AND b.tipo = 'extra' LIMIT 1)
    WHERE bc.binder_id IS NULL;

    -- 3) Verifica di sicurezza
    SELECT count(*) INTO v_residue FROM public.binder_carte WHERE binder_id IS NULL;
    IF v_residue > 0 THEN
        RAISE EXCEPTION 'Backfill incompleto: % righe restano con binder_id NULL — migration annullata, nessun DDL applicato.', v_residue;
    END IF;
END $$;

-- 4) binder_id sempre valorizzato d'ora in poi
ALTER TABLE public.binder_carte ALTER COLUMN binder_id SET NOT NULL;

-- 5) Il vincolo vero: una carta non due volte nello STESSO binder, ma libera
-- di stare in binder diversi.
ALTER TABLE public.binder_carte DROP CONSTRAINT binder_carte_owner_id_carta_id_key;
ALTER TABLE public.binder_carte ADD CONSTRAINT binder_carte_owner_binder_carta_key UNIQUE (owner_id, binder_id, carta_id);


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select count(*) from binder_carte where binder_id is null;
-- -- deve essere 0
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'binder_carte'::regclass and contype = 'u';
-- -- deve mostrare UNIQUE (owner_id, binder_id, carta_id), non più
-- -- UNIQUE (owner_id, carta_id)
--
-- select owner_id, count(*) from binders where tipo = 'extra' group by owner_id having count(*) > 1;
-- -- deve restituire 0 righe (nessun doppione creato dal backfill)
