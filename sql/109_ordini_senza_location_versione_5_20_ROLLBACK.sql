-- ROLLBACK di sql/109: toglie il vincolo "niente location in ordini.parametri"
-- e riporta la versione minima dell'estensione a 5.18 (il valore prima di
-- sql/109). Le location NON tornano in ordini.parametri (resterebbero
-- leggibili da tutti): se serve, lo fa il ROLLBACK di sql/108, da eseguire
-- DOPO questo.
-- Contiene DROP: da eseguire nell'SQL editor di Supabase.
alter table public.ordini drop constraint if exists ordini_parametri_senza_location;

insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.18')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- Verifica: versione_minima 5.18, vincolo assente (null).
select (select valore from public.configurazione_app where chiave = 'versione_minima') as versione_minima,
       (select conname from pg_constraint
         where conrelid = 'public.ordini'::regclass and conname = 'ordini_parametri_senza_location') as vincolo;
