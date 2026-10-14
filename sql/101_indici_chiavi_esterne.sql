-- ============================================================================
-- 101 — INDICI SULLE CHIAVI ESTERNE PIU' USATE (advisor "unindexed_foreign_keys")
-- Letti sul DB LIVE il 2026-10-14: 32 chiavi esterne senza indice. Qui solo le
-- 5 che contano davvero: eliminazioni di carte/sealed (anche col cestino e la
-- cascata sulle appartenenze) e letture per proprietario della wishlist.
-- Solo CREATE INDEX IF NOT EXISTS: nessun dato, nessuna policy, nessun
-- comportamento cambia. Le altre 27 sono su tabelle piccole o poco usate.
--
-- PER ANNULLARE: sql/101_indici_chiavi_esterne_ROLLBACK.sql
-- ============================================================================
create index if not exists binder_carte_carta_id_idx on public.binder_carte (carta_id);
create index if not exists scaffale_prodotti_prodotto_id_idx on public.scaffale_prodotti (prodotto_id);
create index if not exists scaffale_prodotti_scaffale_id_idx on public.scaffale_prodotti (scaffale_id);
create index if not exists wishlist_owner_id_idx on public.wishlist (owner_id);
create index if not exists messaggi_richiesta_id_idx on public.messaggi (richiesta_id);
