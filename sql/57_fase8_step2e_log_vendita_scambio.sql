-- ============================================================================
-- CardSync Pro — 57: Fase 8, Step 2 (parte 5/5, ULTIMA) — Log
-- "vendita_scambio" alla conclusione di una richiesta di scambio
--
-- ⚠ LA FUNZIONE PIÙ DELICATA DI QUESTO STEP: concludi_riga_richiesta sposta
-- DAVVERO un oggetto tra due account (elimina/riduce la riga del
-- proprietario, ne crea una nuova per il richiedente). Stesso livello di
-- cautela già usato in Fase 4 quando questa funzione è stata scritta la
-- prima volta — vedi VERIFICA POST-ESECUZIONE in fondo: consigliato un
-- test guidato in SQL Editor (simulando auth.uid()) PRIMA di fidarsi in UI,
-- non solo "esegui e vai".
--
-- Corpo preso dalla versione più recente nota (sql/49, confermata identica
-- dal vivo in questa sessione per le due RPC di controllo prezzi — non
-- ancora riconfermata per QUESTA specifica funzione, vedi nota sotto).
--
-- Aggiunto SOLO: due INSERT in movimenti_collezione (uno per ramo carta/
-- sealed), ciascuno con 2 righe in un solo statement — chi cede (delta
-- negativo, sull'oggetto ORIGINALE — v_carta/v_prodotto, il record locale
-- resta leggibile anche dopo un eventuale DELETE della riga vera, PL/pgSQL
-- lavora su una copia) e chi riceve (delta positivo, sulla riga NUOVA,
-- id preso con "returning id into v_nuovo_id" — aggiunto qui, non c'era
-- prima). Prezzo usato: prezzo_congelato (il prezzo dell'accordo, non
-- quello corrente che potrebbe essere cambiato nel frattempo) — stesso
-- principio già alla base di tutto il sistema richieste (Fase 4).
-- Nessuna riga di log se prezzo_congelato è null (mai dovrebbe esserlo per
-- una richiesta accettata, ma per sicurezza valore_delta resta null invece
-- di un calcolo inventato).
--
-- fonte='rpc' — nessuna azione client diretta, solo lato server.
--
-- NULLA nel comportamento ESISTENTE della funzione è stato toccato: stesso
-- ordine di operazioni, stesse eccezioni, stesso update finale su
-- richieste_scambio_righe, stesso insert in activity_log. Le due nuove
-- insert in movimenti_collezione sono aggiunte DOPO l'insert della nuova
-- riga (carta/prodotto) e PRIMA dell'update finale di stato — se dovessero
-- fallire per un problema nel vincolo CHECK, l'intera conclusione va in
-- rollback (stesso comportamento transazionale già discusso per sql/55):
-- meglio che un log rotto blocchi visibilmente un'operazione delicata,
-- piuttosto che venga silenziosamente perso.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text DEFAULT '?')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_riga record;
    v_carta record;
    v_prodotto record;
    v_snap jsonb;
    v_nuovo_id uuid;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'accettata' then raise exception 'Questa riga non è riservata'; end if;

    v_snap := v_riga.snapshot;

    if v_riga.carta_id is not null then
        select * into v_carta from carte where id = v_riga.carta_id and owner_id = v_riga.proprietario_id for update;
        if v_carta is null then raise exception 'La carta originale non esiste più'; end if;
        if v_carta.qty < v_riga.quantita_richiesta then
            raise exception 'La quantità posseduta è scesa sotto quella concordata — sistema manualmente prima di concludere';
        end if;

        if v_carta.qty = v_riga.quantita_richiesta then
            delete from carte where id = v_carta.id;
        else
            update carte set qty = qty - v_riga.quantita_richiesta, updated_at = now() where id = v_carta.id;
            update binder_carte set quantita_offerta = greatest(0, quantita_offerta - v_riga.quantita_richiesta)
            where carta_id = v_carta.id and binder_id = (select id from binders where owner_id = v_riga.proprietario_id and tipo = 'scambio');
        end if;

        insert into carte (owner_id, tipo, nome, codice, location, qty, lingua, condizione, reverse_holo, first_ed, url, prezzo, note, immagine, sigillata_originale, stato)
        values (
            v_riga.richiedente_id, 'carta', v_snap->>'nome', v_snap->>'codice', coalesce(nullif(p_location_scelta, ''), '?'),
            v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'condizione',
            coalesce((v_snap->>'reverse_holo')::boolean, false), coalesce((v_snap->>'first_ed')::boolean, false),
            v_snap->>'url', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine',
            coalesce((v_snap->>'sigillata_originale')::boolean, false), 'collezione'
        )
        returning id into v_nuovo_id;

        -- Fase 8, Step 2 (2026-09-13): log su entrambi i lati.
        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'carta', v_carta.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
                (v_riga.richiedente_id, 'vendita_scambio', 'carta', v_nuovo_id, v_snap->>'nome',
                 v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
        end if;

    else
        select * into v_prodotto from prodotti_sealed where id = v_riga.prodotto_sealed_id and owner_id = v_riga.proprietario_id for update;
        if v_prodotto is null then raise exception 'Il prodotto originale non esiste più'; end if;
        if v_prodotto.qty < v_riga.quantita_richiesta then
            raise exception 'La quantità posseduta è scesa sotto quella concordata — sistema manualmente prima di concludere';
        end if;

        if v_prodotto.qty = v_riga.quantita_richiesta then
            delete from prodotti_sealed where id = v_prodotto.id;
        else
            update prodotti_sealed set qty = qty - v_riga.quantita_richiesta where id = v_prodotto.id;
            update scaffale_prodotti set quantita_offerta = greatest(0, quantita_offerta - v_riga.quantita_richiesta)
            where prodotto_id = v_prodotto.id and scaffale_id = (select id from scaffali where owner_id = v_riga.proprietario_id and tipo = 'scambio');
        end if;

        insert into prodotti_sealed (owner_id, nome, codice, set_espansione, qty, lingua, integrita_packaging, prezzo, note, immagine, stato)
        values (
            v_riga.richiedente_id, v_snap->>'nome', v_snap->>'codice', v_snap->>'set_espansione',
            v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'integrita_packaging',
            v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine', 'collezione'
        )
        returning id into v_nuovo_id;

        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'sealed', v_prodotto.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
                (v_riga.richiedente_id, 'vendita_scambio', 'sealed', v_nuovo_id, v_snap->>'nome',
                 v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
        end if;
    end if;

    update richieste_scambio_righe
    set stato_riga = 'conclusa', location_scelta = coalesce(nullif(p_location_scelta, ''), '?'), aggiornato_il = now()
    where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_conclusa', jsonb_build_object('riga_id', p_riga_id));
end;
$$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE — CONSIGLIATO un test guidato prima di fidarsi
-- (stesso livello di Fase 4, non solo "esegui e passa oltre")
-- ============================================================================
-- 1. Firma live — questa NON è stata riconfermata dal vivo come le altre
--    (solo le due RPC prezzi lo sono state in questa sessione): prima di
--    eseguire il CREATE OR REPLACE sopra, conviene girare:
-- select pg_get_functiondef(oid) from pg_proc where proname = 'concludi_riga_richiesta';
--    e confrontarla col corpo di sql/49 (la parte NON toccata da questo
--    file) — se non combacia esattamente, fermati e mandamela prima di
--    eseguire.
--
-- 2. Dopo l'esecuzione, test end-to-end in SQL Editor con una richiesta
--    reale già in stato 'accettata' (o create una di prova, come già fatto
--    in Fase 4 con "francesco"/"prova"):
-- select concludi_riga_richiesta('<id riga accettata>', '?');
-- select * from movimenti_collezione where tipo_evento = 'vendita_scambio' order by avvenuto_il desc limit 5;
-- -- devono comparire ESATTAMENTE 2 righe nuove: una con owner_id del
-- -- proprietario (quantita_delta negativo), una con owner_id del
-- -- richiedente (quantita_delta positivo) — stesso importo assoluto,
-- -- segno opposto.
-- ============================================================================
