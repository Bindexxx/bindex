-- ROLLBACK della 145: toglie le miniature di TCGdex messe dalla 145 (non quelle della 144, che stanno
-- su altri numeri di S12A, SV10 e SV4A). Le foto vere delle carte del gruppo non vengono toccate.

begin;

create temp table _foto_145 (sigla text, dal integer, al integer) on commit drop;
insert into _foto_145 values
  ('S8B@JP', 1, 277), ('S10B@JP', 1, 93), ('S10D@JP', 1, 88), ('S12A@JP', 258, 258),
  ('S1W@JP', 1, 68), ('S4A@JP', 1, 326), ('S5R@JP', 1, 81), ('S8A@JP', 1, 29),
  ('SM10@JP', 1, 107), ('SM4A@JP', 1, 55), ('SV10@JP', 99, 132), ('SV11B@JP', 86, 86),
  ('SV4A@JP', 127, 146), ('SV4A@JP', 148, 167);

update public.set_carte s
   set immagine = null,
       aggiornato_il = now()
  from _foto_145 f
 where s.sigla = f.sigla
   and s.codice ~ '^\S+ [0-9]+$'
   and split_part(s.codice, ' ', 2)::integer between f.dal and f.al
   and s.immagine like 'https://assets.tcgdex.net/ja/%';

commit;

select sigla, count(*) filter (where immagine like 'https://assets.tcgdex.net/ja/%') as miniature_giapponesi_rimaste
  from public.set_carte
 where sigla in ('S8B@JP','S10B@JP','S10D@JP','S12A@JP','S1W@JP','S4A@JP','S5R@JP','S8A@JP','SM10@JP','SM4A@JP','SV10@JP','SV11B@JP','SV4A@JP')
 group by sigla order by sigla;
