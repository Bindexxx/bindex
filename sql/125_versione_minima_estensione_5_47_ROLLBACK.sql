-- ROLLBACK di sql/125: riporta la versione minima dell'estensione a 5.35
-- (il valore messo il 23/10, passo 0a del piano). Le estensioni dalla 5.35 in su
-- tornano a funzionare.
-- Da eseguire nell'SQL editor di Supabase.
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.35')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire una riga "versione_minima | 5.35".
select chiave, valore, aggiornato_il from public.configurazione_app where chiave = 'versione_minima';
