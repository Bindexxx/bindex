-- ═══════════════════════════════════════════════════════════════════════
-- 28_set_espansioni.sql
-- Tabella di consultazione delle espansioni Pokémon (sessione 2026-08-27)
-- ═══════════════════════════════════════════════════════════════════════
-- SCOPO
-- Il widget "Set" calcola quanto manca a completare un'espansione. Per
-- farlo servono due numeri che il codice della carta NON contiene:
--   carte_base   = il denominatore stampato sulla carta ("123/217")
--   carte_totali = quelle davvero esistenti, secret rare comprese (295)
-- Calcolare l'avanzamento sul denominatore stampato darebbe oltre il 100%
-- a chi possiede anche le secret: è il motivo per cui questa tabella esiste.
--
-- NATURA DELLA TABELLA
-- Dati di riferimento del gioco, uguali per tutti gli utenti e non legati
-- a nessun account — stessa natura di 'configurazione_app', da cui è
-- ricalcato il modello di accesso. Nessun owner_id, nessun trigger,
-- nessuna logica: si legge e basta.
--
-- VERIFICHE FATTE PRIMA DI SCRIVERE (Regola d'Oro #3)
--   1. information_schema.tables → nessuna tabella con 'set'/'espansion'
--      nel nome: nessun doppione, nessun conflitto.
--   2. pg_policies → 'configurazione_app' concede SELECT con qual = true;
--      le policy admin di 'pending_requests' usano is_admin(). Entrambe
--      riusate qui invece di inventare condizioni nuove.
--
-- POPOLAMENTO
-- Con l'INSERT generato da genera-libreria-set.html (fonte: TCGdex).
-- Quel file usa 'on conflict (sigla) do update', quindi si può rilanciare
-- a ogni nuova espansione senza duplicare né perdere righe.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.set_espansioni (
    -- Sigla stampata sulla carta e usata nei codici della collezione
    -- ("ASC 123"). È la chiave con cui il client abbina le carte.
    sigla            text primary key,

    -- Identificativo TCGdex ("sv06"), utile per rigenerare o approfondire.
    tcgdex_id        text,

    nome             text not null,

    -- Denominatore stampato sulla carta. Può mancare per le espansioni
    -- senza numerazione ufficiale.
    carte_base       integer,

    -- Totale reale, secret rare comprese. È QUESTO che va usato per
    -- calcolare l'avanzamento.
    carte_totali     integer not null check (carte_totali > 0),

    data_uscita      date,
    aggiornato_il    timestamptz not null default now(),

    -- Il totale non può essere inferiore allo stampato: sarebbe un dato
    -- corrotto e produrrebbe percentuali sopra il 100%.
    constraint set_espansioni_totale_coerente
        check (carte_base is null or carte_totali >= carte_base)
);

comment on table public.set_espansioni is
    'Espansioni Pokémon: sigla, nome e conteggio carte. carte_totali include le secret rare, carte_base è il numero stampato sulla carta. Popolata da genera-libreria-set.html (fonte TCGdex).';

-- Ordinamento per data di uscita: le espansioni recenti sono quelle che
-- si consultano di più.
create index if not exists set_espansioni_data_uscita_idx
    on public.set_espansioni (data_uscita desc nulls last);

alter table public.set_espansioni enable row level security;

-- ── LETTURA: aperta a tutti, anon compreso ──────────────────────────────
-- Scelta esplicita di Claudio. Sono dati pubblici del gioco, senza nulla
-- di sensibile, e le pagine condivise (binder-pubblico.html) girano con
-- il ruolo anon: senza questo, l'avanzamento dei set non funzionerebbe su
-- un binder condiviso. 'configurazione_app' concede la lettura al solo
-- ruolo authenticated, e questa è la differenza voluta rispetto a quella.
drop policy if exists "chiunque legge le espansioni" on public.set_espansioni;
create policy "chiunque legge le espansioni"
    on public.set_espansioni
    for select
    to anon, authenticated
    using (true);

-- ── SCRITTURA: solo admin ───────────────────────────────────────────────
-- Stessa condizione delle policy admin di 'pending_requests' (is_admin()),
-- verificata su pg_policies prima di scrivere. Tre policy separate invece
-- di una ALL: così un domani si può allentare la sola INSERT senza
-- toccare le altre.
drop policy if exists "admin inserisce le espansioni" on public.set_espansioni;
create policy "admin inserisce le espansioni"
    on public.set_espansioni
    for insert
    to authenticated
    with check (is_admin());

drop policy if exists "admin aggiorna le espansioni" on public.set_espansioni;
create policy "admin aggiorna le espansioni"
    on public.set_espansioni
    for update
    to authenticated
    using (is_admin())
    with check (is_admin());

drop policy if exists "admin elimina le espansioni" on public.set_espansioni;
create policy "admin elimina le espansioni"
    on public.set_espansioni
    for delete
    to authenticated
    using (is_admin());

-- ── VERIFICA DOPO L'ESECUZIONE ──────────────────────────────────────────
-- Da lanciare per controllare che sia andato tutto a posto:
--
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'set_espansioni';
--
-- Attese: quattro policy — una SELECT per {anon,authenticated} con
-- qual = true, e tre di scrittura per {authenticated} con is_admin().
