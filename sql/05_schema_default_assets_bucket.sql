-- ============================================================
-- CardSync Pro — Fase 2bis: galleria sfondi predefiniti
-- (bucket pubblico condiviso, card_back + binder_cover)
-- Da eseguire DOPO 04_schema_card_back_metadata.sql, in Supabase:
-- Dashboard > SQL Editor > New query.
--
-- Nessuna modifica a policy esistenti su 'user-media' (bucket
-- privato, invariato). Qui si crea SOLO infrastruttura nuova:
-- un bucket pubblico separato + una colonna nullable/con default
-- su user_media. Verificare sul Dashboard reale, dopo l'esecuzione,
-- che il bucket compaia in Storage e che la colonna compaia in
-- Table Editor > user_media, prima di procedere con la UI.
-- ============================================================

-- 1) Bucket pubblico per gli sfondi predefiniti (curati da voi,
--    non dagli utenti). Due cartelle logiche al suo interno,
--    gestite solo come prefisso del path: card_back/ e binder_cover/.
insert into storage.buckets (id, name, public)
values ('default-assets', 'default-assets', true)
on conflict (id) do nothing;

-- 2) Lettura pubblica: chiunque (anche non autenticato) può leggere
--    i file di questo bucket — sono asset pubblici per definizione.
--    NESSUNA policy di insert/update/delete: solo tu puoi scriverci,
--    da Supabase Dashboard (che usa la service_role e bypassa le
--    RLS), non c'è nessun percorso lato client che possa scriverci.
create policy "lettura pubblica default-assets"
on storage.objects for select
using (bucket_id = 'default-assets');

-- 3) Colonna su user_media per distinguere "sleeve caricata
--    dall'utente" da "default scelto dalla galleria". Nullable con
--    default 'upload': le righe esistenti (tutte upload reali)
--    restano corrette senza bisogno di UPDATE retroattivi.
alter table public.user_media
  add column if not exists source text not null default 'upload'
  check (source in ('upload', 'default'));
-- Quando source='default', storage_path NON punta più al bucket
-- privato 'user-media' ma al bucket pubblico 'default-assets'
-- (es. 'card_back/defaultcard.png'). Il codice client sceglierà
-- getPublicUrl() invece di createSignedUrl() in base a questo campo.

-- ============================================================
-- DOPO aver eseguito questa migration, carica MANUALMENTE da
-- Supabase Dashboard > Storage > default-assets (crea le due
-- cartelle al primo upload, si creano da sole scrivendoci dentro):
--   default-assets/card_back/defaultcard.png       (900x1260, 5:7)
--   default-assets/binder_cover/defaultbinder.png  (1024x1419)
-- Questi due file sono il "default puro" di livello 2 per chi non
-- ha mai scelto/caricato nulla. Puoi aggiungerne altri accanto con
-- qualsiasi altro nome: appariranno comunque nella galleria di
-- selezione (Fase 2bis, UI in arrivo dopo conferma di questa SQL).
-- ============================================================
