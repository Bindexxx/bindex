-- 150: prezzo dei prodotti sealed secondo l'integrità della confezione (fase A del piano sealed,
-- decisione di Claudio del 19/11/2026). Su Cardmarket i sealed non hanno condizione: i danni li
-- scrive chi vende nel commento ("piccolo strappo", "pellicola danneggiata", "corner dents"…).
-- L'estensione (5.77) prende il prezzo della prima offerta adatta all'integrità del prodotto
-- (sigillato integro = senza commento o senza segni di danno) e accanto salva il minimo di
-- Cardmarket; se non c'è un'offerta adatta resta il prezzo normale e si segna.
--
-- Cosa cambia:
--   prodotti_sealed.prezzo_minimo_cm     numeric  minimo di Cardmarket all'ultimo controllo
--   prodotti_sealed.prezzo_da_integrita  boolean  true = prezzo da un'offerta adatta all'integrità,
--                                                 false = nessuna offerta adatta, prezzo normale
--   aggiorna_integrita_controllo_sealed(p_id, p_minimo, p_da_integrita, p_riga_coda_id)
--     - controllo prezzi (p_riga_coda_id null): prodotto proprio o prenotato da chi chiama, come
--       aggiorna_prezzo_controllo_gruppo_sealed;
--     - coda (p_riga_coda_id): il prodotto appena creato da completa_riga_coda_carte per quella
--       riga, completata da chi chiama;
--   trigger: cambiando l'integrità le due colonne tornano vuote (fino al prossimo controllo).
-- Si lancia dall'SQL Editor (contiene REVOKE), PRIMA di unire la PR.

begin;

alter table public.prodotti_sealed
  add column if not exists prezzo_minimo_cm numeric,
  add column if not exists prezzo_da_integrita boolean;

comment on column public.prodotti_sealed.prezzo_minimo_cm is
  'sql/150: minimo di Cardmarket (qualsiasi integrità) all''ultimo controllo';
comment on column public.prodotti_sealed.prezzo_da_integrita is
  'sql/150: true = prezzo da un''offerta adatta all''integrità del prodotto, false = nessuna offerta adatta, prezzo normale';

create or replace function public.aggiorna_integrita_controllo_sealed(
  p_id uuid,
  p_minimo numeric,
  p_da_integrita boolean,
  p_riga_coda_id bigint default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ok boolean := false;
begin
  -- sql/150: prezzo dei sealed secondo l'integrità (estensione 5.77).
  if v_uid is null then
    return;
  end if;
  if p_minimo is not null and (p_minimo < 0 or p_minimo > 1000000) then
    raise exception 'MINIMO_NON_VALIDO';
  end if;

  if p_riga_coda_id is null then
    -- controllo prezzi: stessa regola di aggiorna_prezzo_controllo_gruppo_sealed
    select true into v_ok
      from prodotti_sealed
     where id = p_id
       and stato = 'collezione'
       and (claimed_by = v_uid or owner_id = v_uid);
  else
    -- coda: il prodotto creato da completa_riga_coda_carte per quella riga (stessa transazione)
    select true into v_ok
      from coda_lavoro q
      join prodotti_sealed s on s.id = p_id
     where q.id = p_riga_coda_id
       and q.stato = 'completato'
       and (q.creato_da = v_uid or q.claimed_by = v_uid)
       and s.owner_id = q.creato_da
       and s.stato = 'collezione'
       and s.created_at between q.completato_il - interval '1 minute' and q.completato_il + interval '1 minute';
  end if;

  if not coalesce(v_ok, false) then
    return;
  end if;

  update prodotti_sealed
     set prezzo_minimo_cm = case when p_minimo is null then null else round(p_minimo, 2) end,
         prezzo_da_integrita = p_da_integrita
   where id = p_id;
end;
$function$;

revoke execute on function public.aggiorna_integrita_controllo_sealed(uuid, numeric, boolean, bigint) from public, anon;
grant execute on function public.aggiorna_integrita_controllo_sealed(uuid, numeric, boolean, bigint) to authenticated, service_role;

create or replace function public._sealed_integrita_pulisci()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- sql/150: integrità cambiata → minimo e origine del prezzo valgono dal prossimo controllo
  new.prezzo_minimo_cm := null;
  new.prezzo_da_integrita := null;
  return new;
end;
$function$;

create trigger trg_sealed_integrita_pulisci
  before update of integrita_packaging on public.prodotti_sealed
  for each row
  when (old.integrita_packaging is distinct from new.integrita_packaging)
  execute function public._sealed_integrita_pulisci();

commit;

-- Verifica (2 colonne, 1 funzione con permessi solo authenticated/service_role, 1 trigger):
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'prodotti_sealed'
   and column_name in ('prezzo_minimo_cm', 'prezzo_da_integrita') order by 1;
select p.oid::regprocedure as firma, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aggiorna_integrita_controllo_sealed';
select tgname from pg_trigger where tgrelid = 'public.prodotti_sealed'::regclass and tgname = 'trg_sealed_integrita_pulisci';
