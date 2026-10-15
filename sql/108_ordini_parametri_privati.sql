-- ============================================================================
-- 108 — LOCATION DEGLI ORDINI DI CONTROLLO PREZZI IN UNA TABELLA PRIVATA
-- (punto 26 dell'audit estensione 2026-10-14; decisione di Claudio 2026-10-15)
--
-- Letto sul DB LIVE il 2026-10-15 (information_schema, pg_policies,
-- pg_get_functiondef, pg_proc.proacl):
-- - ordini: RLS attiva, SELECT "using true" per authenticated → chiunque del
--   gruppo legge ordini.parametri.locations, cioè i NOMI delle location di
--   chi ha chiesto il controllo. 9 ordini controlla_prezzi, 8 con location.
-- - Nessuna vista, funzione (tranne admin_hard_delete_user, che tocca solo
--   creato_da/preso_in_carico_da) o trigger usa ordini.parametri.
-- - reclama_carte_per_controllo_prezzi / conta_carte_da_controllare_gruppo
--   (versione sql/105) ricevono i nomi delle location dal client: per
--   eseguire l'ordine di un altro, l'estensione doveva conoscerli.
-- - Permessi attuali di entrambe: EXECUTE solo a postgres, authenticated,
--   service_role (ripristinati uguali qui sotto).
-- - Gli ordini sealed portano id di scaffale (uuid): gli scaffali li legge
--   solo il proprietario, quindi dagli id non si risale ai nomi → invariati.
--
-- COSA FA
-- 1. Tabella ordini_parametri_privati (ordine_id, owner_id, locations): la
--    legge SOLO il proprietario; nessuno la scrive direttamente.
-- 2. crea_ordine_controllo_prezzi(locations, aiutaGruppo): crea l'ordine e la
--    riga privata insieme (in ordini.parametri resta solo aiutaGruppo).
-- 3. reclama_carte_per_controllo_prezzi e conta_carte_da_controllare_gruppo
--    hanno un parametro in più, p_ordine_id: se l'ordine ha la riga privata,
--    proprietario e location li leggono da lì (chi esegue riceve le carte,
--    mai i nomi). Solo per ordini controlla_prezzi ancora 'in_corso':
--    altrimenti nessuna carta / 0. Senza p_ordine_id, o per ordini senza riga
--    privata (creati dal sito vecchio), tutto come in sql/105.
--    Cambiare gli argomenti richiede DROP + CREATE (con CREATE OR REPLACE
--    nascerebbe una seconda versione della funzione e le chiamate
--    diventerebbero ambigue). Le chiamate dell'estensione 5.18/5.19, che non
--    passano p_ordine_id, continuano a funzionare.
-- 4. Le location degli ordini esistenti passano nella tabella privata e
--    vengono tolte da ordini.parametri.
--
-- QUANDO: PRIMA di unire la PR del punto 26 (estensione 5.20 + sito): è
-- compatibile con il sito attuale e con la 5.18/5.19. Dopo la pubblicazione:
-- sql/109 (versione_minima 5.20 + pulizia + vincolo).
--
-- Contiene DROP e REVOKE: da eseguire nell'SQL editor di Supabase.
-- PER ANNULLARE: sql/108_ordini_parametri_privati_ROLLBACK.sql
-- (se è già stato eseguito sql/109, prima il suo ROLLBACK).
-- ============================================================================

-- ── 1. TABELLA PRIVATA ─────────────────────────────────────────────────────
create table public.ordini_parametri_privati (
  ordine_id uuid primary key references public.ordini(id) on delete cascade,
  owner_id  uuid not null references auth.users(id) on delete cascade,
  locations text[] not null default '{}'::text[],
  creato_il timestamptz not null default now()
);
comment on table public.ordini_parametri_privati is
  'sql/108 (punto 26): location scelte per un ordine controlla_prezzi. Le legge solo il proprietario; le funzioni di controllo prezzi le usano lato DB tramite p_ordine_id.';

create index ordini_parametri_privati_owner_id_idx on public.ordini_parametri_privati (owner_id);

alter table public.ordini_parametri_privati enable row level security;

create policy "proprietario legge i propri parametri privati"
  on public.ordini_parametri_privati
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Nessuna scrittura diretta: si scrive solo da crea_ordine_controllo_prezzi.
revoke all on table public.ordini_parametri_privati from anon, authenticated;
grant select on table public.ordini_parametri_privati to authenticated;

-- ── 2. CREAZIONE ORDINE ────────────────────────────────────────────────────
create or replace function public.crea_ordine_controllo_prezzi(
  p_locations text[] default null::text[],
  p_aiuta_gruppo boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_locations text[];
  v_id uuid;
begin
  -- sql/108 (punto 26): ordine + location private in un colpo solo.
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;

  -- Location ripulite: niente vuoti, niente doppioni. Nessuna = tutte.
  select coalesce(array_agg(distinct l order by l), '{}'::text[]) into v_locations
  from unnest(coalesce(p_locations, '{}'::text[])) as l
  where l is not null and btrim(l) <> '';
  if coalesce(array_length(v_locations, 1), 0) > 200 then
    raise exception 'TROPPE_LOCATION';
  end if;
  if exists (select 1 from unnest(v_locations) as l where length(l) > 200) then
    raise exception 'LOCATION_NON_VALIDA';
  end if;

  insert into ordini (tipo, creato_da, parametri)
  values ('controlla_prezzi', v_uid, jsonb_build_object('aiutaGruppo', coalesce(p_aiuta_gruppo, false)))
  returning id into v_id;

  insert into ordini_parametri_privati (ordine_id, owner_id, locations)
  values (v_id, v_uid, v_locations);

  return v_id;
end;
$function$;

revoke execute on function public.crea_ordine_controllo_prezzi(text[], boolean) from public, anon;
grant execute on function public.crea_ordine_controllo_prezzi(text[], boolean) to authenticated, service_role;

-- ── 3. FUNZIONI DI CONTROLLO PREZZI CON p_ordine_id ────────────────────────
drop function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer);

create function public.reclama_carte_per_controllo_prezzi(
  p_user_id uuid,
  p_owner_id_richiesto uuid default null::uuid,
  p_solo_proprie boolean default true,
  p_filtro_location text[] default null::text[],
  p_solo_vecchie boolean default false,
  p_giorni_minimi integer default 3,
  p_lotto_size integer default 3,
  p_ordine_id uuid default null::uuid)
returns setof carte
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
  v_lotto integer := least(greatest(coalesce(p_lotto_size, 3), 1), 10);
  v_owner uuid;
  v_filtro text[] := p_filtro_location;
  v_ha_filtro boolean;
  v_privati record;
begin
  -- p_user_id ignorato di proposito: vedi intestazione di sql/105.
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  v_owner := coalesce(p_owner_id_richiesto, v_uid);

  -- sql/108 (punto 26): ordine con parametri privati → proprietario e
  -- location letti qui, mai dal client. Ordine non più in corso: niente.
  if p_ordine_id is not null then
    select pp.owner_id, pp.locations,
           (o.tipo = 'controlla_prezzi' and o.stato = 'in_corso') as attivo
      into v_privati
      from ordini_parametri_privati pp
      join ordini o on o.id = pp.ordine_id
     where pp.ordine_id = p_ordine_id;
    if found then
      if not v_privati.attivo then
        return;
      end if;
      v_owner := v_privati.owner_id;
      v_filtro := v_privati.locations;
    end if;
  end if;
  v_ha_filtro := v_filtro is not null and array_length(v_filtro, 1) is not null;

  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  with reclamate as (
    update carte c
    set claimed_by = v_uid, claimed_at = now()
    where c.id in (
      select k.id from carte k
      where k.stato = 'collezione'
        and (p_solo_proprie = false or k.owner_id = v_owner)
        and (not v_ha_filtro or (k.owner_id = v_owner and k.location = any(v_filtro)))
        and (p_solo_vecchie = false or k.ultimo_controllo is null or k.ultimo_controllo < v_soglia_vecchie)
        and (k.claimed_by is null or k.claimed_by = v_uid or k.claimed_at < v_soglia_claim)
      order by k.ultimo_controllo asc nulls first
      limit v_lotto
      for update skip locked
    )
    returning c.*
  )
  select x.*
  from reclamate r
  cross join lateral jsonb_populate_record(
    null::carte,
    case when r.owner_id = v_uid then to_jsonb(r)
    else jsonb_build_object(
      'id', r.id, 'owner_id', r.owner_id, 'url', r.url, 'lingua', r.lingua,
      'condizione', r.condizione, 'codice', r.codice, 'nome', r.nome,
      'prezzo', r.prezzo, 'stato', r.stato, 'ultimo_controllo', r.ultimo_controllo,
      'claimed_by', r.claimed_by, 'claimed_at', r.claimed_at)
    end
  ) x;
end;
$function$;

revoke execute on function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer, uuid) from public, anon;
grant execute on function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer, uuid) to authenticated, service_role;

drop function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer);

create function public.conta_carte_da_controllare_gruppo(
  p_owner_id_richiesto uuid default null::uuid,
  p_solo_proprie boolean default true,
  p_filtro_location text[] default null::text[],
  p_solo_vecchie boolean default false,
  p_giorni_minimi integer default 3,
  p_ordine_id uuid default null::uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
  v_soglia timestamptz;
  v_owner uuid := coalesce(p_owner_id_richiesto, auth.uid());
  v_filtro text[] := p_filtro_location;
  v_ha_filtro boolean;
  v_privati record;
begin
  -- sql/108 (punto 26): stessa regola di reclama_carte_per_controllo_prezzi.
  if p_ordine_id is not null then
    select pp.owner_id, pp.locations,
           (o.tipo = 'controlla_prezzi' and o.stato = 'in_corso') as attivo
      into v_privati
      from ordini_parametri_privati pp
      join ordini o on o.id = pp.ordine_id
     where pp.ordine_id = p_ordine_id;
    if found then
      if not v_privati.attivo then
        return 0;
      end if;
      v_owner := v_privati.owner_id;
      v_filtro := v_privati.locations;
    end if;
  end if;
  v_ha_filtro := v_filtro is not null and array_length(v_filtro, 1) is not null;

  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from carte
  where stato = 'collezione'
    and (not p_solo_proprie or owner_id = v_owner)
    -- B1 (sql/105): il filtro location vale solo per le carte del
    -- proprietario delle location, come in reclama_carte_per_controllo_prezzi.
    and (not v_ha_filtro or (owner_id = v_owner and location = any(v_filtro)))
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;

revoke execute on function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer, uuid) from public, anon;
grant execute on function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer, uuid) to authenticated, service_role;

-- ── 4. ORDINI ESISTENTI: LOCATION NELLA TABELLA PRIVATA ────────────────────
insert into public.ordini_parametri_privati (ordine_id, owner_id, locations)
select o.id, o.creato_da, array(select jsonb_array_elements_text(o.parametri -> 'locations'))
from public.ordini o
where o.tipo = 'controlla_prezzi'
  and o.creato_da is not null
  and jsonb_typeof(o.parametri -> 'locations') = 'array'
on conflict (ordine_id) do nothing;

update public.ordini
set parametri = parametri - 'locations'
where parametri ? 'locations';

-- ── VERIFICHE ──────────────────────────────────────────────────────────────
-- a) righe private create e nessuna location rimasta in ordini.parametri
--    (atteso: righe_private = ordini con location prima dell'esecuzione, 0)
select (select count(*) from public.ordini_parametri_privati) as righe_private,
       (select count(*) from public.ordini where parametri ? 'locations') as location_ancora_in_ordini;
-- b) firme e permessi (attesi: authenticated e service_role, mai anon)
select p.oid::regprocedure as funzione, p.proacl::text as permessi
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reclama_carte_per_controllo_prezzi', 'conta_carte_da_controllare_gruppo', 'crea_ordine_controllo_prezzi');
-- c) regola di lettura della tabella privata
select policyname, cmd, roles::text, qual from pg_policies
where schemaname = 'public' and tablename = 'ordini_parametri_privati';
