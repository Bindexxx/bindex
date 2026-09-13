-- ============================================================================
-- CardSync Pro — 47: Fase 4, Step 1 — Prenotazioni/richieste di scambio
-- (fondazioni DB)
--
-- Decisioni prese con Claudio prima di scrivere:
--  - NON riusare 'ordini': RLS UPDATE lì è `qual: true` (chiunque autenticato
--    può aggiornare qualunque riga) — voluto per l'automazione controllo
--    prezzi (un dispositivo del gruppo aiuta un altro), ma sbagliato per
--    trattative private a due. Tabelle nuove, 'ordini' resta invariata.
--  - "Riservato" è un fatto DERIVATO (join su richieste_scambio_righe con
--    stato_riga='accettata'), non un nuovo valore scritto su
--    carte.stato/prodotti_sealed.stato — quei due campi non hanno nemmeno
--    un CHECK (verificato dal vivo), un nuovo valore letterale lì
--    toccherebbe filtri/vetrina pubblica/selezione Scambio in tutto il
--    sito, stesso tipo di rischio della regressione location='SCAMBIO' di
--    oggi. Rimandato, non deciso "mai".
--
-- Scrittura SOLO via RPC (Step 2, non ancora scritte) — RLS qui espone
-- solo SELECT per i coinvolti, nessun INSERT/UPDATE/DELETE diretto dal
-- client: le RPC SECURITY DEFINER bypassano comunque RLS, stesso schema
-- già in uso per admin_process_pending_request/leggi_binder_pubblico.
-- ============================================================================

-- ── richieste_scambio (contenitore) ────────────────────────────────────
create table public.richieste_scambio (
    id uuid primary key default gen_random_uuid(),
    richiedente_id uuid not null references auth.users(id),
    proprietario_id uuid not null references auth.users(id),
    stato text not null default 'aperta' check (stato = any (array['aperta'::text, 'chiusa'::text])),
    creato_il timestamptz not null default now()
);

alter table public.richieste_scambio enable row level security;
create policy "coinvolti leggono la propria richiesta" on public.richieste_scambio
    for select using (auth.uid() = richiedente_id or auth.uid() = proprietario_id or is_admin());


-- ── richieste_scambio_righe (una per carta/prodotto) ───────────────────
-- richiedente_id/proprietario_id denormalizzati dalla richiesta padre —
-- stessa scelta di binder_carte.owner_id/scaffale_prodotti.owner_id nel
-- resto del progetto: RLS diretta senza subquery/join.
create table public.richieste_scambio_righe (
    id uuid primary key default gen_random_uuid(),
    richiesta_id uuid not null references public.richieste_scambio(id) on delete cascade,
    richiedente_id uuid not null references auth.users(id),
    proprietario_id uuid not null references auth.users(id),
    carta_id uuid references public.carte(id),
    prodotto_sealed_id uuid references public.prodotti_sealed(id),
    quantita_richiesta integer not null default 1 check (quantita_richiesta > 0),
    stato_riga text not null default 'in_attesa'
        check (stato_riga = any (array['in_attesa'::text, 'accettata'::text, 'rifiutata'::text, 'annullata'::text, 'conclusa'::text])),
    prezzo_congelato numeric,
    snapshot jsonb,
    location_scelta text,
    motivo_chiusura text
        check (motivo_chiusura is null or motivo_chiusura = any (array[
            'ho_cambiato_idea'::text, 'non_piu_disponibile'::text, 'accordo_non_concluso'::text,
            'errore_prenotazione'::text, 'sostituito_altro_accordo'::text, 'intervento_amministrativo'::text
        ])),
    creato_il timestamptz not null default now(),
    aggiornato_il timestamptz not null default now(),
    -- Esattamente uno tra carta_id/prodotto_sealed_id — stesso principio
    -- delle coppie Binder/Scaffale Scambio: mai un oggetto "ambiguo" tra i
    -- due domini.
    constraint richieste_scambio_righe_un_solo_tipo check (
        (carta_id is not null)::int + (prodotto_sealed_id is not null)::int = 1
    )
);

create index idx_richieste_scambio_righe_richiesta on public.richieste_scambio_righe (richiesta_id);
create index idx_richieste_scambio_righe_carta on public.richieste_scambio_righe (carta_id) where carta_id is not null;
create index idx_richieste_scambio_righe_prodotto on public.richieste_scambio_righe (prodotto_sealed_id) where prodotto_sealed_id is not null;
-- Indice mirato per la query "questo oggetto è riservato?" (Step 3/4) —
-- solo righe effettivamente attive contano.
create index idx_richieste_scambio_righe_accettate on public.richieste_scambio_righe (carta_id, prodotto_sealed_id) where stato_riga = 'accettata';

alter table public.richieste_scambio_righe enable row level security;
create policy "coinvolti leggono le proprie righe" on public.richieste_scambio_righe
    for select using (auth.uid() = richiedente_id or auth.uid() = proprietario_id or is_admin());


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select table_name, column_name, data_type from information_schema.columns
-- where table_name in ('richieste_scambio','richieste_scambio_righe')
-- order by table_name, ordinal_position;
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid in ('richieste_scambio'::regclass, 'richieste_scambio_righe'::regclass);
--
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('richieste_scambio','richieste_scambio_righe');
