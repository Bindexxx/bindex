-- ============================================================================
-- 118 ROLLBACK — toglie il controllo prezzi wishlist di gruppo.
-- Da eseguire a mano (DROP). Prima rimettere sui PC un'estensione < 5.37:
-- la 5.37 chiama queste funzioni.
-- ============================================================================
drop function if exists public.conta_wishlist_da_controllare_gruppo(uuid);
drop function if exists public.reclama_wishlist_per_controllo_prezzi(uuid, integer);
drop function if exists public.tagga_dispositivo_claim_gruppo_wishlist(uuid[], text);
drop function if exists public.rilascia_claim_controllo_prezzi_wishlist(text);
drop function if exists public.aggiorna_prezzo_controllo_gruppo_wishlist(uuid, numeric, text);
drop function if exists public.aggiorna_url_controllo_gruppo_wishlist(uuid, text);
drop function if exists public.segna_controllata_gruppo_wishlist(uuid);

alter table public.wishlist drop column if exists claimed_by;
alter table public.wishlist drop column if exists claimed_at;
alter table public.wishlist drop column if exists dispositivo;
