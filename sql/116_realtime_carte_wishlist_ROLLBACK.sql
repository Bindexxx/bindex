-- ROLLBACK di sql/116: toglie carte e wishlist dalla pubblicazione realtime
-- (stato letto il 2026-10-15: pubblicazione vuota).
alter publication supabase_realtime drop table public.carte, public.wishlist;
