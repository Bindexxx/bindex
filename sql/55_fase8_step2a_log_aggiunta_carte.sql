-- ============================================================================
-- CardSync Pro — 55: Fase 8, Step 2 (parte 1/2) — Log "aggiunta" per le
-- carte inserite tramite coda_carte
--
-- completa_riga_coda_carte è l'UNICO punto reale in cui una carta finisce
-- in 'carte' (l'inserimento da entry.ui.js accoda soltanto — vedi
-- ui/entry.ui.js, salvaCarteReali(): "Coda UNICA... un solo motore
-- (aggiungi_carta_popup.js) la elabora"). Firma riconfermata identica dal
-- vivo prima di questo file (Regola d'Oro #3) — CREATE OR REPLACE, nessun
-- DROP necessario.
--
-- Il log SOLO nel ramo 'else' (destinazione collezione) — non nel ramo
-- 'wishlist': storico_valore_collezione e la definizione stessa di
-- "collezione" nella roadmap escludono esplicitamente la Wishlist dal
-- valore/inventario. movimenti_collezione deve restare coerente con
-- quella stessa definizione.
--
-- fonte='rpc' (non 'sito'): l'INSERT su movimenti_collezione avviene qui
-- dentro, in una funzione SECURITY DEFINER — stesso motivo per cui questo
-- valore era già stato previsto nel CHECK di sql/54.
--
-- Fallimento del log NON deve mai bloccare l'inserimento della carta vera
-- (motivo primario della funzione) — per questo l'INSERT su
-- movimenti_collezione è nel corpo ma DOPO il return id riuscito della
-- carta; un errore lì solleverebbe comunque un'eccezione che fa fallire
-- l'intera funzione (stesso comportamento transazionale di PL/pgSQL: o
-- passa tutto o niente). Questo è VOLUTO in questo caso — a differenza di
-- un log "a corredo" lato client (dove un fallimento silenzioso è
-- accettabile), qui vale la pena che un log rotto sia visibile subito
-- (errore nell'estensione) piuttosto che silenziosamente perso, dato che
-- la tabella e i suoi vincoli sono nuovi e non ancora battuti in
-- produzione — se il vincolo CHECK avesse un problema, meglio scoprirlo
-- subito che avere carte inserite ma zero log per settimane.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_destinazione text DEFAULT 'collezione'::text, p_prezzo_obiettivo numeric DEFAULT NULL::numeric)
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
    insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato)
    values (v_owner_id, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione')
    returning id into v_nuovo_id;

    -- Fase 8, Step 2 (2026-09-13): log dell'evento — SOLO qui, mai nel
    -- ramo wishlist sopra (vedi header del file).
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
    values
        (v_owner_id, 'aggiunta', 'carta', v_nuovo_id, p_nome, p_qty,
         p_prezzo, case when p_prezzo is not null then p_prezzo * p_qty else null end, 'rpc');
  end if;

  return v_nuovo_id;
end;
$function$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- 1. Firma invariata (deve combaciare esattamente con quella già confermata):
-- select pg_get_functiondef(oid) from pg_proc where proname = 'completa_riga_coda_carte';
--
-- 2. Prova end-to-end: aggiungi una carta vera dall'estensione (o processa
--    una riga già in coda), poi:
-- select * from movimenti_collezione where tipo_evento = 'aggiunta' order by avvenuto_il desc limit 5;
-- -- deve comparire la carta appena inserita, con oggetto_id = l'id reale
-- -- della nuova riga in 'carte'.
--
-- 3. Controllo che il ramo wishlist NON generi log:
-- -- aggiungi una carta in Wishlist (non collezione) e verifica che NON
-- -- compaia una nuova riga in movimenti_collezione per quell'inserimento.
-- ============================================================================
