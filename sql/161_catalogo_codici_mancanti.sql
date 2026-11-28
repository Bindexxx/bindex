-- 161: codici mancanti nel catalogo (WCD, Battle Academy, CEL) (28/11/2026).
-- Il codice di una carta dei mazzi (WCD, BA, PPS…) è quello stampato sulla carta ("PRE 004"):
-- serve a trovarla scrivendo "wcd25 pre 004" o "ba sum 126" (catalogo_cerca, p_serie).
-- 1. Battle Academy 2020/2022 e WCD 2019: codice preso dal link di Cardmarket ("…-V1-SUM126" →
--    "SUM 126", "…-s8aTEU-106" → "TEU 106"), solo se manca. Energie e carte senza numero restano.
-- 2. WCD 2025: Cardmarket dà solo il numero ("004"). Il set si ricava dalla stessa carta (stesso
--    nome, stesso numero) nei set usciti dal 2023 ad agosto 2025 (il formato dei Mondiali 2025):
--    solo se ce n'è una sola. "Ordini del Capo - Ghecis" a mano (PAL 172: nel set si chiama
--    "Ordini del Capo"). Restano col solo numero le carte senza un set sicuro.
-- 3. CEL-CC 20 e 21 (Reshiram e Zekrom della Collezione Classica): id e pagina di Cardmarket,
--    verificati sul sito il 28/11 (576790 → Reshiram-V2 "CEL BLW 113", 576791 → Zekrom-V2
--    "CEL BLW 114").
-- 4. La carta "Professor Oak, l'impostore" (CEL BS 73) in collezione aveva un link di ricerca al posto
--    della pagina (prezzo letto 0,20 € da una ricerca): pagina giusta verificata il 28/11
--    (576774 → Celebrations/Imposter-Professor-Oak) e ricontrollo del prezzo in cima.
-- Il giro dal catalogo TCGdex non li sovrascrive (scrive solo dove manca).

begin;

-- 1
update public.set_carte c
   set codice = m[1] || ' ' || m[2]
  from (select sigla, numero, variante,
               regexp_match(regexp_replace(cardmarket_url, '^.*/', ''), '-(?:s8a)?([A-Z]{2,5})-?(\d{1,3})$') m
          from public.set_carte
         where sigla in ('BA20', 'BA22', 'WCD19') and codice is null) x
 where c.sigla = x.sigla and c.numero = x.numero and c.variante = x.variante
   and x.m is not null
   and x.m[1] not in ('BA', 'PPS', 'WCD');

-- 2
with w as (
  select sigla, numero, variante, nome, codice from public.set_carte
   where sigla = 'WCD25' and codice ~ '^\d+$'
), trovate as (
  select w.sigla, w.numero, w.variante, w.codice,
         array_agg(distinct c.sigla) as sigle
    from w
    join public.set_carte c
      on c.numero = w.codice::int
     and regexp_replace(lower(c.nome), '[^a-zà-ù0-9]', '', 'g') = regexp_replace(lower(w.nome), '[^a-zà-ù0-9]', '', 'g')
    join public.set_espansioni e on e.sigla = c.sigla
   where c.sigla !~ '^(WCD|PPS|BA|BOO|MCD|TK|MFB)' and c.sigla !~ '@'
     and e.data_uscita between '2023-01-01' and '2025-08-31'
   group by 1, 2, 3, 4
)
update public.set_carte c
   set codice = t.sigle[1] || ' ' || t.codice
  from trovate t
 where c.sigla = t.sigla and c.numero = t.numero and c.variante = t.variante
   and cardinality(t.sigle) = 1;

update public.set_carte
   set codice = 'PAL 172'
 where sigla = 'WCD25' and codice = '172' and nome = 'Ordini del Capo - Ghecis';

-- 3
update public.set_carte
   set cardmarket_id = 576790,
       cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Celebrations/Reshiram-V2'
 where sigla = 'CEL-CC' and numero = 20 and cardmarket_id is null;
update public.set_carte
   set cardmarket_id = 576791,
       cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Celebrations/Zekrom-V2'
 where sigla = 'CEL-CC' and numero = 21 and cardmarket_id is null;

-- 4
update public.carte
   set url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Celebrations/Imposter-Professor-Oak',
       ultimo_controllo = null
 where id = '0157c967-652d-4b4b-a597-04babcd6603f'
   and url like '%/Products/Search?%searchString=professorOAKimpostoreCEL%';

commit;

-- verifica
select sigla,
       count(*) filter (where codice is null) senza_codice,
       count(*) filter (where codice ~ '^\d+$') solo_numero,
       count(*) filter (where cardmarket_id is null) senza_id,
       count(*) tot
  from public.set_carte
 where sigla in ('BA20', 'BA22', 'WCD19', 'WCD25', 'CEL-CC')
 group by 1 order by 1;
