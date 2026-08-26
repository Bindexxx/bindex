-- ============================================================================
-- 21_binder_nome_con_approvazione.sql
-- Nome del binder personalizzabile con approvazione admin — stessa identica
-- metodologia di copertina/sleeve (pending_requests + user_media.status),
-- applicata qui a un campo testo invece che a un'immagine. Motivo della
-- moderazione: testo libero inserito dall'utente, stesso rischio di
-- contenuto inappropriato di un username (vedi ramo username_change già
-- esistente in admin_process_pending_request).
--
-- NON sostituisce la rinomina immediata del binder 'extra' già esistente
-- (rinominaBinderExtraCorrente/binderExtraRinomina, senza moderazione) —
-- Claudio non ha chiesto di rimuoverla, resta com'è. Le due convivono sullo
-- stesso binder 'extra': un utente smaliziato potrebbe chiedersi perché ci
-- sono due modi diversi di rinominare — segnalato in chat, non deciso qui.
-- ============================================================================

-- ── Colonne nuove su binders ──────────────────────────────────────────
alter table public.binders
    add column if not exists nome_proposto text,
    add column if not exists nome_stato text not null default 'approved'
        check (nome_stato in ('pending', 'approved', 'rejected')),
    add column if not exists nome_admin_note text;

comment on column public.binders.nome_proposto is
    'Nome in attesa di approvazione admin — il nome visibile (colonna nome) NON cambia finché non è approvato.';
comment on column public.binders.nome_stato is
    'Stato del nome_proposto più recente. Le righe esistenti partono da approved: il nome attuale è già valido, non serve rivalidarlo.';

-- ── Estensione RPC admin_process_pending_request ─────────────────────
-- Corpo verbatim letto via pg_get_functiondef, SOLO 2 inserimenti:
-- un nuovo ramo "elsif v_req.type = 'binder_nome'" nel blocco approvazione
-- (accanto a password_reset/username_change/photo_upload) e uno nel blocco
-- rifiuto (accanto a photo_upload). Nessun'altra riga toccata.
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
      -- non deve ripristinare nulla — solo segnare lo stato.
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
$function$
;
