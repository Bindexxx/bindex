-- ============================================================================
-- ROLLBACK di sql/114: le tre funzioni tornano IDENTICHE a prima (lette sul
-- DB live il 2026-10-15), di nuovo senza controllo su chi chiama.
-- Solo CREATE OR REPLACE: eseguibile anche via connettore.
-- ============================================================================

-- ── 1. COMPLETAMENTO ──
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

-- ── 2. MODIFICA DALLA VISTA ──
CREATE OR REPLACE FUNCTION public._coda_carte_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
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

-- ── 3. CORREZIONE MANUALE ──
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
    insert into public.correzioni_manuali_carte (
        coda_carte_id_originale, owner_id, nome, lingua, condizione, qty,
        reverse, first_ed, nota, location, tipo, destinazione,
        prezzo_obiettivo, url_diretto, opzioni_disambiguazione, errore_msg, tentativi_falliti
    ) values (
        v_riga.id, v_riga.owner_id, v_riga.nome, v_riga.lingua, v_riga.condizione, v_riga.qty,
        v_riga.reverse, v_riga.first_ed, v_riga.nota, v_riga.location, v_riga.tipo, v_riga.destinazione,
        v_riga.prezzo_obiettivo, v_riga.url_diretto, coalesce(p_opzioni, v_riga.opzioni_disambiguazione), p_errore_msg,
        v_riga.tentativi_falliti
    )
    returning id into v_nuovo_id;
    delete from public.coda_lavoro where id = p_riga_id;
    return v_nuovo_id;
end;
$function$;
