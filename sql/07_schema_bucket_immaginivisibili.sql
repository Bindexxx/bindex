-- ============================================================
-- CardSync Pro — Fase 4-bis: bucket pubblico copie approvate
-- (risolve il limite: sleeve 'upload' non visibili a viewer
-- anonimi su scambio.html/wishlist.html, bucket privato)
-- Da eseguire DOPO 06_rpc_leggi_card_back_approvata.sql, in
-- Supabase: Dashboard > SQL Editor > New query.
--
-- Riusa public.is_admin() già esistente (vedi
-- 03_schema_ban_media_logs.sql) per le policy di scrittura — stesso
-- pattern già in produzione su 'user-media', non è nuovo codice di
-- sicurezza, solo lo stesso applicato a un bucket diverso.
-- ============================================================

-- 1) Bucket pubblico per le copie APPROVATE (non gli originali —
--    quelli restano nel bucket privato 'user-media'). Due cartelle
--    logiche: carta/ (card_back) e binder/ (binder_cover). Un solo
--    file per utente per cartella, nome = {user_id}.png, sovrascritto
--    a ogni nuova approvazione (nessuna cronologia, come user_media).
insert into storage.buckets (id, name, public)
values ('immaginivisibili', 'immaginivisibili', true)
on conflict (id) do nothing;

-- 2) Lettura pubblica — chiunque, anche senza login.
create policy "lettura pubblica immaginivisibili"
on storage.objects for select
using (bucket_id = 'immaginivisibili');

-- 3) Scrittura SOLO admin (chi approva scrive la copia pubblica —
--    fatto da admin.html dopo ogni approvazione, vedi Fase 4-bis
--    lato client). Nessun utente normale può scrivere qui.
create policy "admin scrive immaginivisibili"
on storage.objects for insert
with check (bucket_id = 'immaginivisibili' and public.is_admin());

create policy "admin sovrascrive immaginivisibili"
on storage.objects for update
using (bucket_id = 'immaginivisibili' and public.is_admin());

-- ============================================================
-- ROLLBACK:
--
-- drop policy if exists "admin sovrascrive immaginivisibili" on storage.objects;
-- drop policy if exists "admin scrive immaginivisibili" on storage.objects;
-- drop policy if exists "lettura pubblica immaginivisibili" on storage.objects;
-- (il bucket stesso si elimina da Dashboard > Storage, non da SQL)
-- ============================================================

-- ============================================================
-- VERIFICA DA FARE SUL DB REALE:
-- 1) Dashboard > Storage: bucket 'immaginivisibili' presente, marcato Public.
-- 2) select * from storage.buckets where id = 'immaginivisibili';
--    → public deve essere true.
-- ============================================================
