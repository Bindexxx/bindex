-- ROLLBACK della 146: toglie il controllo mensile delle foto (appuntamenti, funzioni, tabelle).
-- Le foto già scritte nel catalogo restano: per toglierle vedi la query commentata in fondo.

begin;

do $$
begin
    if exists (select 1 from cron.job where jobname = 'catalogo-foto-chiedi') then
        perform cron.unschedule('catalogo-foto-chiedi');
    end if;
    if exists (select 1 from cron.job where jobname = 'catalogo-foto-leggi') then
        perform cron.unschedule('catalogo-foto-leggi');
    end if;
end $$;

drop function if exists public._catalogo_foto_leggi();
drop function if exists public._catalogo_foto_chiedi();
drop table if exists public.catalogo_foto_giri;
drop table if exists public.catalogo_foto_fonti;

commit;

select count(*) as appuntamenti_rimasti from cron.job where jobname like 'catalogo-foto-%';

-- Per togliere anche le foto scritte dal controllo mensile (solo quelle arrivate dopo la 146):
--   update public.set_carte set immagine = null, aggiornato_il = now()
--    where immagine like 'https://assets.tcgdex.net/%'
--      and sigla like '%@%'
--      and aggiornato_il > '<data e ora di esecuzione della 146>';
