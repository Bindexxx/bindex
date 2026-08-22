-- ============================================================================
-- CardSync Pro — Fase "worker autonomo + correzione manuale per-utente"
-- Sessione: 21/08/2026 — VERSIONE DEFINITIVA (corretta dopo verifica diretta
-- sul DB reale, regola d'oro #3). Rispetto alla prima stesura sono stati
-- corretti 3 problemi scoperti solo verificando lo schema reale:
--
-- 1) coda_carte.id è bigint, non uuid (corretto ovunque: RPC + colonna FK).
-- 2) coda_carte NON è una tabella, è una VIEW su coda_lavoro (payload jsonb),
--    con 3 trigger INSTEAD OF (insert/update/delete) che fanno da
--    traduttore. La colonna nuova va aggiunta alla tabella REALE
--    (coda_lavoro), poi esposta nella view.
-- 3) Il trigger _coda_carte_view_update() aveva un elenco SET cablato che
--    NON includeva tentativi_falliti — un update da background.js sarebbe
--    passato senza errori ma senza scrivere nulla (bug silenzioso: il
--    contatore non sarebbe mai salito, la soglia di 3 tentativi non sarebbe
--    mai scattata). Corretto aggiungendo il campo al SET.
--
-- NOTA APERTA (non risolta qui, file diverso): il flusso manuale in
-- aggiungi_carta_popup.js (contrassegnaEsitoERimuovi, riga ~1125) in caso di
-- errore scrive ancora stato='errore' direttamente su coda_carte, MAI la RPC
-- sposta_riga_in_correzione_manuale — le righe fallite da lì restano
-- invisibili sul sito dopo questa migration, perché index.html ora legge
-- solo da correzioni_manuali_carte. Da affrontare in una sessione dedicata,
-- decisione di Claudio su come gestirlo prima di scrivere codice.
--
-- Da eseguire in Supabase: Dashboard > SQL Editor > New query, tutto il
-- blocco in un colpo solo (istruzioni idempotenti, sicuro rilanciarlo).
-- ============================================================================

-- 1) Contatore tentativi falliti — va sulla tabella REALE coda_lavoro,
--    non su coda_carte (che è solo una view).
alter table public.coda_lavoro
  add column if not exists tentativi_falliti int not null default 0;

-- 2) Ricrea la view coda_carte per esporre la nuova colonna. Identica alla
--    definizione originale (verificata via pg_views), con la sola aggiunta
--    di "tentativi_falliti" in fondo alla select list.
create or replace view public.coda_carte as
 select id,
    (payload ->> 'nome'::text) as nome,
    coalesce((payload ->> 'lingua'::text), 'IT'::text) as lingua,
    coalesce((payload ->> 'condizione'::text), 'NM'::text) as condizione,
    coalesce(((payload ->> 'qty'::text))::integer, 1) as qty,
    coalesce(((payload ->> 'reverse'::text))::boolean, false) as reverse,
    coalesce(((payload ->> 'first_ed'::text))::boolean, false) as first_ed,
    (payload ->> 'nota'::text) as nota,
    (payload ->> 'location'::text) as location,
    (payload ->> 'url_diretto'::text) as url_diretto,
    (payload ->> 'tipo_prodotto'::text) as tipo,
    coalesce((payload ->> 'destinazione'::text), 'collezione'::text) as destinazione,
    (nullif((payload ->> 'prezzo_obiettivo'::text), ''::text))::numeric as prezzo_obiettivo,
    stato,
    creato_da as owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    (esito -> 'opzioni_disambiguazione'::text) as opzioni_disambiguazione,
    tentativi_falliti
   from coda_lavoro
  where (tipo = any (array['aggiungi_carta'::text, 'aggiungi_wishlist'::text]));

-- 3) Estende il trigger INSTEAD OF UPDATE esistente per scrivere davvero
--    tentativi_falliti (prima veniva silenziosamente ignorato). Nessun'altra
--    riga toccata rispetto alla funzione originale — solo aggiunta la riga
--    "tentativi_falliti = coalesce(...)", stesso pattern già in uso per
--    "stato" nella stessa funzione (non tocca i chiamanti esistenti che non
--    passano questo campo, es. aggiungi_carta_popup.js: coalesce mantiene il
--    valore attuale se new.tentativi_falliti è null).
create or replace function public._coda_carte_view_update()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
  update coda_lavoro set
    stato          = coalesce(new.stato, stato),
    errore_msg     = new.errore_msg,
    claimed_by     = new.claimed_by,
    claimed_at     = new.claimed_at,
    completato_il  = new.completato_il,
    tentativi_falliti = coalesce(new.tentativi_falliti, tentativi_falliti),
    esito          = case when new.opzioni_disambiguazione is not null
                          then jsonb_build_object('opzioni_disambiguazione', new.opzioni_disambiguazione)
                          else esito end,
    payload        = payload || jsonb_strip_nulls(jsonb_build_object('nome', new.nome, 'url_diretto', new.url_diretto))
  where id = old.id;
  return new;
end;
$function$;

-- 4) Tabella per le righe che richiedono intervento manuale.
--    owner_id = SEMPRE il vero richiedente originale, copiato da
--    coda_carte.owner_id al momento dello spostamento (mai chi la stava
--    processando).
--    coda_carte_id_originale: bigint, NON uuid (coda_lavoro.id è bigint).
create table if not exists public.correzioni_manuali_carte (
  id uuid primary key default gen_random_uuid(),
  coda_carte_id_originale bigint,
  owner_id uuid not null references auth.users(id) on delete cascade,
  nome text,
  lingua text,
  condizione text,
  qty int,
  reverse boolean default false,
  first_ed boolean default false,
  nota text,
  location text,
  tipo text,
  destinazione text default 'collezione',
  prezzo_obiettivo numeric,
  url_diretto text,
  opzioni_disambiguazione jsonb,
  errore_msg text,
  tentativi_falliti int default 0,
  creato_il timestamptz not null default now()
);

create index if not exists idx_correzioni_manuali_owner
  on public.correzioni_manuali_carte (owner_id);

alter table public.correzioni_manuali_carte enable row level security;

-- Solo il proprietario vede/gestisce le proprie righe — stesso pattern
-- owner_id = auth.uid() già in uso su coda_carte.
create policy "owner legge le proprie correzioni manuali"
  on public.correzioni_manuali_carte for select
  using (owner_id = auth.uid());

create policy "owner elimina le proprie correzioni manuali"
  on public.correzioni_manuali_carte for delete
  using (owner_id = auth.uid());

-- Insert diretto consentito SOLO quando il proprietario coincide con chi
-- esegue l'operazione (caso raro ma possibile: A sta correggendo le PROPRIE
-- carte in prima persona con l'estensione aperta e finiscono comunque in
-- correzione). Il caso normale — Bill sposta una carta di A — passa SEMPRE
-- dalla RPC del punto 5 (SECURITY DEFINER, bypassa questa policy).
create policy "owner inserisce le proprie correzioni manuali"
  on public.correzioni_manuali_carte for insert
  with check (owner_id = auth.uid());

grant select, insert, delete on public.correzioni_manuali_carte to authenticated;

-- 5) RPC per spostare una riga da coda_carte a correzioni_manuali_carte.
--    Serve SECURITY DEFINER perché chi la chiama (es. il worker autonomo sul
--    PC di Bill) quasi mai coincide col proprietario originale.
--    p_riga_id: bigint, NON uuid (coda_lavoro.id è bigint).
create or replace function public.sposta_riga_in_correzione_manuale(
  p_riga_id bigint,
  p_errore_msg text,
  p_opzioni jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga public.coda_carte%rowtype;
  v_nuovo_id uuid;
begin
  select * into v_riga from public.coda_carte where id = p_riga_id;
  if not found then
    raise exception 'Riga coda_carte % non trovata (già spostata o eliminata?)', p_riga_id;
  end if;

  insert into public.correzioni_manuali_carte (
    coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
    reverse, first_ed, nota, location, tipo, destinazione,
    prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg,
    tentativi_falliti
  ) values (
    v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
    v_riga.reverse, v_riga.first_ed, v_riga.nota, v_riga.location, v_riga.tipo, v_riga.destinazione,
    v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
    v_riga.tentativi_falliti
  )
  returning id into v_nuovo_id;

  delete from public.coda_carte where id = p_riga_id;

  return v_nuovo_id;
end;
$$;

grant execute on function public.sposta_riga_in_correzione_manuale(bigint, text, jsonb) to authenticated;

-- ============================================================================
-- ROLLBACK (se qualcosa non va, esegui questo per tornare indietro, in
-- questo ordine):
--
-- drop function if exists public.sposta_riga_in_correzione_manuale(bigint, text, jsonb);
-- drop table if exists public.correzioni_manuali_carte;
--
-- -- Ripristina il trigger update originale (senza tentativi_falliti):
-- create or replace function public._coda_carte_view_update()
--  returns trigger
--  language plpgsql
--  security definer
-- as $function$
-- begin
--   update coda_lavoro set
--     stato          = coalesce(new.stato, stato),
--     errore_msg     = new.errore_msg,
--     claimed_by     = new.claimed_by,
--     claimed_at     = new.claimed_at,
--     completato_il  = new.completato_il,
--     esito          = case when new.opzioni_disambiguazione is not null
--                           then jsonb_build_object('opzioni_disambiguazione', new.opzioni_disambiguazione)
--                           else esito end,
--     payload        = payload || jsonb_strip_nulls(jsonb_build_object('nome', new.nome, 'url_diretto', new.url_diretto))
--   where id = old.id;
--   return new;
-- end;
-- $function$;
--
-- -- Ripristina la view originale (senza tentativi_falliti):
-- create or replace view public.coda_carte as
--  select id,
--     (payload ->> 'nome'::text) as nome,
--     coalesce((payload ->> 'lingua'::text), 'IT'::text) as lingua,
--     coalesce((payload ->> 'condizione'::text), 'NM'::text) as condizione,
--     coalesce(((payload ->> 'qty'::text))::integer, 1) as qty,
--     coalesce(((payload ->> 'reverse'::text))::boolean, false) as reverse,
--     coalesce(((payload ->> 'first_ed'::text))::boolean, false) as first_ed,
--     (payload ->> 'nota'::text) as nota,
--     (payload ->> 'location'::text) as location,
--     (payload ->> 'url_diretto'::text) as url_diretto,
--     (payload ->> 'tipo_prodotto'::text) as tipo,
--     coalesce((payload ->> 'destinazione'::text), 'collezione'::text) as destinazione,
--     (nullif((payload ->> 'prezzo_obiettivo'::text), ''::text))::numeric as prezzo_obiettivo,
--     stato,
--     creato_da as owner_id,
--     creato_il,
--     claimed_by,
--     claimed_at,
--     dispositivo,
--     errore_msg,
--     completato_il,
--     (esito -> 'opzioni_disambiguazione'::text) as opzioni_disambiguazione
--    from coda_lavoro
--   where (tipo = any (array['aggiungi_carta'::text, 'aggiungi_wishlist'::text]));
--
-- alter table public.coda_lavoro drop column if exists tentativi_falliti;
-- ============================================================================
