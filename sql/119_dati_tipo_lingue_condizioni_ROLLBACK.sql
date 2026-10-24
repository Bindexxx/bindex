-- ============================================================================
-- 119 ROLLBACK — rimette lingue e condizioni com'erano il 2026-10-24, per id.
-- Il tipo 'carta' NON si toglie: NULL e 'carta' valevano già la stessa cosa
-- (il sito tratta come sealed solo tipo = 'sealed').
-- ============================================================================

update public.carte set lingua = 'CIN' where id in (
  '047822ac-0aa2-4ed4-bebc-fe192fc10207','24ac5175-1486-495c-9ba7-04e89b0aa735','24fbc6b0-b1d5-4baa-b140-1db58a95a20b',
  '275dadf5-9f8c-4925-8584-402fa44a901a','2bec9f30-1018-4d77-adbd-d2084168151d','42ae8c64-6064-43c2-91bd-57f3d8d6b452',
  '5165c396-cd4f-4ccf-96cd-cad5a943ed3b','5a9d7602-acde-409c-a775-580fb82d3104','63b72d8f-f07c-4e0d-b3d4-90e564256df4',
  '65f22733-4771-4db7-9e21-54c75615a175','70365cc2-8923-4fa2-af1a-d21a2874bb05','74364846-ecc4-4860-a523-9e8fbda584cc',
  '8841fe97-ce69-411e-872d-5f2fdcc68846','8e532820-a334-486e-9375-4ec42c50ea6e','9adbe535-a7a0-40fa-80aa-fb967fe78a9d',
  '9db9eeb5-098e-436e-8e7a-a4e65cd62715','a2b29452-ff1a-4ef5-a0c5-7ee510e42f34','b959c6af-695d-4e64-b2a0-4a656dd89ad4',
  'c80f758c-c72d-4dfc-8964-6530d92adbed','ce3fa11f-427f-4d3a-b81a-0690625dd050','d022a3b7-03a6-4e50-a6ad-e773001ccf82',
  'd4535fb4-8434-474f-b49b-641db7bd0bbe'
) and lingua = 'CHN';

update public.carte set condizione = 'EXC' where id in (
  '7ea37777-b936-4888-a78a-b0ad666be4d8','87da019d-5c77-4b81-adb1-e6aa87ec2442','f8c47795-29bf-4a56-aced-ec5598946ade'
) and condizione = 'EX';
update public.carte set condizione = 'EXC+' where id = '0157c967-652d-4b4b-a597-04babcd6603f' and condizione = 'EX';
update public.carte set condizione = 'POOR' where id = 'b7c7dc9f-01e1-411a-9158-9d05f78a359d' and condizione = 'PO';
update public.carte set condizione = 'SEALED', sigillata_originale = false
 where id = 'e3cf7b17-52f9-42f4-8f23-fc122d3b82fa' and condizione = 'NM';
