-- ROLLBACK di 150: toglie trigger, funzioni e le due colonne (i valori letti si perdono).
-- Dalla 5.77 l'estensione chiama aggiorna_integrita_controllo_sealed: senza la funzione la chiamata
-- fallisce senza fermare il controllo prezzi.

begin;

drop trigger if exists trg_sealed_integrita_pulisci on public.prodotti_sealed;
drop function if exists public._sealed_integrita_pulisci();
drop function if exists public.aggiorna_integrita_controllo_sealed(uuid, numeric, boolean, bigint);
alter table public.prodotti_sealed
  drop column if exists prezzo_minimo_cm,
  drop column if exists prezzo_da_integrita;

commit;
