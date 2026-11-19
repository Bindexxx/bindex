-- 153: link della carta presi dal catalogo per le carte salvate con un link di ricerca
-- (decisione di Claudio del 19/11/2026). Sono carte di francesco importate il 22/08 con un link
-- di ricerca ("…/Products/Search?…searchString=svi143…"): fino alla 5.79 il controllo prezzi le
-- trovava ma poi riscriveva il link di ricerca (corretto nella 5.80). Con il controllo automatico
-- per fasce (sql/152) quasi tutte sarebbero ripassate solo tra 14-30 giorni: qui si collegano
-- subito quelle che il catalogo conosce con certezza.
--
-- Una carta si collega solo se:
--   - è in collezione, ha ancora un link di ricerca e un codice "SIGLA NUMERO" (es. "SVI 143");
--   - è in una lingua occidentale (IT, EN, DE, FR, ES, PT), come i set "INT" del catalogo;
--   - nel catalogo (set_carte) quel set e quel numero, versione normale, hanno UNA sola pagina
--     Cardmarket, e la pagina finisce con la stessa sigla e lo stesso numero ("…-SVI143");
--   - la riga del catalogo non è segnata come dubbia (cardmarket_id_dubbio).
-- Il 19/11 sono 61 carte. Le altre (soprattutto le versioni speciali xBLK/xWHT, con una pagina
-- loro) restano al controllo prezzi, che dalla 5.80 salva il link giusto.
--
-- Prima di cambiare, ogni coppia link vecchio/link nuovo va in archivio.sql153_carte_url (schema
-- non visibile dalle API del sito, nessun permesso agli utenti): il ROLLBACK la usa per rimettere
-- esattamente i link di prima. Si cambiano solo le carte che hanno ancora esattamente il link
-- vecchio. Sulla carta cambia solo url (e updated_at): prezzi, storico e scambi non si toccano.

begin;

create schema if not exists archivio;

create table archivio.sql153_carte_url (
  id uuid primary key,
  codice text,
  url_vecchio text not null,
  url_nuovo text not null,
  cambiato_il timestamptz not null default now()
);

insert into archivio.sql153_carte_url (id, codice, url_vecchio, url_nuovo)
select c.id, c.codice, c.url_vecchio, c.pagine[1]
  from (
    select k.id, k.codice, k.url as url_vecchio,
           upper(split_part(k.codice, ' ', 1)) as sigla,
           split_part(k.codice, ' ', 2)::int as numero,
           (select array_agg(distinct s.cardmarket_url)
              from public.set_carte s
             where s.sigla = upper(split_part(k.codice, ' ', 1))
               and s.numero = split_part(k.codice, ' ', 2)::int
               and s.codice is null
               and s.variante = 'normale'
               and s.cardmarket_url is not null) as pagine,
           (select count(*)
              from public.set_carte s
             where s.sigla = upper(split_part(k.codice, ' ', 1))
               and s.numero = split_part(k.codice, ' ', 2)::int
               and s.codice is null
               and s.variante = 'normale'
               and s.cardmarket_id_dubbio is not null) as dubbie
      from public.carte k
     where k.stato = 'collezione'
       and k.url ilike '%/Products/Search%searchString=%'
       and k.codice ~ '^[A-Za-z0-9]+ [0-9]{1,4}$'
       and upper(coalesce(k.lingua, '')) in ('IT', 'EN', 'DE', 'FR', 'ES', 'PT')
  ) c
 where array_length(c.pagine, 1) = 1
   and c.dubbie = 0
   and c.pagine[1] ~ '^https://www\.cardmarket\.com/it/Pokemon/Products/Singles/[^/?#]+/[^/?#]+$'
   and split_part(c.pagine[1], '/', 9) ~* ('-' || c.sigla || '0*' || c.numero::text || '$');

update public.carte k
   set url = a.url_nuovo
  from archivio.sql153_carte_url a
 where k.id = a.id
   and k.url = a.url_vecchio;

commit;

-- Verifica: carte in archivio e carte col link nuovo (uguali, 61 il 19/11), carte ancora col
-- link di ricerca (178 - 61 = 117), e nessun permesso sullo schema archivio per gli utenti.
select (select count(*) from archivio.sql153_carte_url) as in_archivio,
       (select count(*) from public.carte k join archivio.sql153_carte_url a on a.id = k.id and k.url = a.url_nuovo) as collegate,
       (select count(*) from public.carte where stato = 'collezione' and url ilike '%searchString%') as ancora_ricerca,
       has_schema_privilege('authenticated', 'archivio', 'USAGE') as utenti_vedono_archivio;
