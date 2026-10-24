-- ============================================================================
-- 118 — CONTROLLO PREZZI WISHLIST DI GRUPPO (estensione 5.37)
-- Piano 2026-10-23, Fase 2 (B1). Decisione di Claudio Q3: gli ordini
-- "controlla prezzi wishlist" li lavora tutto il gruppo, come le carte.
--
-- Letto sul DB LIVE il 2026-10-24 (information_schema, pg_policies,
-- pg_get_functiondef, triggers, pg_indexes, pg_publication_tables):
-- - wishlist: nessuna colonna di prenotazione. 4 policy, tutte "solo il
--   proprietario" (SELECT/INSERT/UPDATE/DELETE): oggi un PC di un altro non
--   può né leggerla né scriverla. Infatti l'ordine di Francesco del 16/10,
--   preso dal PC di Ire, ha controllato la wishlist di Ire (0 righe) e le 637
--   righe di Francesco hanno ultimo_controllo vuoto.
-- - Trigger su wishlist: trg_traccia_prezzo_precedente_wishlist e
--   trg_storico_prezzo_wishlist, scattano SOLO se il prezzo cambia → le
--   prenotazioni qui sotto non creano storico. wishlist è in
--   supabase_realtime (come carte): il proprietario vede le prenotazioni,
--   come già succede per le carte.
-- - Nessuna vista e nessuna funzione "setof wishlist": aggiungere colonne non
--   cambia nulla per il sito.
-- - Ordine wishlist dal sito (ui/prices.ui.js): { tipo:
--   'controlla_prezzi_wishlist', creato_da }. Il proprietario della wishlist
--   da controllare è creato_da, letto qui dal DB, MAI passato dal client.
-- - Modello copiato: reclama_carte_per_controllo_prezzi (FOR UPDATE SKIP
--   LOCKED, prenotazione di 10 minuti, ultimo_controllo asc nulls first),
--   aggiorna_prezzo/url_controllo_gruppo e segna_controllata_gruppo (sql/111:
--   solo righe prenotate da chi chiama o proprie), rilascia/tagga.
--
-- COSA FA
-- 1. wishlist + claimed_by, claimed_at, dispositivo (vuote).
-- 2. 7 funzioni SECURITY DEFINER per il controllo prezzi wishlist di gruppo.
--    Senza utente loggato non fanno nulla.
-- 3. Permessi: solo authenticated (sezione 3, REVOKE: la esegue Claudio).
--
-- Nessuna riga esistente cambia. Ritorno indietro: 118_..._ROLLBACK.sql.
-- ============================================================================

-- ── 1. COLONNE DI PRENOTAZIONE ───────────────────────────────────────────────
alter table public.wishlist add column if not exists claimed_by uuid;
alter table public.wishlist add column if not exists claimed_at timestamptz;
alter table public.wishlist add column if not exists dispositivo text;

-- ── 2. FUNZIONI ──────────────────────────────────────────────────────────────
-- Righe controllabili: quelle con un link /Singles/ (come faceva il vecchio
-- controllo wishlist dell'estensione). Proprietario: chi ha creato l'ordine
-- (ordine 'controlla_prezzi_wishlist' ancora in corso); senza ordine, la
-- propria wishlist.
-- Con un ordine, una riga già controllata da quando l'ordine è partito
-- (ultimo_controllo >= preso_in_carico_il) non conta e non si prenota più:
-- con due PC sullo stesso ordine ("mi unisco") ogni riga si controlla una
-- volta sola e la sessione finisce quando non resta niente. Senza questo,
-- ognuno dei due PC faceva un giro completo (righe controllate due volte).

create or replace function public.conta_wishlist_da_controllare_gruppo(p_ordine_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_inizio timestamptz; -- inizio dell'ordine (null senza ordine)
begin
  if v_uid is null then
    return 0;
  end if;
  if p_ordine_id is null then
    v_owner := v_uid;
  else
    select o.creato_da, coalesce(o.preso_in_carico_il, o.creato_il) into v_owner, v_inizio
      from ordini o
     where o.id = p_ordine_id and o.tipo = 'controlla_prezzi_wishlist' and o.stato = 'in_corso';
    if v_owner is null then
      return 0;
    end if;
  end if;
  return (select count(*)::integer from wishlist w
           where w.owner_id = v_owner and w.url like '%/Singles/%'
             and (v_inizio is null or w.ultimo_controllo is null or w.ultimo_controllo < v_inizio));
end;
$function$;

create or replace function public.reclama_wishlist_per_controllo_prezzi(p_ordine_id uuid default null, p_lotto_size integer default 3)
returns table (id uuid, owner_id uuid, nome text, codice text, url text, lingua text, condizione text, prezzo numeric, ultimo_controllo timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_inizio timestamptz; -- inizio dell'ordine (null senza ordine)
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_lotto integer := least(greatest(coalesce(p_lotto_size, 3), 1), 10);
begin
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if p_ordine_id is null then
    v_owner := v_uid;
  else
    select o.creato_da, coalesce(o.preso_in_carico_il, o.creato_il) into v_owner, v_inizio
      from ordini o
     where o.id = p_ordine_id and o.tipo = 'controlla_prezzi_wishlist' and o.stato = 'in_corso';
    if v_owner is null then
      return; -- ordine non più in corso (finito, annullato) o non wishlist: niente
    end if;
  end if;

  return query
  with reclamate as (
    update wishlist w
       set claimed_by = v_uid, claimed_at = now()
     where w.id in (
       select k.id from wishlist k
        where k.owner_id = v_owner
          and k.url like '%/Singles/%'
          and (v_inizio is null or k.ultimo_controllo is null or k.ultimo_controllo < v_inizio)
          and (k.claimed_by is null or k.claimed_by = v_uid or k.claimed_at < v_soglia_claim)
        order by k.ultimo_controllo asc nulls first
        limit v_lotto
        for update skip locked
     )
    returning w.id, w.owner_id, w.nome, w.codice, w.url, w.lingua, w.condizione, w.prezzo, w.ultimo_controllo
  )
  select r.id, r.owner_id, r.nome, r.codice, r.url, r.lingua, r.condizione, r.prezzo, r.ultimo_controllo
    from reclamate r;
end;
$function$;

create or replace function public.tagga_dispositivo_claim_gruppo_wishlist(p_ids uuid[], p_dispositivo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;
  update wishlist
     set dispositivo = p_dispositivo
   where id = any(p_ids)
     and claimed_by = auth.uid();
end;
$function$;

create or replace function public.rilascia_claim_controllo_prezzi_wishlist(p_dispositivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;
  update wishlist
     set claimed_by = null, claimed_at = null, dispositivo = null
   where claimed_by = auth.uid()
     and (p_dispositivo is null or dispositivo = p_dispositivo);
end;
$function$;

-- Prezzo: solo su righe prenotate da chi chiama o proprie (come sql/111).
-- Nessun movimento in movimenti_collezione (la wishlist non è collezione):
-- storico e prezzo_precedente li scrivono già i trigger se il prezzo cambia.
create or replace function public.aggiorna_prezzo_controllo_gruppo_wishlist(p_id uuid, p_prezzo numeric, p_immagine text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;
  update wishlist
     set prezzo = p_prezzo,
         ultimo_controllo = now(),
         immagine = coalesce(p_immagine, immagine)
   where id = p_id
     and (claimed_by = auth.uid() or owner_id = auth.uid());
end;
$function$;

-- Link: stesso controllo di aggiorna_url_controllo_gruppo (solo Cardmarket).
create or replace function public.aggiorna_url_controllo_gruppo_wishlist(p_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;
  if not (p_url is null or p_url in ('', '#') or (p_url ~ '^https://(www\.)?cardmarket\.com/' and p_url !~ '[[:space:]"<>'']')) then
    raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
  end if;
  update wishlist
     set url = p_url
   where id = p_id
     and (claimed_by = auth.uid() or owner_id = auth.uid());
end;
$function$;

create or replace function public.segna_controllata_gruppo_wishlist(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return;
  end if;
  update wishlist
     set ultimo_controllo = now()
   where id = p_id
     and (claimed_by = auth.uid() or owner_id = auth.uid());
end;
$function$;

-- ── 3. PERMESSI (REVOKE: da eseguire a mano, il connettore li annulla) ───────
-- Come annulla_ordine (sql/115): niente anon, solo authenticated.
revoke execute on function public.conta_wishlist_da_controllare_gruppo(uuid) from public, anon;
revoke execute on function public.reclama_wishlist_per_controllo_prezzi(uuid, integer) from public, anon;
revoke execute on function public.tagga_dispositivo_claim_gruppo_wishlist(uuid[], text) from public, anon;
revoke execute on function public.rilascia_claim_controllo_prezzi_wishlist(text) from public, anon;
revoke execute on function public.aggiorna_prezzo_controllo_gruppo_wishlist(uuid, numeric, text) from public, anon;
revoke execute on function public.aggiorna_url_controllo_gruppo_wishlist(uuid, text) from public, anon;
revoke execute on function public.segna_controllata_gruppo_wishlist(uuid) from public, anon;
grant execute on function public.conta_wishlist_da_controllare_gruppo(uuid) to authenticated, service_role;
grant execute on function public.reclama_wishlist_per_controllo_prezzi(uuid, integer) to authenticated, service_role;
grant execute on function public.tagga_dispositivo_claim_gruppo_wishlist(uuid[], text) to authenticated, service_role;
grant execute on function public.rilascia_claim_controllo_prezzi_wishlist(text) to authenticated, service_role;
grant execute on function public.aggiorna_prezzo_controllo_gruppo_wishlist(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.aggiorna_url_controllo_gruppo_wishlist(uuid, text) to authenticated, service_role;
grant execute on function public.segna_controllata_gruppo_wishlist(uuid) to authenticated, service_role;
