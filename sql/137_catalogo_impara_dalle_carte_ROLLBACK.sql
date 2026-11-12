-- ROLLBACK della 137 — il catalogo smette di imparare dalle carte. Link e miniature già imparati (e i
-- link spostati sulla riga giusta) restano dove sono: sono le pagine e le immagini vere delle carte.

begin;
drop trigger if exists trg_carte_insegna_al_catalogo on public.carte;
drop function if exists public._carte_insegna_al_catalogo();
drop function if exists public._catalogo_impara(text, text, text, text);
drop index if exists public.set_carte_cardmarket_url_idx;
commit;
