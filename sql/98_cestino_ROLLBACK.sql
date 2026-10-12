-- ============================================================================
-- 98 — ROLLBACK: toglie cestino, trigger e funzioni. ATTENZIONE: il contenuto
-- del cestino va perso (le righe eliminate restano eliminate).
-- ============================================================================

begin;
drop trigger if exists trg_carte_cestino on public.carte;
drop trigger if exists trg_prodotti_sealed_cestino on public.prodotti_sealed;
drop function if exists public.ripristina_dal_cestino(uuid);
drop function if exists public._cestino_registra();
drop table if exists public.cestino;
commit;
