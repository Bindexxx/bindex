-- ============================================================================
-- CardSync Pro — 37: Fase 1.1 — Fondazioni dati (carte sigillate + prodotti
-- sealed + location tipizzate)
--
-- Roadmap operativa CardSync Pro Online, Fase 1. Nessuna riga carte.tipo=
-- 'sealed' esiste oggi (verificato in audit Fase 0) — nessuna migrazione
-- legacy necessaria.
--
-- Decisioni confermate da Claudio (sessione 2026-09-12):
-- - "Carta sigillata" (Caso A) e "prodotto sealed" (Caso B) sono concetti
--   distinti. Caso A resta una carta, con una spunta booleana. Caso B ha
--   tabella dedicata.
-- - Niente CHECK su integrita_packaging: la lista di valori vive solo
--   nell'interfaccia (stesso pattern già in uso per carte.condizione), per
--   poterne aggiungere/modificare senza toccare il database.
-- - I prodotti sealed entrano nel controllo prezzi automatico "aiuta il
--   gruppo" (Fase 1.2, RPC dedicate — non in questo file).
-- - I trigger generici _cardsync_registra_storico_prezzo /
--   _cardsync_traccia_prezzo_precedente / aggiorna_updated_at sono
--   riusati as-is (corpo verificato dal vivo, generico via TG_TABLE_NAME),
--   per questo la colonna prezzo si chiama 'prezzo' e non 'prezzo_richiesto'.
-- ============================================================================


-- ── 1) Carte sigillate: spunta booleana, stessa filosofia di reverse_holo/
--       first_ed. NOT NULL DEFAULT false: le 1.148 righe esistenti prendono
--       automaticamente false (default costante, Postgres 17 lo applica
--       senza riscrivere la tabella).
alter table public.carte
  add column sigillata_originale boolean not null default false;


-- ── 2) Location tipizzate ────────────────────────────────────────────────
alter table public.location
  add column tipo text not null default 'carta' check (tipo in ('carta', 'sealed'));

-- Il vincolo UNIQUE(owner_id, nome) impedirebbe di avere una location "?"
-- per le carte E una "?" per i sealed sullo stesso owner (stesso nome).
-- Allargato a 3 colonne — nessuna riga esistente urta questo cambio, dato
-- che oggi tipo è sempre 'carta'.
alter table public.location drop constraint location_owner_id_nome_key;
alter table public.location add constraint location_owner_id_nome_tipo_key
  unique (owner_id, nome, tipo);


-- ── 3) Tabella prodotti_sealed ───────────────────────────────────────────
create table public.prodotti_sealed (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nome text,
  codice text,
  set_espansione text,
  qty integer default 1,
  lingua text default 'IT',
  integrita_packaging text default 'sigillato_integro',  -- niente CHECK, valori gestiti in UI
  location text,
  prezzo numeric,               -- prezzo richiesto/di vendita — nome allineato a carte.prezzo per riuso trigger
  prezzo_cardmarket numeric,
  prezzo_acquisto numeric,
  prezzo_precedente numeric,    -- popolato dal trigger _cardsync_traccia_prezzo_precedente
  data_acquisizione date,
  stato text not null default 'collezione',
  note text,
  immagine text,
  claimed_by uuid,              -- per il controllo prezzi di gruppo (Fase 1.2)
  claimed_at timestamptz,
  ultimo_controllo timestamptz,
  dispositivo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_prodotti_sealed_claim on public.prodotti_sealed (stato, claimed_by, claimed_at);
create index idx_prodotti_sealed_owner on public.prodotti_sealed (owner_id, location);
create index idx_prodotti_sealed_stato on public.prodotti_sealed (stato);

alter table public.prodotti_sealed enable row level security;

create policy "propria collezione sealed" on public.prodotti_sealed
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Trigger riusati as-is (stesso pattern di carte/wishlist)
create trigger trg_prodotti_sealed_updated_at
  before update on public.prodotti_sealed
  for each row execute function aggiorna_updated_at();

create trigger trg_traccia_prezzo_precedente_sealed
  before update on public.prodotti_sealed
  for each row execute function _cardsync_traccia_prezzo_precedente();

create trigger trg_storico_prezzo_sealed
  after insert or update on public.prodotti_sealed
  for each row execute function _cardsync_registra_storico_prezzo();


-- ============================================================================
-- QUERY DI VERIFICA POST-ESECUZIONE (lanciale dopo, incollami l'esito)
-- ============================================================================

-- Colonna aggiunta correttamente, tutte le righe esistenti a false:
-- select sigillata_originale, count(*) from public.carte group by 1;

-- Location: tutte le righe esistenti sono 'carta':
-- select tipo, count(*) from public.location group by 1;

-- Tabella nuova, RLS attiva, 3 trigger agganciati:
-- select relrowsecurity from pg_class where relname = 'prodotti_sealed';
-- select tgname from pg_trigger where tgrelid = 'public.prodotti_sealed'::regclass and not tgisinternal;

-- Test funzionale rapido (poi CANCELLA questa riga di prova):
-- insert into public.prodotti_sealed (owner_id, nome, qty, prezzo)
--   values (auth.uid(), 'Test Booster Box', 1, 99.90) returning *;
-- select * from public.storico_prezzi where tabella = 'prodotti_sealed';
-- delete from public.prodotti_sealed where nome = 'Test Booster Box';
