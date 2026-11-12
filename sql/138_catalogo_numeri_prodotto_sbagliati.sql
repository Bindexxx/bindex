-- 138 — Numeri di prodotto Cardmarket sbagliati nel catalogo (12/11/2026).
-- Il selettore del sito, quando una riga del catalogo non ha la pagina Cardmarket, blocca la carta col
-- numero di prodotto (…/Products?idProduct=NUMERO). Quei numeri vengono da TCGdex e alcuni sono
-- sbagliati: l'estensione apre un'altra carta e la aggiunge. È successo il 12/11: scelta "Blissey
-- PGO 052" versione cosmos (669498), aggiunta la pagina di Snorlax-V2-PGO055.
--
-- Verificato sul DB reale e su Cardmarket il 12/11/2026:
--   - la foto del prodotto 669498 è Snorlax "Pokémon GO Gift Tin Holo"; quella del 669497 è Blissey
--     "Pokémon GO Gift Tin Holo" (pagina Blissey-V2-PGO052, carta del gruppo dal 22/08);
--   - idProduct=278888 (nel catalogo AR 17 Gengar) apre "Gengar Lv.44 (AR 16)"; la carta del gruppo
--     AR 17 (pagina Gengar-Lv46-AR17) ha la foto del prodotto 278889;
--   - 345 numeri di prodotto, su 13.305, stanno su più carte diverse (710 carte, 1.225 righe: MA, SS,
--     EX, N2, RO, AR, JU, SMP, FO, Trainer Kit…). Un prodotto è una carta sola, quindi per almeno
--     365 di quelle carte il numero è di sicuro sbagliato. TCGdex abbina per nome: sbaglia quando in
--     un set ci sono più carte con lo stesso nome (Jolteon JU 4 olografica e JU 20 non olografica).
--
-- COSA FA:
--   1. colonna nuova set_carte.cardmarket_id_dubbio: ci va il numero tolto o sostituito, così non si
--      perde niente e il rollback lo rimette;
--   2. corregge i numeri dove una carta del gruppo dà la prova (la foto è quella del prodotto giusto,
--      stessa prova della 137). La correzione si applica solo se la prova c'è ancora al momento
--      dell'esecuzione;
--   3. toglie il numero di prodotto che sta su più carte diverse, tranne dalla carta per cui la foto lo
--      dimostra. Per quelle carte il selettore non blocca più con un link: manda il testo e
--      l'estensione cerca come ha sempre fatto;
--   4. ripassa le carte del gruppo, così le righe corrette prendono pagina e miniatura.
-- Non tocca i masterset promo (numeri letti da Cardmarket) né i link già nel catalogo.
-- RESTA FUORI: un numero sbagliato che sta su una carta sola (come il 669498) non si riconosce dal
-- catalogo. Per quelli serve il controllo nell'estensione (la pagina aperta deve avere il numero di
-- carta chiesto), che arriva con la versione 5.66.
-- VA ESEGUITA DOPO sql/137. Rollback: 138_catalogo_numeri_prodotto_sbagliati_ROLLBACK.sql.

begin;

do $$
begin
    if to_regprocedure('public._catalogo_impara(text, text, text, text)') is null then
        raise exception 'Prima va eseguita sql/137_catalogo_impara_dalle_carte.sql (manca _catalogo_impara)';
    end if;
end $$;

alter table public.set_carte add column if not exists cardmarket_id_dubbio bigint;
comment on column public.set_carte.cardmarket_id_dubbio is
  'Numero di prodotto Cardmarket tolto o sostituito perché inaffidabile (sql/138). Non usarlo per i link.';

-- Le carte del gruppo che possono dare la prova: codice "SIGLA NUMERO", pagina che finisce con quel
-- codice, foto nello Storage (stesse condizioni della regola A della 137).
create temp table _carte_con_foto_138 on commit drop as
select k.set_cat, k.numero, k.cartella, k.foto
from (
    select j.*,
           substring(j.slug from '(?i)-(' || j.sigla || ')-?0*' || j.numero::text || '$') as cartella,
           case when j.sigla ~ '^X[A-Z0-9]{2,}$'
                     and not exists (select 1 from public.set_espansioni e where e.sigla = j.sigla)
                then substr(j.sigla, 2) else j.sigla end as set_cat
    from (
        select upper(split_part(c.codice, ' ', 1)) as sigla,
               split_part(c.codice, ' ', 2)::integer as numero,
               split_part(split_part(c.url, '?', 1), '/', 9) as slug,
               substring(c.immagine from '/immagini-carte/([0-9a-f]{24})\.[a-z]+$') as foto
        from public.carte c
        where c.codice ~ '^[A-Za-z0-9]+ [0-9]{1,4}$'
          and coalesce(c.lingua, '') in ('IT', 'EN', 'DE', 'FR', 'ES', 'PT')
          and split_part(c.url, '?', 1) ~ '^https://www\.cardmarket\.com/[a-z]{2}/Pokemon/Products/Singles/[^/?#]+/[^/?#[:space:]"<>'']+$'
          and c.immagine ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/immagini-carte/[0-9a-f]{24}\.[a-z]+$'
    ) j
    where j.numero > 0
) k
where k.cartella is not null;

-- 2. numeri corretti con la prova. Il numero nuovo è quello della foto di una carta del gruppo
--    (trovato il 12/11/2026); si scrive solo se una carta del gruppo con quel codice ha ancora quella foto.
with correzioni (sigla, numero, varianti, id_nuovo) as (values
    ('PGO', 52, array['holo-cosmos'],       669497::bigint),   -- era 669498 = Snorlax Gift Tin Holo
    ('AR',  17, array['normale', 'reverse'], 278889::bigint),   -- era 278888 = Gengar Lv.44 AR 16
    ('AR',  63, array['normale', 'reverse'], 278935::bigint),   -- era 278934
    ('AR',  67, array['normale', 'reverse'], 278939::bigint),   -- era 278876
    ('AR',  74, array['normale', 'reverse'], 278946::bigint),   -- era 278872
    ('AR',  81, array['normale', 'reverse'], 278953::bigint),   -- era 278952
    ('EX',  65, array['normale', 'reverse'], 274940::bigint)    -- era 274903
),
provate as (
    select z.*
    from correzioni z
    where exists (
        select 1 from _carte_con_foto_138 k
        where k.set_cat = z.sigla and k.numero = z.numero
          and left(encode(sha256(convert_to('https://product-images.s3.cardmarket.com/51/' || k.cartella || '/'
                   || z.id_nuovo::text || '/' || z.id_nuovo::text || '.jpg', 'UTF8')), 'hex'), 24) = k.foto)
)
update public.set_carte s
set cardmarket_id_dubbio = coalesce(s.cardmarket_id_dubbio, s.cardmarket_id),
    cardmarket_id = p.id_nuovo,
    aggiornato_il = now()
from provate p
where s.sigla = p.sigla and s.numero = p.numero and s.variante = any (p.varianti)
  and s.codice is null and s.cardmarket_id is distinct from p.id_nuovo;

-- 3. lo stesso numero di prodotto su carte diverse: si toglie, tranne dove la foto lo dimostra
with doppi as (
    select s.cardmarket_id
    from public.set_carte s
    where s.codice is null and s.cardmarket_id is not null
    group by s.cardmarket_id
    having count(distinct s.sigla || ' ' || s.numero::text) > 1
),
provati as (
    select distinct s.sigla, s.numero, s.cardmarket_id
    from _carte_con_foto_138 k
    join public.set_carte s
      on s.sigla = k.set_cat and s.numero = k.numero and s.codice is null and s.cardmarket_id is not null
     and left(encode(sha256(convert_to('https://product-images.s3.cardmarket.com/51/' || k.cartella || '/'
              || s.cardmarket_id::text || '/' || s.cardmarket_id::text || '.jpg', 'UTF8')), 'hex'), 24) = k.foto
)
update public.set_carte s
set cardmarket_id_dubbio = coalesce(s.cardmarket_id_dubbio, s.cardmarket_id),
    cardmarket_id = null,
    aggiornato_il = now()
from doppi d
where s.cardmarket_id = d.cardmarket_id and s.codice is null
  and not exists (select 1 from provati p
                  where p.sigla = s.sigla and p.numero = s.numero and p.cardmarket_id = s.cardmarket_id);

-- 4. le righe corrette prendono pagina e miniatura dalle carte del gruppo (stesso passaggio della 137)
do $$
declare
    r record;
begin
    for r in select c.codice, c.lingua, c.url, c.immagine from public.carte c
             order by c.ultimo_controllo nulls first, c.id loop
        perform public._catalogo_impara(r.codice, r.lingua, r.url, r.immagine);
    end loop;
end $$;

commit;

-- Controllo a occhio dopo l'esecuzione (non cambia niente):
select count(*) filter (where cardmarket_id_dubbio is not null and cardmarket_id is null)     as numeri_tolti,
       count(*) filter (where cardmarket_id_dubbio is not null and cardmarket_id is not null) as numeri_corretti,
       count(*) filter (where cardmarket_id is not null)                                      as righe_con_numero,
       count(*) filter (where cardmarket_url is not null)                                     as righe_con_link
from public.set_carte;
