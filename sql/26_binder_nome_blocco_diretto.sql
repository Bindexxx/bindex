-- ═══════════════════════════════════════════════════════════════════════
-- 26_binder_nome_blocco_diretto.sql
-- Sessione 2026-08-27 — Consolidamento doppio meccanismo di rinomina binder.
--
-- CONTESTO: rinominaBinderExtraCorrente()/binderExtraRinomina() (rinomina
-- immediata, solo binder tipo 'extra') e proponiNomeBinderAttivo()/
-- binderProponiNome() (con approvazione admin, 21_binder_nome_con_
-- approvazione.sql, già generica per qualunque tipo) convivevano — decisione
-- di Claudio: un solo canale, approvazione admin per tutti i tipi.
--
-- Il fix lato client (ui/binder.ui.js, consegnato insieme a questa
-- migration) nasconde il bottone di rinomina immediata, ma la RLS
-- "utenti gestiscono i propri binder" (ALL, owner_id = auth.uid(),
-- verificata via pg_policies in questa sessione) permette comunque al
-- proprietario di scrivere binders.nome direttamente via Supabase — quindi
-- il solo nascondimento UI non è una vera barriera. Questo file la aggiunge
-- lato DB.
--
-- PATTERN: stesso stile del trigger già esistente su questa tabella,
-- _binders_forza_condivisione() (verificato via pg_get_triggerdef prima di
-- scrivere questo file) — funzione trigger semplice, non SECURITY DEFINER,
-- BEFORE UPDATE.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Nuova funzione trigger ────────────────────────────────────────────
-- Blocca qualunque UPDATE che cambia binders.nome, A MENO CHE non sia in
-- corso una transazione con il flag locale cardsync.admin_context = 'true'
-- — flag che SOLO admin_process_pending_request imposta (vedi punto 2),
-- non raggiungibile da un client Supabase normale (non è una colonna, non
-- è un parametro RPC esposto, è una variabile di transazione lato server).
-- Locale alla transazione (set_config(..., true) più sotto) — non serve
-- resettarla a mano, si azzera da sola a fine transazione.
CREATE OR REPLACE FUNCTION public._binders_blocca_rinomina_diretta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    if new.nome is distinct from old.nome
       and coalesce(current_setting('cardsync.admin_context', true), '') <> 'true' then
        raise exception 'Il nome del binder può cambiare solo tramite approvazione admin (proponi un nuovo nome dal pannello Design)';
    end if;
    return new;
end;
$function$;

CREATE TRIGGER trg_binders_blocca_rinomina_diretta
    BEFORE UPDATE ON public.binders
    FOR EACH ROW
    EXECUTE FUNCTION public._binders_blocca_rinomina_diretta();

-- ── 2. admin_process_pending_request — ripubblicata identica, UNA riga
--      aggiunta (perform set_config...) subito prima dell'UPDATE su
--      binders nel ramo 'binder_nome' approvato. Corpo copiato per intero
--      da pg_get_functiondef verificato in questa sessione — nessun'altra
--      riga toccata, nessun altro ramo (password_reset/username_change/
--      photo_upload/rejected) modificato.
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
    elsif v_req.type = 'binder_nome' then
      -- 21_binder_nome_con_approvazione.sql: copia nome_proposto → nome,
      -- solo se il binder ha ancora davvero un nome_proposto in pending
      -- (potrebbe essere stato ri-proposto o annullato nel frattempo).
      v_binder_id := (v_req.payload->>'binder_id')::uuid;
      if v_binder_id is null then
        raise exception 'Riferimento binder mancante nella richiesta';
      end if;
      -- 26_binder_nome_blocco_diretto.sql: flag locale alla transazione,
      -- letto da trg_binders_blocca_rinomina_diretta — SENZA questa riga
      -- l'UPDATE qui sotto verrebbe bloccato dal trigger appena creato,
      -- esattamente come un update diretto dal client.
      perform set_config('cardsync.admin_context', 'true', true);
      update public.binders
      set nome = nome_proposto, nome_stato = 'approved', nome_admin_note = null
      where id = v_binder_id and nome_stato = 'pending';
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
      -- 21_binder_nome_con_approvazione.sql: il nome VISIBILE (colonna
      -- nome) non è mai stato toccato dalla proposta, quindi un rifiuto
      -- non deve ripristinare nulla — solo segnare lo stato. Nessun
      -- set_config qui: questo ramo non scrive mai 'nome'.
      v_binder_id := (v_req.payload->>'binder_id')::uuid;
      if v_binder_id is not null then
        update public.binders
        set nome_stato = 'rejected', nome_admin_note = p_payload->>'nota'
        where id = v_binder_id and nome_stato = 'pending';
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

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICA POST-DEPLOY (da lanciare a mano dopo aver eseguito questo file):
--
-- 1. Un utente NON admin prova a rinominare direttamente un binder extra
--    (es. dalla console Supabase con la sua sessione, o temporaneamente
--    riattivando rinominaBinderExtraCorrente() lato client per il test):
--    deve fallire con l'errore "Il nome del binder può cambiare solo
--    tramite approvazione admin".
--
-- 2. Flusso normale (proponi → admin approva da admin.html) deve
--    continuare a funzionare esattamente come prima — il nome cambia
--    solo dopo l'approvazione.
--
-- 3. Altri update sulla stessa riga (layout, stato_pubblicazione,
--    condivisibile) devono continuare a funzionare senza toccare 'nome':
--    il trigger controlla SOLO quella colonna, non blocca il resto.
-- ═══════════════════════════════════════════════════════════════════════
