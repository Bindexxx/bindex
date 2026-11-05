-- ROLLBACK di sql/127: riporta la versione minima dell'estensione a 5.47
-- (il valore di sql/125). Le estensioni dalla 5.47 in su tornano a funzionare.
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.47')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: deve restituire una riga "versione_minima | 5.47".
select chiave, valore, aggiornato_il from public.configurazione_app where chiave = 'versione_minima';
