-- ═══════════════════════════════════════════════════════════════════════
-- 88_richiesta_ospite.sql — 2026-10-01 (Restyle Bindex, FASE 8b)
-- Rollback: 88_richiesta_ospite_ROLLBACK.sql
--
-- RICHIESTA DI SCAMBIO COME OSPITE (visitatore senza profilo Bindex).
-- Decisioni (tavole approvate + Claudio 2026-10-01): nome obbligatorio,
-- contatto facoltativo (whatsapp/telegram/instagram/email o "persona"),
-- messaggio facoltativo, codice RQ-XXXX per controllare lo stato dalla
-- pagina pubblica (solo vedere, niente annulla); max 3 richieste ospite in
-- attesa per dispositivo IN TOTALE; max 20 richieste ospite in attesa per
-- proprietario; Blocca; scadenza 7 giorni se non accettate; nome/contatto/
-- messaggio cancellati quando la richiesta si chiude; Concludi = l'oggetto
-- esce dalla collezione del proprietario (nessun destinatario nel DB).
--
-- VERIFICATO sul DB live prima di scrivere (2026-10-01):
--  - richieste_scambio(id, richiedente_id NOT NULL FK auth.users,
--    proprietario_id, stato aperta/chiusa, creato_il); RLS: solo SELECT per
--    richiedente/proprietario/admin. richieste_scambio_righe idem, con
--    motivo_chiusura CHECK a 6 valori e richiedente_id NOT NULL.
--  - Le 6 RPC (invia/accetta/rifiuta/annulla/sblocca/concludi) scrivono in
--    activity_log(user_id NOT NULL) l'id del richiedente: con un ospite
--    (NULL) fallirebbero → qui ripubblicate con la guardia "solo se c'è un
--    richiedente". annulla_riga_richiesta usava "<>": con richiedente NULL il
--    controllo diventava NULL e QUALUNQUE utente poteva annullare → qui
--    "is distinct from".
--  - pg_cron NON installato → scadenza "pigra": _scadi_richieste_ospite()
--    gira dentro le RPC che toccano richieste ospite e da
--    scadi_richieste_ospite() chiamata dal sito all'apertura di Richieste.
--  - _chat_ha_parolacce / _chat_ha_link_esterno esistono (riusate qui).
--  - movimenti_collezione.tipo_evento ammette 'vendita_scambio'.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) SCHEMA ---------------------------------------------------------------
ALTER TABLE public.richieste_scambio ALTER COLUMN richiedente_id DROP NOT NULL;
ALTER TABLE public.richieste_scambio_righe ALTER COLUMN richiedente_id DROP NOT NULL;

ALTER TABLE public.richieste_scambio
    ADD COLUMN IF NOT EXISTS codice_rq text,
    ADD COLUMN IF NOT EXISTS ospite_nome text,
    ADD COLUMN IF NOT EXISTS ospite_contatto_tipo text,
    ADD COLUMN IF NOT EXISTS ospite_contatto text,
    ADD COLUMN IF NOT EXISTS ospite_messaggio text,
    ADD COLUMN IF NOT EXISTS ospite_dispositivo text;

ALTER TABLE public.richieste_scambio
    ADD CONSTRAINT richieste_scambio_codice_rq_key UNIQUE (codice_rq),
    ADD CONSTRAINT richieste_scambio_richiedente_o_ospite
        CHECK ((richiedente_id IS NOT NULL) <> (codice_rq IS NOT NULL)),
    ADD CONSTRAINT richieste_scambio_ospite_contatto_tipo_check
        CHECK (ospite_contatto_tipo IS NULL OR ospite_contatto_tipo IN ('whatsapp', 'telegram', 'instagram', 'email', 'persona')),
    ADD CONSTRAINT richieste_scambio_ospite_lunghezze CHECK (
        (ospite_nome IS NULL OR char_length(ospite_nome) <= 40)
        AND (ospite_contatto IS NULL OR char_length(ospite_contatto) <= 100)
        AND (ospite_messaggio IS NULL OR char_length(ospite_messaggio) <= 300)
        AND (ospite_dispositivo IS NULL OR char_length(ospite_dispositivo) <= 64));

ALTER TABLE public.richieste_scambio_righe DROP CONSTRAINT richieste_scambio_righe_motivo_chiusura_check;
ALTER TABLE public.richieste_scambio_righe ADD CONSTRAINT richieste_scambio_righe_motivo_chiusura_check
    CHECK ((motivo_chiusura IS NULL) OR (motivo_chiusura = ANY (ARRAY['ho_cambiato_idea'::text, 'non_piu_disponibile'::text, 'accordo_non_concluso'::text, 'errore_prenotazione'::text, 'sostituito_altro_accordo'::text, 'intervento_amministrativo'::text, 'scaduta'::text, 'bloccato'::text])));

CREATE INDEX IF NOT EXISTS idx_richieste_scambio_ospite_dispositivo ON public.richieste_scambio (ospite_dispositivo) WHERE ospite_dispositivo IS NOT NULL;

-- Dispositivi bloccati da un proprietario (solo il proprietario li vede).
CREATE TABLE IF NOT EXISTS public.blocchi_ospiti (
    proprietario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dispositivo text NOT NULL,
    creato_il timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (proprietario_id, dispositivo)
);
ALTER TABLE public.blocchi_ospiti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprietario legge i propri blocchi ospite" ON public.blocchi_ospiti
    FOR SELECT USING (auth.uid() = proprietario_id);

-- 2) FUNZIONI INTERNE (non chiamabili dal sito) --------------------------

-- Cancella nome/contatto/messaggio/dispositivo delle richieste ospite chiuse
-- (nessuna riga in attesa o riservata). Il codice resta per "controlla".
CREATE OR REPLACE FUNCTION public._pulisci_dati_ospite(p_richiesta_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    update richieste_scambio rs
    set ospite_nome = null, ospite_contatto = null, ospite_messaggio = null, ospite_dispositivo = null
    where rs.codice_rq is not null
      and (p_richiesta_id is null or rs.id = p_richiesta_id)
      and (rs.ospite_nome is not null or rs.ospite_contatto is not null or rs.ospite_messaggio is not null or rs.ospite_dispositivo is not null)
      and not exists (select 1 from richieste_scambio_righe r
                      where r.richiesta_id = rs.id and r.stato_riga in ('in_attesa', 'accettata'));
$function$;

-- Richieste ospite in attesa da più di 7 giorni → annullate ("scaduta").
CREATE OR REPLACE FUNCTION public._scadi_richieste_ospite()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    update richieste_scambio_righe r
    set stato_riga = 'annullata', motivo_chiusura = 'scaduta', aggiornato_il = now()
    from richieste_scambio rs
    where rs.id = r.richiesta_id
      and rs.codice_rq is not null
      and r.stato_riga = 'in_attesa'
      and rs.creato_il < now() - interval '7 days';
    perform _pulisci_dati_ospite(null);
end;
$function$;

CREATE OR REPLACE FUNCTION public._genera_codice_rq()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_codice text;
    i integer;
    tentativo integer := 0;
begin
    loop
        v_codice := 'RQ-';
        for i in 1..4 loop
            v_codice := v_codice || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
        end loop;
        exit when not exists (select 1 from richieste_scambio where codice_rq = v_codice);
        tentativo := tentativo + 1;
        if tentativo > 50 then raise exception 'Impossibile generare un codice, riprova'; end if;
    end loop;
    return v_codice;
end;
$function$;

REVOKE ALL ON FUNCTION public._pulisci_dati_ospite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._scadi_richieste_ospite() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._genera_codice_rq() FROM PUBLIC, anon, authenticated;

-- 3) RPC NUOVE ------------------------------------------------------------

-- Invio come ospite (anche da anonimo). Ritorna il codice RQ-XXXX.
CREATE OR REPLACE FUNCTION public.invia_richiesta_ospite(
    p_proprietario_id uuid, p_righe jsonb, p_nome text, p_contatto_tipo text,
    p_contatto text, p_messaggio text, p_dispositivo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_nome text := nullif(trim(coalesce(p_nome, '')), '');
    v_tipo_contatto text := lower(trim(coalesce(p_contatto_tipo, '')));
    v_contatto text := nullif(trim(coalesce(p_contatto, '')), '');
    v_messaggio text := nullif(trim(coalesce(p_messaggio, '')), '');
    v_dispositivo text := trim(coalesce(p_dispositivo, ''));
    v_codice text;
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
    v_in_attesa integer;
begin
    perform _scadi_richieste_ospite();

    if v_nome is null or char_length(v_nome) > 40 then raise exception 'Scrivi un nome (massimo 40 caratteri)'; end if;
    if v_tipo_contatto not in ('whatsapp', 'telegram', 'instagram', 'email', 'persona') then raise exception 'Scegli come vuoi essere contattato'; end if;
    if v_tipo_contatto = 'persona' then v_contatto := null;
    elsif v_contatto is null or char_length(v_contatto) > 100 then raise exception 'Scrivi il contatto (massimo 100 caratteri)';
    end if;
    if v_messaggio is not null and char_length(v_messaggio) > 300 then raise exception 'Il messaggio può avere al massimo 300 caratteri'; end if;
    if char_length(v_dispositivo) < 16 or char_length(v_dispositivo) > 64 then raise exception 'Dispositivo non riconosciuto, ricarica la pagina'; end if;
    if _chat_ha_parolacce(v_nome) or (v_messaggio is not null and _chat_ha_parolacce(v_messaggio)) then
        raise exception 'Messaggio non consentito: contiene linguaggio non ammesso';
    end if;
    if v_messaggio is not null and _chat_ha_link_esterno(v_messaggio) then
        raise exception 'Messaggio non consentito: niente link nel messaggio';
    end if;
    if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then raise exception 'Nessuna riga nella richiesta'; end if;
    if jsonb_array_length(p_righe) > 50 then raise exception 'Troppi oggetti in una sola richiesta'; end if;
    if not exists (select 1 from auth.users where id = p_proprietario_id) then raise exception 'Proprietario non trovato'; end if;
    if auth.uid() is not null and auth.uid() = p_proprietario_id then raise exception 'Non puoi inviare una richiesta a te stesso'; end if;

    if exists (select 1 from blocchi_ospiti where proprietario_id = p_proprietario_id and dispositivo = v_dispositivo) then
        raise exception 'Non puoi più inviare richieste a questa persona';
    end if;

    select count(*) into v_in_attesa from richieste_scambio rs
    where rs.ospite_dispositivo = v_dispositivo
      and exists (select 1 from richieste_scambio_righe r where r.richiesta_id = rs.id and r.stato_riga = 'in_attesa');
    if v_in_attesa >= 3 then raise exception 'Hai già 3 richieste in attesa: aspetta una risposta prima di inviarne altre'; end if;

    select count(*) into v_in_attesa from richieste_scambio rs
    where rs.proprietario_id = p_proprietario_id and rs.codice_rq is not null
      and exists (select 1 from richieste_scambio_righe r where r.richiesta_id = rs.id and r.stato_riga = 'in_attesa');
    if v_in_attesa >= 20 then raise exception 'Questa persona ha già troppe richieste in attesa, riprova più avanti'; end if;

    v_codice := _genera_codice_rq();
    insert into richieste_scambio (richiedente_id, proprietario_id, codice_rq, ospite_nome, ospite_contatto_tipo, ospite_contatto, ospite_messaggio, ospite_dispositivo)
    values (null, p_proprietario_id, v_codice, v_nome, v_tipo_contatto, v_contatto, v_messaggio, v_dispositivo)
    returning id into v_richiesta_id;

    select id into v_binder_scambio_id from binders where owner_id = p_proprietario_id and tipo = 'scambio';
    select id into v_scaffale_scambio_id from scaffali where owner_id = p_proprietario_id and tipo = 'scambio';

    -- Stesse verifiche e stesso snapshot di invia_richiesta_scambio (copia
    -- locale voluta: la funzione esistente resta intatta).
    for v_riga in select * from jsonb_array_elements(p_righe)
    loop
        v_tipo := v_riga->>'tipo';
        v_oggetto_id := (v_riga->>'oggetto_id')::uuid;
        v_quantita := coalesce((v_riga->>'quantita')::integer, 1);
        if v_quantita < 1 then raise exception 'Quantità non valida per un oggetto della richiesta'; end if;

        if v_tipo = 'carta' then
            select c.* into v_carta from carte c where c.id = v_oggetto_id and c.owner_id = p_proprietario_id and c.stato = 'collezione';
            if v_carta is null then raise exception 'Carta non trovata o non più del proprietario indicato'; end if;
            select bc.quantita_offerta into v_offerta from binder_carte bc where bc.binder_id = v_binder_scambio_id and bc.carta_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then raise exception 'Quantità richiesta superiore a quella offerta per questa carta'; end if;
            v_prezzo := v_carta.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_carta.nome, 'codice', v_carta.codice, 'lingua', v_carta.lingua,
                'condizione', v_carta.condizione, 'reverse_holo', v_carta.reverse_holo,
                'first_ed', v_carta.first_ed, 'url', v_carta.url, 'immagine', v_carta.immagine,
                'sigillata_originale', v_carta.sigillata_originale, 'note', v_carta.note,
                'variante', v_carta.variante, 'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', null, 'ospite', true, 'proprietario_id', p_proprietario_id, 'data', now());
            insert into richieste_scambio_righe (richiesta_id, richiedente_id, proprietario_id, carta_id, quantita_richiesta, prezzo_congelato, snapshot)
            values (v_richiesta_id, null, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);

        elsif v_tipo = 'sealed' then
            select p.* into v_prodotto from prodotti_sealed p where p.id = v_oggetto_id and p.owner_id = p_proprietario_id and p.stato = 'collezione';
            if v_prodotto is null then raise exception 'Prodotto sealed non trovato o non più del proprietario indicato'; end if;
            select sp.quantita_offerta into v_offerta from scaffale_prodotti sp where sp.scaffale_id = v_scaffale_scambio_id and sp.prodotto_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then raise exception 'Quantità richiesta superiore a quella offerta per questo prodotto'; end if;
            v_prezzo := v_prodotto.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_prodotto.nome, 'codice', v_prodotto.codice, 'set_espansione', v_prodotto.set_espansione,
                'lingua', v_prodotto.lingua, 'integrita_packaging', v_prodotto.integrita_packaging,
                'immagine', v_prodotto.immagine, 'note', v_prodotto.note, 'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', null, 'ospite', true, 'proprietario_id', p_proprietario_id, 'data', now());
            insert into richieste_scambio_righe (richiesta_id, richiedente_id, proprietario_id, prodotto_sealed_id, quantita_richiesta, prezzo_congelato, snapshot)
            values (v_richiesta_id, null, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);
        else
            raise exception 'Tipo oggetto non riconosciuto: %', v_tipo;
        end if;
    end loop;

    insert into activity_log (user_id, source, action, details)
    values (p_proprietario_id, 'sito', 'richiesta_scambio_ricevuta', jsonb_build_object('richiesta_id', v_richiesta_id, 'ospite', true, 'codice', v_codice));

    return v_codice;
end;
$function$;
REVOKE ALL ON FUNCTION public.invia_richiesta_ospite(uuid, jsonb, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invia_richiesta_ospite(uuid, jsonb, text, text, text, text, text) TO anon, authenticated, service_role;

-- Stato di una richiesta ospite dal codice (solo vedere; nessun dato
-- personale dell'ospite nella risposta).
CREATE OR REPLACE FUNCTION public.leggi_richiesta_ospite(p_codice text)
 RETURNS TABLE(nome text, quantita integer, stato_riga text, motivo_chiusura text, prezzo numeric, immagine text, creato_il timestamptz, proprietario_nickname text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_codice text := upper(regexp_replace(coalesce(p_codice, ''), '[^A-Za-z0-9]', '', 'g'));
begin
    if v_codice like 'RQ%' then v_codice := substr(v_codice, 3); end if;
    if char_length(v_codice) <> 4 then return; end if;
    v_codice := 'RQ-' || v_codice;
    perform _scadi_richieste_ospite();
    return query
        select coalesce(r.snapshot->>'nome', r.snapshot->>'codice'), r.quantita_richiesta, r.stato_riga, r.motivo_chiusura,
               r.prezzo_congelato, r.snapshot->>'immagine', rs.creato_il, pu.nickname
        from richieste_scambio rs
        join richieste_scambio_righe r on r.richiesta_id = rs.id
        left join preferenze_utente pu on pu.owner_id = rs.proprietario_id
        where rs.codice_rq = v_codice
        order by r.creato_il, r.id;
end;
$function$;
REVOKE ALL ON FUNCTION public.leggi_richiesta_ospite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_richiesta_ospite(text) TO anon, authenticated, service_role;

-- Il sito la chiama all'apertura di Richieste: scadenza + pulizia dati.
CREATE OR REPLACE FUNCTION public.scadi_richieste_ospite()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if auth.uid() is null then raise exception 'Non autenticato'; end if;
    perform _scadi_richieste_ospite();
end;
$function$;
REVOKE ALL ON FUNCTION public.scadi_richieste_ospite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scadi_richieste_ospite() TO authenticated, service_role;

-- Blocca: il dispositivo dell'ospite non può più inviare richieste a questo
-- proprietario; le sue richieste aperte verso di lui si annullano.
CREATE OR REPLACE FUNCTION public.blocca_ospite(p_richiesta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_rs record;
begin
    select * into v_rs from richieste_scambio where id = p_richiesta_id;
    if v_rs is null or v_rs.proprietario_id is distinct from auth.uid() then raise exception 'Richiesta non trovata'; end if;
    if v_rs.codice_rq is null then raise exception 'Non è una richiesta di un ospite'; end if;

    if v_rs.ospite_dispositivo is not null then
        insert into blocchi_ospiti (proprietario_id, dispositivo) values (v_rs.proprietario_id, v_rs.ospite_dispositivo)
        on conflict do nothing;
        update richieste_scambio_righe r
        set stato_riga = 'annullata', motivo_chiusura = 'bloccato', aggiornato_il = now()
        from richieste_scambio rs
        where rs.id = r.richiesta_id and rs.proprietario_id = v_rs.proprietario_id
          and rs.ospite_dispositivo = v_rs.ospite_dispositivo
          and r.stato_riga in ('in_attesa', 'accettata');
    else
        update richieste_scambio_righe
        set stato_riga = 'annullata', motivo_chiusura = 'bloccato', aggiornato_il = now()
        where richiesta_id = p_richiesta_id and stato_riga in ('in_attesa', 'accettata');
    end if;
    perform _pulisci_dati_ospite(null);
end;
$function$;
REVOKE ALL ON FUNCTION public.blocca_ospite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blocca_ospite(uuid) TO authenticated, service_role;

-- 4) RPC ESISTENTI RIPUBBLICATE (stessa firma; solo le modifiche segnate) --

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
    perform _scadi_richieste_ospite(); -- sql/88: una richiesta ospite scaduta non si accetta più
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

    if v_riga.richiedente_id is not null then -- sql/88: ospite = nessun log
        insert into activity_log (user_id, source, action, details)
        values (v_riga.richiedente_id, 'sito', 'riga_scambio_accettata', jsonb_build_object('riga_id', p_riga_id));
    end if;
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

    if v_riga.richiedente_id is not null then -- sql/88
        insert into activity_log (user_id, source, action, details)
        values (v_riga.richiedente_id, 'sito', 'riga_scambio_rifiutata', jsonb_build_object('riga_id', p_riga_id));
    end if;
    perform _pulisci_dati_ospite(v_riga.richiesta_id); -- sql/88
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
    -- sql/88: "is distinct from" (con richiedente NULL il vecchio "<>" lasciava passare chiunque)
    if auth.uid() is null or (auth.uid() is distinct from v_riga.richiedente_id and auth.uid() is distinct from v_riga.proprietario_id) then
        raise exception 'Non autorizzato';
    end if;
    if v_riga.stato_riga not in ('in_attesa', 'accettata') then
        raise exception 'Questa riga non può più essere annullata';
    end if;

    update richieste_scambio_righe
    set stato_riga = 'annullata', motivo_chiusura = p_motivo, aggiornato_il = now()
    where id = p_riga_id;

    v_altra_parte := case when auth.uid() = v_riga.richiedente_id then v_riga.proprietario_id else v_riga.richiedente_id end;
    if v_altra_parte is not null then -- sql/88
        insert into activity_log (user_id, source, action, details)
        values (v_altra_parte, 'sito', 'riga_scambio_annullata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo, 'da', auth.uid()));
    end if;
    perform _pulisci_dati_ospite(v_riga.richiesta_id); -- sql/88
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

    if v_riga.richiedente_id is not null then -- sql/88
        insert into activity_log (user_id, source, action, details)
        values (v_riga.richiedente_id, 'sito', 'riga_scambio_sbloccata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo));
    end if;
    perform _pulisci_dati_ospite(v_riga.richiesta_id); -- sql/88
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

        -- sql/88: con un ospite la carta esce dalla collezione e basta
        -- (nessun destinatario nel DB, nessuna copia creata).
        if v_riga.richiedente_id is not null then
            insert into carte (owner_id, tipo, nome, codice, location, qty, lingua, condizione, reverse_holo, first_ed, url, prezzo, note, immagine, sigillata_originale, variante, stato)
            values (
                v_riga.richiedente_id, 'carta', v_snap->>'nome', v_snap->>'codice', coalesce(nullif(p_location_scelta, ''), '?'),
                v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'condizione',
                coalesce((v_snap->>'reverse_holo')::boolean, false), coalesce((v_snap->>'first_ed')::boolean, false),
                v_snap->>'url', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine',
                coalesce((v_snap->>'sigillata_originale')::boolean, false), v_snap->>'variante', 'collezione'
            )
            returning id into v_nuovo_id;
        end if;

        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'carta', v_carta.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
            if v_riga.richiedente_id is not null then
                insert into public.movimenti_collezione
                    (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
                values
                    (v_riga.richiedente_id, 'vendita_scambio', 'carta', v_nuovo_id, v_snap->>'nome',
                     v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
            end if;
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

        if v_riga.richiedente_id is not null then -- sql/88
            insert into prodotti_sealed (owner_id, nome, codice, set_espansione, qty, lingua, integrita_packaging, prezzo, note, immagine, stato)
            values (
                v_riga.richiedente_id, v_snap->>'nome', v_snap->>'codice', v_snap->>'set_espansione',
                v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'integrita_packaging',
                v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine', 'collezione'
            )
            returning id into v_nuovo_id;
        end if;

        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'sealed', v_prodotto.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
            if v_riga.richiedente_id is not null then
                insert into public.movimenti_collezione
                    (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
                values
                    (v_riga.richiedente_id, 'vendita_scambio', 'sealed', v_nuovo_id, v_snap->>'nome',
                     v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
            end if;
        end if;
    end if;

    update richieste_scambio_righe
    set stato_riga = 'conclusa', location_scelta = coalesce(nullif(p_location_scelta, ''), '?'), aggiornato_il = now()
    where id = p_riga_id;

    if v_riga.richiedente_id is not null then -- sql/88
        insert into activity_log (user_id, source, action, details)
        values (v_riga.richiedente_id, 'sito', 'riga_scambio_conclusa', jsonb_build_object('riga_id', p_riga_id));
    end if;
    perform _pulisci_dati_ospite(v_riga.richiesta_id); -- sql/88
end;
$function$;
