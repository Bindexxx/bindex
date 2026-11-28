-- 162: i contenitori (28/11/2026).
-- La "location secondaria" di sql/158 diventa il CONTENITORE: dove sta fisicamente la carta
-- (Toploader, Binder Scambi…), facoltativo. La location resta il gruppo (Promo, Collezione,
-- Pikachu 30…): un contenitore può avere carte di più location. I contenitori sono un elenco a
-- parte, per utente. Sul DB la colonna resta carte.location_secondaria (nessuna carta l'ha ancora).
-- - tabella contenitori (solo il proprietario), nome unico per utente senza badare alle maiuscole;
-- - una carta con un contenitore che non c'è lo crea da sola, e prende il nome scritto come
--   nell'elenco ("toploader" → "Toploader");
-- - il contenitore può avere lo stesso nome di una location (sono elenchi diversi): tolta la
--   regola di sql/158 "mai uguale alla location";
-- - rinomina_location non tocca più i contenitori (era la parte di sql/158);
-- - rinomina_contenitore(da, a): nome nell'elenco e nelle carte, insieme.
-- Svuotare ed eliminare un contenitore li fa il sito (update delle carte e riga della tabella).

begin;

-- 1. elenco
create table if not exists public.contenitori (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nome text not null check (btrim(nome) <> '' and nome = btrim(nome) and length(nome) <= 60 and nome <> '?'),
  creato_il timestamptz not null default now()
);
create unique index if not exists contenitori_owner_nome_key on public.contenitori (owner_id, lower(nome));
alter table public.contenitori enable row level security;
create policy "propri contenitori" on public.contenitori for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
comment on table public.contenitori is 'Contenitori fisici delle carte (sql/162): carte.location_secondaria ne riporta il nome.';
comment on column public.carte.location_secondaria is
  'Contenitore della carta (sql/162, nome in contenitori), facoltativo: binder, scambio automatico e conteggi usano solo location.';

-- 2. carte: nome pulito, scritto come nell'elenco, contenitore creato se manca
create or replace function public._carte_location_secondaria_pulisci()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nome text;
begin
  new.location_secondaria := nullif(btrim(new.location_secondaria), '');
  if new.location_secondaria = '?' then
    new.location_secondaria := null;
  end if;
  if new.location_secondaria is not null then
    new.location_secondaria := left(new.location_secondaria, 60);
    select c.nome into v_nome from public.contenitori c
     where c.owner_id = new.owner_id and lower(c.nome) = lower(new.location_secondaria);
    if v_nome is null then
      insert into public.contenitori (owner_id, nome) values (new.owner_id, new.location_secondaria)
      on conflict do nothing;
    else
      new.location_secondaria := v_nome;
    end if;
  end if;
  return new;
end;
$$;

-- 3. rinomina_location come prima di sql/158
do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      ($b$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND (location = v_da OR location_secondaria = v_da))$b$,
       $a$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)$a$),
      ($b$GET DIAGNOSTICS v_n_carte = ROW_COUNT;
    -- sql/158: location secondaria
    UPDATE public.carte SET location_secondaria = v_a
     WHERE owner_id = v_uid AND location_secondaria = v_da;$b$,
       $a$GET DIAGNOSTICS v_n_carte = ROW_COUNT;$a$)
    ) as t(prima, dopo)
  loop
    v_def := pg_get_functiondef('public.rinomina_location(text,text)'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception '162: in rinomina_location la riga attesa compare % volte invece di 1: %', v_n, r.prima;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

-- 4. rinomina un contenitore (nell'elenco e nelle carte)
create or replace function public.rinomina_contenitore(p_da text, p_a text)
returns integer
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_a text := btrim(coalesce(p_a, ''));
  v_n int;
begin
  if v_uid is null then raise exception 'Non autenticato'; end if;
  if coalesce(p_da, '') = '' or v_a = '' or v_a = '?' then raise exception 'Nome mancante'; end if;
  if length(v_a) > 60 then raise exception 'Nome troppo lungo'; end if;
  if exists (select 1 from contenitori where owner_id = v_uid and lower(nome) = lower(v_a) and nome <> p_da) then
    raise exception 'Esiste già un contenitore "%"', v_a;
  end if;
  update contenitori set nome = v_a where owner_id = v_uid and nome = p_da;
  if not found then raise exception 'Contenitore "%" non trovato', p_da; end if;
  update carte set location_secondaria = v_a where owner_id = v_uid and location_secondaria = p_da;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.rinomina_contenitore(text, text) to authenticated;

-- 5. eventuali nomi già sulle carte finiscono nell'elenco
insert into public.contenitori (owner_id, nome)
select distinct on (owner_id, lower(location_secondaria)) owner_id, location_secondaria
  from public.carte where location_secondaria is not null
on conflict do nothing;

commit;

-- verifica (tutto true)
select
  exists (select 1 from pg_class where relname = 'contenitori' and relrowsecurity) as tabella_rls,
  exists (select 1 from pg_policies where tablename = 'contenitori') as policy,
  pg_get_functiondef('public._carte_location_secondaria_pulisci()'::regprocedure) like '%insert into public.contenitori%' as trigger_crea,
  pg_get_functiondef('public.rinomina_location(text,text)'::regprocedure) not like '%location_secondaria%' as rinomina_location_come_prima,
  exists (select 1 from pg_proc where proname = 'rinomina_contenitore') as rinomina_contenitore;
