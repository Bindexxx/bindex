-- ============================================================================
-- 93 — coda_carte: colonna sigillata_originale + trigger INSTEAD OF
-- (2026-10-09, errore "Could not find the 'sigillata_originale' column of
-- 'coda_carte' in the schema cache" caricando carte da Inserimento)
--
-- VERIFICATO sul DB (progetto "Bindexxx", 2026-10-09, solo letture):
--  1) la vista public.coda_carte NON espone sigillata_originale (la
--     migrazione 38 non c'e'): il sito la invia, PostgREST rifiuta.
--  2) sulla vista NON esiste nessun trigger (pg_trigger vuoto per
--     coda_carte e per le tre funzioni _coda_carte_view_*): le funzioni ci
--     sono, ma non sono agganciate. Senza INSTEAD OF INSERT nessun inserimento
--     dalla vista puo' funzionare, nemmeno senza la colonna nuova.
--  3) _coda_carte_view_insert live non scrive 'sigillata_originale' nel payload.
--  4) coda_lavoro e' vuota (0 righe), quindi non c'e' niente da migrare.
-- Probabile origine: l'export sql/schema_live_2026-09-25.sql non include i
-- trigger delle viste, e il progetto e' stato ricreato da li'.
--
-- COSA FA (una transazione):
--  A) _coda_carte_view_insert: come sql/38 (porta sigillata_originale nel payload).
--  B) vista coda_carte: stessa definizione live + colonna in fondo
--     (CREATE OR REPLACE VIEW consente solo di aggiungere in coda).
--  C) tre trigger INSTEAD OF (insert/update/delete) sulla vista.
-- Idempotente (DROP TRIGGER IF EXISTS prima di crearli).
-- PER ANNULLARE: sql/93_coda_carte_trigger_e_sigillata_ROLLBACK.sql
-- ============================================================================

begin;

-- A) funzione insert con sigillata_originale (stesso corpo di sql/38)
create or replace function public._coda_carte_view_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'owner_id deve corrispondere all''utente autenticato';
  end if;
  insert into coda_lavoro (tipo, creato_da, payload)
  values (
    case when coalesce(new.destinazione, 'collezione') = 'wishlist' then 'aggiungi_wishlist' else 'aggiungi_carta' end,
    new.owner_id,
    jsonb_strip_nulls(jsonb_build_object(
      'nome', new.nome, 'lingua', coalesce(new.lingua, 'IT'), 'condizione', coalesce(new.condizione, 'NM'),
      'qty', coalesce(new.qty, 1), 'reverse', coalesce(new.reverse, false), 'first_ed', coalesce(new.first_ed, false),
      'nota', new.nota, 'location', new.location, 'url_diretto', new.url_diretto,
      'tipo_prodotto', new.tipo, 'destinazione', coalesce(new.destinazione, 'collezione'),
      'prezzo_obiettivo', new.prezzo_obiettivo,
      'sigillata_originale', coalesce(new.sigillata_originale, false)
    ))
  );
  return new;
end;
$function$;

-- B) vista: definizione live (letta con pg_get_viewdef) + colonna in coda
create or replace view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
    payload ->> 'location'::text AS location,
    payload ->> 'url_diretto'::text AS url_diretto,
    payload ->> 'tipo_prodotto'::text AS tipo,
    COALESCE(payload ->> 'destinazione'::text, 'collezione'::text) AS destinazione,
    NULLIF(payload ->> 'prezzo_obiettivo'::text, ''::text)::numeric AS prezzo_obiettivo,
    stato,
    creato_da AS owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    esito -> 'opzioni_disambiguazione'::text AS opzioni_disambiguazione,
    tentativi_falliti,
    COALESCE(((payload ->> 'sigillata_originale'::text))::boolean, false) AS sigillata_originale
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);

-- C) trigger INSTEAD OF (le tre funzioni esistono gia' sul DB)
drop trigger if exists coda_carte_instead_insert on public.coda_carte;
drop trigger if exists coda_carte_instead_update on public.coda_carte;
drop trigger if exists coda_carte_instead_delete on public.coda_carte;

create trigger coda_carte_instead_insert instead of insert on public.coda_carte
  for each row execute function public._coda_carte_view_insert();
create trigger coda_carte_instead_update instead of update on public.coda_carte
  for each row execute function public._coda_carte_view_update();
create trigger coda_carte_instead_delete instead of delete on public.coda_carte
  for each row execute function public._coda_carte_view_delete();

commit;

-- VERIFICA DOPO:
-- select tgname from pg_trigger where tgrelid = 'public.coda_carte'::regclass and not tgisinternal;   -- 3 righe
-- select column_name from information_schema.columns where table_name='coda_carte' and column_name='sigillata_originale';
