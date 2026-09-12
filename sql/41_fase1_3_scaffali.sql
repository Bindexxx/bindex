-- ============================================================================
-- CardSync Pro — 41: Fase 1.3 — Scaffali (organizzazione prodotti sealed)
--
-- Ispirato a binders/binder_carte/user_media (schema reale letto dal vivo
-- via pg_constraint/information_schema — MAI dedotto da un file, Regola
-- d'Oro #3), ma NON una copia 1:1: differenze concordate con Claudio,
-- documentate qui.
--
-- DIFFERENZA 1 — niente tipo='location' automatico: binders.tipo è
-- vincolato a 3 valori con un binder auto-creato per location. Scaffali
-- SOSTITUISCE location per i sealed (decisione esplicita di Claudio), quindi
-- non ha senso un tipo 'location' — l'utente crea scaffali liberamente,
-- quanti vuole, nome libero. tipo qui ha solo 2 valori: 'libero' (tanti
-- quanti vuole l'utente) e 'vetrina' (esattamente UNO per utente, fisso,
-- mirror del binder 'extra' — richiesto esplicitamente da Claudio).
--
-- DIFFERENZA 2 — scaffale_prodotti nasce GIÀ multi-scaffale: binder_carte ha
-- ancora UNIQUE(owner_id, carta_id) — una carta in un solo binder alla
-- volta, nonostante binder_id esista già (la Fase 2 della roadmap reale
-- vuole cambiarlo, non ancora fatto). scaffale_prodotti è una tabella
-- nuova, senza legacy da migrare: UNIQUE(owner_id, scaffale_id,
-- prodotto_id) da subito — un prodotto sealed in più scaffali (confermato
-- da Claudio), mai duplicato nello stesso scaffale.
--
-- DIFFERENZA 3 — user_media: aggiunta colonna scaffale_id nullable, stesso
-- ruolo di binder_id. binder_id e scaffale_id sono entrambi nullable e MAI
-- valorizzati insieme sulla stessa riga (CHECK sotto) — Postgres tratta i
-- NULL come distinti nelle UNIQUE, quindi la UNIQUE esistente
-- (user_id,binder_id,slot) e quella nuova (user_id,scaffale_id,slot)
-- convivono senza conflitto.
--
-- DIFFERENZA 4 — moderazione nome: stessa identica architettura generica
-- già esistente (pending_requests + admin_process_pending_request), un
-- nuovo ramo 'scaffale_nome' aggiunto ACCANTO a 'binder_nome' (corpo
-- funzione letto per intero via pg_get_functiondef prima di scrivere
-- questo blocco — solo 2 inserimenti, nessun'altra riga toccata, stesso
-- metodo di sql/21).
-- ============================================================================

-- ── scaffali ────────────────────────────────────────────────────────────
create table public.scaffali (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    tipo text not null default 'libero' check (tipo = any (array['libero'::text, 'vetrina'::text])),
    nome text,
    condivisibile boolean not null default false,
    stato_pubblicazione text not null default 'privato'
        check (stato_pubblicazione = any (array['privato'::text, 'in_approvazione'::text, 'pubblico'::text])),
    layout text not null default '3x3',
    nome_proposto text,
    nome_stato text not null default 'approved'
        check (nome_stato = any (array['pending'::text, 'approved'::text, 'rejected'::text])),
    nome_admin_note text,
    created_at timestamptz not null default now()
);

-- Un solo scaffale 'vetrina' per utente (mirror del binder 'extra' unico).
-- Indice parziale invece del pattern UNIQUE(owner_id,tipo,location_valore)
-- dei binders: qui 'libero' non ha alcun limite di quantità, solo 'vetrina'
-- è vincolato a uno solo — un UNIQUE pieno su (owner_id,tipo) bloccherebbe
-- anche i 'libero' a uno per utente, sbagliato.
create unique index scaffali_owner_vetrina_uniq on public.scaffali (owner_id) where (tipo = 'vetrina');

alter table public.scaffali enable row level security;
create policy "utenti gestiscono i propri scaffali" on public.scaffali
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());


-- ── scaffale_prodotti ───────────────────────────────────────────────────
create table public.scaffale_prodotti (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id),
    prodotto_id uuid not null references public.prodotti_sealed(id) on delete cascade,
    scaffale_id uuid not null references public.scaffali(id) on delete cascade,
    ordine integer,
    aggiunta_il timestamptz default now(),
    unique (owner_id, scaffale_id, prodotto_id)
);

alter table public.scaffale_prodotti enable row level security;
create policy "utenti gestiscono il proprio scaffale" on public.scaffale_prodotti
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);


-- ── user_media: nuova colonna scaffale_id ──────────────────────────────
alter table public.user_media add column if not exists scaffale_id uuid references public.scaffali(id) on delete cascade;

alter table public.user_media add constraint user_media_binder_o_scaffale_non_entrambi
    check (binder_id is null or scaffale_id is null);

create unique index user_media_user_scaffale_slot_uniq on public.user_media (user_id, scaffale_id, slot) where (scaffale_id is not null);


-- ── admin_process_pending_request: nuovo ramo 'scaffale_nome' ──────────
-- Corpo verbatim letto via pg_get_functiondef prima di scrivere questo
-- blocco (stesso metodo di sql/21) — SOLO 2 inserimenti, uno nel blocco
-- approvazione (accanto a 'binder_nome') e uno nel blocco rifiuto, nessun
-- altra riga toccata.
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
      v_binder_id := (v_req.payload->>'binder_id')::uuid;
      if v_binder_id is null then
        raise exception 'Riferimento binder mancante nella richiesta';
      end if;
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


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select column_name, data_type from information_schema.columns
-- where table_name = 'scaffali' order by ordinal_position;
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid in ('scaffali'::regclass, 'scaffale_prodotti'::regclass);
--
-- select column_name from information_schema.columns
-- where table_name = 'user_media' and column_name = 'scaffale_id';
--
-- select proname from pg_proc where proname = 'admin_process_pending_request';
-- select pg_get_functiondef(oid) from pg_proc where proname = 'admin_process_pending_request';
-- -- deve contenere 'scaffale_nome' due volte (approvazione + rifiuto)
