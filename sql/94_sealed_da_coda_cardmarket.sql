-- ============================================================================
-- 94 — Inserimento SEALED con ricerca Cardmarket (2026-10-09)
--
-- PROBLEMA (Claudio): da Inserimento > Sealed qualunque testo ("efudshfu...")
-- veniva accettato e salvato direttamente in prodotti_sealed, senza alcuna
-- verifica su Cardmarket, e in Collezione non compariva nulla.
--
-- VERIFICATO (solo letture, progetto xpfibrzsffurdlypxnrw, 2026-10-09) e letto
-- nel codice dell'estensione v5.16 (releases/cardsync-extension.zip):
--  1) L'estensione (aggiungi_carta_popup.js) per le righe di coda_carte con
--     tipo='sealed' GIA' cerca su Cardmarket (/Products/, LEGGI_SEALED) e poi
--     chiama la RPC completa_riga_coda_carte(..., p_tipo='sealed', ...).
--  2) Quella RPC (live) scrive SEMPRE in carte (tipo='sealed', il vecchio
--     meccanismo ritirato in Fase 1) o in wishlist: mai in prodotti_sealed /
--     wishlist_sealed, dove leggono widget Sealed, Scaffali e prezzi.
--  3) La vista coda_carte non ha nessun campo per l'integrita' del packaging.
-- => NESSUNA modifica all'estensione: basta far scrivere la RPC nelle tabelle
--    giuste quando p_tipo='sealed'.
--
-- COSA FA (una transazione):
--  A) vista coda_carte: nuova colonna in fondo integrita_packaging (dal payload).
--  B) _coda_carte_view_insert: porta integrita_packaging nel payload.
--  C) completa_riga_coda_carte (stessa firma): se p_tipo='sealed'
--       - collezione -> prodotti_sealed (+ movimento 'sealed')
--       - wishlist   -> wishlist_sealed
--     l'integrita' viene letta dalla riga di coda stessa (payload).
--     Per tutto il resto il corpo e' identico a quello live.
-- Righe di coda sealed GIA' in attesa (se ce ne sono) verranno completate
-- con la nuova logica: e' voluto.
-- PER ANNULLARE: sql/94_sealed_da_coda_cardmarket_ROLLBACK.sql
-- ============================================================================

begin;

-- A) vista: definizione live + colonna in coda
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
    COALESCE((payload ->> 'sigillata_originale'::text)::boolean, false) AS sigillata_originale,
    payload ->> 'integrita_packaging'::text AS integrita_packaging
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);

-- B) funzione insert: live + integrita_packaging
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
      'sigillata_originale', coalesce(new.sigillata_originale, false),
      'integrita_packaging', new.integrita_packaging
    ))
  );
  return new;
end;
$function$;

-- C) RPC: ramo sealed
create or replace function public.completa_riga_coda_carte(
    p_riga_coda_id bigint, p_nome text, p_codice text, p_location text, p_qty integer,
    p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text,
    p_immagine text default null::text, p_tipo text default null::text,
    p_destinazione text default 'collezione'::text, p_prezzo_obiettivo numeric default null::numeric,
    p_sigillata_originale boolean default false)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_riga     coda_lavoro%rowtype;
    v_nuovo_id uuid;
    v_integr   text;
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
    select * into v_riga from coda_lavoro
     where id = p_riga_coda_id and tipo in ('aggiungi_carta', 'aggiungi_wishlist')
     for update;
    if not found then
        raise exception 'Riga coda_carte % non trovata — impossibile determinare il proprietario', p_riga_coda_id;
    end if;
    if v_riga.stato = 'completato' then
        raise exception 'Riga coda_carte % già completata', p_riga_coda_id;
    end if;
    v_integr := coalesce(nullif(v_riga.payload ->> 'integrita_packaging', ''), 'sigillato_integro');

    if p_tipo = 'sealed' and p_destinazione = 'wishlist' then
        insert into wishlist_sealed (owner_id, nome, qty, lingua, integrita_minima, prezzo_obiettivo, note, immagine)
        values (v_riga.creato_da, p_nome, p_qty, p_lingua, v_integr, p_prezzo_obiettivo, p_note, p_immagine)
        returning id into v_nuovo_id;
    elsif p_tipo = 'sealed' then
        insert into prodotti_sealed (owner_id, nome, codice, qty, lingua, integrita_packaging, prezzo, url, note, immagine)
        values (v_riga.creato_da, p_nome, nullif(p_codice, ''), p_qty, p_lingua, v_integr, p_prezzo, p_url, p_note, p_immagine)
        returning id into v_nuovo_id;
        insert into public.movimenti_collezione
            (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
        values
            (v_riga.creato_da, 'aggiunta', 'sealed', v_nuovo_id, p_nome, p_qty,
             p_prezzo, case when p_prezzo is not null then p_prezzo * p_qty else null end, 'rpc');
    elsif p_destinazione = 'wishlist' then
        insert into wishlist (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, prezzo_obiettivo)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, p_prezzo_obiettivo)
        returning id into v_nuovo_id;
    else
        insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))
        returning id into v_nuovo_id;
        insert into public.movimenti_collezione
            (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
        values
            (v_riga.creato_da, 'aggiunta', 'carta', v_nuovo_id, p_nome, p_qty,
             p_prezzo, case when p_prezzo is not null then p_prezzo * p_qty else null end, 'rpc');
    end if;
    update coda_lavoro set stato = 'completato', completato_il = now() where id = p_riga_coda_id;
    return v_nuovo_id;
end;
$function$;

commit;

-- VERIFICA (dopo l'esecuzione):
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='coda_carte' and column_name='integrita_packaging';   -- 1
--   select pg_get_functiondef('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)'::regprocedure) like '%prodotti_sealed%';  -- true
--   select count(*) from pg_trigger where tgrelid='public.coda_carte'::regclass and not tgisinternal;  -- 3 (i trigger restano)
