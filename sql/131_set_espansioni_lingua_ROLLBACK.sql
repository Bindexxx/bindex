-- ROLLBACK di 131: toglie i set in altre lingue, McDonald's Collection 2026 e la colonna "lingua".
-- Contiene DELETE e DROP: va lanciato dall'SQL Editor.
delete from public.set_espansioni where lingua <> 'INT' or sigla = 'MCD26';
alter table public.set_espansioni drop constraint if exists set_espansioni_lingua_check;
alter table public.set_espansioni drop column if exists lingua;
