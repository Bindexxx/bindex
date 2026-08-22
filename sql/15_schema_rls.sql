-- ============================================================================
-- CardSync Pro — 15: Row Level Security (nomi e condizioni ESATTI da
-- pg_policies sul DB di produzione). Da eseguire dopo 14.
--
-- correzioni_manuali_carte NON è qui: RLS e policy sono già in
-- 11_schema_correzioni_manuali_carte.sql.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.location enable row level security;
alter table public.preferenze_utente enable row level security;
alter table public.carte enable row level security;
alter table public.wishlist enable row level security;
alter table public.binder_carte enable row level security;
alter table public.foto_carte enable row level security;
alter table public.user_media enable row level security;
alter table public.storico_prezzi enable row level security;
alter table public.ordini enable row level security;
alter table public.pending_requests enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.activity_log enable row level security;
alter table public.configurazione_app enable row level security;
alter table public.worker_presenza enable row level security;
alter table public.coda_lavoro enable row level security;
alter table public.coda_wishlist enable row level security;

-- ── activity_log ──────────────────────────────────────────────────────
create policy "admin legge tutto il log attività"
  on public.activity_log for select
  using (is_admin());

create policy "utente crea le proprie voci di log"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- ── admin_audit_log ───────────────────────────────────────────────────
create policy "solo admin legge il log admin"
  on public.admin_audit_log for select
  using (is_admin());

-- ── binder_carte ──────────────────────────────────────────────────────
create policy "utenti gestiscono il proprio binder"
  on public.binder_carte for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── carte ─────────────────────────────────────────────────────────────
create policy "propria collezione"
  on public.carte for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── coda_lavoro ───────────────────────────────────────────────────────
create policy "crea proprie richieste"
  on public.coda_lavoro for insert
  with check (creato_da = auth.uid());

create policy "vede le proprie richieste"
  on public.coda_lavoro for select
  using (creato_da = auth.uid());

-- ── coda_wishlist ─────────────────────────────────────────────────────
create policy "utenti aggiornano la propria coda_wishlist"
  on public.coda_wishlist for update
  to authenticated
  using (auth.uid() = owner_id);

create policy "utenti gestiscono la propria coda_wishlist"
  on public.coda_wishlist for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "utenti inseriscono nella propria coda_wishlist"
  on public.coda_wishlist for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- ── configurazione_app ────────────────────────────────────────────────
create policy "chiunque legge la configurazione"
  on public.configurazione_app for select
  to authenticated
  using (true);

-- ── foto_carte ────────────────────────────────────────────────────────
create policy "utenti gestiscono le foto delle proprie carte"
  on public.foto_carte for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── location ──────────────────────────────────────────────────────────
create policy "proprie location"
  on public.location for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── ordini ────────────────────────────────────────────────────────────
create policy "utenti autenticati possono aggiornare ordini"
  on public.ordini for update
  to authenticated
  using (true);

create policy "utenti autenticati possono creare ordini"
  on public.ordini for insert
  to authenticated
  with check (auth.uid() = creato_da);

create policy "utenti autenticati possono leggere ordini"
  on public.ordini for select
  to authenticated
  using (true);

-- ── pending_requests ──────────────────────────────────────────────────
create policy "admin aggiorna le richieste"
  on public.pending_requests for update
  using (is_admin());

create policy "admin vede tutte le richieste"
  on public.pending_requests for select
  using (is_admin());

create policy "utente crea le proprie richieste"
  on public.pending_requests for insert
  with check (auth.uid() = user_id);

create policy "utente vede le proprie richieste"
  on public.pending_requests for select
  using (auth.uid() = user_id);

-- ── preferenze_utente ─────────────────────────────────────────────────
create policy "utenti gestiscono le proprie preferenze"
  on public.preferenze_utente for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── profiles ──────────────────────────────────────────────────────────
create policy "admin modifica i profili"
  on public.profiles for update
  using (is_admin());

create policy "admin vede tutti i profili"
  on public.profiles for select
  using (is_admin());

create policy "utente vede il proprio profilo"
  on public.profiles for select
  using (auth.uid() = id);

-- ── storico_prezzi ────────────────────────────────────────────────────
create policy "utenti leggono il proprio storico prezzi"
  on public.storico_prezzi for select
  to authenticated
  using (auth.uid() = owner_id);

-- ── user_media ────────────────────────────────────────────────────────
create policy "admin aggiorna tutti i media"
  on public.user_media for update
  using (is_admin());

create policy "admin vede tutti i media"
  on public.user_media for select
  using (is_admin());

create policy "utente aggiorna sempre i propri media"
  on public.user_media for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "utente crea/aggiorna i propri media"
  on public.user_media for insert
  with check (auth.uid() = user_id);

create policy "utente vede i propri media"
  on public.user_media for select
  using (auth.uid() = user_id);

-- ── wishlist ──────────────────────────────────────────────────────────
create policy "utenti aggiornano la propria wishlist"
  on public.wishlist for update
  to authenticated
  using (auth.uid() = owner_id);

create policy "utenti eliminano dalla propria wishlist"
  on public.wishlist for delete
  to authenticated
  using (auth.uid() = owner_id);

create policy "utenti inseriscono nella propria wishlist"
  on public.wishlist for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "utenti leggono la propria wishlist"
  on public.wishlist for select
  to authenticated
  using (auth.uid() = owner_id);

-- ── worker_presenza ───────────────────────────────────────────────────
create policy "propria presenza"
  on public.worker_presenza for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
