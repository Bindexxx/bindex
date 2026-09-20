-- ═══════════════════════════════════════════════════════════════════════
-- sql/65_rinomina_location.sql
-- Widget Location, tasto "Gestisci" (2026-09-20).
--
-- DUE COSE, nell'ordine:
--   A) binders.nome_in_attesa — colonna GENERATA: un solo posto dove
--      QUALUNQUE widget legge "il nuovo nome del binder in attesa di
--      approvazione". NULL = nessuna proposta in corso → si mostra solo
--      binders.nome. Non si scrive mai a mano (la calcola il DB).
--   B) rinomina_location(p_da, p_a) — rinomina di una location in UNA
--      transazione, con proposta del nuovo nome del binder collegato.
--
-- ─── A) PERCHÉ UNA COLONNA GENERATA ─────────────────────────────────────
-- sql/21 ha già nome_proposto + nome_stato, ma nome_proposto NON viene mai
-- azzerato (admin_process_pending_request, dopo approvazione o rifiuto, lo
-- lascia lì): "nome_proposto non vuoto" NON significa "c'è una proposta in
-- corso". Per leggerlo giusto serviva sempre incrociarlo con nome_stato.
-- nome_in_attesa lo fa il DB una volta per tutti:
--     nome_in_attesa = nome_proposto  SE nome_stato = 'pending'
--                                      E nome_proposto non vuoto
--                                      E nome_proposto <> nome
--                      NULL           altrimenti
-- Regola per ogni widget:
--     b.nome_in_attesa ? `${b.nome} (${b.nome_in_attesa} — in attesa di approvazione)`
--                      : b.nome
-- Nessuna modifica ad admin_process_pending_request (SECURITY DEFINER, non
-- toccata): approvazione/rifiuto cambiano nome_stato e la colonna si
-- aggiorna da sola. Le pagine pubbliche non cambiano: le RPC pubbliche
-- restituiscono solo binders.nome (mai il nome in attesa, non ancora
-- moderato).
--
-- ─── B) PERCHÉ UNA RPC ──────────────────────────────────────────────────
-- Il nome di una location è testo libero replicato senza FK:
-- location.nome, carte.location, binders.location_valore (il binder-location
-- con copertina/sleeve/layout/link pubblico). Aggiornarne una sola
-- lascerebbe carte orfane e sdoppierebbe il binder. Più UPDATE dal client
-- non sarebbero atomici.
--
-- VERIFICATO SUL DB REALE (query di Claudio, 2026-09-20): colonne con
-- location (binders.location_valore, carte.location, wishlist.location,
-- coda_carte, coda_wishlist, correzioni_manuali_carte); location UNIQUE
-- (owner_id, nome, tipo) + RLS ALL owner; binders UNIQUE (owner_id, tipo,
-- location_valore) + RLS ALL owner + trigger trg_binders_blocca_rinomina_
-- diretta (blocca SOLO binders.nome) e trg_binders_forza_condivisione;
-- carte RLS ALL owner.
--
-- SCELTE:
--   - SECURITY INVOKER (NON definer): gira con RLS del chiamante, tocca solo
--     righe con owner_id = auth.uid(). Nessun privilegio nuovo, nessuna
--     policy/trigger modificati.
--   - NON tocca la tabella wishlist: la Wishlist è una tabella e un binder
--     a sé (tipo='wishlist'); 'WISHLIST' è solo il testo di default di
--     wishlist.location, non una location vera. Nessuna riga di wishlist
--     viene letta né scritta.
--   - NON tocca coda_carte / coda_wishlist / correzioni_manuali_carte
--     (transitorie, RLS non verificata). Una riga ancora in coda col vecchio
--     nome, se completata DOPO la rinomina, ricreerebbe il vecchio nome.
--   - binders.nome NON viene mai scritto (approvazione admin di sql/21/26
--     intatta). Cambia location_valore; se il binder "seguiva" la location
--     (nome = vecchio nome, oppure proposta in corso uguale al vecchio
--     nome) imposta nome_proposto/nome_stato='pending'. Un binder con nome
--     personalizzato dall'utente NON viene toccato.
--   - Contenitori di sistema — '?' (fallback "in attesa di location"),
--     'SCAMBIO', 'WISHLIST' — e '—': mai come nome di partenza né di
--     arrivo. Ci sono funzioni che si basano su questi nomi (e il trigger
--     _binders_forza_condivisione forza PUBBLICO ogni binder-location
--     'SCAMBIO').
--   - Nome di arrivo già in uso (anche con maiuscole diverse) in location,
--     binders o carte → errore, nessuna fusione automatica.
--   - NON cancella mai nulla.
-- Effetto collaterale noto: gli UPDATE su carte fanno scattare i trigger di
-- sempre (updated_at, storico prezzo) — identico a "Sposta Location".
-- ═══════════════════════════════════════════════════════════════════════


-- ── A) colonna generata ────────────────────────────────────────────────
-- Guardia: se le colonne attese non ci sono, si ferma prima di toccare
-- qualunque cosa.
DO $$
BEGIN
    IF (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'binders'
           AND column_name IN ('nome', 'nome_proposto', 'nome_stato')) <> 3 THEN
        RAISE EXCEPTION 'binders: colonne nome / nome_proposto / nome_stato non trovate — script interrotto, nulla è stato modificato';
    END IF;
END $$;

ALTER TABLE public.binders
    ADD COLUMN IF NOT EXISTS nome_in_attesa text
    GENERATED ALWAYS AS (
        CASE
            WHEN nome_stato = 'pending'
             AND nome_proposto IS NOT NULL
             AND btrim(nome_proposto) <> ''
             AND nome_proposto IS DISTINCT FROM nome
            THEN nome_proposto
        END
    ) STORED;

COMMENT ON COLUMN public.binders.nome_in_attesa IS
    'SOLA LETTURA (colonna generata). Nuovo nome del binder in attesa di approvazione admin; NULL = nessuna proposta in corso, mostrare solo binders.nome. Mostrare come: "<nome> (<nome_in_attesa> — in attesa di approvazione)".';


-- ── B) rinomina_location ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rinomina_location(p_da text, p_a text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
    v_uid            uuid := auth.uid();
    v_da             text := nullif(p_da, '');
    v_a              text := btrim(coalesce(p_a, ''));
    v_n_location     int  := 0;
    v_n_carte        int  := 0;
    v_binder_id      uuid;
    v_binder_nome    text;
    v_binder_stato   text;
    v_binder_prop    text;
    v_proposta_nome  boolean := false;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Non autenticato';
    END IF;
    IF v_da IS NULL OR v_a = '' THEN
        RAISE EXCEPTION 'Nome mancante';
    END IF;
    IF v_da = v_a THEN
        RAISE EXCEPTION 'Il nuovo nome coincide con quello attuale';
    END IF;
    IF upper(btrim(v_da)) IN ('?', 'SCAMBIO', 'WISHLIST', '—')
       OR upper(v_a) IN ('?', 'SCAMBIO', 'WISHLIST', '—') THEN
        RAISE EXCEPTION 'Contenitore di sistema: non si può rinominare né usare come nuovo nome';
    END IF;

    -- La location di partenza deve esistere da qualche parte (può essere
    -- "orfana": usata da carte ma senza riga in location).
    IF NOT EXISTS (SELECT 1 FROM public.location WHERE owner_id = v_uid AND tipo = 'carta' AND nome = v_da)
       AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)
       AND NOT EXISTS (SELECT 1 FROM public.binders WHERE owner_id = v_uid AND tipo = 'location' AND location_valore = v_da) THEN
        RAISE EXCEPTION 'Location "%" non trovata', v_da;
    END IF;

    -- Nome di arrivo già in uso (case-insensitive, esclusa la location
    -- stessa: "bulk" → "BULK" resta un cambio di maiuscole lecito).
    IF EXISTS (SELECT 1 FROM public.location WHERE owner_id = v_uid AND tipo = 'carta' AND nome <> v_da AND lower(nome) = lower(v_a))
       OR EXISTS (SELECT 1 FROM public.binders WHERE owner_id = v_uid AND tipo = 'location' AND location_valore <> v_da AND lower(location_valore) = lower(v_a))
       OR EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location <> v_da AND lower(location) = lower(v_a)) THEN
        RAISE EXCEPTION 'Esiste già una location "%"', v_a;
    END IF;

    UPDATE public.location SET nome = v_a
     WHERE owner_id = v_uid AND tipo = 'carta' AND nome = v_da;
    GET DIAGNOSTICS v_n_location = ROW_COUNT;

    UPDATE public.carte SET location = v_a
     WHERE owner_id = v_uid AND location = v_da;
    GET DIAGNOSTICS v_n_carte = ROW_COUNT;

    -- Binder-location: location_valore sempre; nome MAI. Il nuovo nome va
    -- in nome_proposto/'pending' solo se il binder "seguiva" la location.
    SELECT id, nome, nome_stato, nome_proposto
      INTO v_binder_id, v_binder_nome, v_binder_stato, v_binder_prop
      FROM public.binders
     WHERE owner_id = v_uid AND tipo = 'location' AND location_valore = v_da;
    IF FOUND THEN
        IF v_binder_nome = v_da
           OR (v_binder_stato = 'pending' AND v_binder_prop = v_da) THEN
            UPDATE public.binders
               SET location_valore = v_a,
                   nome_proposto   = v_a,
                   nome_stato      = 'pending',
                   nome_admin_note = null
             WHERE id = v_binder_id;
            v_proposta_nome := true;
        ELSE
            UPDATE public.binders SET location_valore = v_a WHERE id = v_binder_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'location',       v_n_location,
        'carte',          v_n_carte,
        'binder_id',      v_binder_id,
        'proposta_nome',  v_proposta_nome
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rinomina_location(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rinomina_location(text, text) TO authenticated;

-- Ricarica la cache schema di PostgREST (nuova colonna + nuova funzione).
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICA DOPO L'ESECUZIONE
--   1. Colonna generata presente e tutta NULL (nessuna proposta in corso):
--        select tipo, location_valore, nome, nome_stato, nome_in_attesa
--          from binders order by tipo, nome;
--   2. Dal SQL editor auth.uid() è NULL → deve rispondere "Non autenticato":
--        select rinomina_location('x', 'y');
--      (la funzione si prova solo dal sito.)
--   3. Dal sito: location di prova con 1 carta → Gestisci → ✎ → rinomina.
--        select location_valore, nome, nome_stato, nome_proposto, nome_in_attesa
--          from binders where tipo='location' and location_valore ilike '%<nuovo>%';
--      → location_valore = nuovo; nome = vecchio; nome_stato = pending;
--        nome_in_attesa = nuovo.
-- ═══════════════════════════════════════════════════════════════════════
