-- ROLLBACK di 161: codici e id del catalogo come prima.

begin;

-- 1: i codici presi dal link tornano vuoti
update public.set_carte c
   set codice = null
  from (select sigla, numero, variante,
               regexp_match(regexp_replace(cardmarket_url, '^.*/', ''), '-(?:s8a)?([A-Z]{2,5})-?(\d{1,3})$') m
          from public.set_carte
         where sigla in ('BA20', 'BA22', 'WCD19')) x
 where c.sigla = x.sigla and c.numero = x.numero and c.variante = x.variante
   and x.m is not null
   and x.m[1] not in ('BA', 'PPS', 'WCD')
   and c.codice = x.m[1] || ' ' || x.m[2];

-- 2: WCD 2025 col solo numero (prima nessun codice WCD25 aveva il set davanti)
update public.set_carte
   set codice = regexp_replace(codice, '^[A-Z]+ ', '')
 where sigla = 'WCD25' and codice ~ '^[A-Z]+ \d+$';

-- 3
update public.set_carte
   set cardmarket_id = null, cardmarket_url = null
 where sigla = 'CEL-CC' and numero in (20, 21);

-- 4: il link di ricerca di prima
update public.carte
   set url = 'https://www.cardmarket.com/it/Pokemon/Products/Search?category=-1&searchString=professorOAKimpostoreCEL&category=-1&searchMode=v2'
 where id = '0157c967-652d-4b4b-a597-04babcd6603f'
   and url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Celebrations/Imposter-Professor-Oak';

commit;
