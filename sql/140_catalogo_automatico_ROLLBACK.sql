-- ROLLBACK della 140 — ferma il giro notturno e toglie tabelle e funzioni del catalogo automatico.
-- Le carte già aggiunte al catalogo restano (sono righe vere di TCGdex). B2 torna come prima solo se
-- lo si vuole davvero: la correzione è giusta, quindi qui NON viene annullata.
-- La funzione sul server "catalogo-tcgdex" va cancellata a parte (dashboard, Edge Functions): senza il
-- cron e senza la chiave non fa più niente.
-- pg_cron e pg_net restano installati (non danno fastidio; si tolgono con drop extension se si vuole).

begin;
do $$
begin
    if exists (select 1 from cron.job where jobname = 'catalogo-tcgdex') then
        perform cron.unschedule('catalogo-tcgdex');
    end if;
end $$;
drop function if exists public.catalogo_set_conferma(text, text, text);
drop function if exists public.catalogo_set_ignora(text);
drop function if exists public._catalogo_cron_ok(text);
drop function if exists public._catalogo_segna(text, integer, boolean, text);
drop function if exists public._catalogo_tcgdex_scrivi(text, jsonb);
drop function if exists public._catalogo_prossimo_set();
drop table if exists public.catalogo_giri;
drop table if exists public.catalogo_aggiornamenti;
drop table if exists public.catalogo_tcgdex;
delete from vault.secrets where name = 'catalogo_cron';
commit;
