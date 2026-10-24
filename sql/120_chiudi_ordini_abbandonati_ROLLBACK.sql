-- ============================================================================
-- 120 ROLLBACK — da eseguire a mano (DROP).
-- ORDINE: prima 123_..._ROLLBACK.sql (la funzione delle carte di sql/123 usa
-- ordini.attivo_il), poi questo. Prima ancora rimettere sui PC un'estensione
-- < 5.40 (la 5.40 chiama chiudi_ordini_abbandonati).
-- ============================================================================

-- reclama_wishlist_per_controllo_prezzi com'era in sql/118 (senza attivo_il)
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

drop function if exists public.chiudi_ordini_abbandonati();
alter table public.ordini drop column if exists attivo_il;
