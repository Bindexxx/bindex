-- ═══════════════════════════════════════════════════════════════════════
-- sql/66_set_masterset.sql
-- Widget SET — masterset (2026-09-20)
--
-- COSA AGGIUNGE (4 tabelle nuove + 1 funzione di sola lettura)
--   set_carte              catalogo per carta/variante, caricato A MANO da
--                          Claudio (dashboard → Table Editor → Import CSV).
--                          Lettura per tutti, scrittura solo admin.
--   set_nascosti           set che l'utente ha nascosto (per-utente).
--   set_carte_ignorate     carte che l'utente esclude dal proprio masterset
--                          (es. promo stampino Pokémon Center) (per-utente).
--   set_soglie_notificate  soglie 25/50/75/90/99/100% già raggiunte per set
--                          (per-utente) + marcatore "set già valutato"
--                          (soglia = 0) + stato "vista" per la pallina.
--   set_carte_conteggi()   quante carte ha il catalogo per ogni set (una
--                          sola query da ~200 righe invece di scaricare
--                          tutto il catalogo).
--
-- VERIFICHE FATTE PRIMA DI SCRIVERE (Regola d'Oro #3), sul DB reale:
--   1. information_schema.columns → nessuna tabella catalogo per carta
--      preesistente; l'unica tabella "set" è set_espansioni (200 righe,
--      ultimo aggiornamento 2026-08-31).
--   2. pg_policies su set_espansioni → SELECT {anon,authenticated} true +
--      3 policy di scrittura {authenticated} con is_admin(): replicate
--      identiche su set_carte (stesso modello, già in produzione).
--   3. pg_policies su wishlist → 4 policy {authenticated} con
--      auth.uid() = owner_id: replicate identiche sulle 3 tabelle
--      per-utente qui sotto.
--   4. information_schema.triggers su carte → solo trg_carte_updated_at,
--      trg_storico_prezzo_carte, trg_traccia_prezzo_precedente: nessun
--      trigger mio, nessuna interferenza. Nessuna policy/funzione
--      esistente viene modificata da questo file.
--
-- NON FA (deciso con Claudio)
--   - Nessuna email (rimandata, non risulta implementata).
--   - Nessun collegamento col widget Match.
--   - Nessun trigger: le soglie le rileva il client e le scrive qui.
--
-- FORMATO DEL CATALOGO (set_carte) — una riga per carta E per variante
--   sigla     = la stessa di set_espansioni (es. ASC, SCR, CRZ-GG)
--   numero    = intero (i sottoinsiemi con numerazione propria hanno la
--               propria sigla: BRS-TG, CRZ-GG, ...)
--   variante  = testo libero in minuscolo. Valori riconosciuti dal sito
--               per abbinare le carte possedute:
--                 normale  → carta non reverse
--                 reverse  → reverse holo
--                 ball     → tutte le X-sigle (Poké Ball E Master Ball,
--                            non distinguibili oggi: vedi nota sotto)
--                 stampata → bustina premio (PPS...)
--                 halloween→ Trick or Trade (BOO...)
--               Una variante con un altro nome si carica lo stesso, ma
--               nessuna carta posseduta la soddisferà finché non si
--               decide come riconoscerla.
--   nome, rarita, immagine = facoltativi (immagine = URL; se manca, per
--               le carte possedute si usa l'immagine della carta).
-- NOTA MASTER BALL: oggi il DB non distingue Poké Ball da Master Ball
-- (stesso prefisso X, reverse_holo sempre false). Finché non si decide,
-- nel catalogo usare UNA sola variante 'ball' per numero.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. CATALOGO PER CARTA ──────────────────────────────────────────────
-- FK verso set_espansioni: un refuso nella sigla dà errore subito in
-- import invece di creare righe orfane che nessuno vedrà mai.
create table if not exists public.set_carte (
    sigla          text    not null references public.set_espansioni(sigla)
                           on update cascade on delete cascade,
    numero         integer not null check (numero > 0),
    variante       text    not null default 'normale',
    nome           text,
    rarita         text,
    immagine       text,
    aggiornato_il  timestamptz not null default now(),
    primary key (sigla, numero, variante)
);

comment on table public.set_carte is
    'Catalogo per carta e variante, caricato a mano. Il completamento (masterset) di un set è il 100% delle righe di questa tabella per quella sigla, meno le carte che l''utente ha ignorato.';

alter table public.set_carte enable row level security;

drop policy if exists "chiunque legge il catalogo set" on public.set_carte;
create policy "chiunque legge il catalogo set"
    on public.set_carte for select
    to anon, authenticated
    using (true);

drop policy if exists "admin inserisce nel catalogo set" on public.set_carte;
create policy "admin inserisce nel catalogo set"
    on public.set_carte for insert
    to authenticated
    with check (is_admin());

drop policy if exists "admin aggiorna il catalogo set" on public.set_carte;
create policy "admin aggiorna il catalogo set"
    on public.set_carte for update
    to authenticated
    using (is_admin())
    with check (is_admin());

drop policy if exists "admin elimina dal catalogo set" on public.set_carte;
create policy "admin elimina dal catalogo set"
    on public.set_carte for delete
    to authenticated
    using (is_admin());


-- ── 2. SET NASCOSTI (per-utente) ───────────────────────────────────────
-- on delete cascade su auth.users: senza, admin_hard_delete_user
-- fallirebbe sull'utente che ha righe qui.
create table if not exists public.set_nascosti (
    owner_id    uuid not null default auth.uid()
                     references auth.users(id) on delete cascade,
    sigla       text not null,
    creato_il   timestamptz not null default now(),
    primary key (owner_id, sigla)
);

alter table public.set_nascosti enable row level security;
revoke all on public.set_nascosti from anon;

drop policy if exists "utenti leggono i propri set nascosti" on public.set_nascosti;
create policy "utenti leggono i propri set nascosti"
    on public.set_nascosti for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti inseriscono i propri set nascosti" on public.set_nascosti;
create policy "utenti inseriscono i propri set nascosti"
    on public.set_nascosti for insert to authenticated
    with check (auth.uid() = owner_id);

drop policy if exists "utenti aggiornano i propri set nascosti" on public.set_nascosti;
create policy "utenti aggiornano i propri set nascosti"
    on public.set_nascosti for update to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti eliminano i propri set nascosti" on public.set_nascosti;
create policy "utenti eliminano i propri set nascosti"
    on public.set_nascosti for delete to authenticated
    using (auth.uid() = owner_id);


-- ── 3. CARTE IGNORATE DAL MASTERSET (per-utente) ───────────────────────
create table if not exists public.set_carte_ignorate (
    owner_id    uuid    not null default auth.uid()
                        references auth.users(id) on delete cascade,
    sigla       text    not null,
    numero      integer not null,
    variante    text    not null default 'normale',
    creato_il   timestamptz not null default now(),
    primary key (owner_id, sigla, numero, variante)
);

alter table public.set_carte_ignorate enable row level security;
revoke all on public.set_carte_ignorate from anon;

drop policy if exists "utenti leggono le proprie carte ignorate" on public.set_carte_ignorate;
create policy "utenti leggono le proprie carte ignorate"
    on public.set_carte_ignorate for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti inseriscono le proprie carte ignorate" on public.set_carte_ignorate;
create policy "utenti inseriscono le proprie carte ignorate"
    on public.set_carte_ignorate for insert to authenticated
    with check (auth.uid() = owner_id);

drop policy if exists "utenti aggiornano le proprie carte ignorate" on public.set_carte_ignorate;
create policy "utenti aggiornano le proprie carte ignorate"
    on public.set_carte_ignorate for update to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti eliminano le proprie carte ignorate" on public.set_carte_ignorate;
create policy "utenti eliminano le proprie carte ignorate"
    on public.set_carte_ignorate for delete to authenticated
    using (auth.uid() = owner_id);


-- ── 4. SOGLIE RAGGIUNTE (per-utente) ───────────────────────────────────
-- soglia = 0        → marcatore "questo set è già stato valutato per
--                     questo utente" (la prima valutazione è silenziosa,
--                     niente raffica di notifiche per ciò che si possiede
--                     già).
-- soglia 25..100    → soglia raggiunta. Una sola volta per set, mai
--                     ripetuta anche se la % scende e risale.
-- vista_il null     → notifica non ancora vista: la pallina in home
--                     mostra la più recente finché non si apre la pagina
--                     Set o non ne arriva una più recente.
create table if not exists public.set_soglie_notificate (
    owner_id      uuid     not null default auth.uid()
                           references auth.users(id) on delete cascade,
    sigla         text     not null,
    soglia        smallint not null check (soglia in (0, 25, 50, 75, 90, 99, 100)),
    raggiunta_il  timestamptz not null default now(),
    vista_il      timestamptz,
    primary key (owner_id, sigla, soglia)
);

alter table public.set_soglie_notificate enable row level security;
revoke all on public.set_soglie_notificate from anon;

drop policy if exists "utenti leggono le proprie soglie set" on public.set_soglie_notificate;
create policy "utenti leggono le proprie soglie set"
    on public.set_soglie_notificate for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti inseriscono le proprie soglie set" on public.set_soglie_notificate;
create policy "utenti inseriscono le proprie soglie set"
    on public.set_soglie_notificate for insert to authenticated
    with check (auth.uid() = owner_id);

drop policy if exists "utenti aggiornano le proprie soglie set" on public.set_soglie_notificate;
create policy "utenti aggiornano le proprie soglie set"
    on public.set_soglie_notificate for update to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "utenti eliminano le proprie soglie set" on public.set_soglie_notificate;
create policy "utenti eliminano le proprie soglie set"
    on public.set_soglie_notificate for delete to authenticated
    using (auth.uid() = owner_id);


-- ── 5. CONTEGGI DEL CATALOGO (sola lettura) ────────────────────────────
-- SECURITY INVOKER (default): vale la RLS di set_carte, che è pubblica in
-- lettura. Niente SECURITY DEFINER, niente da auditare.
create or replace function public.set_carte_conteggi()
returns table (sigla text, carte integer)
language sql
stable
set search_path to 'public'
as $$
    select c.sigla, count(*)::integer
    from public.set_carte c
    group by c.sigla;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICA DOPO L'ESECUZIONE (incollami l'output):
--
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where tablename in ('set_carte','set_nascosti','set_carte_ignorate','set_soglie_notificate')
--   order by tablename, policyname;
--   → attese: set_carte 4 policy (SELECT {anon,authenticated} + 3 admin);
--     le altre 3 tabelle 4 policy ciascuna, tutte {authenticated}.
--
--   select * from public.set_carte_conteggi();
--   → vuota finché non carichi il catalogo, senza errori.
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'set_nascosti';
--   → nessuna riga per anon.
--
-- CARICAMENTO CATALOGO DI PROVA (da SQL Editor, ruolo postgres):
--   insert into public.set_carte (sigla, numero, variante, nome) values
--     ('ASC', 1, 'normale', 'Oddish di Erika'),
--     ('ASC', 1, 'reverse', 'Oddish di Erika'),
--     ('ASC', 1, 'ball',    'Oddish di Erika');
--   Per l'import massivo: Table Editor → set_carte → Insert → Import
--   data from CSV, colonne: sigla,numero,variante,nome,rarita,immagine
--   (vedi set_carte_template.csv).
--
-- ROLLBACK (in quest'ordine):
--   drop function if exists public.set_carte_conteggi();
--   drop table if exists public.set_soglie_notificate;
--   drop table if exists public.set_carte_ignorate;
--   drop table if exists public.set_nascosti;
--   drop table if exists public.set_carte;
-- ═══════════════════════════════════════════════════════════════════════
