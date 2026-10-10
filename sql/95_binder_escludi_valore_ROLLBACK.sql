-- ROLLBACK di sql/95
alter table public.binders drop column if exists escludi_valore_collezione;
