-- ============================================================================
-- 116 — AGGIORNAMENTI IN TEMPO REALE PER CARTE E WISHLIST (2026-10-15)
--
-- Letto sul DB LIVE il 2026-10-15: la pubblicazione supabase_realtime esiste
-- ma non contiene NESSUNA tabella. Il sito si iscrive ai cambiamenti di
-- carte e wishlist (cardsRealtimeSubscribe in data/cards.repository.js,
-- usata da ui/cards.ui.js), ma il database non li mandava mai: le carte
-- aggiunte dall'estensione (es. un'importazione CSV) comparivano solo
-- ricaricando la pagina.
--
-- COSA FA: aggiunge public.carte e public.wishlist alla pubblicazione.
-- Le regole RLS restano valide anche per il tempo reale: ognuno riceve solo
-- gli eventi delle righe che può leggere (e il sito filtra per owner_id).
-- ============================================================================

alter publication supabase_realtime add table public.carte, public.wishlist;
