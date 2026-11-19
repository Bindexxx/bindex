-- ROLLBACK di 148: toglie trigger, funzioni e le due colonne (i valori letti si perdono).
-- Prima di lanciarlo: l'estensione dalla 5.76 chiama aggiorna_sigillata_controllo (senza la
-- funzione la chiamata fallisce senza fermare il controllo prezzi) e il sito legge le colonne.

begin;

drop trigger if exists trg_carte_sigillata_pulisci on public.carte;
drop function if exists public._carte_sigillata_pulisci();
drop function if exists public.aggiorna_sigillata_controllo(uuid, numeric, boolean, bigint);
alter table public.carte
  drop column if exists prezzo_minimo_cm,
  drop column if exists prezzo_da_sigillata;

commit;
