-- ============================================================================
-- 92 — ROLLBACK: riporta funzioni e permessi ESATTAMENTE allo stato live del
-- 2026-10-01 (prima della 92). NB: rimette anche il bug di
-- completa_riga_coda_carte (id uuid su una vista con id bigint).
-- ============================================================================

begin;

-- ── A) completa_riga_coda_carte: versione precedente (id uuid) ────────────
drop function public.completa_riga_coda_carte(bigint, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric, boolean);

create function public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_destinazione text DEFAULT 'collezione'::text, p_prezzo_obiettivo numeric DEFAULT NULL::numeric)
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
revoke all on function public.completa_riga_coda_carte(uuid, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric) from public, anon;
grant execute on function public.completa_riga_coda_carte(uuid, text, text, text, integer, text, text, text, numeric, text, text, text, text, numeric) to authenticated, service_role;

-- ── B) sposta_riga_in_correzione_manuale: versione precedente ─────────────
CREATE OR REPLACE FUNCTION public.sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_riga public.coda_carte%rowtype;
  v_nuovo_id uuid;
begin
  select * into v_riga from public.coda_carte where id = p_riga_id;
  if not found then
    raise exception 'Riga coda_carte % non trovata (già spostata o eliminata?)', p_riga_id;
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

  delete from public.coda_carte where id = p_riga_id;

  return v_nuovo_id;
end;
$function$;

-- ── C) trova_match_*: versioni precedenti (con email, senza controllo) ────
CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist(p_owner_id uuid)
 RETURNS TABLE(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric, altro_nickname text, altra_disponibili integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select c.id, c.nome, c.prezzo, w.owner_id, u.email, w.id, w.prezzo_obiettivo, pn.nickname, (bc.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.carte c
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join public.wishlist w on upper(trim(w.codice)) = upper(trim(c.codice))
    join auth.users u on u.id = w.owner_id
    left join public.preferenze_utente pn on pn.owner_id = w.owner_id
    where c.owner_id = p_owner_id
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
$function$;

CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric, altro_nickname text, altra_disponibili integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, u.email, c.id, c.prezzo, pn.nickname, (bc.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.wishlist w
    join public.carte c on upper(trim(c.codice)) = upper(trim(w.codice))
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join auth.users u on u.id = c.owner_id
    left join public.preferenze_utente pn on pn.owner_id = c.owner_id
    where w.owner_id = p_owner_id
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
$function$;

CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist_sealed(p_owner_id uuid)
 RETURNS TABLE(mio_prodotto_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_sealed_id uuid, altro_prezzo_obiettivo numeric, altro_nickname text, altra_disponibili integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select p.id, p.nome, p.prezzo, ws.owner_id, u.email, ws.id, ws.prezzo_obiettivo, pn.nickname, (sp.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.prodotti_sealed p
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join public.wishlist_sealed ws on upper(trim(ws.codice)) = upper(trim(p.codice))
    join auth.users u on u.id = ws.owner_id
    left join public.preferenze_utente pn on pn.owner_id = ws.owner_id
    where p.owner_id = p_owner_id
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
$function$;

CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio_sealed(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_sealed_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altro_prodotto_id uuid, altro_prezzo numeric, altro_nickname text, altra_disponibili integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select ws.id, ws.nome, ws.prezzo_obiettivo, p.owner_id, u.email, p.id, p.prezzo, pn.nickname, (sp.quantita_offerta - coalesce((select sum(rsr.quantita_richiesta) from public.richieste_scambio_righe rsr where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0))::integer
    from public.wishlist_sealed ws
    join public.prodotti_sealed p on upper(trim(p.codice)) = upper(trim(ws.codice))
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join auth.users u on u.id = p.owner_id
    left join public.preferenze_utente pn on pn.owner_id = p.owner_id
    where ws.owner_id = p_owner_id
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
$function$;

-- ── D) permessi precedenti ───────────────────────────────────────────────
grant execute on function public.completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) to authenticated;
grant execute on function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) to authenticated;
grant execute on function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) to authenticated;

-- ── E) hook di login: permessi precedenti ────────────────────────────────
grant execute on function public.handle_password_verification_attempt(event jsonb) to public, anon, authenticated;
revoke execute on function public.handle_password_verification_attempt(event jsonb) from supabase_auth_admin;

-- ── F) search_path ───────────────────────────────────────────────────────
alter function public._shop_gruppo(p_categoria text, p_stile jsonb) reset search_path;

commit;
