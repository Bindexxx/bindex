-- 149: tolgo le 4 righe di prova dei sealed (decisione di Claudio del 19/11/2026).
-- Verificate sul DB il 19/11: aggiunte dal sito il 2 e 4 ottobre durante il restyle, mai passate
-- dall'estensione, senza link, prezzo, foto, note, scaffali, richieste di scambio o storico prezzi.
--   prodotti_sealed  06149216-…  "booster box scintille"  (prova)
--   prodotti_sealed  2f90f387-…  "4wferd"                 (prova)
--   prodotti_sealed  7584e521-…  "gfhfghfh"               (francesco)
--   wishlist_sealed  2d5d4792-…  "booster box ossidiana"  (prova)
-- Con loro vanno i 3 movimenti "aggiunta" e le copie che il trigger del cestino crea cancellando
-- (così non compaiono nel Cestino di nessuno). Il _ROLLBACK le rimette identiche.
-- Contiene DELETE: si lancia dall'SQL Editor.

begin;

delete from public.prodotti_sealed
 where id in ('06149216-57aa-4999-b340-d7e752e60c1d', '2f90f387-d6e9-426d-94cf-8a4f0812f4fe', '7584e521-97df-47f8-b663-3521a3d79392')
   and url is null and prezzo is null and prezzo_cardmarket is null;

delete from public.wishlist_sealed
 where id = '2d5d4792-05e5-435d-9ac1-056ff25c693c';

delete from public.movimenti_collezione
 where id in (4, 5, 6) and oggetto_tipo = 'sealed' and tipo_evento = 'aggiunta';

delete from public.cestino
 where oggetto_id::text in ('06149216-57aa-4999-b340-d7e752e60c1d', '2f90f387-d6e9-426d-94cf-8a4f0812f4fe', '7584e521-97df-47f8-b663-3521a3d79392');

commit;

-- Verifica: tutto a 0
select (select count(*) from public.prodotti_sealed) as prodotti_sealed,
       (select count(*) from public.wishlist_sealed) as wishlist_sealed,
       (select count(*) from public.movimenti_collezione where oggetto_tipo = 'sealed') as movimenti_sealed,
       (select count(*) from public.cestino where tabella = 'prodotti_sealed') as nel_cestino;
