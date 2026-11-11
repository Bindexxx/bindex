-- ROLLBACK della 135 — rimette catalogo_cerca com'era con la 132 (6 parametri, senza "codice") e
-- toglie la colonna set_carte.codice. PRIMA va fatto il rollback della 136 (le carte dei set promo
-- hanno il codice): se ci sono ancora righe col codice questo file si ferma da solo.

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'set_carte' and column_name = 'codice') then
    if exists (select 1 from public.set_carte where codice is not null) then
      raise exception 'Ci sono ancora carte col codice (set promo): esegui prima sql/136_..._ROLLBACK.sql';
    end if;
  end if;
end $$;

begin;

drop function if exists public.catalogo_cerca(text, integer, text[], text[], integer, integer, text);
drop function if exists public.catalogo_cerca(text, integer, text[], text[], integer, integer);

create function public.catalogo_cerca(
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

revoke all on function public.catalogo_cerca(text, integer, text[], text[], integer, integer) from public, anon;
grant execute on function public.catalogo_cerca(text, integer, text[], text[], integer, integer) to authenticated;

alter table public.set_carte drop constraint if exists set_carte_codice_check;
alter table public.set_carte drop column if exists codice;

commit;

notify pgrst, 'reload schema';
