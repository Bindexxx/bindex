-- ROLLBACK della 132 — toglie la ricerca nel catalogo, l'indice e la colonna del link.
-- Le miniature: prima della 132 il catalogo non ne aveva nessuna (verificato l'11/11/2026: 0 su
-- 33.341 righe), quindi si svuotano solo quelle che la 132 ha preso dallo Storage per le righe a cui
-- ha messo il link. Il sito senza catalogo_cerca() torna a salvare le righe come prima (testo libero).

drop function if exists public.catalogo_cerca(text, integer, text[], text[], integer, integer);

drop index if exists public.set_carte_numero_idx;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'set_carte' and column_name = 'cardmarket_url') then
    update public.set_carte
    set immagine = null
    where cardmarket_url is not null
      and immagine ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/immagini-carte/';
  end if;
end $$;

alter table public.set_carte drop constraint if exists set_carte_cardmarket_url_check;
alter table public.set_carte drop column if exists cardmarket_url;
