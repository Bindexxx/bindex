-- ============================================================================
-- CardSync Pro — 12: Schema base da zero (tabelle + indici)
-- Ricostruito da query dirette sul DB di produzione (information_schema,
-- pg_constraint, pg_indexes — regola d'oro #3 rispettata: nessuna colonna
-- indovinata dal codice client). Da eseguire su un progetto Supabase VUOTO,
-- in ordine: 12 → 13 → 14 → 15 → 16.
--
-- NOTA su wishlist: la query sui vincoli non ha restituito righe per questa
-- tabella (né PK né FK confermati). PK e FK sotto sono lo schema standard
-- coerente col resto del progetto, ma è l'unica tabella non confermata al
-- 100% — verificalo dopo l'esecuzione.
--
-- NOTA sulle FK verso auth.users: admin_hard_delete_user (vedi
-- 09_fix_admin_hard_delete_user_cascade.sql) cancella/azzera esplicitamente
-- le righe collegate PRIMA di cancellare da auth.users — la migration 09
-- dice esplicitamente che il bug era dovuto a FK SENZA "on delete cascade".
-- Le FK sotto sono quindi scritte senza azione automatica (comportamento
-- di default), eccetto dove esplicitamente documentato diversamente
-- (correzioni_manuali_carte.owner_id e binder_carte.carta_id, entrambe
-- verificate: la prima da 11_schema_correzioni_manuali_carte.sql, la
-- seconda dal commento "binder_carte segue carte in cascade" nello stesso
-- file 09).
-- ============================================================================

-- ── profiles ──────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id),
  username text,
  role text not null default 'user' check (role = any (array['user','admin'])),
  deleted_at timestamptz,
  created_at timestamptz default now(),
  banned_until timestamptz,
  ban_reason text,
  nome_reale text,
  cognome_reale text,
  telefono text,
  email_contatto text
);

-- ── location ──────────────────────────────────────────────────────────
create table public.location (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nome text not null,
  unique (owner_id, nome)
);

-- ── preferenze_utente ─────────────────────────────────────────────────
create table public.preferenze_utente (
  owner_id uuid primary key references auth.users(id),
  email_notifiche text,
  notifica_changelog boolean default false,
  notifica_prezzi boolean default false,
  soglia_prezzi numeric default 5,
  notifica_wishlist boolean default false,
  tab_predefinita text default 'visualizzazione',
  aggiornato_il timestamptz default now(),
  nascondi_scambio_da_match boolean default false,
  nascondi_wishlist_da_match boolean default false
);

-- ── carte (collezione + sealed) ───────────────────────────────────────
create table public.carte (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  tipo text default 'carta',
  nome text,
  codice text,
  location text,
  qty integer default 1,
  lingua text default 'IT',
  condizione text default 'NM',
  reverse_holo boolean default false,
  first_ed boolean default false,
  url text,
  prezzo numeric,
  prezzo_obiettivo numeric,
  note text,
  stato text not null default 'collezione',
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ultimo_controllo timestamptz,
  prezzo_precedente numeric,
  immagine text,
  dispositivo text
);

create index idx_carte_claim on public.carte (stato, claimed_by, claimed_at);
create index idx_carte_lookup on public.carte (owner_id, codice, lingua, condizione);
create index idx_carte_stato on public.carte (stato);
create index idx_carte_ultimo_controllo on public.carte (owner_id, stato, ultimo_controllo);

-- ── wishlist (NON CONFERMATA al 100%, vedi nota in testa al file) ─────
create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  nome text,
  codice text,
  qty integer default 1,
  lingua text default 'IT',
  condizione text default 'NM',
  url text,
  prezzo numeric,
  prezzo_precedente numeric,
  prezzo_obiettivo numeric,
  note text,
  created_at timestamptz default now(),
  ultimo_controllo timestamptz,
  location text default 'WISHLIST',
  tipo text,
  immagine text
);

-- ── binder_carte ──────────────────────────────────────────────────────
create table public.binder_carte (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  carta_id uuid not null references public.carte(id) on delete cascade,
  ordine integer,
  aggiunta_il timestamptz default now(),
  unique (owner_id, carta_id)
);

-- ── foto_carte ────────────────────────────────────────────────────────
create table public.foto_carte (
  id uuid primary key default gen_random_uuid(),
  carta_id uuid not null,
  tabella text not null default 'carte',
  owner_id uuid not null references auth.users(id),
  storage_path text not null,
  nota text,
  creato_il timestamptz default now()
);

-- ── user_media (copertina Binder + retro carta) ──────────────────────
create table public.user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  slot text not null,
  storage_path text not null,
  status text not null default 'pending' check (status = any (array['pending','approved','rejected'])),
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  metadata jsonb,
  source text not null default 'upload' check (source = any (array['upload','default'])),
  unique (user_id, slot)
);

-- ── storico_prezzi ────────────────────────────────────────────────────
create table public.storico_prezzi (
  id uuid primary key default gen_random_uuid(),
  carta_id uuid not null,
  owner_id uuid not null,
  tabella text not null default 'carte',
  prezzo numeric not null,
  registrato_il timestamptz default now()
);

create index idx_storico_prezzi_carta on public.storico_prezzi (carta_id, registrato_il);

-- ── ordini (controllo prezzi via estensione) ──────────────────────────
create table public.ordini (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  parametri jsonb default '{}'::jsonb,
  stato text not null default 'pending',
  creato_da uuid references auth.users(id),
  creato_il timestamptz default now(),
  preso_in_carico_da uuid references auth.users(id),
  preso_in_carico_il timestamptz,
  completato_il timestamptz,
  risultato jsonb,
  errore_msg text
);

-- ── pending_requests (moderazione: reset pw, cambio username, foto) ──
create table public.pending_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  type text not null check (type = any (array['photo_upload','password_reset','username_change','other'])),
  payload jsonb,
  status text not null default 'pending' check (status = any (array['pending','approved','rejected'])),
  admin_note text,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- ── admin_audit_log / activity_log ────────────────────────────────────
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  action text not null,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  source text not null check (source = any (array['sito','estensione'])),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

create index activity_log_user_idx on public.activity_log (user_id, created_at desc);

-- ── configurazione_app ────────────────────────────────────────────────
create table public.configurazione_app (
  chiave text primary key,
  valore text not null,
  aggiornato_il timestamptz not null default now()
);

-- ── worker_presenza ───────────────────────────────────────────────────
create table public.worker_presenza (
  user_id uuid primary key references auth.users(id),
  nome_worker text,
  ultimo_ping timestamptz default now()
);

-- ── coda_lavoro (tabella REALE dietro la view coda_carte) ─────────────
create table public.coda_lavoro (
  id bigint primary key generated always as identity,
  tipo text not null check (tipo = any (array['aggiungi_carta','aggiungi_wishlist','controlla_prezzi','controlla_prezzi_wishlist'])),
  stato text not null default 'pending' check (stato = any (array['pending','in_corso','completato','errore'])),
  creato_da uuid not null references auth.users(id),
  creato_il timestamptz not null default now(),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  dispositivo text,
  payload jsonb not null default '{}'::jsonb,
  esito jsonb,
  errore_msg text,
  completato_il timestamptz,
  tentativi_falliti integer not null default 0
);

create index idx_coda_lavoro_creato_da on public.coda_lavoro (creato_da);
create index idx_coda_lavoro_stato_creato on public.coda_lavoro (stato, creato_il);

-- ── coda_wishlist (presente nello schema, non usata dal sito web attuale) ──
create table public.coda_wishlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  nome text not null,
  lingua text default 'IT',
  condizione text default 'NM',
  qty integer default 1,
  reverse boolean default false,
  first_ed boolean default false,
  nota text,
  prezzo_obiettivo numeric,
  stato text not null default 'pending',
  creato_il timestamptz default now(),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  completato_il timestamptz,
  errore_msg text,
  location text default 'WISHLIST',
  tipo text,
  dispositivo text
);

-- ── correzioni_manuali_carte + view coda_carte + trigger di traduzione ──
-- Già scritte, verificate e commentate per intero in
-- 11_schema_correzioni_manuali_carte.sql (sezioni 1, 2, 4) — eseguilo
-- subito dopo questo file (12 → 11 → 13 → 14 → 15 → 16).
