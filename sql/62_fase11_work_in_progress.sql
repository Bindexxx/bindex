-- ============================================================================
-- CardSync Pro — 62: Fase 11 — Work in Progress configurabile
--
-- Tabella semplice, letta da TUTTI (serve sapere se qualcosa è in
-- manutenzione anche da anonimi/utenti normali) ma scritta SOLO da admin
-- (is_admin(), stessa funzione già usata altrove nel progetto).
--
-- target_tipo copre i 4 livelli della roadmap (widget Home, pagina,
-- Binder speciale, singola funzione) — target_id è il testo libero che
-- identifica QUALE, stesso id già usato altrove per quel tipo (es. l'id
-- di CATALOGO_WIDGET per 'widget', il tabId di switchTab per 'pagina').
-- Nessuna FK verso quegli id: vivono in posti diversi (un catalogo JS,
-- non una tabella), stessa scelta già presa altrove nel progetto quando
-- l'id di riferimento non è in una singola tabella Postgres.
--
-- Messaggio: CHECK con i 5 valori fissi della roadmap — "scelto da lista
-- chiusa, non testo libero" è un requisito esplicito, non un dettaglio.
-- ============================================================================

CREATE TABLE public.work_in_progress (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_tipo  text NOT NULL CHECK (target_tipo IN ('widget', 'pagina', 'binder_speciale', 'funzione')),
    target_id    text NOT NULL,
    messaggio    text NOT NULL CHECK (messaggio IN (
        'Un Ditto ha copiato qualche impostazione di troppo. Stiamo sistemando.',
        'Il Professor Oak sta facendo un controllo qualità. Torniamo presto.',
        'Team Rocket ha temporaneamente preso possesso di questa pagina. Stiamo recuperando tutto.',
        'Porygon sta aggiornando questa funzione. Nessun Pokémon è stato danneggiato.',
        'Questa funzione è in evoluzione. Torna a trovarci tra poco.'
    )),
    attivo       boolean NOT NULL DEFAULT true,
    attivato_da  uuid REFERENCES auth.users(id),
    attivato_il  timestamptz NOT NULL DEFAULT now(),

    -- Un solo WIP attivo per bersaglio alla volta — evita doppioni
    -- accidentali dal pannello admin (due righe attive sullo stesso
    -- target_tipo/target_id non avrebbero senso: quale messaggio vince?).
    UNIQUE (target_tipo, target_id)
);

ALTER TABLE public.work_in_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chiunque autenticato legge i work in progress"
    ON public.work_in_progress FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "solo admin scrive i work in progress"
    ON public.work_in_progress FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- select column_name, data_type from information_schema.columns where table_name='work_in_progress' order by ordinal_position;
-- select policyname, cmd from pg_policies where tablename='work_in_progress';
-- ============================================================================
