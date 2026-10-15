-- ROLLBACK di sql/107: riporta la versione minima dell'estensione a 5.17
-- (il valore messo da sql/103). Le estensioni 5.17 tornano a funzionare.
-- Per togliere del tutto la versione minima: sql/103_versione_minima_estensione_ROLLBACK.sql
-- Da eseguire nell'SQL editor di Supabase.
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.17')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire una riga "versione_minima | 5.17".
select chiave, valore, aggiornato_il
from public.configurazione_app
where chiave = 'versione_minima';
