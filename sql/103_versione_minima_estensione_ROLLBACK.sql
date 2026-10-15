-- ROLLBACK di sql/103: toglie la versione minima dell'estensione.
-- Senza la riga, verifica_versione_minima torna a lasciar passare tutti
-- (resta comunque il blocco su releases/latest-version.txt).
-- Contiene DELETE: da eseguire nell'SQL editor di Supabase.
delete from public.configurazione_app where chiave = 'versione_minima';

-- Verifica: non deve restituire righe.
select chiave, valore from public.configurazione_app where chiave = 'versione_minima';
