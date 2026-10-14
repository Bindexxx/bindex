-- ============================================================================
-- 105 — PRIVACY DEL CONTROLLO PREZZI DI GRUPPO (estensione 5.17, audit C4)
-- Letto sul DB LIVE il 2026-10-15 (pg_get_functiondef, pg_policies,
-- information_schema): carte ha la sola policy "propria collezione"
-- (owner_id = auth.uid()), ma queste funzioni SECURITY DEFINER, eseguibili da
-- authenticated, restituivano le righe INTERE anche delle carte/prodotti
-- degli altri (location, note, prezzo_obiettivo, dispositivo; sealed:
-- prezzo_acquisto, data_acquisizione, prezzo di vendita, note), si fidavano
-- di p_user_id mandato dal client e non avevano un tetto al lotto.
--
-- COSA CAMBIA (decisioni di Claudio, 2026-10-15: A1 + B1):
-- 1. Chi chiama = auth.uid(). p_user_id resta nella firma SOLO per
--    compatibilità con l'estensione 5.16/5.17 (che lo manda), ma è ignorato.
--    Senza login: errore NON_AUTENTICATO.
-- 2. Lotto massimo 10 (l'estensione ne chiede 3): niente più "scarica tutto".
-- 3. A1 — righe di ALTRI: solo i campi che servono al controllo prezzi
--    (elenco esplicito, così una colonna aggiunta in futuro resta vuota per
--    gli altri senza doverci pensare). Le proprie righe restano intere.
--    carte:  id, owner_id, url, lingua, condizione, codice, nome, prezzo,
--            stato, ultimo_controllo, claimed_by, claimed_at
--    sealed: id, owner_id, url, codice, nome, prezzo_cardmarket, stato,
--            ultimo_controllo, claimed_by, claimed_at
-- 4. B1 — filtro location: vale solo per le carte del proprietario delle
--    location (chi chiama, o chi ha creato l'ordine se p_owner_id_richiesto
--    è valorizzato); con un filtro attivo le carte degli altri non vengono
--    prese. Stessa regola nel conteggio (conta_carte_da_controllare_gruppo),
--    così la barra di avanzamento resta coerente. Il sealed filtra già per
--    id di scaffale (dei propri scaffali): invariato.
--
-- Firme e tipi di ritorno IDENTICI: solo CREATE OR REPLACE, nessun DROP.
-- conta_prodotti_sealed_da_controllare_gruppo: non toccata.
--
-- Da eseguire nell'SQL editor di Supabase (o via connettore).
-- PER ANNULLARE: sql/105_privacy_controllo_prezzi_gruppo_ROLLBACK.sql
-- ============================================================================

create or replace function public.reclama_carte_per_controllo_prezzi(
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

create or replace function public.reclama_prodotti_sealed_per_controllo_prezzi(
  p_user_id uuid,
  p_owner_id_richiesto uuid default null::uuid,
  p_solo_proprie boolean default true,
  p_filtro_scaffali uuid[] default null::uuid[],
  p_solo_vecchie boolean default false,
  p_giorni_minimi integer default 3,
  p_lotto_size integer default 3)
returns setof prodotti_sealed
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
  v_lotto integer := least(greatest(coalesce(p_lotto_size, 3), 1), 10);
begin
  -- p_user_id ignorato di proposito: vedi intestazione di sql/105.
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  with reclamati as (
    update prodotti_sealed c
    set claimed_by = v_uid, claimed_at = now()
    where c.id in (
      select p.id from prodotti_sealed p
      where p.stato = 'collezione'
        and (p_solo_proprie = false or p.owner_id = coalesce(p_owner_id_richiesto, v_uid))
        and (p_filtro_scaffali is null or array_length(p_filtro_scaffali, 1) is null or exists (
          select 1 from scaffale_prodotti sp where sp.prodotto_id = p.id and sp.scaffale_id = any(p_filtro_scaffali)
        ))
        and (p_solo_vecchie = false or p.ultimo_controllo is null or p.ultimo_controllo < v_soglia_vecchie)
        and (p.claimed_by is null or p.claimed_by = v_uid or p.claimed_at < v_soglia_claim)
      order by p.ultimo_controllo asc nulls first
      limit v_lotto
      for update skip locked
    )
    returning c.*
  )
  select x.*
  from reclamati r
  cross join lateral jsonb_populate_record(
    null::prodotti_sealed,
    case when r.owner_id = v_uid then to_jsonb(r)
    else jsonb_build_object(
      'id', r.id, 'owner_id', r.owner_id, 'url', r.url, 'codice', r.codice,
      'nome', r.nome, 'prezzo_cardmarket', r.prezzo_cardmarket, 'stato', r.stato,
      'ultimo_controllo', r.ultimo_controllo, 'claimed_by', r.claimed_by,
      'claimed_at', r.claimed_at)
    end
  ) x;
end;
$function$;

create or replace function public.conta_carte_da_controllare_gruppo(
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

-- Verifica: le tre funzioni devono risultare aggiornate (cerca "sql/105").
select p.oid::regprocedure as funzione,
       pg_get_functiondef(p.oid) like '%sql/105%' as aggiornata
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reclama_carte_per_controllo_prezzi',
                    'reclama_prodotti_sealed_per_controllo_prezzi',
                    'conta_carte_da_controllare_gruppo');
