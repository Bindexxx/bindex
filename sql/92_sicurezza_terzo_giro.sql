-- ============================================================================
-- 92 — SICUREZZA, TERZO GIRO + correzione coda carte
-- (audit 2026-10-01, dopo l'unione delle PR 36-39)
-- Scritto partendo dalle definizioni LIVE lette il 2026-10-01.
--
-- Decisione (2026-10-01): la coda carte resta CONDIVISA — tutti lavorano le
-- carte di tutti (vista coda_carte leggibile da ogni utente loggato,
-- completa/sposta su righe altrui consentite). Qui si chiude solo il resto.
--
-- COSA FA (una transazione: o tutto o niente):
--  A) completa_riga_coda_carte — ERA ROTTA: prendeva l'id della riga come
--     uuid, ma coda_carte (vista su coda_lavoro) ha id bigint, quindi ogni
--     chiamata falliva con "operator does not exist: bigint = uuid"; in più
--     l'estensione le passa p_sigillata_originale, che la funzione live non
--     aveva più. Ora: id bigint, p_sigillata_originale (default false),
--     richiede l'accesso, blocca la riga e rifiuta una riga già completata
--     (niente carte doppie se la chiamata viene ripetuta), e segna lei
--     stessa la riga come completata.
--  B) sposta_riga_in_correzione_manuale — cancellava la riga passando dalla
--     vista coda_carte, il cui trigger permette di cancellare solo le
--     PROPRIE righe: per una riga di un altro (lavoro di gruppo) la RPC
--     falliva e la riga restava in coda per sempre. Ora cancella
--     direttamente da coda_lavoro. Richiede l'accesso e rifiuta righe già
--     completate.
--  C) trova_match_* (4 funzioni): funzionano solo per chi chiama
--     (p_owner_id deve essere il proprio id) e non restituiscono più l'email
--     degli altri utenti (colonna altra_email lasciata, sempre NULL, così
--     nessun client si rompe). Il sito usa già solo il nickname.
--  D) completa_lavoro / reclama_lavoro / conta_lavoro_pendente: non le usa
--     né il sito né l'estensione attuale, e non controllano chi le chiama
--     (reclama_lavoro accetta qualunque p_user_id). Tolte agli utenti,
--     restano a service_role.
--  E) handle_password_verification_attempt (hook di login di Supabase
--     Auth): prima il permesso arrivava SOLO da PUBLIC (vedi nota in 77),
--     quindi era chiamabile da chiunque via /rest/v1/rpc e diceva se un
--     utente è sospeso e fino a quando. Ora il permesso è dato ESPLICITAMENTE
--     a supabase_auth_admin (il ruolo con cui Supabase Auth chiama l'hook,
--     come da documentazione Supabase) e tolto a PUBLIC/anon/authenticated.
--  F) _shop_gruppo (SQL 91): search_path fissato.
--
-- PER ANNULLARE: sql/92_sicurezza_terzo_giro_ROLLBACK.sql
-- ============================================================================

begin;

-- ── A) completa_riga_coda_carte: id bigint + sigillata_originale ──────────
drop function public.completa_riga_coda_carte(uuid, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric);

create function public.completa_riga_coda_carte(
    p_riga_coda_id bigint,
    p_nome text,
    p_codice text,
    p_location text,
    p_qty integer,
    p_lingua text,
    p_condizione text,
    p_url text,
    p_prezzo numeric,
    p_note text,
    p_immagine text default null::text,
    p_tipo text default null::text,
    p_destinazione text default 'collezione'::text,
    p_prezzo_obiettivo numeric default null::numeric,
    p_sigillata_originale boolean default false
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_riga     coda_lavoro%rowtype;
    v_nuovo_id uuid;
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;

    -- La riga può essere di chiunque (la coda è lavorata da tutto il
    -- gruppo): la carta va sempre al proprietario della RICHIESTA.
    select * into v_riga from coda_lavoro
     where id = p_riga_coda_id and tipo in ('aggiungi_carta', 'aggiungi_wishlist')
     for update;
    if not found then
        raise exception 'Riga coda_carte % non trovata — impossibile determinare il proprietario', p_riga_coda_id;
    end if;
    if v_riga.stato = 'completato' then
        raise exception 'Riga coda_carte % già completata', p_riga_coda_id;
    end if;

    if p_destinazione = 'wishlist' then
        insert into wishlist (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, prezzo_obiettivo)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, p_prezzo_obiettivo)
        returning id into v_nuovo_id;
    else
        insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)
        values (v_riga.creato_da, p_nome, p_codice, p_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))
        returning id into v_nuovo_id;

        -- Fase 8, Step 2 (2026-09-13): log dell'evento — SOLO qui, mai nel
        -- ramo wishlist sopra.
        insert into public.movimenti_collezione
            (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
        values
            (v_riga.creato_da, 'aggiunta', 'carta', v_nuovo_id, p_nome, p_qty,
             p_prezzo, case when p_prezzo is not null then p_prezzo * p_qty else null end, 'rpc');
    end if;

    update coda_lavoro set stato = 'completato', completato_il = now() where id = p_riga_coda_id;

    return v_nuovo_id;
end;
$$;
revoke all on function public.completa_riga_coda_carte(bigint, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric, boolean) from public, anon;
grant execute on function public.completa_riga_coda_carte(bigint, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric, boolean) to authenticated, service_role;

-- ── B) sposta_riga_in_correzione_manuale: funziona anche su righe altrui ──
create or replace function public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb default null::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_riga     public.coda_carte%rowtype;
    v_nuovo_id uuid;
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;

    perform 1 from coda_lavoro where id = p_riga_id for update;
    select * into v_riga from public.coda_carte where id = p_riga_id;
    if not found then
        raise exception 'Riga coda_carte % non trovata (già spostata o eliminata?)', p_riga_id;
    end if;
    if v_riga.stato = 'completato' then
        raise exception 'Riga coda_carte % già completata', p_riga_id;
    end if;

    insert into public.correzioni_manuali_carte (
        coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
        reverse, first_ed, nota, location, tipo, destinazione,
        prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg,
        tentativi_falliti
    ) values (
        v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
        v_riga.reverse, v_riga.first_ed, v_riga.nota, v_riga.location, v_riga.tipo, v_riga.destinazione,
        v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
        v_riga.tentativi_falliti
    )
    returning id into v_nuovo_id;

    -- Direttamente sulla tabella: il trigger della vista coda_carte
    -- permette di cancellare solo le proprie righe.
    delete from public.coda_lavoro where id = p_riga_id;

    return v_nuovo_id;
end;
$$;

-- ── C) trova_match_*: solo per sé, niente email ──────────────────────────
create or replace function public.trova_match_scambio_wishlist(p_owner_id uuid)
returns table(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric, altro_nickname text, altra_disponibili integer)
language sql security definer set search_path = public as $$
    select c.id, c.nome, c.prezzo, w.owner_id, null::text, w.id, w.prezzo_obiettivo, pn.nickname, (bc.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.carte c
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join public.wishlist w on upper(trim(w.codice)) = upper(trim(c.codice))
    join auth.users u on u.id = w.owner_id
    left join public.preferenze_utente pn on pn.owner_id = w.owner_id
    where p_owner_id = auth.uid()
      and c.owner_id = p_owner_id
      and c.stato = 'collezione'
      and c.codice is not null and trim(c.codice) <> ''
      and w.codice is not null and trim(w.codice) <> ''
      and (bc.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and w.owner_id != p_owner_id
      and (w.lingua is null or w.lingua = '' or w.lingua = c.lingua)
      and (w.prezzo_obiettivo is null or c.prezzo is null or c.prezzo <= w.prezzo_obiettivo)
      and public._rank_condizione(c.condizione) >= public._rank_condizione(w.condizione)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = w.owner_id and pu.nascondi_wishlist_da_match = true
      );
$$;

create or replace function public.trova_match_wishlist_scambio(p_owner_id uuid)
returns table(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric, altro_nickname text, altra_disponibili integer)
language sql security definer set search_path = public as $$
    select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, null::text, c.id, c.prezzo, pn.nickname, (bc.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.wishlist w
    join public.carte c on upper(trim(c.codice)) = upper(trim(w.codice))
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join auth.users u on u.id = c.owner_id
    left join public.preferenze_utente pn on pn.owner_id = c.owner_id
    where p_owner_id = auth.uid()
      and w.owner_id = p_owner_id
      and c.stato = 'collezione'
      and c.codice is not null and trim(c.codice) <> ''
      and w.codice is not null and trim(w.codice) <> ''
      and (bc.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and c.owner_id != p_owner_id
      and (w.lingua is null or w.lingua = '' or w.lingua = c.lingua)
      and (w.prezzo_obiettivo is null or c.prezzo is null or c.prezzo <= w.prezzo_obiettivo)
      and public._rank_condizione(c.condizione) >= public._rank_condizione(w.condizione)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = c.owner_id and pu.nascondi_scambio_da_match = true
      );
$$;

create or replace function public.trova_match_scambio_wishlist_sealed(p_owner_id uuid)
returns table(mio_prodotto_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_sealed_id uuid, altro_prezzo_obiettivo numeric, altro_nickname text, altra_disponibili integer)
language sql security definer set search_path = public as $$
    select p.id, p.nome, p.prezzo, ws.owner_id, null::text, ws.id, ws.prezzo_obiettivo, pn.nickname, (sp.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.prodotti_sealed p
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join public.wishlist_sealed ws on upper(trim(ws.codice)) = upper(trim(p.codice))
    join auth.users u on u.id = ws.owner_id
    left join public.preferenze_utente pn on pn.owner_id = ws.owner_id
    where p_owner_id = auth.uid()
      and p.owner_id = p_owner_id
      and p.stato = 'collezione'
      and p.codice is not null and trim(p.codice) <> ''
      and ws.codice is not null and trim(ws.codice) <> ''
      and (sp.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and ws.owner_id != p_owner_id
      and (ws.lingua is null or ws.lingua = '' or ws.lingua = p.lingua)
      and (ws.prezzo_obiettivo is null or p.prezzo is null or p.prezzo <= ws.prezzo_obiettivo)
      and public._rank_integrita(p.integrita_packaging) >= public._rank_integrita(ws.integrita_minima)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = ws.owner_id and pu.nascondi_wishlist_da_match = true
      );
$$;

create or replace function public.trova_match_wishlist_scambio_sealed(p_owner_id uuid)
returns table(mia_wishlist_sealed_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altro_prodotto_id uuid, altro_prezzo numeric, altro_nickname text, altra_disponibili integer)
language sql security definer set search_path = public as $$
    select ws.id, ws.nome, ws.prezzo_obiettivo, p.owner_id, null::text, p.id, p.prezzo, pn.nickname, (sp.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.wishlist_sealed ws
    join public.prodotti_sealed p on upper(trim(p.codice)) = upper(trim(ws.codice))
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join auth.users u on u.id = p.owner_id
    left join public.preferenze_utente pn on pn.owner_id = p.owner_id
    where p_owner_id = auth.uid()
      and ws.owner_id = p_owner_id
      and p.stato = 'collezione'
      and p.codice is not null and trim(p.codice) <> ''
      and ws.codice is not null and trim(ws.codice) <> ''
      and (sp.quantita_offerta - coalesce((
            select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr
            where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'
          ), 0)) > 0
      and p.owner_id != p_owner_id
      and (ws.lingua is null or ws.lingua = '' or ws.lingua = p.lingua)
      and (ws.prezzo_obiettivo is null or p.prezzo is null or p.prezzo <= ws.prezzo_obiettivo)
      and public._rank_integrita(p.integrita_packaging) >= public._rank_integrita(ws.integrita_minima)
      and not exists (
        select 1 from preferenze_utente pu
        where pu.owner_id = p.owner_id and pu.nascondi_scambio_da_match = true
      );
$$;

-- ── D) funzioni della vecchia coda_lavoro non più usate ──────────────────
revoke execute on function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) from public, anon, authenticated;
revoke execute on function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) from public, anon, authenticated;
revoke execute on function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) from public, anon, authenticated;

-- ── E) hook di login: solo Supabase Auth ─────────────────────────────────
-- Prima il GRANT esplicito, poi le revoche: l'hook non resta mai senza
-- permesso, nemmeno per un istante.
grant execute on function public.handle_password_verification_attempt(event jsonb) to supabase_auth_admin;
revoke execute on function public.handle_password_verification_attempt(event jsonb) from public, anon, authenticated;

-- ── F) search_path ───────────────────────────────────────────────────────
alter function public._shop_gruppo(p_categoria text, p_stile jsonb) set search_path = public;

commit;

-- ============================================================================
-- VERIFICA (eseguire DOPO, sola lettura). Risultato atteso: ZERO righe.
-- ============================================================================
-- select 'completa_riga_coda_carte vecchia ancora presente'
--  where exists (select 1 from pg_proc where proname = 'completa_riga_coda_carte'
--                and pg_get_function_identity_arguments(oid) like 'p_riga_coda_id uuid%')
-- union all
-- select 'hook login: Supabase Auth non può eseguirlo'
--  where not has_function_privilege('supabase_auth_admin', 'public.handle_password_verification_attempt(jsonb)', 'execute')
-- union all
-- select 'hook login ancora eseguibile da anon'
--  where has_function_privilege('anon', 'public.handle_password_verification_attempt(jsonb)', 'execute')
-- union all
-- select 'reclama_lavoro ancora eseguibile dagli utenti'
--  where has_function_privilege('authenticated', 'public.reclama_lavoro(uuid,text,boolean,integer,text[])', 'execute');
