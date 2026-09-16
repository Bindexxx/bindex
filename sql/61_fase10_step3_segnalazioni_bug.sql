-- ============================================================================
-- CardSync Pro — 61: Fase 10, Step 3 — Segnalazioni bug con log diagnostico
--
-- "Report to admin" della roadmap: ogni utente può segnalare un problema,
-- con il log diagnostico (ultimi eventi/errori raccolti in tempo reale
-- lato client, ui/log-diagnostico.ui.js) allegato automaticamente — non
-- serve più che l'utente sappia aprire F12 e copiare la console (la
-- roadmap dice esplicitamente "non è possibile leggere retroattivamente
-- tutta la console F12" — qui infatti non si tenta: si raccoglie DA ORA
-- IN AVANTI, ogni sessione riparte con un buffer vuoto).
--
-- RLS: chiunque autenticato inserisce la PROPRIA segnalazione (mai legge/
-- modifica quelle altrui); solo admin (is_admin(), stessa funzione già
-- usata per bustina_carte_possedute) le legge tutte. Nessun UPDATE/DELETE
-- per nessuno dal client — se un giorno serve una gestione stato
-- (aperta/chiusa), sarà un'altra migration con RPC dedicata, non ora.
-- ============================================================================

CREATE TABLE public.segnalazioni_bug (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         uuid NOT NULL REFERENCES auth.users(id),
    descrizione      text NOT NULL,
    log_diagnostico  text,   -- testo libero, formattato lato client (ui/log-diagnostico.ui.js) — ultimi N eventi/errori di QUESTA sessione
    pagina           text,   -- view-section attiva al momento della segnalazione
    browser          text,   -- navigator.userAgent
    schermo          text,   -- "larghezza x altezza"
    creato_il        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.segnalazioni_bug ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utenti inviano le proprie segnalazioni"
    ON public.segnalazioni_bug FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "admin legge tutte le segnalazioni"
    ON public.segnalazioni_bug FOR SELECT
    USING (is_admin());

-- Un utente normale non deve poter rileggere/elencare le segnalazioni
-- (nemmeno le proprie) da qui — il flusso previsto è "invia e dimentica",
-- stesso spirito di un modulo di contatto. Se in futuro serve fargliele
-- rivedere, si aggiunge una policy SELECT own_id a parte.

-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- select column_name, data_type from information_schema.columns where table_name='segnalazioni_bug' order by ordinal_position;
-- select policyname, cmd from pg_policies where tablename='segnalazioni_bug';
-- ============================================================================
