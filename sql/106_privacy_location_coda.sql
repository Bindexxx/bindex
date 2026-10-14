-- ============================================================================
-- 106 — PRIVACY DELLE LOCATION NELLA CODA CONDIVISA (estensione 5.17, audit C4)
-- Letto sul DB LIVE il 2026-10-15:
-- - coda_carte è una vista (owner postgres, senza security_invoker) sopra
--   coda_lavoro: ignora la RLS di coda_lavoro ("vede le proprie richieste"),
--   quindi chiunque sia loggato legge le righe in coda di TUTTI, location
--   compresa. INSERT/DELETE passano da trigger INSTEAD OF che controllano il
--   proprietario; UPDATE è aperto a tutti (serve: chi aiuta il gruppo prende
--   in carico le righe degli altri) e non tocca mai la location.
-- - completa_riga_coda_carte scriveva nella carta la location MANDATA DAL
--   CLIENT: per le righe degli altri l'hub manda quella della riga o, se
--   vuota, quella del dispositivo di chi lavora (decisione 20/08, superata
--   dalla regola privacy "nessuno legge le location degli altri").
--
-- COSA CAMBIA (decisione di Claudio, 2026-10-15: "a"):
-- 1. Vista coda_carte: la colonna location è piena solo per le PROPRIE righe
--    (creato_da = auth.uid()); per gli altri è NULL. Tutto il resto della
--    vista è identico (stesse colonne, stesso ordine, stessi tipi): trigger
--    INSTEAD OF e permessi restano quelli di prima.
-- 2. completa_riga_coda_carte: se chi completa NON è il proprietario della
--    riga, la location la prende il database dalla richiesta originale
--    (payload) e ignora quella mandata dal client; se la richiesta non aveva
--    location, la carta resta senza (la imposta il proprietario). Le proprie
--    righe: come prima (location mandata dal client).
--
-- Vale anche per l'estensione 5.16: la regola è imposta dal database.
-- Da eseguire nell'SQL editor di Supabase (o via connettore).
-- PER ANNULLARE: sql/106_privacy_location_coda_ROLLBACK.sql
-- ============================================================================

create or replace view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
    -- sql/106: location solo per le proprie righe
    CASE WHEN creato_da = auth.uid() THEN payload ->> 'location'::text ELSE NULL::text END AS location,
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

CREATE OR REPLACE FUNCTION public.completa_riga_coda_carte(p_riga_coda_id bigint, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_destinazione text DEFAULT 'collezione'::text, p_prezzo_obiettivo numeric DEFAULT NULL::numeric, p_sigillata_originale boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_riga     coda_lavoro%rowtype;
    v_nuovo_id uuid;
    v_integr   text;
    v_location text;
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
    -- sql/106: per le righe degli altri la location viene SOLO dalla
    -- richiesta del proprietario, mai da chi completa.
    v_location := case when v_riga.creato_da = auth.uid() then p_location
                       else nullif(v_riga.payload ->> 'location', '') end;

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
        values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, p_prezzo_obiettivo)
        returning id into v_nuovo_id;
    else
        insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)
        values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))
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

-- Verifica: due righe, entrambe con aggiornata = true (la vista contiene
-- auth.uid(), la funzione il commento "sql/106").
select 'vista coda_carte' as oggetto, pg_get_viewdef('public.coda_carte'::regclass) like '%auth.uid()%' as aggiornata
union all
select 'completa_riga_coda_carte', pg_get_functiondef('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)'::regprocedure) like '%sql/106%';
