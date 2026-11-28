-- 158: location secondaria delle carte (28/11/2026).
-- Un'etichetta in più sulla carta: la carta resta nella sua location (binder, "Va in Scambio da sola",
-- conteggi e controllo prezzi guardano solo carte.location); la secondaria si vede nella scheda, si
-- usa nel filtro "Location" della Collezione e si dà da Modifica, selezione multipla, Inserimento
-- (per riga o per tutte) e Import CSV.
-- Privacy come per la location: la leggono solo il proprietario (RLS "propria collezione") e, nella
-- vista coda_carte, solo chi ha creato la riga. reclama_carte_per_controllo_prezzi restituisce per le
-- carte degli altri solo i campi del controllo prezzi: la nuova colonna non ci arriva.
-- Le carte ricevute negli scambi nascono senza secondaria (_scambio_trasferisci_riga e
-- concludi_riga_richiesta elencano le colonne).
-- Le funzioni si cambiano con replace sul corpo letto dal vivo: se una riga attesa non c'è
-- esattamente una volta, il file si ferma senza toccare niente.
-- La parte di sposta_riga_in_correzione_manuale è in sql/159 (il corpo contiene una cancellazione:
-- il connettore non la lancia, va nell'SQL Editor). Lanciare 158 prima di 159.

begin;

-- 1. colonne
alter table public.carte add column if not exists location_secondaria text;
alter table public.correzioni_manuali_carte add column if not exists location_secondaria text;
comment on column public.carte.location_secondaria is
  'Seconda location, solo etichetta (sql/158): binder, scambio automatico e conteggi usano solo location.';

-- 2. mai vuota, mai "?", mai uguale alla location principale
create or replace function public._carte_location_secondaria_pulisci()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.location_secondaria := nullif(btrim(new.location_secondaria), '');
  if new.location_secondaria is not null
     and (new.location_secondaria = '?'
          or lower(new.location_secondaria) = lower(btrim(coalesce(new.location, '')))) then
    new.location_secondaria := null;
  end if;
  return new;
end;
$$;

create trigger trg_carte_location_secondaria
  before insert or update of location, location_secondaria on public.carte
  for each row execute function public._carte_location_secondaria_pulisci();

-- 3. vista della coda: colonna nuova in fondo (le colonne di prima restano uguali per l'estensione)
create or replace view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
        CASE
            WHEN creato_da = auth.uid() THEN payload ->> 'location'::text
            ELSE NULL::text
        END AS location,
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
    COALESCE((payload ->> 'sigillata_originale'::text)::boolean, false) AS sigillata_originale,
    payload ->> 'integrita_packaging'::text AS integrita_packaging,
        CASE
            WHEN creato_da = auth.uid() THEN payload ->> 'location_secondaria'::text
            ELSE NULL::text
        END AS location_secondaria
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);

-- 4. funzioni: una riga cambiata per volta
do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      -- inserimento dalla vista: la secondaria va nella richiesta
      ('public._coda_carte_view_insert()',
       $a$'nota', new.nota, 'location', new.location, 'url_diretto', new.url_diretto,$a$,
       $b$'nota', new.nota, 'location', new.location, 'location_secondaria', nullif(btrim(new.location_secondaria), ''), 'url_diretto', new.url_diretto,$b$),
      -- carta completata: la secondaria viene SOLO dalla richiesta del proprietario (come la location)
      ('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)',
       $a$insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)$a$,
       $b$insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale, location_secondaria)$b$),
      ('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)',
       $a$values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))$a$,
       $b$values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false), nullif(v_riga.payload ->> 'location_secondaria', ''))$b$),
      -- rinomina: anche le carte che la usano come secondaria (e una location usata solo così esiste)
      ('public.rinomina_location(text,text)',
       $a$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)$a$,
       $b$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND (location = v_da OR location_secondaria = v_da))$b$),
      ('public.rinomina_location(text,text)',
       $a$GET DIAGNOSTICS v_n_carte = ROW_COUNT;$a$,
       $b$GET DIAGNOSTICS v_n_carte = ROW_COUNT;
    -- sql/158: location secondaria
    UPDATE public.carte SET location_secondaria = v_a
     WHERE owner_id = v_uid AND location_secondaria = v_da;$b$)
    ) as t(funzione, prima, dopo)
  loop
    v_def := pg_get_functiondef(r.funzione::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception '158: in % la riga attesa compare % volte invece di 1: %', r.funzione, v_n, r.prima;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

commit;

-- verifica (deve dare tutto true)
select
  exists (select 1 from information_schema.columns where table_name = 'carte' and column_name = 'location_secondaria') as colonna_carte,
  exists (select 1 from information_schema.columns where table_name = 'correzioni_manuali_carte' and column_name = 'location_secondaria') as colonna_correzioni,
  exists (select 1 from information_schema.columns where table_name = 'coda_carte' and column_name = 'location_secondaria') as colonna_vista,
  exists (select 1 from information_schema.triggers where trigger_name = 'trg_carte_location_secondaria') as trigger_carte,
  pg_get_functiondef('public._coda_carte_view_insert()'::regprocedure) like '%''location_secondaria'', nullif(btrim(new.location_secondaria)%' as vista_insert,
  pg_get_functiondef('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)'::regprocedure) like '%nullif(v_riga.payload ->> ''location_secondaria'', '''')%' as completa,
  pg_get_functiondef('public.rinomina_location(text,text)'::regprocedure) like '%SET location_secondaria = v_a%' as rinomina;
