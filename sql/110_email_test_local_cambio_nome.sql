-- ============================================================================
-- 110 — CAMBIO NOME UTENTE: EMAIL INTERNA @test.local (AMBIENTE DI TEST)
-- Richiesta di Claudio, 2026-10-15, insieme all'estensione 5.19 / PR #99:
-- nell'ambiente di test gli account sono tutti nome@test.local, e sito ed
-- estensione ora completano il solo nome con @test.local. Questa funzione,
-- quando l'admin approva un cambio di nome utente, riscriveva l'email in
-- nome@cardsyncpro.local: l'utente rinominato non sarebbe più riuscito a
-- entrare scrivendo solo il nome.
--
-- Letto sul DB LIVE il 2026-10-15 (pg_get_functiondef): unico punto del DB
-- (schemi public e auth) che contiene "cardsyncpro". Testo IDENTICO a quello
-- live, cambia solo la riga di v_nuova_email (+ commento). Stessa firma:
-- CREATE OR REPLACE, nessun DROP, permessi invariati.
--
-- AL PASSAGGIO IN PRODUZIONE: eseguire il ROLLBACK (torna @cardsyncpro.local),
-- insieme al cambio "AMBIENTE DI TEST" nel sito e nell'estensione.
--
-- Da eseguire nell'SQL editor di Supabase (o via connettore).
-- PER ANNULLARE: sql/110_email_test_local_cambio_nome_ROLLBACK.sql
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req record;
  v_nuovo_username text;
  v_nuova_email text;
  v_media_id uuid;
  v_conflitti int;
  v_binder_id uuid; -- 21_binder_nome_con_approvazione.sql
  v_scaffale_id uuid; -- 41_fase1_3_scaffali.sql
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
      -- AMBIENTE DI TEST (sql/110, 2026-10-15): account @test.local, come il
      -- completamento del nome in sito ed estensione. In produzione:
      -- '@cardsyncpro.local' (sql/110_..._ROLLBACK.sql).
      v_nuova_email := lower(v_nuovo_username) || '@test.local';
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
    elsif v_req.type = 'binder_nome' then
      v_binder_id := (v_req.payload->>'binder_id')::uuid;
      if v_binder_id is null then
        raise exception 'Riferimento binder mancante nella richiesta';
      end if;
      -- 65b_admin_process_binder_nome_context.sql: flag locale alla
      -- transazione che autorizza QUESTO update di binders.nome (trigger
      -- trg_binders_blocca_rinomina_diretta, sql/26). Era andato perso
      -- quando la funzione è stata ripubblicata da sql/41.
      perform set_config('cardsync.admin_context', 'true', true);
      update public.binders
      set nome = nome_proposto, nome_stato = 'approved', nome_admin_note = null
      where id = v_binder_id and nome_stato = 'pending';
    elsif v_req.type = 'scaffale_nome' then
      -- 41_fase1_3_scaffali.sql: stessa identica logica di 'binder_nome'
      -- sopra, solo tabella diversa.
      v_scaffale_id := (v_req.payload->>'scaffale_id')::uuid;
      if v_scaffale_id is null then
        raise exception 'Riferimento scaffale mancante nella richiesta';
      end if;
      update public.scaffali
      set nome = nome_proposto, nome_stato = 'approved', nome_admin_note = null
      where id = v_scaffale_id and nome_stato = 'pending';
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
    elsif v_req.type = 'binder_nome' then
      v_binder_id := (v_req.payload->>'binder_id')::uuid;
      if v_binder_id is not null then
        update public.binders
        set nome_stato = 'rejected', nome_admin_note = p_payload->>'nota'
        where id = v_binder_id and nome_stato = 'pending';
      end if;
    elsif v_req.type = 'scaffale_nome' then
      -- 41_fase1_3_scaffali.sql: mirror del ramo binder_nome sopra.
      v_scaffale_id := (v_req.payload->>'scaffale_id')::uuid;
      if v_scaffale_id is not null then
        update public.scaffali
        set nome_stato = 'rejected', nome_admin_note = p_payload->>'nota'
        where id = v_scaffale_id and nome_stato = 'pending';
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

-- Verifica: deve restituire true, false.
select pg_get_functiondef(p.oid) like '%@test.local%' as usa_test_local,
       pg_get_functiondef(p.oid) like '%||%@cardsyncpro.local%' as usa_ancora_cardsyncpro
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_process_pending_request';
