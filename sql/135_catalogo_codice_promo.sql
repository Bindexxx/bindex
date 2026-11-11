-- 135 — Catalogo: colonna "codice" per i masterset promo e ricerca che la usa (11/11/2026).
-- Decisioni di Claudio (11/11/2026): BOO, PPS, WCD e Battle Academy sono masterset a parte (una carta
-- "BOO24 PAL 050" conta per BOO24, non per PAL); Battle Academy un masterset per anno; dentro questi
-- set due carte possono avere lo stesso numero (PAL 050 e PAR 050), quindi il numero di set_carte
-- diventa un progressivo e il codice vero della carta sta nella colonna nuova:
--     BOO24  → "PAL 050"      PPS6 → "SFA 063"      WCD23 → "CRE 061"      WCD25 → "086"      BA24 → "A42"
-- La chiave (sigla, numero, variante) non cambia. Per i set normali "codice" resta vuota.
--
-- Verificato sul DB l'11/11/2026: set_carte ha 9 colonne (sigla, numero, variante, nome, rarita,
-- immagine, aggiornato_il, cardmarket_id, cardmarket_url), nessuna "codice"; catalogo_cerca ha 6
-- parametri ed è quella della 132 (eseguibile solo da authenticated).
--
-- COSA FA
--   1. set_carte.codice (testo, vuota per tutte le righe di oggi).
--   2. catalogo_cerca: stessa di prima, con in più
--        - il parametro p_serie (il set d'origine dentro un masterset promo: "PAL" in "boo pal 050");
--        - il numero cercato anche in fondo al codice ("050" di "PAL 050"), perché nei set promo
--          set_carte.numero è solo un progressivo;
--        - la colonna "codice" nella risposta;
--        - il nome cercato anche nell'indirizzo Cardmarket della carta, dove c'è il nome inglese
--          (il catalogo ha un nome solo, spesso italiano: "Codaurlante" si trova anche con "scream tail").
--      Cambiando parametri e colonne la funzione va tolta e ricreata: per questo c'è un DROP, dentro
--      una transazione (non c'è un momento senza funzione). Il sito di oggi la chiama coi 6 parametri
--      di prima e continua a funzionare: il settimo ha un valore predefinito.
-- Le carte dei set promo arrivano con la 136. Rollback: 135_catalogo_codice_promo_ROLLBACK.sql.

begin;

alter table public.set_carte add column if not exists codice text;
alter table public.set_carte drop constraint if exists set_carte_codice_check;
alter table public.set_carte add constraint set_carte_codice_check
  check (codice is null or codice ~ '^[A-Z0-9]+( [A-Z0-9]+)?$');

drop function if exists public.catalogo_cerca(text, integer, text[], text[], integer, integer);
drop function if exists public.catalogo_cerca(text, integer, text[], text[], integer, integer, text);

create function public.catalogo_cerca(
    p_nome   text    default null,
    p_numero integer default null,
    p_sigle  text[]  default null,
    p_lingue text[]  default null,
    p_totale integer default null,
    p_limite integer default 12,
    p_serie  text    default null
)
returns table (
    sigla text, numero integer, variante text, nome text, immagine text,
    cardmarket_id bigint, cardmarket_url text,
    set_nome text, lingua text, data_uscita date, carte_base integer,
    base boolean, versioni integer, trovate bigint, codice text
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
        select c.sigla, c.numero, c.variante, c.nome, c.immagine, c.cardmarket_id, c.cardmarket_url, c.codice,
               e.nome as set_nome, e.lingua, e.data_uscita, e.carte_base,
               translate(lower(coalesce(c.nome, '')), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu') as nome_norm,
               -- nome + nome inglese preso dall'indirizzo Cardmarket ("Prime-Catcher-V1-WCD25157" → "prime catcher v1"):
               -- così "prime catcher" trova anche la carta che nel catalogo ha il nome italiano
               translate(lower(coalesce(c.nome, '') || ' ' || replace(regexp_replace(coalesce(split_part(c.cardmarket_url, '/', 9), ''),
                         '-[A-Za-z0-9]*[0-9][A-Za-z0-9]*(-[0-9]+[A-Za-z]?)?$', ''), '-', ' ')),
                         'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu') as cerca_norm,
               case c.variante when 'normale' then 0 when 'reverse' then 1 else 2 end as ord
        from public.set_carte c
        join public.set_espansioni e on e.sigla = c.sigla
        cross join par
        where (par.nome_norm is not null or p_numero is not null or p_sigle is not null)
          and (p_numero is null
               or (c.codice is null and c.numero = p_numero)
               or (c.codice is not null and c.codice ~ ('(^|[^0-9])0*' || p_numero::text || '$')))
          and (p_serie is null
               or (c.codice is not null and left(upper(c.codice), length(p_serie) + 1) = upper(p_serie) || ' '))
          and (p_sigle  is null or c.sigla = any (p_sigle))
          and (p_lingue is null or e.lingua = any (p_lingue))
          and (p_totale is null or e.carte_base = p_totale or e.carte_totali = p_totale)
    ),
    filtrate as (
        select r.*
        from righe r
        cross join par
        where par.nome_norm is null
           or r.cerca_norm like all (par.modelli)
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
               max(g.nome_norm) as nome_norm,
               max(g.codice) as codice
        from con_chiave g
        group by g.sigla, g.numero, g.k
    )
    select q.sigla, q.numero, q.variante, q.nome,
           coalesce(q.immagine, max(q.immagine) over (partition by q.sigla, q.numero)) as immagine,
           q.cardmarket_id, q.cardmarket_url,
           q.set_nome, q.lingua, q.data_uscita, q.carte_base,
           (q.k = 0) as base, q.versioni,
           count(*) over () as trovate,
           q.codice
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

comment on function public.catalogo_cerca(text, integer, text[], text[], integer, integer, text) is
  'Ricerca nel catalogo set_carte per il selettore carte del sito (sql/132, sql/135). Sola lettura.';

revoke all on function public.catalogo_cerca(text, integer, text[], text[], integer, integer, text) from public, anon;
grant execute on function public.catalogo_cerca(text, integer, text[], text[], integer, integer, text) to authenticated;

commit;

-- PostgREST deve rileggere le funzioni (lo fa da solo, questo lo fa subito):
notify pgrst, 'reload schema';
