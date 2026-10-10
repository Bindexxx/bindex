-- sql/95 — binders.escludi_valore_collezione
-- Interruttore "Non aggiungere il valore di queste carte alla mia collezione"
-- nelle Impostazioni del binder. Solo una colonna booleana: RLS esistente
-- ("utenti gestiscono i propri binder", ALL, owner_id = auth.uid()) e i due
-- trigger BEFORE (rinomina diretta / forza condivisione) non la toccano.
-- Verificato sul DB live il 2026-10-10: la colonna non esisteva.
-- La regola di calcolo e' tutta lato sito: una carta in collezione non conta
-- nei totali di valore solo se TUTTI i binder che la contengono sono esclusi
-- (la sua location conta sempre come un binder, anche se la riga manca).
alter table public.binders
    add column if not exists escludi_valore_collezione boolean not null default false;
