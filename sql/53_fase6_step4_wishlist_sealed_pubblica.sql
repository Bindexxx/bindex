-- ============================================================================
-- CardSync Pro — 53: Fase 6, Step 4 — RPC pubblica Wishlist Sealed
--
-- Funzione NUOVA (nessuna firma precedente da preservare, CREATE OR REPLACE
-- basta) — mirror di leggi_wishlist_condivisa (sql/13, mai toccata da
-- allora, verificata invariata: nessun file successivo la modifica) per la
-- tabella wishlist_sealed (sql/52, Fase 6 Step 1).
--
-- NOTA: wishlist_sealed non ha una colonna 'prezzo' (solo prezzo_obiettivo —
-- scelta di sql/52, mirror semplificato di 'wishlist' che invece un
-- 'prezzo' ce l'ha). Il lato pubblico quindi non potrà mostrare un prezzo
-- di riferimento per riga sealed nel riepilogo, solo l'obiettivo — 
-- limitazione nota, non un bug: se in futuro serve un prezzo di
-- riferimento anche lì, serve prima un ALTER TABLE separato (fuori scope
-- di questo file, decisione da prendere con Claudio).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leggi_wishlist_sealed_condivisa(p_owner_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, set_espansione text, lingua text, integrita_minima text, qty integer, prezzo_obiettivo numeric, note text, immagine text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select id, nome, codice, set_espansione, lingua, integrita_minima, qty,
           prezzo_obiettivo, note, immagine
    from public.wishlist_sealed
    where owner_id = p_owner_id
    order by nome;
$function$;

-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- select proname from pg_proc where proname = 'leggi_wishlist_sealed_condivisa';
-- select * from leggi_wishlist_sealed_condivisa('<un owner_id con wishlist sealed>');
-- ============================================================================
