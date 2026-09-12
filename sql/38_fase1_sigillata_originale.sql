-- ============================================================================
-- CardSync Pro — 38: "Sigillata originale" reale (Opzione B, Fase 1)
--
-- A differenza di reverse_holo/first_ed — verificato che NESSUN percorso di
-- inserimento le scrive mai, né la RPC né l'insert diretto lato estensione —
-- qui sigillata_originale deve funzionare per davvero, dal form Inserimento
-- del sito fino alla riga in carte, passando per la coda condivisa e i due
-- worker dell'estensione (popup + autonomo in background.js).
--
-- ORDINE OBBLIGATORIO: 1) RPC, 2) VISTA (aggiunge la colonna), 3) TRIGGER
-- INSERT (referenzia new.sigillata_originale — richiede che la vista la
-- esponga già). Eseguire in quest'ordine, tutto insieme va bene.
--
-- Da eseguire DOPO 37_fase1_fondazioni_sealed.sql (serve la colonna
-- carte.sigillata_originale, aggiunta lì).
-- ============================================================================


-- ── 1) RPC completa_riga_coda_carte — nuovo parametro IN CODA con DEFAULT,
--       compatibile con qualunque client che non lo passi ancora.
CREATE OR REPLACE FUNCTION public.completa_riga_coda_carte(
  p_riga_coda_id uuid,
  p_nome text,
  p_codice text,
  p_location text,
  p_qty integer,
  p_lingua text,
  p_condizione text,
  p_url text,
  p_prezzo numeric,
  p_note text,
  p_immagine text DEFAULT NULL::text,
  p_tipo text DEFAULT NULL::text,
  p_destinazione text DEFAULT 'collezione'::text,
  p_prezzo_obiettivo numeric DEFAULT NULL::numeric,
  p_sigillata_originale boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_nuovo_id uuid;
begin
  select owner_id into v_owner_id from coda_carte where id = p_riga_coda_id;
  if v_owner_id is null then
    raise exception 'Riga coda_carte % non trovata — impossibile determinare il proprietario', p_riga_coda_id;
  end if;

  if p_destinazione = 'wishlist' then
    insert into wishlist (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, prezzo_obiettivo)
    values (v_owner_id, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, p_prezzo_obiettivo)
    returning id into v_nuovo_id;
  else
    insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)
    values (v_owner_id, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', p_sigillata_originale)
    returning id into v_nuovo_id;
  end if;

  return v_nuovo_id;
end;
$function$;


-- ── 2) Vista coda_carte — nuova colonna IN CODA (obbligatorio per Postgres
--       su CREATE OR REPLACE VIEW: non si può inserire in mezzo). Tutto il
--       resto della definizione è IDENTICO all'originale (verificato dal
--       vivo prima di scrivere questa migration).
CREATE OR REPLACE VIEW public.coda_carte AS
 SELECT id,
    (payload ->> 'nome'::text) AS nome,
    COALESCE((payload ->> 'lingua'::text), 'IT'::text) AS lingua,
    COALESCE((payload ->> 'condizione'::text), 'NM'::text) AS condizione,
    COALESCE(((payload ->> 'qty'::text))::integer, 1) AS qty,
    COALESCE(((payload ->> 'reverse'::text))::boolean, false) AS reverse,
    COALESCE(((payload ->> 'first_ed'::text))::boolean, false) AS first_ed,
    (payload ->> 'nota'::text) AS nota,
    (payload ->> 'location'::text) AS location,
    (payload ->> 'url_diretto'::text) AS url_diretto,
    (payload ->> 'tipo_prodotto'::text) AS tipo,
    COALESCE((payload ->> 'destinazione'::text), 'collezione'::text) AS destinazione,
    (NULLIF((payload ->> 'prezzo_obiettivo'::text), ''::text))::numeric AS prezzo_obiettivo,
    stato,
    creato_da AS owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    (esito -> 'opzioni_disambiguazione'::text) AS opzioni_disambiguazione,
    tentativi_falliti,
    COALESCE(((payload ->> 'sigillata_originale'::text))::boolean, false) AS sigillata_originale
   FROM coda_lavoro
  WHERE (tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]));

-- La vista non è owned da noi ma da postgres (verificato in Fase 0,
-- security_invoker=false) — CREATE OR REPLACE VIEW non tocca owner/
-- reloptions, restano invariati. Non è questa la sede per il redesign RLS
-- di coda_carte (Passo 2/3 di 35_correzioni_sicurezza.sql, bloccato di
-- proposito — vedi audit Fase 0): questa migration aggiunge solo una
-- colonna, stesso livello di sicurezza di prima, né migliore né peggiore.


-- ── 3) Trigger insert — porta sigillata_originale dentro payload.
CREATE OR REPLACE FUNCTION public._coda_carte_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- 1) La vista espone la nuova colonna:
-- select column_name from information_schema.columns where table_name = 'coda_carte' order by ordinal_position;
--
-- 2) Test end-to-end (simula esattamente quello che fa ui/entry.ui.js):
-- insert into coda_carte (owner_id, nome, sigillata_originale, destinazione)
--   values (auth.uid(), 'Test Sigillata E2E', true, 'collezione') returning *;
-- -- deve tornare sigillata_originale = true nella riga appena letta
-- select payload from coda_lavoro where payload->>'nome' = 'Test Sigillata E2E';
-- -- deve contenere "sigillata_originale": true
-- -- poi cancella la riga di prova da coda_lavoro
--
-- 3) Test della RPC (serve l'id della riga di test sopra):
-- select completa_riga_coda_carte(
--   '<id riga coda_carte di test>'::uuid, 'Test Sigillata RPC', null, null, 1,
--   'IT', 'NM', null, null, null, null, null, 'collezione', null, true
-- );
-- select nome, sigillata_originale from carte where nome = 'Test Sigillata RPC';
-- -- poi cancella la riga di prova da carte
