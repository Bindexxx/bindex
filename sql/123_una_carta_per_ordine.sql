-- ============================================================================
-- 123 — ORDINE PREZZI CARTE: OGNI CARTA UNA VOLTA SOLA (estensione 5.40)
-- Piano 2026-10-23, Fase 4.12 (B20, aggiunto da Claudio il 24/10).
--
-- Letto sul DB LIVE il 2026-10-24 (pg_get_functiondef):
-- - reclama_carte_per_controllo_prezzi e conta_carte_da_controllare_gruppo
--   (sql/105, sql/108): con un ordine prendono proprietario e location da
--   ordini_parametri_privati; ordinano per ultimo_controllo, ma non escludono
--   le carte già controllate DURANTE l'ordine. Con "mi unisco" ogni PC conta
--   il giro intero e lo fa tutto: con due PC ogni carta controllata due volte.
-- - La wishlist ha già la regola (sql/118). Qui la stessa per le carte.
--
-- COSA FA (solo con un ordine 'controlla_prezzi' in corso; senza ordine e con
-- "solo più vecchie di N giorni" tutto resta com'è):
-- - le carte con ultimo_controllo >= inizio dell'ordine (preso_in_carico_il)
--   non si contano e non si prenotano più: la sessione finisce quando non ne
--   resta nessuna, anche con più PC;
-- - a ogni lotto l'ordine segna la sua attività (ordini.attivo_il, sql/120).
-- Il resto delle due funzioni è identico alla versione live.
-- Ritorno indietro: 123_..._ROLLBACK.sql (le due funzioni com'erano).
-- Richiede sql/120 (colonna ordini.attivo_il).
-- ============================================================================

create or replace function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid default null::uuid, p_solo_proprie boolean default true, p_filtro_location text[] default null::text[], p_solo_vecchie boolean default false, p_giorni_minimi integer default 3, p_ordine_id uuid default null::uuid)
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
  v_inizio timestamptz; -- sql/123: inizio dell'ordine in corso (null senza ordine)
begin
  -- sql/108 (punto 26): stessa regola di reclama_carte_per_controllo_prezzi.
  if p_ordine_id is not null then
    select pp.owner_id, pp.locations,
           (o.tipo = 'controlla_prezzi' and o.stato = 'in_corso') as attivo,
           coalesce(o.preso_in_carico_il, o.creato_il) as inizio
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
      v_inizio := v_privati.inizio;
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
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia)
    and (v_inizio is null or ultimo_controllo is null or ultimo_controllo < v_inizio);

  return v_count;
end;
$function$;

create or replace function public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid default null::uuid, p_solo_proprie boolean default true, p_filtro_location text[] default null::text[], p_solo_vecchie boolean default false, p_giorni_minimi integer default 3, p_lotto_size integer default 3, p_ordine_id uuid default null::uuid)
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
  v_inizio timestamptz; -- sql/123: inizio dell'ordine in corso (null senza ordine)
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
           (o.tipo = 'controlla_prezzi' and o.stato = 'in_corso') as attivo,
           coalesce(o.preso_in_carico_il, o.creato_il) as inizio
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
      v_inizio := v_privati.inizio;
      update ordini set attivo_il = now() where id = p_ordine_id; -- sql/120: l'ordine è vivo
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
        and (v_inizio is null or k.ultimo_controllo is null or k.ultimo_controllo < v_inizio)
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
