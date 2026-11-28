-- ROLLBACK di 162: niente contenitori, torna la "location secondaria" di sql/158.
-- Contiene DROP: va lanciato nell'SQL Editor. L'elenco dei contenitori si perde (i nomi sulle
-- carte restano).

begin;

drop function if exists public.rinomina_contenitore(text, text);
drop table if exists public.contenitori;

create or replace function public._carte_location_secondaria_pulisci()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.location_secondaria := nullif(btrim(new.location_secondaria), '');
  if new.location_secondaria is not null
     and (new.location_secondaria = '?'
          or lower(new.location_secondaria) = lower(btrim(coalesce(new.location, '')))) then
    new.location_secondaria := null;
  end if;
  return new;
end;
$$;

do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      ($a$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)$a$,
       $b$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND (location = v_da OR location_secondaria = v_da))$b$),
      ($a$GET DIAGNOSTICS v_n_carte = ROW_COUNT;$a$,
       $b$GET DIAGNOSTICS v_n_carte = ROW_COUNT;
    -- sql/158: location secondaria
    UPDATE public.carte SET location_secondaria = v_a
     WHERE owner_id = v_uid AND location_secondaria = v_da;$b$)
    ) as t(prima, dopo)
  loop
    v_def := pg_get_functiondef('public.rinomina_location(text,text)'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception 'ROLLBACK 162: in rinomina_location la riga attesa compare % volte invece di 1', v_n;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

commit;
