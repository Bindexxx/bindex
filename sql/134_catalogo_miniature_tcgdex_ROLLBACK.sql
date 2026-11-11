-- ROLLBACK della 134 — toglie le miniature prese da TCGdex. Quelle arrivate dalla collezione
-- (Storage) e quelle che l'estensione avrà messo nel frattempo restano.

update public.set_carte
set immagine = null, aggiornato_il = now()
where immagine like 'https://assets.tcgdex.net/%';
