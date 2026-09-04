-- ═══════════════════════════════════════════════════════════════════════
-- 36 — STORICO DEL VALORE DELLA COLLEZIONE
-- Claudio, 2026-09-03
-- ═══════════════════════════════════════════════════════════════════════
--
-- A COSA SERVE
-- Il blocco "Variazione del valore totale" della home era un segnaposto da
-- mesi per un motivo semplice: il valore lo sappiamo calcolare adesso, ma
-- nessuno lo ha mai salvato ieri. Questa tabella comincia a salvarlo.
--
-- SCELTA DI CLAUDIO: NIENTE RICOSTRUZIONE ALL'INDIETRO.
-- Era stata valutata una ricostruzione da storico_prezzi (per ogni giorno
-- passato, l'ultimo prezzo noto per carta x quantita'). Scartata: le
-- quantita' di ieri non sono registrate da nessuna parte, quindi avrebbe
-- usato quelle di oggi per tutte le date passate, e le carte vendute o
-- cancellate sarebbero mancate del tutto. Un grafico che sembra storia ma
-- non lo e'. Si parte dal primo giorno vero.
--
-- PERCHE' QUATTRO NUMERI E NON SOLO IL VALORE — E' IL PUNTO DI TUTTO.
-- Claudio: "quando aggiungi carte dovrebbe dire tipo: valore salito di 45
-- euro, aggiunte tre carte ieri dal valore complessivo di 43 euro".
-- Con il solo totale quella frase e' impossibile: se domani il totale e'
-- cresciuto di 45 euro non si puo' sapere se sono saliti i prezzi o se hai
-- comprato. Serve scomporre la differenza:
--
--     variazione_totale = variazione_di_prezzo + valore_delle_aggiunte
--
-- Di questi conosciamo con certezza il totale (valore_totale) e le
-- aggiunte (valore_aggiunte, calcolato dalle carte con created_at nella
-- giornata). La variazione di prezzo si ricava per differenza. Da qui le
-- quattro colonne.
--
-- LIMITE NOTO, DA TENERE PRESENTE: le carte RIMOSSE (vendute, cancellate)
-- non sono scomponibili allo stesso modo — non lasciano traccia. Una
-- rimozione finisce quindi nel residuo e verrebbe letta come "i prezzi
-- sono scesi". Per questo si salva anche pezzi_totali: se i pezzi calano,
-- il calo NON e' di prezzo e il widget puo' dirlo onestamente invece di
-- mentire. Non risolve il valore esatto della rimozione, ma evita
-- l'errore piu' grosso.

CREATE TABLE IF NOT EXISTS storico_valore_collezione (
    id            BIGSERIAL PRIMARY KEY,

    -- owner_id, non user_id: e' la convenzione di questo progetto su tutte
    -- le tabelle di dati (carte, wishlist, binders). L'unica eccezione nota
    -- e' activity_log, che usa user_id — non seguirla qui.
    owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Una riga per utente per giorno. DATE e non timestamp: l'unita' di
    -- misura del grafico e' la giornata, e un timestamp renderebbe
    -- impossibile il vincolo di unicita' qui sotto.
    giorno        DATE NOT NULL,

    -- Valore della collezione ('collezione', quindi carte + sealed,
    -- esclusa la Wishlist) al momento dell'ultima istantanea del giorno.
    valore_totale NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Somma delle quantita'. Serve a distinguere un calo di prezzo da una
    -- rimozione di carte (vedi il limite noto qui sopra).
    pezzi_totali  INTEGER NOT NULL DEFAULT 0,

    -- Carte entrate in collezione IN QUESTA GIORNATA e loro valore.
    -- Calcolati dal client da created_at: sono la parte "spiegata" della
    -- variazione, quella che permette la frase di Claudio.
    carte_aggiunte  INTEGER NOT NULL DEFAULT 0,
    valore_aggiunte NUMERIC(12,2) NOT NULL DEFAULT 0,

    registrato_il TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- IL VINCOLO CHE FA IL LAVORO. Come per missioni_completate (migration
    -- 32), l'unicita' a livello di database rende impossibile la riga
    -- doppia senza scrivere una riga di codice anti-duplicazione lato
    -- client: cinque dispositivi che aprono l'app lo stesso giorno
    -- aggiornano la stessa riga invece di crearne cinque.
    CONSTRAINT storico_valore_uno_al_giorno UNIQUE (owner_id, giorno)
);

-- Il grafico legge sempre "le ultime N giornate di QUESTO utente", quindi
-- l'indice segue quell'ordine. L'unicita' qui sopra crea gia' un indice su
-- (owner_id, giorno) crescente; questo serve al verso opposto.
CREATE INDEX IF NOT EXISTS idx_storico_valore_owner_giorno
    ON storico_valore_collezione (owner_id, giorno DESC);

-- ── RLS DAL PRIMO GIORNO ────────────────────────────────────────────────
-- Non "da aggiungere dopo": e' il key learning ripetuto del progetto. Qui
-- e' anche semplice, perche' owner_id esiste sulla tabella e non serve
-- nessuna RPC per leggere i propri dati.
ALTER TABLE storico_valore_collezione ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storico_valore_lettura_propria ON storico_valore_collezione;
CREATE POLICY storico_valore_lettura_propria
    ON storico_valore_collezione FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS storico_valore_scrittura_propria ON storico_valore_collezione;
CREATE POLICY storico_valore_scrittura_propria
    ON storico_valore_collezione FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- L'aggiornamento serve perche' l'istantanea del giorno viene riscritta a
-- ogni apertura: il valore del giorno e' quello dell'ultima apertura, non
-- della prima. Senza UPDATE, aprire l'app alle 9 e alle 21 lascerebbe il
-- valore delle 9.
DROP POLICY IF EXISTS storico_valore_aggiornamento_proprio ON storico_valore_collezione;
CREATE POLICY storico_valore_aggiornamento_proprio
    ON storico_valore_collezione FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- NESSUNA policy di DELETE, di proposito: uno storico che si puo'
-- cancellare dal client non e' uno storico. Se un giorno servira'
-- (cancellazione account), passera' da una funzione dedicata.

COMMENT ON TABLE storico_valore_collezione IS
    'Istantanea giornaliera del valore della collezione, una riga per utente per giorno. Scritta dal client a ogni apertura (upsert). Le colonne carte_aggiunte/valore_aggiunte servono a scomporre la variazione fra movimento dei prezzi e acquisti.';
