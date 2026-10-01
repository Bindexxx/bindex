-- ═══════════════════════════════════════════════════════════════════════
-- 88_richiesta_ospite_ROLLBACK.sql — annulla sql/88.
-- ATTENZIONE: cancella TUTTE le richieste degli ospiti (non possono esistere
-- con lo schema di prima: richiedente_id torna NOT NULL).
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Funzioni esistenti com'erano prima di sql/88
CREATE OR REPLACE FUNCTION public.accetta_riga_richiesta(p_riga_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_riga record;
    v_offerta integer;
    v_gia_accettato integer;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'in_attesa' then raise exception 'Questa riga non è più in attesa'; end if;

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
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_accettata', jsonb_build_object('riga_id', p_riga_id));
end;
$function$;

CREATE OR REPLACE FUNCTION public.rifiuta_riga_richiesta(p_riga_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_riga record;
begin
    select * into v_riga from richieste_scambio_righe where id = p_riga_id;
    if v_riga is null then raise exception 'Riga non trovata'; end if;
    if v_riga.proprietario_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
    if v_riga.stato_riga <> 'in_attesa' then raise exception 'Questa riga non è più in attesa'; end if;

    update richieste_scambio_righe set stato_riga = 'rifiutata', aggiornato_il = now() where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_rifiutata', jsonb_build_object('riga_id', p_riga_id));
end;
$function$;

CREATE OR REPLACE FUNCTION public.annulla_riga_richiesta(p_riga_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    values (v_altra_parte, 'sito', 'riga_scambio_annullata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo, 'da', auth.uid()));
end;
$function$;

CREATE OR REPLACE FUNCTION public.sblocca_riga_richiesta(p_riga_id uuid, p_motivo text DEFAULT 'intervento_amministrativo'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_sbloccata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo));
end;
$function$;

CREATE OR REPLACE FUNCTION public.concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text DEFAULT '?'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

        insert into carte (owner_id, tipo, nome, codice, location, qty, lingua, condizione, reverse_holo, first_ed, url, prezzo, note, immagine, sigillata_originale, variante, stato)
        values (
            v_riga.richiedente_id, 'carta', v_snap->>'nome', v_snap->>'codice', coalesce(nullif(p_location_scelta, ''), '?'),
            v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'condizione',
            coalesce((v_snap->>'reverse_holo')::boolean, false), coalesce((v_snap->>'first_ed')::boolean, false),
            v_snap->>'url', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine',
            coalesce((v_snap->>'sigillata_originale')::boolean, false), v_snap->>'variante', 'collezione'
        )
        returning id into v_nuovo_id;

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
$function$;

-- 2) Funzioni nuove
DROP FUNCTION IF EXISTS public.blocca_ospite(uuid);
DROP FUNCTION IF EXISTS public.scadi_richieste_ospite();
DROP FUNCTION IF EXISTS public.leggi_richiesta_ospite(text);
DROP FUNCTION IF EXISTS public.invia_richiesta_ospite(uuid, jsonb, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._genera_codice_rq();
DROP FUNCTION IF EXISTS public._scadi_richieste_ospite();
DROP FUNCTION IF EXISTS public._pulisci_dati_ospite(uuid);

-- 3) Dati e schema
DELETE FROM public.richieste_scambio WHERE codice_rq IS NOT NULL;           -- le righe cadono in cascata
DELETE FROM public.richieste_scambio_righe WHERE richiedente_id IS NULL;    -- difensivo
UPDATE public.richieste_scambio_righe SET motivo_chiusura = 'intervento_amministrativo'
 WHERE motivo_chiusura IN ('scaduta', 'bloccato');                          -- difensivo
DROP TABLE IF EXISTS public.blocchi_ospiti;
DROP INDEX IF EXISTS public.idx_richieste_scambio_ospite_dispositivo;
ALTER TABLE public.richieste_scambio_righe DROP CONSTRAINT richieste_scambio_righe_motivo_chiusura_check;
ALTER TABLE public.richieste_scambio_righe ADD CONSTRAINT richieste_scambio_righe_motivo_chiusura_check
    CHECK ((motivo_chiusura IS NULL) OR (motivo_chiusura = ANY (ARRAY['ho_cambiato_idea'::text, 'non_piu_disponibile'::text, 'accordo_non_concluso'::text, 'errore_prenotazione'::text, 'sostituito_altro_accordo'::text, 'intervento_amministrativo'::text])));
ALTER TABLE public.richieste_scambio
    DROP CONSTRAINT IF EXISTS richieste_scambio_ospite_lunghezze,
    DROP CONSTRAINT IF EXISTS richieste_scambio_ospite_contatto_tipo_check,
    DROP CONSTRAINT IF EXISTS richieste_scambio_richiedente_o_ospite,
    DROP CONSTRAINT IF EXISTS richieste_scambio_codice_rq_key;
ALTER TABLE public.richieste_scambio
    DROP COLUMN IF EXISTS ospite_dispositivo,
    DROP COLUMN IF EXISTS ospite_messaggio,
    DROP COLUMN IF EXISTS ospite_contatto,
    DROP COLUMN IF EXISTS ospite_contatto_tipo,
    DROP COLUMN IF EXISTS ospite_nome,
    DROP COLUMN IF EXISTS codice_rq;
ALTER TABLE public.richieste_scambio_righe ALTER COLUMN richiedente_id SET NOT NULL;
ALTER TABLE public.richieste_scambio ALTER COLUMN richiedente_id SET NOT NULL;
