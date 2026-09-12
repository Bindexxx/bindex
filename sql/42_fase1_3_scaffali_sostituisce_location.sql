-- ============================================================================
-- CardSync Pro — 42: Fase 1.3, Step 2 — prodotti_sealed.location sparisce,
-- le 2 RPC di controllo prezzi di gruppo filtrano per scaffale invece che
-- per location
--
-- Verificato dal vivo prima di scrivere (Regola d'Oro #3):
--  - un solo indice composito coinvolge location: idx_prodotti_sealed_owner
--    (owner_id, location) — Postgres lo droppa automaticamente insieme alla
--    colonna (DROP COLUMN CASCADE sugli indici che la referenziano), lo
--    ricreo sotto senza location (owner_id resta un filtro utile da solo).
--  - solo 2 funzioni nel DB referenziano insieme prodotti_sealed e location:
--    conta_prodotti_sealed_da_controllare_gruppo e
--    reclama_prodotti_sealed_per_controllo_prezzi (le stesse di sql/39,
--    nessuna RPC "fantasma" non documentata in più).
--
-- CREATE OR REPLACE non basta qui: p_filtro_location text[] diventa
-- p_filtro_scaffali uuid[] — tipo di parametro diverso, per Postgres è una
-- firma diversa. Un OR REPLACE lascerebbe la vecchia funzione a penzoloni
-- invece di sostituirla. DROP esplicito con la firma esatta di sql/39,
-- prima di ricreare.
-- ============================================================================

-- ── prodotti_sealed: via location ──────────────────────────────────────
DROP INDEX IF EXISTS public.idx_prodotti_sealed_owner;
ALTER TABLE public.prodotti_sealed DROP COLUMN location;
CREATE INDEX idx_prodotti_sealed_owner ON public.prodotti_sealed (owner_id);


-- ── RPC: DROP delle firme esatte di sql/39 ─────────────────────────────
DROP FUNCTION IF EXISTS public.conta_prodotti_sealed_da_controllare_gruppo(uuid, boolean, text[], boolean, integer);
DROP FUNCTION IF EXISTS public.reclama_prodotti_sealed_per_controllo_prezzi(uuid, uuid, boolean, text[], boolean, integer, integer);


-- ── RPC: ricreate con p_filtro_scaffali uuid[] al posto di
-- p_filtro_location text[] — filtro via EXISTS su scaffale_prodotti invece
-- che confronto diretto su una colonna. Corpo altrimenti IDENTICO a sql/39.
CREATE FUNCTION public.conta_prodotti_sealed_da_controllare_gruppo(
  p_owner_id_richiesto uuid DEFAULT NULL::uuid,
  p_solo_proprie boolean DEFAULT true,
  p_filtro_scaffali uuid[] DEFAULT NULL::uuid[],
  p_solo_vecchie boolean DEFAULT false,
  p_giorni_minimi integer DEFAULT 3
)
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
  from prodotti_sealed p
  where p.stato = 'collezione'
    and (not p_solo_proprie or p.owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    and (p_filtro_scaffali is null or array_length(p_filtro_scaffali, 1) is null or exists (
      select 1 from scaffale_prodotti sp where sp.prodotto_id = p.id and sp.scaffale_id = any(p_filtro_scaffali)
    ))
    and (not p_solo_vecchie or p.ultimo_controllo is null or p.ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;


CREATE FUNCTION public.reclama_prodotti_sealed_per_controllo_prezzi(
  p_user_id uuid,
  p_owner_id_richiesto uuid DEFAULT NULL::uuid,
  p_solo_proprie boolean DEFAULT true,
  p_filtro_scaffali uuid[] DEFAULT NULL::uuid[],
  p_solo_vecchie boolean DEFAULT false,
  p_giorni_minimi integer DEFAULT 3,
  p_lotto_size integer DEFAULT 3
)
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


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select column_name from information_schema.columns
-- where table_name = 'prodotti_sealed' and column_name = 'location';
-- -- deve restituire 0 righe
--
-- select indexname from pg_indexes where tablename = 'prodotti_sealed';
-- -- idx_prodotti_sealed_owner deve esserci, ora su (owner_id) soltanto
--
-- select proname, pg_get_function_arguments(oid) from pg_proc
-- where proname in ('conta_prodotti_sealed_da_controllare_gruppo','reclama_prodotti_sealed_per_controllo_prezzi');
-- -- deve mostrare p_filtro_scaffali uuid[], non più p_filtro_location text[]
