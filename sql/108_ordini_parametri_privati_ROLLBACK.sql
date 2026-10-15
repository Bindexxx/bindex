-- ============================================================================
-- ROLLBACK di sql/108 (location degli ordini in tabella privata).
-- Riporta tutto come dopo sql/105:
--   1. le location tornano in ordini.parametri (dalla tabella privata);
--   2. reclama_carte_per_controllo_prezzi e conta_carte_da_controllare_gruppo
--      tornano senza p_ordine_id (testo identico a sql/105, permessi uguali);
--   3. vengono tolte crea_ordine_controllo_prezzi e la tabella privata.
--
-- ATTENZIONE
-- - Se sql/109 è già stato eseguito, PRIMA il suo ROLLBACK: il vincolo di
--   sql/109 vieta le location in ordini.parametri e il punto 1 fallirebbe.
-- - Dopo questo ROLLBACK il sito del punto 26 non può più creare ordini
--   (manca crea_ordine_controllo_prezzi) e l'estensione 5.20 non può più
--   eseguirli (manca p_ordine_id): riportare anche sito ed estensione alla
--   versione precedente.
--
-- Contiene DROP e REVOKE: da eseguire nell'SQL editor di Supabase.
-- ============================================================================

-- ── 1. LOCATION DI NUOVO IN ordini.parametri ───────────────────────────────
update public.ordini o
set parametri = coalesce(o.parametri, '{}'::jsonb) || jsonb_build_object('locations', to_jsonb(pp.locations))
from public.ordini_parametri_privati pp
where pp.ordine_id = o.id;

-- ── 2. FUNZIONI COME IN sql/105 ────────────────────────────────────────────
drop function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer, uuid);

create function public.reclama_carte_per_controllo_prezzi(
  p_user_id uuid,
  p_owner_id_richiesto uuid default null::uuid,
  p_solo_proprie boolean default true,
  p_filtro_location text[] default null::text[],
  p_solo_vecchie boolean default false,
  p_giorni_minimi integer default 3,
  p_lotto_size integer default 3)
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
  v_ha_filtro boolean := p_filtro_location is not null and array_length(p_filtro_location, 1) is not null;
begin
  -- p_user_id ignorato di proposito: vedi intestazione di sql/105.
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;
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
        and (p_solo_proprie = false or k.owner_id = coalesce(p_owner_id_richiesto, v_uid))
        and (not v_ha_filtro or (k.owner_id = coalesce(p_owner_id_richiesto, v_uid) and k.location = any(p_filtro_location)))
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

revoke execute on function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer) from public, anon;
grant execute on function public.reclama_carte_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer) to authenticated, service_role;

drop function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer, uuid);

create function public.conta_carte_da_controllare_gruppo(
  p_owner_id_richiesto uuid default null::uuid,
  p_solo_proprie boolean default true,
  p_filtro_location text[] default null::text[],
  p_solo_vecchie boolean default false,
  p_giorni_minimi integer default 3)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
  v_soglia timestamptz;
begin
  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from carte
  where stato = 'collezione'
    and (not p_solo_proprie or owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    -- B1 (sql/105): il filtro location vale solo per le carte del
    -- proprietario delle location, come in reclama_carte_per_controllo_prezzi.
    and (p_filtro_location is null or (owner_id = coalesce(p_owner_id_richiesto, auth.uid()) and location = any(p_filtro_location)))
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;

revoke execute on function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer) from public, anon;
grant execute on function public.conta_carte_da_controllare_gruppo(uuid, boolean, text[], boolean, integer) to authenticated, service_role;

-- ── 3. VIA FUNZIONE DI CREAZIONE E TABELLA PRIVATA ─────────────────────────
drop function public.crea_ordine_controllo_prezzi(text[], boolean);
drop table public.ordini_parametri_privati;

-- Verifica: due funzioni senza p_ordine_id, permessi authenticated e
-- service_role; nessuna crea_ordine_controllo_prezzi; tabella assente.
select p.oid::regprocedure as funzione, p.proacl::text as permessi
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reclama_carte_per_controllo_prezzi', 'conta_carte_da_controllare_gruppo', 'crea_ordine_controllo_prezzi');
select to_regclass('public.ordini_parametri_privati') as tabella_privata;
