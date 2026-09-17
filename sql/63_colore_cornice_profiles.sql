-- ═══════════════════════════════════════════════════════════════════════
-- sql/63_colore_cornice_profiles.sql
-- STEP 6 restyle "cornice Pokédex" (2026-09-17) — colore cornice
-- (Principale/Secondario) leggibile anche da visitatori anonimi sui link
-- pubblici (Wishlist/Binder/Scaffali).
--
-- DECISIONE (dopo verifica live schema, Regola d'Oro #3):
--   - preferenze_utente: RLS "ALL, authenticated, owner_id=auth.uid()",
--     NESSUNA policy pubblica — scartata, avrebbe richiesto allargare la
--     RLS di una tabella con altre preferenze private.
--   - profiles: RLS SELECT solo self/admin, NESSUNA policy UPDATE per
--     l'utente stesso (solo admin) — già la tabella "identità utente" più
--     adatta concettualmente, ma la scrittura diretta dal client va per
--     forza attraverso una RPC (stessa lezione di Fase 9: mai un valore
--     scritto direttamente su una tabella "di identità" senza controllo).
--   - Nessuna tabella "profilo pubblico" dedicata già esistente.
--
-- Pattern: stesso principio delle 3 RPC pubbliche già esistenti
-- (leggi_binder_pubblico, ecc.) — SECURITY DEFINER, restituisce SOLO i
-- 2 campi richiesti, mai l'intera riga profiles (che contiene dati
-- privati: nome_reale, telefono, email_contatto, ban_reason, ecc.).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Nuove colonne — nullable: null = utente non ha ancora scelto,
--    il client applica i default (#7c4dff / #756a8a).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS colore_principale text,
    ADD COLUMN IF NOT EXISTS colore_secondario text;

-- 2. Lettura pubblica (chiamata dalle 3 pagine pubbliche, utente ANONIMO).
--    Restituisce SOLO i 2 colori, mai altro — la riga profiles resta
--    protetta dalla sua RLS per qualunque altra lettura.
CREATE OR REPLACE FUNCTION public.leggi_colore_cornice_pubblico(p_owner_id uuid)
RETURNS TABLE(colore_principale text, colore_secondario text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT p.colore_principale, p.colore_secondario
    FROM public.profiles p
    WHERE p.id = p_owner_id;
$$;

-- Se le altre 3 RPC pubbliche funzionano oggi per utenti anonimi senza
-- GRANT espliciti, questa dovrebbe comportarsi uguale (stesso owner delle
-- funzioni, stesso schema). Se invece la chiamata anonima fallisce dal
-- vivo, serve quasi certamente questa riga (verificarlo con un test reale
-- prima di aggiungerla alla cieca):
--   GRANT EXECUTE ON FUNCTION public.leggi_colore_cornice_pubblico(uuid) TO anon;

-- 3. Scrittura — SOLO l'utente autenticato scrive i PROPRI 2 colori.
--    Mai un UPDATE diretto dal client (RLS di profiles non lo permette
--    comunque, nessuna policy UPDATE per l'utente stesso — voluto).
--    Validazione minima formato esadecimale (#RRGGBB), stesso spirito di
--    "mai un valore accettato così com'è dal client" già applicato in
--    Fase 9 per i premi.
CREATE OR REPLACE FUNCTION public.imposta_colore_cornice(p_principale text, p_secondario text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF p_principale !~ '^#[0-9a-fA-F]{6}$' OR p_secondario !~ '^#[0-9a-fA-F]{6}$' THEN
        RAISE EXCEPTION 'Formato colore non valido — atteso #RRGGBB';
    END IF;

    UPDATE public.profiles
    SET colore_principale = p_principale,
        colore_secondario = p_secondario
    WHERE id = auth.uid();
END;
$$;

-- authenticated soltanto (auth.uid() sarebbe null per anon, l'UPDATE non
-- toccherebbe nessuna riga — ma nessuna ragione di lasciarla chiamabile
-- da anonimi):
REVOKE EXECUTE ON FUNCTION public.imposta_colore_cornice(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.imposta_colore_cornice(text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICA DA FARE DOPO L'ESECUZIONE (incollami l'output):
--   1. Da loggato: select imposta_colore_cornice('#123456', '#654321');
--      poi: select colore_principale, colore_secondario from profiles
--           where id = auth.uid();
--      → deve mostrare i 2 valori appena scritti.
--   2. Da anonimo (o con la chiave anon, non la service role):
--      select * from leggi_colore_cornice_pubblico('<uuid di un utente>');
--      → deve restituire i 2 colori SENZA errore di permessi. Se dà
--        errore di permessi, serve il GRANT commentato sopra (punto 2).
-- ═══════════════════════════════════════════════════════════════════════
