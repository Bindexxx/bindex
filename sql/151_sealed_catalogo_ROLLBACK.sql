-- ROLLBACK di 151: toglie l'elenco dei prodotti sealed di Cardmarket.
-- PRIMA, dalla dashboard di Supabase (Storage): svuotare e cancellare il bucket "sealed-foto".
-- Lo storage non lascia cancellare file e bucket con l'SQL (trigger protect_objects_delete e
-- protect_buckets_delete), per questo si fa a mano.
-- Le estensioni 5.78 e successive, senza queste funzioni, smettono da sole di leggere l'elenco
-- (la funzione catalogo_sealed_e_mio non risponde → nessun lavoro).

begin;

drop policy if exists "chiunque legge le foto sealed" on storage.objects;
drop policy if exists "catalogo sealed carica le foto" on storage.objects;
drop policy if exists "catalogo sealed sostituisce le foto" on storage.objects;

drop function if exists public.catalogo_sealed_foto_salvata(text, text);
drop function if exists public.catalogo_sealed_foto_mancanti(integer);
drop function if exists public.catalogo_sealed_errore(integer, integer, text);
drop function if exists public.catalogo_sealed_salva_pagina(integer, integer, jsonb, boolean, integer);
drop function if exists public.catalogo_sealed_salva_espansioni(integer, jsonb);
drop function if exists public.catalogo_sealed_prossimo();
drop function if exists public.catalogo_sealed_e_mio();

drop table if exists public.sealed_catalogo_giri;
drop table if exists public.sealed_catalogo;
drop table if exists public.sealed_espansioni_cm;

delete from public.configurazione_app where chiave = 'catalogo_sealed_utente';

commit;

-- Verifica (tutto a 0):
select (select count(*) from information_schema.tables where table_schema = 'public' and table_name like 'sealed\_%') as tabelle,
       (select count(*) from pg_proc where proname like 'catalogo_sealed_%') as funzioni,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname ilike '%sealed%') as policy,
       (select count(*) from public.configurazione_app where chiave = 'catalogo_sealed_utente') as configurazione;
