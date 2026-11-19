-- ROLLBACK di 153: rimette i link di ricerca di prima sulle carte collegate da sql/153, usando la
-- tabella archivio.sql153_carte_url (link vecchio e nuovo di ogni carta). Rimette solo le carte
-- che hanno ancora il link messo da sql/153 (se nel frattempo il controllo prezzi o una correzione
-- l'hanno cambiato, quella carta resta com'è). Poi toglie la tabella e lo schema archivio, se vuoto.
-- Si lancia dall'SQL Editor (contiene DROP).

begin;

update public.carte k
   set url = a.url_vecchio
  from archivio.sql153_carte_url a
 where k.id = a.id
   and k.url = a.url_nuovo;

drop table if exists archivio.sql153_carte_url;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'archivio') then
    execute 'drop schema if exists archivio';
  end if;
end
$$;

commit;

-- Verifica: carte di nuovo col link di ricerca (178 il 19/11) e schema archivio sparito (0).
select (select count(*) from public.carte where stato = 'collezione' and url ilike '%searchString%') as col_link_di_ricerca,
       (select count(*) from pg_namespace where nspname = 'archivio') as schema_archivio;
