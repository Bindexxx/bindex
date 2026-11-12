-- ROLLBACK della 138 — rimette i numeri di prodotto com'erano (anche quelli sbagliati) e toglie la
-- colonna. Link e miniature imparati nel frattempo restano.

begin;
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'set_carte' and column_name = 'cardmarket_id_dubbio') then
        update public.set_carte
        set cardmarket_id = cardmarket_id_dubbio, aggiornato_il = now()
        where cardmarket_id_dubbio is not null;
        alter table public.set_carte drop column cardmarket_id_dubbio;
    end if;
end $$;
commit;
