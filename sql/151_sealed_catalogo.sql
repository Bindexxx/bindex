-- 151: elenco dei prodotti sealed di Cardmarket (fase B del piano sealed, decisioni di Claudio
-- del 19/11/2026). L'estensione (5.78) legge gli elenchi di Cardmarket per categoria ed espansione
-- e li salva qui, con una foto piccola (400 px WebP) copiata nello storage del gruppo. Servirà
-- al selettore dell'inserimento sealed (fase C): espansione → tipo → prodotto, col link esatto.
--
-- Chi lo riempie: SOLO l'account indicato in configurazione_app.catalogo_sealed_utente (Bill),
-- dai suoi PC, quando sono liberi da coda e prezzi. Le 8 categorie dei prodotti (niente accessori):
--   52 Boosters · 53 Booster-Boxes · 1083 Blisters · 54 Theme-Decks · 1013 Trainer-Kits
--   1014 Tins · 1015 Box-Sets · 1016 Elite-Trainer-Boxes
--
-- Cosa crea:
--   sealed_espansioni_cm   espansioni di Cardmarket (id e nome italiano come nel filtro del sito)
--   sealed_catalogo        un prodotto per link: id prodotto Cardmarket, categoria, espansione,
--                          nome italiano, slug inglese, foto Cardmarket e foto nostra
--   sealed_catalogo_giri   cosa leggere: per categoria la pagina con l'elenco delle espansioni
--                          (id_espansione = 0, ogni giorno) e una riga per categoria + espansione
--                          (la prima volta tutte, poi ogni 30 giorni)
--   funzioni (SECURITY DEFINER, tutte fanno qualcosa solo per l'account del catalogo):
--     catalogo_sealed_e_mio()                       true se chi chiama è l'account del catalogo
--     catalogo_sealed_prossimo()                    prenota la prossima pagina da leggere (15 min)
--     catalogo_sealed_salva_espansioni(cat, jsonb)  espansioni lette dal filtro della categoria
--     catalogo_sealed_salva_pagina(cat, esp, jsonb, completa, totale)
--                                                   prodotti di una pagina → quelli senza foto
--     catalogo_sealed_errore(cat, esp, esito)       lettura non riuscita (3 volte → salta 30 giorni)
--     catalogo_sealed_foto_mancanti(limite)         foto da fare (una prova al giorno per prodotto)
--     catalogo_sealed_foto_salvata(url, foto)       foto caricata nello storage
--   bucket pubblico sealed-foto (solo WebP, max 200 KB): scrive solo l'account del catalogo
-- Tutti gli utenti che hanno fatto l'accesso leggono le tre tabelle; nessuno ci scrive direttamente.
-- Si lancia dall'SQL Editor (contiene REVOKE), PRIMA di unire la PR.

begin;

-- 1) chi riempie l'elenco: l'account di Bill
insert into public.configurazione_app (chiave, valore)
values ('catalogo_sealed_utente', '2fc17d99-b7a5-4bdf-ba2c-61354b179219')
on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = now();

-- 2) tabelle
create table public.sealed_espansioni_cm (
  id_espansione integer primary key check (id_espansione > 0),
  nome text not null check (length(nome) between 1 and 200),
  visto_il timestamptz not null default now()
);

create table public.sealed_catalogo (
  url text primary key check (url ~ '^https://www\.cardmarket\.com/it/Pokemon/Products/[A-Za-z-]+/[^/?#]+$'),
  id_prodotto integer unique check (id_prodotto > 0),
  id_categoria integer not null,
  categoria text not null,
  id_espansione integer references public.sealed_espansioni_cm (id_espansione),
  nome text not null check (length(nome) between 1 and 300),
  slug text not null check (length(slug) between 1 and 300),
  foto_cm text check (foto_cm ~ '^https://product-images\.s3\.cardmarket\.com/\d+/\d+/[^/?#]+$'),
  foto text check (foto ~ '^\d+\.webp$'),
  foto_tentata_il timestamptz,
  creato_il timestamptz not null default now(),
  visto_il timestamptz not null default now()
);
create index sealed_catalogo_espansione_idx on public.sealed_catalogo (id_espansione, id_categoria);

create table public.sealed_catalogo_giri (
  id_categoria integer not null,
  categoria text not null,
  id_espansione integer not null default 0 check (id_espansione >= 0),
  letto_il timestamptz,
  preso_il timestamptz,
  prodotti integer,
  esito text,
  tentativi integer not null default 0,
  primary key (id_categoria, id_espansione)
);

insert into public.sealed_catalogo_giri (id_categoria, categoria, id_espansione) values
  (52, 'Boosters', 0), (53, 'Booster-Boxes', 0), (1083, 'Blisters', 0), (54, 'Theme-Decks', 0),
  (1013, 'Trainer-Kits', 0), (1014, 'Tins', 0), (1015, 'Box-Sets', 0), (1016, 'Elite-Trainer-Boxes', 0);

alter table public.sealed_espansioni_cm enable row level security;
alter table public.sealed_catalogo enable row level security;
alter table public.sealed_catalogo_giri enable row level security;

revoke all on public.sealed_espansioni_cm, public.sealed_catalogo, public.sealed_catalogo_giri from anon;
revoke insert, update, delete, truncate on public.sealed_espansioni_cm, public.sealed_catalogo, public.sealed_catalogo_giri from authenticated;

create policy "gruppo legge le espansioni Cardmarket" on public.sealed_espansioni_cm
  for select to authenticated using (true);
create policy "gruppo legge l'elenco sealed" on public.sealed_catalogo
  for select to authenticated using (true);
create policy "gruppo legge i giri dell'elenco sealed" on public.sealed_catalogo_giri
  for select to authenticated using (true);

-- 3) funzioni
create or replace function public.catalogo_sealed_e_mio()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- sql/151: solo l'account indicato in configurazione_app riempie l'elenco sealed
  select auth.uid() is not null and exists (
    select 1 from configurazione_app
     where chiave = 'catalogo_sealed_utente' and valore = auth.uid()::text);
$function$;

create or replace function public.catalogo_sealed_prossimo()
returns table (id_categoria integer, categoria text, id_espansione integer, letto_il timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  r record;
begin
  -- sql/151: prima le pagine-elenco delle categorie (ogni giorno), poi le coppie mai lette
  -- (espansioni più nuove prima), poi quelle lette da più di 30 giorni
  if not catalogo_sealed_e_mio() then
    return;
  end if;
  select g.id_categoria, g.categoria, g.id_espansione, g.letto_il into r
    from sealed_catalogo_giri g
   where (g.preso_il is null or g.preso_il < now() - interval '15 minutes')
     and (g.letto_il is null
          or (g.id_espansione = 0 and g.letto_il < now() - interval '1 day')
          or g.letto_il < now() - interval '30 days')
   order by (g.id_espansione = 0 and g.letto_il is null) desc,
            (g.letto_il is null) desc,
            (g.id_espansione = 0) desc,
            g.letto_il nulls first,
            g.id_espansione desc,
            g.id_categoria
   limit 1
   for update skip locked;
  if not found then
    return;
  end if;
  update sealed_catalogo_giri g
     set preso_il = now()
   where g.id_categoria = r.id_categoria and g.id_espansione = r.id_espansione;
  return query select r.id_categoria, r.categoria, r.id_espansione, r.letto_il;
end;
$function$;

create or replace function public.catalogo_sealed_salva_espansioni(p_id_categoria integer, p_espansioni jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_categoria text;
  v_nuove integer := 0;
  v_tot integer;
begin
  -- sql/151: espansioni elencate nel filtro della pagina di una categoria
  if not catalogo_sealed_e_mio() then
    return 0;
  end if;
  select g.categoria into v_categoria
    from sealed_catalogo_giri g
   where g.id_categoria = p_id_categoria and g.id_espansione = 0;
  if v_categoria is null then
    raise exception 'CATEGORIA_NON_PREVISTA';
  end if;
  if jsonb_typeof(p_espansioni) <> 'array' or jsonb_array_length(p_espansioni) > 3000 then
    raise exception 'ESPANSIONI_NON_VALIDE';
  end if;
  v_tot := jsonb_array_length(p_espansioni);

  insert into sealed_espansioni_cm (id_espansione, nome, visto_il)
  select distinct on ((e->>'id')::integer) (e->>'id')::integer, left(btrim(e->>'nome'), 200), now()
    from jsonb_array_elements(p_espansioni) e
   where (e->>'id') ~ '^\d{1,9}$' and (e->>'id')::integer > 0 and length(btrim(coalesce(e->>'nome', ''))) > 0
  on conflict (id_espansione) do update set nome = excluded.nome, visto_il = now();

  insert into sealed_catalogo_giri (id_categoria, categoria, id_espansione)
  select distinct p_id_categoria, v_categoria, (e->>'id')::integer
    from jsonb_array_elements(p_espansioni) e
   where (e->>'id') ~ '^\d{1,9}$' and (e->>'id')::integer > 0 and length(btrim(coalesce(e->>'nome', ''))) > 0
  on conflict do nothing;
  get diagnostics v_nuove = row_count;

  update sealed_catalogo_giri g
     set letto_il = now(), preso_il = null, prodotti = v_tot, esito = 'ok', tentativi = 0
   where g.id_categoria = p_id_categoria and g.id_espansione = 0;
  return v_nuove;
end;
$function$;

create or replace function public.catalogo_sealed_salva_pagina(
  p_id_categoria integer,
  p_id_espansione integer,
  p_prodotti jsonb,
  p_completa boolean default true,
  p_totale integer default null)
returns table (url text, id_prodotto integer, foto_cm text)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_categoria text;
  v_url_re constant text := '^https://www\.cardmarket\.com/it/Pokemon/Products/[A-Za-z-]+/[^/?#]+$';
  v_foto_re constant text := '^https://product-images\.s3\.cardmarket\.com/\d+/\d+/[^/?#]+$';
begin
  -- sql/151: prodotti di una pagina-elenco (categoria + espansione). Restituisce quelli della
  -- pagina che non hanno ancora la foto nostra (e li segna come "foto provata adesso").
  if not catalogo_sealed_e_mio() then
    return;
  end if;
  select g.categoria into v_categoria
    from sealed_catalogo_giri g
   where g.id_categoria = p_id_categoria and g.id_espansione = p_id_espansione and p_id_espansione > 0;
  if v_categoria is null then
    raise exception 'PAGINA_NON_PREVISTA';
  end if;
  if jsonb_typeof(p_prodotti) <> 'array' or jsonb_array_length(p_prodotti) > 60 then
    raise exception 'PRODOTTI_NON_VALIDI';
  end if;

  insert into sealed_catalogo as c (url, id_prodotto, id_categoria, categoria, id_espansione, nome, slug, foto_cm, visto_il)
  select distinct on (e->>'url')
         e->>'url',
         case when (e->>'id_prodotto') ~ '^\d{1,9}$' then (e->>'id_prodotto')::integer end,
         p_id_categoria, v_categoria, p_id_espansione,
         left(btrim(e->>'nome'), 300), left(e->>'slug', 300),
         case when (e->>'foto_cm') ~ v_foto_re then e->>'foto_cm' end,
         now()
    from jsonb_array_elements(p_prodotti) e
   where (e->>'url') ~ v_url_re
     and length(btrim(coalesce(e->>'nome', ''))) > 0
     and length(coalesce(e->>'slug', '')) > 0
  on conflict on constraint sealed_catalogo_pkey do update
     set id_prodotto = coalesce(excluded.id_prodotto, c.id_prodotto),
         id_categoria = excluded.id_categoria,
         categoria = excluded.categoria,
         id_espansione = excluded.id_espansione,
         nome = excluded.nome,
         slug = excluded.slug,
         foto_cm = excluded.foto_cm,
         foto = case when excluded.foto_cm is distinct from c.foto_cm then null else c.foto end,
         visto_il = now();

  if p_completa then
    update sealed_catalogo_giri g
       set letto_il = now(), preso_il = null, esito = 'ok', tentativi = 0,
           prodotti = coalesce(p_totale, jsonb_array_length(p_prodotti))
     where g.id_categoria = p_id_categoria and g.id_espansione = p_id_espansione;
  else
    update sealed_catalogo_giri g
       set preso_il = now()
     where g.id_categoria = p_id_categoria and g.id_espansione = p_id_espansione;
  end if;

  return query
    update sealed_catalogo c
       set foto_tentata_il = now()
     where c.url in (select e->>'url' from jsonb_array_elements(p_prodotti) e)
       and c.foto is null and c.foto_cm is not null and c.id_prodotto is not null
    returning c.url, c.id_prodotto, c.foto_cm;
end;
$function$;

create or replace function public.catalogo_sealed_errore(p_id_categoria integer, p_id_espansione integer, p_esito text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- sql/151: lettura non riuscita; alla terza di fila la coppia aspetta il prossimo giro (30 giorni)
  if not catalogo_sealed_e_mio() then
    return;
  end if;
  update sealed_catalogo_giri g
     set preso_il = null,
         esito = left(coalesce(p_esito, 'errore'), 100),
         tentativi = g.tentativi + 1,
         letto_il = case when g.tentativi + 1 >= 3 then now() else g.letto_il end
   where g.id_categoria = p_id_categoria and g.id_espansione = p_id_espansione;
end;
$function$;

create or replace function public.catalogo_sealed_foto_mancanti(p_limite integer default 30)
returns table (url text, id_prodotto integer, foto_cm text)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  -- sql/151: prodotti senza foto nostra, ognuno provato al massimo una volta al giorno
  if not catalogo_sealed_e_mio() then
    return;
  end if;
  return query
    update sealed_catalogo c
       set foto_tentata_il = now()
     where c.url in (
       select c2.url from sealed_catalogo c2
        where c2.foto is null and c2.foto_cm is not null and c2.id_prodotto is not null
          and (c2.foto_tentata_il is null or c2.foto_tentata_il < now() - interval '1 day')
        order by c2.foto_tentata_il nulls first, c2.creato_il
        limit least(greatest(coalesce(p_limite, 30), 1), 100)
        for update skip locked)
    returning c.url, c.id_prodotto, c.foto_cm;
end;
$function$;

create or replace function public.catalogo_sealed_foto_salvata(p_url text, p_foto text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- sql/151: la foto (id_prodotto.webp) è nel bucket sealed-foto
  if not catalogo_sealed_e_mio() then
    return;
  end if;
  if p_foto !~ '^\d+\.webp$' then
    raise exception 'FOTO_NON_VALIDA';
  end if;
  update sealed_catalogo c
     set foto = p_foto
   where c.url = p_url and p_foto = c.id_prodotto::text || '.webp';
end;
$function$;

revoke execute on function public.catalogo_sealed_e_mio() from public, anon;
revoke execute on function public.catalogo_sealed_prossimo() from public, anon;
revoke execute on function public.catalogo_sealed_salva_espansioni(integer, jsonb) from public, anon;
revoke execute on function public.catalogo_sealed_salva_pagina(integer, integer, jsonb, boolean, integer) from public, anon;
revoke execute on function public.catalogo_sealed_errore(integer, integer, text) from public, anon;
revoke execute on function public.catalogo_sealed_foto_mancanti(integer) from public, anon;
revoke execute on function public.catalogo_sealed_foto_salvata(text, text) from public, anon;
grant execute on function public.catalogo_sealed_e_mio() to authenticated, service_role;
grant execute on function public.catalogo_sealed_prossimo() to authenticated, service_role;
grant execute on function public.catalogo_sealed_salva_espansioni(integer, jsonb) to authenticated, service_role;
grant execute on function public.catalogo_sealed_salva_pagina(integer, integer, jsonb, boolean, integer) to authenticated, service_role;
grant execute on function public.catalogo_sealed_errore(integer, integer, text) to authenticated, service_role;
grant execute on function public.catalogo_sealed_foto_mancanti(integer) to authenticated, service_role;
grant execute on function public.catalogo_sealed_foto_salvata(text, text) to authenticated, service_role;

-- 4) foto: bucket pubblico, scrive solo l'account del catalogo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sealed-foto', 'sealed-foto', true, 204800, array['image/webp'])
on conflict (id) do nothing;

create policy "chiunque legge le foto sealed" on storage.objects
  for select to public using (bucket_id = 'sealed-foto');
create policy "catalogo sealed carica le foto" on storage.objects
  for insert to authenticated with check (bucket_id = 'sealed-foto' and public.catalogo_sealed_e_mio());
create policy "catalogo sealed sostituisce le foto" on storage.objects
  for update to authenticated using (bucket_id = 'sealed-foto' and public.catalogo_sealed_e_mio())
  with check (bucket_id = 'sealed-foto' and public.catalogo_sealed_e_mio());

commit;

-- Verifica (3 tabelle con RLS e 8 giri, 7 funzioni solo authenticated/service_role, bucket, 3 policy):
select c.relname, c.relrowsecurity as rls,
       (select count(*) from public.sealed_catalogo_giri) as giri
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('sealed_espansioni_cm', 'sealed_catalogo', 'sealed_catalogo_giri')
 order by 1;
select p.oid::regprocedure as firma, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'catalogo_sealed_%' order by 1;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'sealed-foto';
select policyname, cmd from pg_policies where schemaname = 'storage' and policyname ilike '%sealed%' order by 1;
select chiave, valore from public.configurazione_app where chiave = 'catalogo_sealed_utente';
