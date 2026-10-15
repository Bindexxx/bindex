-- ============================================================================
-- 114 — CODA CARTE: LA TOCCA SOLO IL PROPRIETARIO O CHI LA STA LAVORANDO
-- (richiesta di Claudio, 2026-10-15)
--
-- Letto sul DB LIVE il 2026-10-15 (pg_get_functiondef, pg_trigger):
-- - completa_riga_coda_carte (SECURITY DEFINER, EXECUTE ad authenticated):
--   nessun controllo su chi chiama. Chiunque del gruppo poteva completare
--   QUALUNQUE riga di coda, con nome/prezzo/link a piacere, e la carta
--   finiva nella collezione (o wishlist/sealed) del proprietario della riga.
-- - Vista coda_carte: trigger INSTEAD OF UPDATE (_coda_carte_view_update,
--   SECURITY DEFINER) senza nessun controllo → chiunque poteva cambiare nome
--   e link delle richieste altrui, o rubare/azzerare la presa in carico.
--   (INSERT e DELETE erano già controllati.)
-- - sposta_riga_in_correzione_manuale: nessun controllo → chiunque poteva
--   togliere dalla coda le righe altrui.
--
-- Nel codice dell'estensione (5.17–5.21) ogni scrittura su una riga altrui
-- avviene dopo averla presa in carico (stato 'in_corso', claimed_by = chi
-- lavora), con lo stesso filtro "libera o abbandonata da più di 10 minuti":
--   presa in carico (background.js _lavoraCodaCarteAutonomo,
--   aggiungi_carta_popup.js _recuperaAltreRigheDaDb); completamento via RPC;
--   rimessa in attesa / errore / opzioni (solo se ancora propria);
--   spostamento in correzione dopo 3 tentativi.
-- Il sito sulla coda fa solo INSERT e SELECT.
--
-- COSA FA
-- 1. completa_riga_coda_carte: solo il proprietario della riga o chi l'ha in
--    carico (claimed_by = chi chiama). Altrimenti errore (l'estensione conta
--    un tentativo fallito e la rimette in coda solo se è ancora sua).
-- 2. Trigger di modifica della vista: la modifica passa solo se chi modifica
--    è il proprietario, o ha la riga in carico, o la sta prendendo in carico
--    (riga libera o abbandonata da più di 10 minuti, nuova presa a proprio
--    nome). Nome e link restano del proprietario. La presa in carico si può
--    solo dare a sé stessi o togliere. Una modifica non permessa NON dà
--    errore: la riga non viene toccata (come "già presa da un altro PC"),
--    così una presa in carico di più righe non fallisce tutta per una sola.
-- 3. sposta_riga_in_correzione_manuale: solo proprietario o chi l'ha in carico.
-- Gli admin (is_admin()) restano liberi, come già per la cancellazione.
--
-- Stesse firme: solo CREATE OR REPLACE (permessi invariati). Nessun DROP,
-- REVOKE o DELETE: eseguibile anche via connettore.
-- ESEGUITO sul DB il 2026-10-15 (connettore) SOLO per le parti 1 e 2, dopo
-- una prova in un blocco annullato (13/13 casi come atteso: aiutante senza
-- presa bloccato, presa in carico ok, nome/link altrui intoccabili, estraneo
-- bloccato, carta al proprietario con la sua location).
-- PARTE 3 eseguita a mano nell'SQL editor (contiene un DELETE, il
-- connettore chiedeva una conferma), poi provata in un blocco annullato:
-- estraneo bloccato, aiutante con la riga in carico ok, correzione al
-- proprietario con la sua location, riga tolta dalla coda.
-- PER ANNULLARE: sql/114_coda_carte_solo_proprietario_o_chi_lavora_ROLLBACK.sql
-- ============================================================================

-- ── 1. COMPLETAMENTO ───────────────────────────────────────────────────────
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
    -- sql/114: solo il proprietario o chi ha la riga in carico.
    if v_riga.creato_da is distinct from auth.uid()
       and v_riga.claimed_by is distinct from auth.uid()
       and not is_admin() then
        raise exception 'Riga coda_carte % non presa in carico da te', p_riga_coda_id;
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

-- ── 2. MODIFICA DALLA VISTA coda_carte ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public._coda_carte_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_io uuid := auth.uid();
  v_proprietario boolean;
begin
  -- sql/114: chi può modificare una riga di coda. Una modifica non permessa
  -- non dà errore: la riga resta com'è (return null = riga non toccata).
  v_proprietario := old.owner_id = v_io or is_admin();
  if not v_proprietario then
    if v_io is null then
      return null;
    end if;
    if not (
         old.claimed_by = v_io                                   -- già in carico a me
      or (new.claimed_by = v_io and new.stato = 'in_corso'        -- la prendo in carico ora
          and (old.stato = 'pending'
               or (old.stato = 'in_corso' and old.claimed_at < now() - interval '10 minutes')))
    ) then
      return null;
    end if;
    -- nome e link della richiesta sono del proprietario
    if new.nome is distinct from old.nome or new.url_diretto is distinct from old.url_diretto then
      return null;
    end if;
    -- la presa in carico si può solo dare a sé stessi o togliere
    if new.claimed_by is distinct from old.claimed_by and new.claimed_by is not null and new.claimed_by <> v_io then
      return null;
    end if;
  end if;

  if not (new.url_diretto is null or new.url_diretto in ('', '#') or (new.url_diretto ~ '^https://(www\.)?cardmarket\.com/' and new.url_diretto !~ '[[:space:]"<>'']')) then
    raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
  end if;
  update coda_lavoro set
    stato          = coalesce(new.stato, stato),
    errore_msg     = new.errore_msg,
    claimed_by     = new.claimed_by,
    claimed_at     = new.claimed_at,
    completato_il  = new.completato_il,
    tentativi_falliti = coalesce(new.tentativi_falliti, tentativi_falliti),
    esito          = case when new.opzioni_disambiguazione is not null
                          then jsonb_build_object('opzioni_disambiguazione', new.opzioni_disambiguazione)
                          else esito end,
    payload        = payload || jsonb_strip_nulls(jsonb_build_object('nome', new.nome, 'url_diretto', new.url_diretto))
  where id = old.id;
  return new;
end;
$function$;

-- ── 3. SPOSTAMENTO IN CORREZIONE MANUALE ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- sql/114: solo il proprietario o chi ha la riga in carico.
    if v_riga.owner_id is distinct from auth.uid()
       and v_riga.claimed_by is distinct from auth.uid()
       and not is_admin() then
        raise exception 'Riga coda_carte % non presa in carico da te', p_riga_id;
    end if;
    -- La vista nasconde la location delle righe altrui: per la correzione
    -- (che legge solo il proprietario) va presa dalla richiesta originale.
    insert into public.correzioni_manuali_carte (
        coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
        reverse, first_ed, nota, location, tipo, destinazione,
        prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg, tentativi_falliti
    ) values (
        v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
        v_riga.reverse, v_riga.first_ed, v_riga.nota,
        (select nullif(l.payload ->> 'location', '') from coda_lavoro l where l.id = p_riga_id),
        v_riga.tipo, v_riga.destinazione,
        v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
        v_riga.tentativi_falliti
    )
    returning id into v_nuovo_id;
    delete from public.coda_lavoro where id = p_riga_id;
    return v_nuovo_id;
end;
$function$;

-- ── VERIFICA ───────────────────────────────────────────────────────────────
-- attesa: 3 (le tre funzioni contengono "sql/114")
select count(*) as funzioni_aggiornate
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname in ('completa_riga_coda_carte', '_coda_carte_view_update', 'sposta_riga_in_correzione_manuale')
  and pg_get_functiondef(p.oid) like '%sql/114%';
