-- ROLLBACK di sql/115: niente più annullamento degli ordini dal sito.
-- Gli ordini già 'annullato' restano tali (l'estensione prende solo i
-- 'pending', quindi non ripartono). Da eseguire nell'SQL editor di Supabase.
drop trigger if exists ordini_annullato_resta_annullato on public.ordini;
drop function if exists public.ordini_annullato_resta_annullato();
drop function if exists public.annulla_ordine(uuid);
