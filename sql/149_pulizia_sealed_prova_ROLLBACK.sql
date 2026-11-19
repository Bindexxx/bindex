-- ROLLBACK di 149: rimette le 4 righe di prova dei sealed e i 3 movimenti, identici a prima.
begin;

insert into public.prodotti_sealed (id, owner_id, nome, qty, lingua, integrita_packaging, stato, created_at, updated_at)
values
  ('06149216-57aa-4999-b340-d7e752e60c1d', '2f035d6d-602a-4295-9cb3-741299a9526c', 'booster box scintille', 1, 'IT', 'sigillato_integro', 'collezione', '2026-10-02T10:00:13.756347+00:00', '2026-10-02T10:00:13.756347+00:00'),
  ('2f90f387-d6e9-426d-94cf-8a4f0812f4fe', '2f035d6d-602a-4295-9cb3-741299a9526c', '4wferd', 1, 'IT', 'sigillato_integro', 'collezione', '2026-10-02T10:00:51.702143+00:00', '2026-10-02T10:00:51.702143+00:00'),
  ('7584e521-97df-47f8-b663-3521a3d79392', '87048bf9-dcde-4bab-a44d-98651c425871', 'gfhfghfh', 1, 'IT', 'sigillato_integro', 'collezione', '2026-10-04T21:05:00.643942+00:00', '2026-10-04T21:05:00.643942+00:00');

insert into public.wishlist_sealed (id, owner_id, nome, qty, lingua, integrita_minima, created_at)
values ('2d5d4792-05e5-435d-9ac1-056ff25c693c', '2f035d6d-602a-4295-9cb3-741299a9526c', 'booster box ossidiana', 1, 'IT', 'sigillato_integro', '2026-10-02T10:00:00.592291+00:00');

insert into public.movimenti_collezione (id, owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte, avvenuto_il)
values
  (4, '2f035d6d-602a-4295-9cb3-741299a9526c', 'aggiunta', 'sealed', '06149216-57aa-4999-b340-d7e752e60c1d', 'booster box scintille', 1, null, null, 'sito', '2026-10-02T10:00:15.638394+00:00'),
  (5, '2f035d6d-602a-4295-9cb3-741299a9526c', 'aggiunta', 'sealed', '2f90f387-d6e9-426d-94cf-8a4f0812f4fe', '4wferd', 1, null, null, 'sito', '2026-10-02T10:01:28.502879+00:00'),
  (6, '87048bf9-dcde-4bab-a44d-98651c425871', 'aggiunta', 'sealed', '7584e521-97df-47f8-b663-3521a3d79392', 'gfhfghfh', 1, null, null, 'sito', '2026-10-04T21:05:02.980933+00:00');

commit;
