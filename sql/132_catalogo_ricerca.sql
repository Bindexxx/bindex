-- 132 — Ricerca nel catalogo per l'Inserimento (11/11/2026).
-- Serve al selettore carte del sito: mentre scrivi "jigglypuff 8" o "svi 054" il sito chiede al
-- catalogo (set_carte) le carte che combaciano e te le mostra con la miniatura; quella scelta va in
-- coda col link diretto di Cardmarket.
--
-- VA ESEGUITA DOPO sql/131 (colonna set_espansioni.lingua): se manca, questo file si ferma da solo.
--
-- Verificato sul DB reale l'11/11/2026, prima di scrivere:
--   set_carte: 33.341 righe, 17.985 carte, chiave (sigla, numero, variante); immagine vuota in tutte
--   le righe; cardmarket_id in 20.609 righe; nessuna colonna col link; nessun trigger; policy:
--   lettura per tutti, scrittura solo is_admin(). Indici: chiave e cardmarket_id.
--   carte: 2.306 righe, tutte con url; 2.238 con l'immagine nello Storage (immagini-carte).
--   Estensioni Postgres: niente pg_trgm né unaccent (gli accenti si tolgono con translate()).
--
-- COSA FA (solo aggiunte, nessun DROP di cose esistenti):
--   1. set_carte.cardmarket_url: il link della pagina Cardmarket della carta, senza parametri.
--   2. indice su set_carte(numero): le ricerche col numero non leggono tutta la tabella.
--   3. catalogo_cerca(): la ricerca. Sola lettura, gira coi permessi di chi la chiama.
--   4. riempie link e miniatura delle carte che il gruppo ha già in collezione (solo quando il codice
--      della carta e il link combaciano e non c'è dubbio su quale pagina sia).
-- Rollback: 132_catalogo_ricerca_ROLLBACK.sql.

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'set_espansioni' and column_name = 'lingua') then
    raise exception 'Prima va eseguita sql/131_set_espansioni_lingua.sql (manca set_espansioni.lingua)';
  end if;
end $$;

-- 1. link Cardmarket nel catalogo
alter table public.set_carte add column if not exists cardmarket_url text;
alter table public.set_carte drop constraint if exists set_carte_cardmarket_url_check;
alter table public.set_carte add constraint set_carte_cardmarket_url_check
  check (cardmarket_url is null or cardmarket_url ~ '^https://www\.cardmarket\.com/[a-z]{2}/Pokemon/Products/[^[:space:]"<>'']+$');

-- 2. indice per le ricerche col numero
create index if not exists set_carte_numero_idx on public.set_carte using btree (numero);

-- 3. la ricerca
--   p_nome    parole del nome, tutte devono esserci ("raichu alola"); maiuscole e accenti non contano
--   p_numero  numero della carta
--   p_sigle   sigle di set_espansioni in cui cercare (le decide il sito da quello che scrivi)
--   p_lingue  lingue dei set: INT (internazionali), JP, KOR, CHN, CHN-T
--   p_totale  il numero dopo la barra ("8/12"): tiene i set con quel totale
--   p_limite  quante carte al massimo (da 1 a 60)
-- Torna una riga per ogni PAGINA di Cardmarket: la carta normale e la sua reverse stanno insieme
-- (base = true); le versioni che su Cardmarket hanno una pagina loro (Poké Ball, timbri, staff)
-- escono a parte (base = false) e dopo le altre. "trovate" è il totale prima del limite.
create or replace function public.catalogo_cerca(
    p_nome   text    default null,
    p_numero integer default null,
    p_sigle  text[]  default null,
    p_lingue text[]  default null,
    p_totale integer default null,
    p_limite integer default 12
)
returns table (
    sigla text, numero integer, variante text, nome text, immagine text,
    cardmarket_id bigint, cardmarket_url text,
    set_nome text, lingua text, data_uscita date, carte_base integer,
    base boolean, versioni integer, trovate bigint
)
language sql
stable
set search_path to 'public'
as $function$
    with pulito as (
        select nullif(btrim(regexp_replace(
                   translate(lower(coalesce(p_nome, '')), 'àáâäèéêëìíîïòóôöùúûü%_\', 'aaaaeeeeiiiioooouuuu'),
                   '\s+', ' ', 'g')), '') as nome_norm
    ),
    par as (
        select p.nome_norm,
               (select array_agg('%' || w || '%') from unnest(string_to_array(p.nome_norm, ' ')) as w where w <> '') as modelli
        from pulito p
    ),
    righe as (
        select c.sigla, c.numero, c.variante, c.nome, c.immagine, c.cardmarket_id, c.cardmarket_url,
               e.nome as set_nome, e.lingua, e.data_uscita, e.carte_base,
               translate(lower(coalesce(c.nome, '')), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu') as nome_norm,
               case c.variante when 'normale' then 0 when 'reverse' then 1 else 2 end as ord
        from public.set_carte c
        join public.set_espansioni e on e.sigla = c.sigla
        cross join par
        where (par.nome_norm is not null or p_numero is not null or p_sigle is not null)
          and (p_numero is null or c.numero = p_numero)
          and (p_sigle  is null or c.sigla = any (p_sigle))
          and (p_lingue is null or e.lingua = any (p_lingue))
          and (p_totale is null or e.carte_base = p_totale or e.carte_totali = p_totale)
    ),
    filtrate as (
        select r.*
        from righe r
        cross join par
        where par.nome_norm is null
           or r.nome_norm like all (par.modelli)
    ),
    con_primo as (
        select f.*,
               first_value(f.cardmarket_id) over (partition by f.sigla, f.numero order by f.ord, f.variante) as id_primo
        from filtrate f
    ),
    con_chiave as (
        select p.*,
               case when p.cardmarket_id is null or p.cardmarket_id is not distinct from p.id_primo
                    then 0 else p.cardmarket_id end as k
        from con_primo p
    ),
    pagine as (
        select g.sigla, g.numero, g.k,
               (array_agg(g.variante order by g.ord, g.variante))[1] as variante,
               max(g.nome) as nome,
               (array_agg(g.immagine order by g.ord, g.variante) filter (where g.immagine is not null))[1] as immagine,
               max(g.cardmarket_id) as cardmarket_id,
               (array_agg(g.cardmarket_url order by g.ord, g.variante) filter (where g.cardmarket_url is not null))[1] as cardmarket_url,
               max(g.set_nome) as set_nome, max(g.lingua) as lingua,
               max(g.data_uscita) as data_uscita, max(g.carte_base) as carte_base,
               count(*)::integer as versioni,
               max(g.nome_norm) as nome_norm
        from con_chiave g
        group by g.sigla, g.numero, g.k
    )
    select q.sigla, q.numero, q.variante, q.nome,
           coalesce(q.immagine, max(q.immagine) over (partition by q.sigla, q.numero)) as immagine,
           q.cardmarket_id, q.cardmarket_url,
           q.set_nome, q.lingua, q.data_uscita, q.carte_base,
           (q.k = 0) as base, q.versioni,
           count(*) over () as trovate
    from pagine q
    cross join par
    order by (q.k = 0) desc,
             case when par.nome_norm is null then 0
                  when q.nome_norm = par.nome_norm then 0
                  when q.nome_norm like par.nome_norm || '%' then 1
                  else 2 end,
             q.data_uscita desc nulls last, q.sigla, q.numero, q.k
    limit greatest(1, least(coalesce(p_limite, 12), 60));
$function$;

comment on function public.catalogo_cerca(text, integer, text[], text[], integer, integer) is
  'Ricerca nel catalogo set_carte per il selettore carte del sito (sql/132). Sola lettura.';

-- L'Inserimento è dietro il login: la ricerca la chiama solo chi è entrato.
revoke all on function public.catalogo_cerca(text, integer, text[], text[], integer, integer) from public, anon;
grant execute on function public.catalogo_cerca(text, integer, text[], text[], integer, integer) to authenticated;

-- 4. link e miniatura dalle carte già in collezione.
--    Si usa una carta solo se: codice "SIGLA NUMERO" (lingue occidentali), link a una pagina
--    /Products/Singles/ che finisce con quel codice (Blissey-LOT153 per "LOT 153"), e tutte le copie
--    del gruppo con quel codice portano alla stessa pagina. Si scrive sulle righe normale e reverse
--    (su Cardmarket sono la stessa pagina). La miniatura è quella già salvata nello Storage.
with abbinate as (
    select upper(split_part(c.codice, ' ', 1)) as sigla,
           split_part(c.codice, ' ', 2)::integer as numero,
           split_part(c.url, '?', 1) as link,
           c.immagine
    from public.carte c
    where c.codice ~ '^[A-Za-z0-9]+ [0-9]{1,4}$'
      and c.lingua in ('IT', 'EN', 'DE', 'FR', 'ES', 'PT')
      and c.url ~ '^https://www\.cardmarket\.com/[a-z]{2}/Pokemon/Products/Singles/[^/?#]+/[^/?#[:space:]"<>'']+'
      and split_part(c.url, '?', 1) ~* ('-' || split_part(c.codice, ' ', 1) || '-?0*'
                                         || (split_part(c.codice, ' ', 2)::integer)::text || '$')
),
uniche as (
    select a.sigla, a.numero, min(a.link) as link,
           (array_agg(a.immagine) filter (where a.immagine ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/immagini-carte/'))[1] as immagine
    from abbinate a
    group by a.sigla, a.numero
    having count(distinct a.link) = 1
)
update public.set_carte s
set cardmarket_url = u.link,
    immagine = coalesce(s.immagine, u.immagine),
    aggiornato_il = now()
from uniche u
where s.sigla = u.sigla and s.numero = u.numero and s.variante in ('normale', 'reverse');

-- Controllo a occhio dopo l'esecuzione (non cambia niente):
select count(*) filter (where cardmarket_url is not null) as righe_con_link,
       count(*) filter (where immagine is not null)       as righe_con_miniatura,
       count(*)                                            as righe_catalogo
from public.set_carte;
