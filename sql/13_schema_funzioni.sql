-- ============================================================================
-- CardSync Pro — 13: Funzioni e RPC (testo verificato via pg_get_functiondef
-- sul DB di produzione — nessuna riscritta a memoria).
-- Da eseguire dopo 12 + 11.
-- ============================================================================

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$function$;

create or replace function public.log_admin_action(p_action text, p_target uuid, p_details jsonb default null::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target, p_details);
end;
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, username, role)
  values (new.id, split_part(new.email, '@', 1), 'user')
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.handle_password_verification_attempt(event jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_banned_until timestamptz;
  v_deleted_at timestamptz;
begin
  if (event->>'valid')::boolean is not true then
    return jsonb_build_object('decision', 'continue');
  end if;

  v_user_id := (event->>'user_id')::uuid;

  select banned_until, deleted_at into v_banned_until, v_deleted_at
  from public.profiles
  where id = v_user_id;

  if v_deleted_at is not null then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Account disattivato. Contatta un amministratore.',
      'should_logout_user', true
    );
  end if;

  if v_banned_until is not null and v_banned_until > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Account sospeso fino al ' || to_char(v_banned_until, 'DD/MM/YYYY HH24:MI') || '.',
      'should_logout_user', true
    );
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$function$;
-- NOTA: questa NON è collegata da un trigger — è un Auth Hook di Supabase.
-- Va agganciata da Dashboard > Authentication > Hooks (Beta) > Password
-- Verification Attempt, selezionando questa funzione. Passo manuale, non
-- eseguibile da SQL Editor.

create or replace function public.aggiorna_updated_at()
 returns trigger
 language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public._cardsync_registra_storico_prezzo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.prezzo is not null and (TG_OP = 'INSERT' or new.prezzo is distinct from old.prezzo) then
    insert into storico_prezzi (carta_id, owner_id, tabella, prezzo)
    values (new.id, new.owner_id, TG_TABLE_NAME, new.prezzo);
  end if;
  return new;
end;
$function$;

create or replace function public._cardsync_traccia_prezzo_precedente()
 returns trigger
 language plpgsql
as $function$
begin
  if new.prezzo is distinct from old.prezzo then
    new.prezzo_precedente := old.prezzo;
  end if;
  return new;
end;
$function$;

create or replace function public._coda_carte_view_insert()
 returns trigger
 language plpgsql
 security definer
as $function$
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
      'prezzo_obiettivo', new.prezzo_obiettivo
    ))
  );
  return new;
end;
$function$;

create or replace function public._coda_carte_view_update()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
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

create or replace function public._coda_carte_view_delete()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
  delete from coda_lavoro where id = old.id;
  return old;
end;
$function$;

create or replace function public.completa_lavoro(p_id bigint, p_esito jsonb default null::jsonb, p_errore_msg text default null::text)
 returns void
 language sql
 security definer
as $function$
  update coda_lavoro
  set stato = case when p_errore_msg is null then 'completato' else 'errore' end,
      esito = p_esito, errore_msg = p_errore_msg,
      completato_il = now()
  where id = p_id;
$function$;

create or replace function public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean default false, p_tipi text[] default null::text[])
 returns integer
 language sql
 security definer
as $function$
  select count(*)::int from coda_lavoro
  where stato = 'pending'
    and (p_aiuta_gruppo or creato_da = p_user_id)
    and (p_tipi is null or tipo = any(p_tipi));
$function$;

create or replace function public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean default false, p_lotto_size integer default 3, p_tipi text[] default null::text[])
 returns setof coda_lavoro
 language plpgsql
 security definer
as $function$
declare
  v_soglia_stallo timestamptz := now() - interval '10 minutes';
begin
  return query
  with eleggibili as (
    select id from coda_lavoro
    where (stato = 'pending' or (stato = 'in_corso' and claimed_at < v_soglia_stallo))
      and (p_aiuta_gruppo or creato_da = p_user_id)
      and (p_tipi is null or tipo = any(p_tipi))
    order by creato_il asc
    limit p_lotto_size
    for update skip locked
  )
  update coda_lavoro
  set stato = 'in_corso', claimed_by = p_user_id,
      claimed_at = now(), dispositivo = p_dispositivo
  where id in (select id from eleggibili)
  returning *;
end;
$function$;

create or replace function public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text default null::text, p_tipo text default null::text, p_destinazione text default 'collezione'::text, p_prezzo_obiettivo numeric default null::numeric)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  end if;

  return v_nuovo_id;
end;
$function$;

create or replace function public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid default null::uuid, p_solo_proprie boolean default true, p_filtro_location text[] default null::text[], p_solo_vecchie boolean default false, p_giorni_minimi integer default 3)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
  v_soglia timestamptz;
begin
  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from carte
  where stato = 'collezione'
    and (not p_solo_proprie or owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    and (p_filtro_location is null or location = any(p_filtro_location))
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;

create or replace function public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid default null::uuid, p_solo_proprie boolean default true, p_filtro_location text[] default null::text[], p_solo_vecchie boolean default false, p_giorni_minimi integer default 3, p_lotto_size integer default 3)
 returns setof carte
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
begin
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  update carte c
  set claimed_by = p_user_id, claimed_at = now()
  where c.id in (
    select id from carte
    where stato = 'collezione'
      and (p_solo_proprie = false or owner_id = coalesce(p_owner_id_richiesto, p_user_id))
      and (p_filtro_location is null or array_length(p_filtro_location, 1) is null or location = any(p_filtro_location))
      and (p_solo_vecchie = false or ultimo_controllo is null or ultimo_controllo < v_soglia_vecchie)
      and (claimed_by is null or claimed_by = p_user_id or claimed_at < v_soglia_claim)
    order by ultimo_controllo asc nulls first
    limit p_lotto_size
    for update skip locked
  )
  returning c.*;
end;
$function$;

create or replace function public.rilascia_claim_controllo_prezzi(p_dispositivo text default null::text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set claimed_by = null, claimed_at = null, dispositivo = null
  where claimed_by = auth.uid()
    and (p_dispositivo is null or dispositivo = p_dispositivo);
$function$;

create or replace function public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set dispositivo = p_dispositivo
  where id = any(p_ids)
    and claimed_by = auth.uid()
    and stato = 'collezione';
$function$;

create or replace function public.segna_controllata_gruppo(p_id uuid)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione';
$function$;

create or replace function public.leggi_stato_claim_gruppo(p_soglia_minuti integer default 10)
 returns table(id uuid, dispositivo text, claimed_by uuid, claimed_at timestamp with time zone)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select id, dispositivo, claimed_by, claimed_at
  from carte
  where stato = 'collezione'
    and claimed_by is not null
    and claimed_at > (now() - (p_soglia_minuti || ' minutes')::interval)
  order by claimed_at desc;
$function$;

create or replace function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$function$;

create or replace function public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set note = p_nota
  where id = p_id
    and stato = 'collezione';
$function$;

create or replace function public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text default null::text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update carte
  set prezzo = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';
$function$;

create or replace function public.pulisci_storico_prezzi()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  delete from storico_prezzi sp
  where sp.registrato_il < now() - interval '30 days'
    and sp.id not in (
      select distinct on (carta_id, tabella, date_trunc('day', registrato_il))
        id
      from storico_prezzi
      where registrato_il < now() - interval '30 days'
      order by carta_id, tabella, date_trunc('day', registrato_il), registrato_il desc
    );
end;
$function$;

create or replace function public.verifica_versione_minima(p_versione_client text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_minima text;
  v_parti_client int[];
  v_parti_minima int[];
begin
  select valore into v_minima from configurazione_app where chiave = 'versione_minima';
  if v_minima is null then
    return true;
  end if;

  v_parti_client := string_to_array(p_versione_client, '.')::int[];
  v_parti_minima := string_to_array(v_minima, '.')::int[];

  if v_parti_client < v_parti_minima then
    raise exception 'ESTENSIONE_NON_AGGIORNATA: versione minima richiesta %, hai dichiarato %', v_minima, p_versione_client
      using errcode = 'P0001';
  end if;

  return true;
end;
$function$;

create or replace function public.request_password_reset(p_username text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_recenti int;
begin
  select id into v_user_id
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    return;
  end if;

  select count(*) into v_recenti
  from public.pending_requests
  where user_id = v_user_id
    and type = 'password_reset'
    and status = 'pending'
    and created_at > now() - interval '1 hour';

  if v_recenti >= 3 then
    raise exception 'Troppe richieste per questo utente, riprova più tardi.';
  end if;

  insert into public.pending_requests (user_id, type, status, payload)
  values (v_user_id, 'password_reset', 'pending', jsonb_build_object('richiesto_il', now()));
end;
$function$;

create or replace function public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb default null::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_req record;
  v_nuovo_username text;
  v_nuova_email text;
  v_media_id uuid;
  v_conflitti int;
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  if p_decisione not in ('approved', 'rejected') then
    raise exception 'Decisione non valida';
  end if;

  select * into v_req from public.pending_requests where id = p_request_id;
  if v_req is null then
    raise exception 'Richiesta non trovata';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Richiesta già gestita in precedenza';
  end if;

  if p_decisione = 'approved' then

    if v_req.type = 'password_reset' then
      if p_payload is null or length(coalesce(p_payload->>'new_password', '')) < 6 then
        raise exception 'Password mancante o troppo corta';
      end if;

      update auth.users
      set encrypted_password = extensions.crypt(p_payload->>'new_password', extensions.gen_salt('bf')),
          updated_at = now()
      where id = v_req.user_id;

      delete from auth.refresh_tokens where user_id = v_req.user_id::text;
      delete from auth.sessions where user_id = v_req.user_id;

    elsif v_req.type = 'username_change' then
      v_nuovo_username := trim(v_req.payload->>'nuovo_username');
      if v_nuovo_username is null or length(v_nuovo_username) < 3 then
        raise exception 'Nuovo username mancante o troppo corto nella richiesta';
      end if;
      v_nuova_email := lower(v_nuovo_username) || '@cardsyncpro.local';

      select count(*) into v_conflitti
      from public.profiles
      where lower(username) = lower(v_nuovo_username) and id <> v_req.user_id;
      if v_conflitti > 0 then
        raise exception 'Username già in uso da un altro account';
      end if;

      select count(*) into v_conflitti
      from auth.users
      where email = v_nuova_email and id <> v_req.user_id;
      if v_conflitti > 0 then
        raise exception 'Username già in uso da un altro account (conflitto email interna)';
      end if;

      update public.profiles set username = v_nuovo_username where id = v_req.user_id;
      update auth.users set email = v_nuova_email, updated_at = now() where id = v_req.user_id;

      delete from auth.refresh_tokens where user_id = v_req.user_id::text;
      delete from auth.sessions where user_id = v_req.user_id;

    elsif v_req.type = 'photo_upload' then
      v_media_id := (v_req.payload->>'media_id')::uuid;
      if v_media_id is null then
        raise exception 'Riferimento foto mancante nella richiesta';
      end if;

      update public.user_media
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
      where id = v_media_id;

    else
      null;
    end if;

  else
    if v_req.type = 'photo_upload' then
      v_media_id := (v_req.payload->>'media_id')::uuid;
      if v_media_id is not null then
        update public.user_media
        set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
            admin_note = p_payload->>'nota'
        where id = v_media_id;
      end if;
    end if;
  end if;

  update public.pending_requests
  set status = p_decisione, reviewed_at = now(), reviewed_by = auth.uid(),
      admin_note = coalesce(p_payload->>'nota', admin_note)
  where id = p_request_id;

  perform public.log_admin_action(
    case when p_decisione = 'approved' then 'request_approved' else 'request_rejected' end,
    v_req.user_id,
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type)
  );
end;
$function$;

create or replace function public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set banned_until = p_until, ban_reason = p_reason where id = p_target;
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('ban', p_target, jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$function$;

create or replace function public.admin_unban_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set banned_until = null, ban_reason = null where id = p_target;
  perform public.log_admin_action('unban', p_target, null);
end;
$function$;

create or replace function public.admin_revoke_sessions(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('revoke_sessions', p_target, null);
end;
$function$;

create or replace function public.admin_soft_delete_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set deleted_at = now() where id = p_target;
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('soft_delete', p_target, null);
end;
$function$;

create or replace function public.admin_restore_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set deleted_at = null where id = p_target;
  perform public.log_admin_action('restore', p_target, null);
end;
$function$;

create or replace function public.admin_reset_password(p_target uuid, p_new_password text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;
  if length(p_new_password) < 6 then
    raise exception 'Password troppo corta';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_target;

  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('reset_password', p_target, null);
end;
$function$;

-- admin_hard_delete_user: versione FINALE (già corretta), stessa di
-- 09_fix_admin_hard_delete_user_cascade.sql — non rieseguire 09 dopo
-- questo file, è ridondante (non dannoso, ma inutile).
create or replace function public.admin_hard_delete_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;
  perform public.log_admin_action('hard_delete', p_target, null);

  delete from public.foto_carte where owner_id = p_target;
  delete from public.user_media where user_id = p_target;
  delete from public.location where owner_id = p_target;
  delete from public.preferenze_utente where owner_id = p_target;
  delete from public.wishlist where owner_id = p_target;
  delete from public.carte where owner_id = p_target;

  update public.admin_audit_log set admin_id = null where admin_id = p_target;
  update public.activity_log set user_id = null where user_id = p_target;
  update public.pending_requests set user_id = null where user_id = p_target;
  update public.pending_requests set reviewed_by = null where reviewed_by = p_target;
  update public.user_media set reviewed_by = null where reviewed_by = p_target;
  update public.worker_presenza set user_id = null where user_id = p_target;
  update public.ordini set creato_da = null where creato_da = p_target;
  update public.ordini set preso_in_carico_da = null where preso_in_carico_da = p_target;
  update public.coda_wishlist set owner_id = null where owner_id = p_target;
  update public.coda_wishlist set claimed_by = null where claimed_by = p_target;
  update public.coda_lavoro set creato_da = null where creato_da = p_target;
  update public.coda_lavoro set claimed_by = null where claimed_by = p_target;

  delete from auth.users where id = p_target;
end;
$function$;

create or replace function public.leggi_scambio_condiviso(p_owner_id uuid)
 returns table(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, note text, url text, immagine text)
 language sql
 security definer
 set search_path to 'public'
as $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           note, url, immagine
    from public.carte
    where owner_id = p_owner_id
      and location = 'SCAMBIO'
      and stato = 'collezione'
    order by nome;
$function$;

create or replace function public.leggi_sealed_condiviso(p_owner_id uuid)
 returns table(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, note text, url text, immagine text)
 language sql
 security definer
 set search_path to 'public'
as $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           note, url, immagine
    from public.carte
    where owner_id = p_owner_id
      and tipo = 'sealed'
      and stato = 'collezione'
      and location = 'SCAMBIO'
    order by nome;
$function$;

create or replace function public.leggi_wishlist_condivisa(p_owner_id uuid)
 returns table(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, prezzo_obiettivo numeric, note text, url text, immagine text)
 language sql
 security definer
 set search_path to 'public'
as $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           prezzo_obiettivo, note, url, immagine
    from public.wishlist
    where owner_id = p_owner_id
    order by nome;
$function$;

create or replace function public.trova_match_scambio_wishlist(p_owner_id uuid)
 returns table(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select c.id, c.nome, c.prezzo, w.owner_id, u.email, w.id, w.prezzo_obiettivo
  from carte c
  join wishlist w on lower(w.nome) = lower(c.nome)
  join auth.users u on u.id = w.owner_id
  where c.owner_id = p_owner_id
    and c.location = 'SCAMBIO'
    and c.stato = 'collezione'
    and w.owner_id != p_owner_id
    and not exists (
      select 1 from preferenze_utente pu
      where pu.owner_id = w.owner_id and pu.nascondi_wishlist_da_match = true
    );
$function$;

create or replace function public.trova_match_wishlist_scambio(p_owner_id uuid)
 returns table(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, u.email, c.id, c.prezzo
  from wishlist w
  join carte c on lower(c.nome) = lower(w.nome)
  join auth.users u on u.id = c.owner_id
  where w.owner_id = p_owner_id
    and c.location = 'SCAMBIO'
    and c.stato = 'collezione'
    and c.owner_id != p_owner_id
    and not exists (
      select 1 from preferenze_utente pu
      where pu.owner_id = c.owner_id and pu.nascondi_scambio_da_match = true
    );
$function$;

-- leggi_card_back_approvata: versione FINALE (con reviewed_at), già
-- verificata in 08_rpc_card_back_reviewed_at.sql.
create or replace function public.leggi_card_back_approvata(p_owner_id uuid)
 returns table(storage_path text, source text, metadata jsonb, reviewed_at timestamptz)
 language sql
 security definer
 set search_path = public
as $$
  select storage_path, source, metadata, reviewed_at
  from user_media
  where user_id = p_owner_id
    and slot = 'card_back'
    and status = 'approved'
  limit 1;
$$;

grant execute on function public.leggi_card_back_approvata(uuid) to anon, authenticated;
