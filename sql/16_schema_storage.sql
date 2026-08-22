-- ============================================================================
-- CardSync Pro — 16: Storage — bucket user-media, immagini-carte, foto-carte
-- (testo ESATTO da pg_policies sul DB reale — sostituisce del tutto la
-- bozza non verificata data in precedenza in questa sessione).
--
-- default-assets e immaginivisibili NON sono qui: eseguili da
-- 05_schema_default_assets_bucket.sql e 07_schema_bucket_immaginivisibili.sql
-- (già scritti e verificati in sessioni precedenti). Ordine consigliato per
-- lo storage: 16 → 05 → 07 (o qualunque ordine, sono indipendenti tra loro).
--
-- SCOPERTA in questa sessione: esiste un bucket 'immagini-carte' (pubblico)
-- che non era mai comparso nel codice che avevo analizzato finora — è
-- verosimilmente dove viene ri-ospitata l'immagine reale della carta (campo
-- carte.immagine / wishlist.immagine), scritta da chi processa la riga in
-- coda (utente autenticato). Nessun file JS di questa sessione lo referenzia
-- esplicitamente come stringa bucket — probabile che sia scritto/letto
-- dall'estensione (background.js/content.js), MAI toccata in questo
-- refactoring del sito.
-- ============================================================================

-- ── bucket 'user-media' (privato) ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('user-media', 'user-media', false)
on conflict (id) do nothing;

create policy "utente carica i propri file"
on storage.objects for insert
with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "utente legge i propri file"
on storage.objects for select
using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "utente sostituisce i propri file"
on storage.objects for update
using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admin legge tutti i file"
on storage.objects for select
using (bucket_id = 'user-media' and is_admin());

-- Chiunque sia autenticato può leggere i file GIÀ APPROVATI di un altro
-- utente (non richiede essere admin — verificato sul DB reale, presente
-- così in produzione).
create policy "utenti autenticati leggono i file approvati altrui"
on storage.objects for select
using (
  bucket_id = 'user-media'
  and exists (
    select 1 from user_media m
    where m.storage_path = objects.name and m.status = 'approved'
  )
);

-- ── bucket 'immagini-carte' (pubblico) ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('immagini-carte', 'immagini-carte', true)
on conflict (id) do nothing;

create policy "chiunque legge le immagini carte (bucket pubblico)"
on storage.objects for select
using (bucket_id = 'immagini-carte');

create policy "utenti autenticati caricano immagini carte"
on storage.objects for insert
to authenticated
with check (bucket_id = 'immagini-carte');

create policy "utenti autenticati sovrascrivono immagini carte"
on storage.objects for update
to authenticated
using (bucket_id = 'immagini-carte');

-- ── bucket 'foto-carte' (pubblico) ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('foto-carte', 'foto-carte', true)
on conflict (id) do nothing;

create policy "chiunque puo vedere le foto dettaglio (bucket pubblico)"
on storage.objects for select
using (bucket_id = 'foto-carte');

create policy "utenti caricano le proprie foto dettaglio"
on storage.objects for insert
to authenticated
with check (bucket_id = 'foto-carte' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "utenti eliminano le proprie foto dettaglio"
on storage.objects for delete
to authenticated
using (bucket_id = 'foto-carte' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- VERIFICA DA FARE SUL NUOVO DB, DOPO 16 + 05 + 07:
-- select id, public from storage.buckets order by id;
-- → attesi tutti e 5: default-assets(true), foto-carte(true),
--   immagini-carte(true), immaginivisibili(true), user-media(false).
-- ============================================================================
