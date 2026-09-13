-- ============================================================================
-- CardSync Pro — 48: Fase 4, Step 2 — 6 RPC transazionali per le richieste
-- di scambio
--
-- Tutte SECURITY DEFINER (bypassano la RLS sola-lettura di sql/47) — ogni
-- funzione verifica ESPLICITAMENTE che il chiamante sia la persona giusta
-- (richiedente/proprietario/admin) prima di fare qualunque cosa, non si
-- affida alla RLS per la sicurezza qui.
--
-- Anti-overbooking (concorrenza, richiesto esplicitamente dalla roadmap):
-- accetta_riga_richiesta fa un SELECT ... FOR UPDATE sulla riga sorgente
-- (binder_carte/scaffale_prodotti) prima di contare quanto è già accettato
-- altrove — serializza due accettazioni concorrenti sulla stessa carta,
-- la seconda aspetta il commit/rollback della prima prima di procedere.
--
-- concludi_riga_richiesta (la più delicata, richiesta esplicitamente da
-- Claudio insieme alle altre 5, non rimandata): usa lo SNAPSHOT salvato al
-- momento dell'invio della richiesta (non la riga live, che potrebbe essere
-- cambiata nel frattempo) per creare la nuova riga del richiedente — fedele
-- a cosa fu davvero concordato. Riga carte/prodotti_sealed del proprietario
-- SEMPRE scalata o eliminata (mai lasciata a qty=0, richiesto dalla
-- roadmap). Nessun tentativo di "unire" con righe esistenti del
-- richiedente — sempre una riga nuova, la deduplica è già un compito
-- dell'utente (funzione Doppioni esistente).
-- ============================================================================


-- ── 1. invia_richiesta_scambio ─────────────────────────────────────────
-- p_righe: array di oggetti {"tipo":"carta"|"sealed","oggetto_id":"<uuid>","quantita":<int>}
CREATE OR REPLACE FUNCTION public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_richiedente_id uuid := auth.uid();
    v_richiesta_id uuid;
    v_riga jsonb;
    v_tipo text;
    v_oggetto_id uuid;
    v_quantita integer;
    v_binder_scambio_id uuid;
    v_scaffale_scambio_id uuid;
    v_carta record;
    v_prodotto record;
    v_offerta integer;
    v_snapshot jsonb;
    v_prezzo numeric;
begin
    if v_richiedente_id is null then
        raise exception 'Non autenticato';
    end if;
    if v_richiedente_id = p_proprietario_id then
        raise exception 'Non puoi inviare una richiesta a te stesso';
    end if;
    if jsonb_array_length(p_righe) = 0 then
        raise exception 'Nessuna riga nella richiesta';
    end if;

    insert into richieste_scambio (richiedente_id, proprietario_id)
    values (v_richiedente_id, p_proprietario_id)
    returning id into v_richiesta_id;

    select id into v_binder_scambio_id from binders where owner_id = p_proprietario_id and tipo = 'scambio';
    select id into v_scaffale_scambio_id from scaffali where owner_id = p_proprietario_id and tipo = 'scambio';

    for v_riga in select * from jsonb_array_elements(p_righe)
    loop
        v_tipo := v_riga->>'tipo';
        v_oggetto_id := (v_riga->>'oggetto_id')::uuid;
        v_quantita := coalesce((v_riga->>'quantita')::integer, 1);
        if v_quantita < 1 then
            raise exception 'Quantità non valida per un oggetto della richiesta';
        end if;

        if v_tipo = 'carta' then
            select c.* into v_carta from carte c where c.id = v_oggetto_id and c.owner_id = p_proprietario_id and c.stato = 'collezione';
            if v_carta is null then
                raise exception 'Carta non trovata o non più del proprietario indicato';
            end if;
            select bc.quantita_offerta into v_offerta
            from binder_carte bc where bc.binder_id = v_binder_scambio_id and bc.carta_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then
                raise exception 'Quantità richiesta superiore a quella offerta per questa carta';
            end if;

            v_prezzo := v_carta.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_carta.nome, 'codice', v_carta.codice, 'lingua', v_carta.lingua,
                'condizione', v_carta.condizione, 'reverse_holo', v_carta.reverse_holo,
                'first_ed', v_carta.first_ed, 'url', v_carta.url, 'immagine', v_carta.immagine,
                'sigillata_originale', v_carta.sigillata_originale, 'note', v_carta.note,
                'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', v_richiedente_id, 'proprietario_id', p_proprietario_id,
                'data', now()
            );

            insert into richieste_scambio_righe
                (richiesta_id, richiedente_id, proprietario_id, carta_id, quantita_richiesta, prezzo_congelato, snapshot)
            values
                (v_richiesta_id, v_richiedente_id, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);

        elsif v_tipo = 'sealed' then
            select p.* into v_prodotto from prodotti_sealed p where p.id = v_oggetto_id and p.owner_id = p_proprietario_id and p.stato = 'collezione';
            if v_prodotto is null then
                raise exception 'Prodotto sealed non trovato o non più del proprietario indicato';
            end if;
            select sp.quantita_offerta into v_offerta
            from scaffale_prodotti sp where sp.scaffale_id = v_scaffale_scambio_id and sp.prodotto_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then
                raise exception 'Quantità richiesta superiore a quella offerta per questo prodotto';
            end if;

            v_prezzo := v_prodotto.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_prodotto.nome, 'codice', v_prodotto.codice, 'set_espansione', v_prodotto.set_espansione,
                'lingua', v_prodotto.lingua, 'integrita_packaging', v_prodotto.integrita_packaging,
                'immagine', v_prodotto.immagine, 'note', v_prodotto.note, 'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', v_richiedente_id, 'proprietario_id', p_proprietario_id,
                'data', now()
            );

            insert into richieste_scambio_righe
                (richiesta_id, richiedente_id, proprietario_id, prodotto_sealed_id, quantita_richiesta, prezzo_congelato, snapshot)
            values
                (v_richiesta_id, v_richiedente_id, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);
        else
            raise exception 'Tipo oggetto non riconosciuto: %', v_tipo;
        end if;
    end loop;

    insert into activity_log (user_id, source, action, details)
    values (p_proprietario_id, 'richieste-scambio', 'richiesta_ricevuta', jsonb_build_object('richiesta_id', v_richiesta_id, 'richiedente_id', v_richiedente_id));

    return v_richiesta_id;
end;
$$;


-- ── 2. accetta_riga_richiesta ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accetta_riga_richiesta(p_riga_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_riga record;
    v_offerta integer;
    v_gia_accettato integer;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'in_attesa' then raise exception 'Questa riga non è più in attesa'; end if;

    -- Lock pessimistico sulla riga sorgente — serializza due accettazioni
    -- concorrenti sulla stessa carta/prodotto (anti-overbooking, richiesto
    -- esplicitamente dalla roadmap).
    if v_riga.carta_id is not null then
        select bc.quantita_offerta into v_offerta
        from binder_carte bc
        join binders b on b.id = bc.binder_id
        where b.owner_id = v_riga.proprietario_id and b.tipo = 'scambio' and bc.carta_id = v_riga.carta_id
        for update;
    else
        select sp.quantita_offerta into v_offerta
        from scaffale_prodotti sp
        join scaffali s on s.id = sp.scaffale_id
        where s.owner_id = v_riga.proprietario_id and s.tipo = 'scambio' and sp.prodotto_id = v_riga.prodotto_sealed_id
        for update;
    end if;
    if v_offerta is null then raise exception 'Oggetto non più offerto in Scambio'; end if;

    select coalesce(sum(quantita_richiesta), 0) into v_gia_accettato
    from richieste_scambio_righe
    where stato_riga = 'accettata'
      and id <> p_riga_id
      and ((carta_id is not null and carta_id = v_riga.carta_id) or (prodotto_sealed_id is not null and prodotto_sealed_id = v_riga.prodotto_sealed_id));

    if v_gia_accettato + v_riga.quantita_richiesta > v_offerta then
        raise exception 'Quantità non più disponibile — altre richieste hanno già impegnato l''offerta';
    end if;

    update richieste_scambio_righe set stato_riga = 'accettata', aggiornato_il = now() where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'richieste-scambio', 'riga_accettata', jsonb_build_object('riga_id', p_riga_id));
end;
$$;


-- ── 3. rifiuta_riga_richiesta ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rifiuta_riga_richiesta(p_riga_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_riga record;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'in_attesa' then raise exception 'Questa riga non è più in attesa'; end if;

    update richieste_scambio_righe set stato_riga = 'rifiutata', aggiornato_il = now() where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'richieste-scambio', 'riga_rifiutata', jsonb_build_object('riga_id', p_riga_id));
end;
$$;


-- ── 4. annulla_riga_richiesta ───────────────────────────────────────────
-- Richiedente O proprietario, per una riga 'in_attesa' o 'accettata' (non
-- ancora conclusa). Motivo obbligatorio, uno dei 6 valori fissi (CHECK già
-- su richieste_scambio_righe.motivo_chiusura, sql/47).
CREATE OR REPLACE FUNCTION public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_riga record;
    v_altra_parte uuid;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if auth.uid() <> v_riga.richiedente_id and auth.uid() <> v_riga.proprietario_id then
        raise exception 'Non autorizzato';
    end if;
    if v_riga.stato_riga not in ('in_attesa', 'accettata') then
        raise exception 'Questa riga non può più essere annullata';
    end if;

    update richieste_scambio_righe
    set stato_riga = 'annullata', motivo_chiusura = p_motivo, aggiornato_il = now()
    where id = p_riga_id;

    v_altra_parte := case when auth.uid() = v_riga.richiedente_id then v_riga.proprietario_id else v_riga.richiedente_id end;
    insert into activity_log (user_id, source, action, details)
    values (v_altra_parte, 'richieste-scambio', 'riga_annullata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo, 'da', auth.uid()));
end;
$$;


-- ── 5. sblocca_riga_richiesta ───────────────────────────────────────────
-- SOLO il proprietario, SOLO per una riga 'accettata' (riservata) — la
-- roadmap la distingue da annulla_riga_richiesta ("Il proprietario può
-- sbloccare manualmente una carta/prodotto riservato"), stessa
-- conseguenza pratica (la riga smette di contare come riservata) ma
-- semantica distinta: qui è un intervento unilaterale del proprietario su
-- qualcosa già accettato, non un ripensamento di una delle due parti prima
-- dell'accettazione.
CREATE OR REPLACE FUNCTION public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text DEFAULT 'intervento_amministrativo')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_riga record;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'accettata' then raise exception 'Questa riga non è riservata'; end if;

    update richieste_scambio_righe
    set stato_riga = 'annullata', motivo_chiusura = p_motivo, aggiornato_il = now()
    where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'richieste-scambio', 'riga_sbloccata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo));
end;
$$;


-- ── 6. concludi_riga_richiesta ──────────────────────────────────────────
-- SOLO il proprietario, SOLO per una riga 'accettata'. Trasferimento reale:
-- scala/elimina la riga del proprietario, riduce (mai sotto zero) la
-- quantita_offerta residua, crea una riga NUOVA per il richiedente (dallo
-- snapshot congelato, MAI dalla riga live). "Non lasciare quantità zero"
-- (roadmap): se la riga del proprietario arriva a 0, viene eliminata
-- (CASCADE elimina da sola binder_carte/scaffale_prodotti collegate).
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
            delete from carte where id = v_carta.id; -- CASCADE elimina anche binder_carte collegata
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
        );

    else
        select * into v_prodotto from prodotti_sealed where id = v_riga.prodotto_sealed_id and owner_id = v_riga.proprietario_id for update;
        if v_prodotto is null then raise exception 'Il prodotto originale non esiste più'; end if;
        if v_prodotto.qty < v_riga.quantita_richiesta then
            raise exception 'La quantità posseduta è scesa sotto quella concordata — sistema manualmente prima di concludere';
        end if;

        if v_prodotto.qty = v_riga.quantita_richiesta then
            delete from prodotti_sealed where id = v_prodotto.id; -- CASCADE elimina anche scaffale_prodotti collegata
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
        );
    end if;

    update richieste_scambio_righe
    set stato_riga = 'conclusa', location_scelta = coalesce(nullif(p_location_scelta, ''), '?'), aggiornato_il = now()
    where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'richieste-scambio', 'riga_conclusa', jsonb_build_object('riga_id', p_riga_id));
end;
$$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select proname from pg_proc where proname in (
--   'invia_richiesta_scambio','accetta_riga_richiesta','rifiuta_riga_richiesta',
--   'annulla_riga_richiesta','sblocca_riga_richiesta','concludi_riga_richiesta'
-- );
-- -- devono comparire tutte e 6
