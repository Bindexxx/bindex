-- ============================================================================
-- 105 ROLLBACK — rimette le tre funzioni ESATTAMENTE come erano prima di 105
-- (corpo copiato da pg_get_functiondef sul DB LIVE il 2026-10-15).
-- Da eseguire nell'SQL editor di Supabase.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_location text[] DEFAULT NULL::text[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3, p_lotto_size integer DEFAULT 3)
 RETURNS SETOF carte
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
begin
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  update carte c
  set claimed_by = p_user_id, claimed_at = now()
  where c.id in (
    select id from carte
    where stato = 'collezione'
      and (p_solo_proprie = false or owner_id = coalesce(p_owner_id_richiesto, p_user_id))
      and (p_filtro_location is null or array_length(p_filtro_location, 1) is null or location = any(p_filtro_location))
      and (p_solo_vecchie = false or ultimo_controllo is null or ultimo_controllo < v_soglia_vecchie)
      and (claimed_by is null or claimed_by = p_user_id or claimed_at < v_soglia_claim)
    order by ultimo_controllo asc nulls first
    limit p_lotto_size
    for update skip locked
  )
  returning c.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_scaffali uuid[] DEFAULT NULL::uuid[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3, p_lotto_size integer DEFAULT 3)
 RETURNS SETOF prodotti_sealed
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
begin
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  update prodotti_sealed c
  set claimed_by = p_user_id, claimed_at = now()
  where c.id in (
    select p.id from prodotti_sealed p
    where p.stato = 'collezione'
      and (p_solo_proprie = false or p.owner_id = coalesce(p_owner_id_richiesto, p_user_id))
      and (p_filtro_scaffali is null or array_length(p_filtro_scaffali, 1) is null or exists (
        select 1 from scaffale_prodotti sp where sp.prodotto_id = p.id and sp.scaffale_id = any(p_filtro_scaffali)
      ))
      and (p_solo_vecchie = false or p.ultimo_controllo is null or p.ultimo_controllo < v_soglia_vecchie)
      and (p.claimed_by is null or p.claimed_by = p_user_id or p.claimed_at < v_soglia_claim)
    order by p.ultimo_controllo asc nulls first
    limit p_lotto_size
    for update skip locked
  )
  returning c.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_location text[] DEFAULT NULL::text[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
  v_soglia timestamptz;
begin
  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from carte
  where stato = 'collezione'
    and (not p_solo_proprie or owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    and (p_filtro_location is null or location = any(p_filtro_location))
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;

-- Verifica: nessuna delle tre deve contenere "sql/105".
select p.oid::regprocedure as funzione,
       pg_get_functiondef(p.oid) like '%sql/105%' as ancora_105
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reclama_carte_per_controllo_prezzi',
                    'reclama_prodotti_sealed_per_controllo_prezzi',
                    'conta_carte_da_controllare_gruppo');
