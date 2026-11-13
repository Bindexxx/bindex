-- ROLLBACK della 144: toglie le miniature di TCGdex in giapponese messe ai set @JP.
-- Le foto vere delle carte del gruppo non vengono toccate (non sono su assets.tcgdex.net).

begin;

update public.set_carte
   set immagine = null,
       aggiornato_il = now()
 where sigla in ('SV2A@JP','S12A@JP','SV4A@JP','S12@JP','S9A@JP','SV10@JP','SV3@JP','SV7A@JP','SV8A@JP')
   and immagine like 'https://assets.tcgdex.net/ja/%';

commit;

select count(*) as miniature_giapponesi_rimaste
  from public.set_carte
 where immagine like 'https://assets.tcgdex.net/ja/%';
