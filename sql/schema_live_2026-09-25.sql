-- ============================================================================
-- CARDSYNC PRO — SNAPSHOT SCHEMA DEL DATABASE LIVE (2026-09-25, sera)
-- Generato da sql/esporta_schema_live.sql eseguita sul progetto Supabase
-- xpfibrzsffurdlypxnrw DOPO l'applicazione delle migrazioni 76 e 77
-- (sicurezza). È la FONTE DI VERITÀ documentale dello schema: i file
-- numerati di questa cartella (05…77) sono lo STORICO delle migrazioni,
-- incompleto e in parte superato — consultarli solo per capire il perché
-- di una scelta, mai per sapere com'è fatto il DB oggi.
-- Contenuto: 51 tabella, 95 funzione, 1 vista, 174 vincolo, 30 indice, 51 rls, 99 policy, 11 trigger, 9 bucket, 21 policy storage, 95 permessi funzione
-- NON contiene dati. NON va eseguito sul DB esistente (è documentazione,
-- tutto esiste già); servirebbe solo a ricreare lo schema su un progetto
-- vuoto, e in quel caso va rivisto a mano (ruoli, estensioni, auth).
-- Per aggiornarlo: rieseguire sql/esporta_schema_live.sql e rigenerare.
-- ============================================================================


-- ============================================================================
-- TABELLE
-- ============================================================================

create table public.achievement_catalogo (
  id text not null,
  titolo text not null,
  rarita text not null,
  nome_file text,
  attiva boolean not null default true
);

create table public.achievement_sbloccati (
  owner_id uuid not null,
  achievement_id text not null,
  sbloccato_il timestamp with time zone not null default now()
);

create table public.activity_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  source text not null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default now()
);

create table public.activity_log_accessi_duplicati_bak (
  id uuid,
  user_id uuid,
  source text,
  action text,
  details jsonb,
  created_at timestamp with time zone
);

create table public.admin_audit_log (
  id uuid not null default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone default now()
);

create table public.binder_carte (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  carta_id uuid not null,
  ordine integer,
  aggiunta_il timestamp with time zone default now(),
  binder_id uuid not null,
  quantita_offerta integer not null default 0
);

create table public.binders (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  tipo text not null,
  location_valore text,
  nome text,
  condivisibile boolean not null default false,
  stato_pubblicazione text not null default 'privato'::text,
  created_at timestamp with time zone not null default now(),
  nome_proposto text,
  nome_stato text not null default 'approved'::text,
  nome_admin_note text,
  layout text not null default '3x3'::text,
  nome_in_attesa text default 
CASE
    WHEN ((nome_stato = 'pending'::text) AND (nome_proposto IS NOT NULL) AND (btrim(nome_proposto) <> ''::text) AND (nome_proposto IS DISTINCT FROM nome)) THEN nome_proposto
    ELSE NULL::text
END
);

create table public.blocchi_chat (
  blocca_id uuid not null,
  bloccato_id uuid not null,
  creato_il timestamp with time zone not null default now()
);

create table public.bustina_carte_possedute (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  carta_id text not null,
  quantita integer not null default 1,
  ottenuto_il timestamp with time zone not null default now()
);

create table public.bustina_catalogo (
  carta_id text not null,
  rarita text not null,
  nome_file text not null,
  nome text not null,
  attiva boolean not null default true
);

create table public.bustina_polvere_doppione (
  rarita text not null,
  polvere integer not null
);

create table public.bustina_probabilita (
  slot smallint not null,
  rarita text not null,
  peso integer not null
);

create table public.carte (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  tipo text default 'carta'::text,
  nome text,
  codice text,
  location text,
  qty integer default 1,
  lingua text default 'IT'::text,
  condizione text default 'NM'::text,
  reverse_holo boolean default false,
  first_ed boolean default false,
  url text,
  prezzo numeric,
  prezzo_obiettivo numeric,
  note text,
  stato text not null default 'collezione'::text,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  ultimo_controllo timestamp with time zone,
  prezzo_precedente numeric,
  immagine text,
  dispositivo text,
  sigillata_originale boolean not null default false,
  variante text
);

create table public.catalogo_ricompense (
  voce_id text not null,
  categoria text not null,
  tipo_ricompensa text not null,
  quantita integer,
  riferimento text
);

create table public.chat_restrizioni_utente (
  owner_id uuid not null,
  minorenne boolean not null default false,
  impostato_da uuid,
  impostato_il timestamp with time zone not null default now()
);

create table public.coda_lavoro (
  id bigint not null,
  tipo text not null,
  stato text not null default 'pending'::text,
  creato_da uuid not null,
  creato_il timestamp with time zone not null default now(),
  claimed_by uuid,
  claimed_at timestamp with time zone,
  dispositivo text,
  payload jsonb not null default '{}'::jsonb,
  esito jsonb,
  errore_msg text,
  completato_il timestamp with time zone,
  tentativi_falliti integer not null default 0
);

create table public.coda_wishlist (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  nome text not null,
  lingua text default 'IT'::text,
  condizione text default 'NM'::text,
  qty integer default 1,
  reverse boolean default false,
  first_ed boolean default false,
  nota text,
  prezzo_obiettivo numeric,
  stato text not null default 'pending'::text,
  creato_il timestamp with time zone default now(),
  claimed_by uuid,
  claimed_at timestamp with time zone,
  completato_il timestamp with time zone,
  errore_msg text,
  location text default 'WISHLIST'::text,
  tipo text,
  dispositivo text
);

create table public.configurazione_app (
  chiave text not null,
  valore text not null,
  aggiornato_il timestamp with time zone not null default now()
);

create table public.conversazioni (
  id uuid not null default gen_random_uuid(),
  owner_a uuid not null,
  owner_b uuid not null,
  creato_il timestamp with time zone not null default now()
);

create table public.correzioni_manuali_carte (
  id uuid not null default gen_random_uuid(),
  coda_carte_id_originale bigint,
  owner_id uuid not null,
  nome text,
  lingua text,
  condizione text,
  qty integer,
  reverse boolean default false,
  first_ed boolean default false,
  nota text,
  location text,
  tipo text,
  destinazione text default 'collezione'::text,
  prezzo_obiettivo numeric,
  url_diretto text,
  opzioni_disambiguazione jsonb,
  errore_msg text,
  tentativi_falliti integer default 0,
  creato_il timestamp with time zone not null default now()
);

create table public.foto_carte (
  id uuid not null default gen_random_uuid(),
  carta_id uuid not null,
  tabella text not null default 'carte'::text,
  owner_id uuid not null,
  storage_path text not null,
  nota text,
  creato_il timestamp with time zone default now()
);

create table public.inventario_ricompense (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  tipo text not null,
  riferimento_id text not null,
  quantita integer not null default 1,
  ottenuto_il timestamp with time zone not null default now()
);

create table public.location (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  nome text not null,
  tipo text not null default 'carta'::text
);

create table public.messaggi (
  id uuid not null default gen_random_uuid(),
  conversazione_id uuid not null,
  mittente_id uuid not null,
  testo text not null,
  creato_il timestamp with time zone not null default now(),
  letto_il timestamp with time zone
);

create table public.missioni_completate (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  missione_id text not null,
  finestra text not null,
  periodo text not null,
  origine text not null default 'normale'::text,
  completato_il timestamp with time zone not null default now()
);

create table public.movimenti_collezione (
  id bigint not null default nextval('movimenti_collezione_id_seq'::regclass),
  owner_id uuid not null,
  avvenuto_il timestamp with time zone not null default now(),
  tipo_evento text not null,
  oggetto_tipo text not null,
  oggetto_id uuid,
  nome_snapshot text not null,
  quantita_delta integer,
  prezzo_unitario numeric(10,2),
  valore_delta numeric(10,2),
  fonte text not null default 'sito'::text,
  note text
);

create table public.ordini (
  id uuid not null default gen_random_uuid(),
  tipo text not null,
  parametri jsonb default '{}'::jsonb,
  stato text not null default 'pending'::text,
  creato_da uuid,
  creato_il timestamp with time zone default now(),
  preso_in_carico_da uuid,
  preso_in_carico_il timestamp with time zone,
  completato_il timestamp with time zone,
  risultato jsonb,
  errore_msg text
);

create table public.pending_requests (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  type text not null,
  payload jsonb,
  status text not null default 'pending'::text,
  admin_note text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid
);

create table public.preferenze_utente (
  owner_id uuid not null,
  email_notifiche text,
  notifica_changelog boolean default false,
  notifica_prezzi boolean default false,
  soglia_prezzi numeric default 5,
  notifica_wishlist boolean default false,
  tab_predefinita text default 'visualizzazione'::text,
  aggiornato_il timestamp with time zone default now(),
  nascondi_scambio_da_match boolean default false,
  nascondi_wishlist_da_match boolean default false,
  binder_modalita_visualizzazione text default 'immagini'::text,
  match_nascosti text,
  dafare_risolti text,
  achievement_vetrina text,
  nickname text
);

create table public.prodotti_sealed (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  nome text,
  codice text,
  set_espansione text,
  qty integer default 1,
  lingua text default 'IT'::text,
  integrita_packaging text default 'sigillato_integro'::text,
  prezzo numeric,
  prezzo_cardmarket numeric,
  prezzo_acquisto numeric,
  prezzo_precedente numeric,
  data_acquisizione date,
  stato text not null default 'collezione'::text,
  note text,
  immagine text,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  ultimo_controllo timestamp with time zone,
  dispositivo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  url text
);

create table public.profiles (
  id uuid not null,
  username text,
  role text not null default 'user'::text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  banned_until timestamp with time zone,
  ban_reason text,
  nome_reale text,
  cognome_reale text,
  telefono text,
  email_contatto text,
  bustine_aperte integer not null default 0,
  mesi_completati integer not null default 0,
  bustina_giornaliera_ultimo_giorno date,
  colore_principale text,
  colore_secondario text
);

create table public.richieste_scambio (
  id uuid not null default gen_random_uuid(),
  richiedente_id uuid not null,
  proprietario_id uuid not null,
  stato text not null default 'aperta'::text,
  creato_il timestamp with time zone not null default now()
);

create table public.richieste_scambio_righe (
  id uuid not null default gen_random_uuid(),
  richiesta_id uuid not null,
  richiedente_id uuid not null,
  proprietario_id uuid not null,
  carta_id uuid,
  prodotto_sealed_id uuid,
  quantita_richiesta integer not null default 1,
  stato_riga text not null default 'in_attesa'::text,
  prezzo_congelato numeric,
  snapshot jsonb,
  location_scelta text,
  motivo_chiusura text,
  creato_il timestamp with time zone not null default now(),
  aggiornato_il timestamp with time zone not null default now()
);

create table public.scaffale_prodotti (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  prodotto_id uuid not null,
  scaffale_id uuid not null,
  ordine integer,
  aggiunta_il timestamp with time zone default now(),
  quantita_offerta integer not null default 0
);

create table public.scaffali (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  tipo text not null default 'libero'::text,
  nome text,
  condivisibile boolean not null default false,
  stato_pubblicazione text not null default 'privato'::text,
  layout text not null default '3x3'::text,
  nome_proposto text,
  nome_stato text not null default 'approved'::text,
  nome_admin_note text,
  created_at timestamp with time zone not null default now()
);

create table public.segnalazioni_bug (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  descrizione text not null,
  log_diagnostico text,
  pagina text,
  browser text,
  schermo text,
  creato_il timestamp with time zone not null default now()
);

create table public.segnalazioni_chat (
  id uuid not null default gen_random_uuid(),
  conversazione_id uuid not null,
  segnalato_da uuid not null,
  motivo text,
  creato_il timestamp with time zone not null default now()
);

create table public.set_carte (
  sigla text not null,
  numero integer not null,
  variante text not null default 'normale'::text,
  nome text,
  rarita text,
  immagine text,
  aggiornato_il timestamp with time zone not null default now(),
  cardmarket_id bigint
);

create table public.set_carte_ignorate (
  owner_id uuid not null default auth.uid(),
  sigla text not null,
  numero integer not null,
  variante text not null default 'normale'::text,
  creato_il timestamp with time zone not null default now()
);

create table public.set_espansioni (
  sigla text not null,
  tcgdex_id text,
  nome text not null,
  carte_base integer,
  carte_totali integer not null,
  data_uscita date,
  aggiornato_il timestamp with time zone not null default now()
);

create table public.set_nascosti (
  owner_id uuid not null default auth.uid(),
  sigla text not null,
  creato_il timestamp with time zone not null default now()
);

create table public.set_soglie_notificate (
  owner_id uuid not null default auth.uid(),
  sigla text not null,
  soglia smallint not null,
  raggiunta_il timestamp with time zone not null default now(),
  vista_il timestamp with time zone
);

create table public.storico_prezzi (
  id uuid not null default gen_random_uuid(),
  carta_id uuid not null,
  owner_id uuid not null,
  tabella text not null default 'carte'::text,
  prezzo numeric not null,
  registrato_il timestamp with time zone default now()
);

create table public.storico_valore_collezione (
  id bigint not null default nextval('storico_valore_collezione_id_seq'::regclass),
  owner_id uuid not null,
  giorno date not null,
  valore_totale numeric(12,2) not null default 0,
  pezzi_totali integer not null default 0,
  carte_aggiunte integer not null default 0,
  valore_aggiunte numeric(12,2) not null default 0,
  registrato_il timestamp with time zone not null default now()
);

create table public.traguardi_riscossi (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  traguardo_id text not null,
  riscosso_il timestamp with time zone not null default now()
);

create table public.ultima_visita (
  owner_id uuid not null default auth.uid(),
  ultima_apertura timestamp with time zone not null default now(),
  baseline timestamp with time zone,
  aggiornata_il timestamp with time zone not null default now()
);

create table public.user_media (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  slot text not null,
  storage_path text not null,
  status text not null default 'pending'::text,
  admin_note text,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  metadata jsonb,
  source text not null default 'upload'::text,
  binder_id uuid,
  scaffale_id uuid
);

create table public.wishlist (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  nome text,
  codice text,
  qty integer default 1,
  lingua text default 'IT'::text,
  condizione text default 'NM'::text,
  url text,
  prezzo numeric,
  prezzo_precedente numeric,
  prezzo_obiettivo numeric,
  note text,
  created_at timestamp with time zone default now(),
  ultimo_controllo timestamp with time zone,
  location text default 'WISHLIST'::text,
  tipo text,
  immagine text
);

create table public.wishlist_sealed (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  nome text,
  codice text,
  set_espansione text,
  qty integer default 1,
  lingua text default 'IT'::text,
  integrita_minima text default 'sigillato_integro'::text,
  prezzo_obiettivo numeric,
  note text,
  immagine text,
  created_at timestamp with time zone default now()
);

create table public.work_in_progress (
  id uuid not null default gen_random_uuid(),
  target_tipo text not null,
  target_id text not null,
  messaggio text not null,
  attivo boolean not null default true,
  attivato_da uuid,
  attivato_il timestamp with time zone not null default now()
);

create table public.worker_presenza (
  user_id uuid not null,
  nome_worker text,
  ultimo_ping timestamp with time zone default now()
);


-- ============================================================================
-- FUNZIONI
-- ============================================================================

-- ── _binders_blocca_rinomina_diretta ──
CREATE OR REPLACE FUNCTION public._binders_blocca_rinomina_diretta()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    if new.nome is distinct from old.nome
       and coalesce(current_setting('cardsync.admin_context', true), '') <> 'true' then
        raise exception 'Il nome del binder può cambiare solo tramite approvazione admin (proponi un nuovo nome dal pannello Design)';
    end if;
    return new;
end;
$function$
;

-- ── _binders_forza_condivisione ──
CREATE OR REPLACE FUNCTION public._binders_forza_condivisione()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    if new.tipo = 'wishlist'
       or new.tipo = 'scambio'
       or (new.tipo = 'location' and new.location_valore = 'SCAMBIO') then
        -- Wishlist e Scambio: sempre pubblici, l'utente non può renderli
        -- privati — qualunque valore arrivi dal client viene sovrascritto.
        -- Il ramo location='SCAMBIO' resta per compatibilità storica (non
        -- dovrebbe più esistere nessuna riga così dopo il blocco 5 sotto,
        -- ma non c'è motivo di romperlo se qualcosa sfuggisse).
        new.condivisibile := true;
        new.stato_pubblicazione := 'pubblico';
    end if;
    return new;
end;
$function$
;

-- ── _cardsync_registra_storico_prezzo ──
CREATE OR REPLACE FUNCTION public._cardsync_registra_storico_prezzo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.prezzo is not null and (TG_OP = 'INSERT' or new.prezzo is distinct from old.prezzo) then
    insert into storico_prezzi (carta_id, owner_id, tabella, prezzo)
    values (new.id, new.owner_id, TG_TABLE_NAME, new.prezzo);
  end if;
  return new;
end;
$function$
;

-- ── _cardsync_traccia_prezzo_precedente ──
CREATE OR REPLACE FUNCTION public._cardsync_traccia_prezzo_precedente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.prezzo is distinct from old.prezzo then
    new.prezzo_precedente := old.prezzo;
  end if;
  return new;
end;
$function$
;

-- ── _chat_ha_link_esterno ──
CREATE OR REPLACE FUNCTION public._chat_ha_link_esterno(p_testo text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select (p_testo ~* '(https?://|www\.)\S+')
       and (p_testo !~* 'bindexxx\.github\.io');
$function$
;

-- ── _chat_ha_parolacce ──
CREATE OR REPLACE FUNCTION public._chat_ha_parolacce(p_testo text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select p_testo ~* '\y(cazzo|cazzata|cazzone|stronzo|stronza|puttana|troia|merda|merdoso|vaffanculo|bastardo|bastarda|coglione|cogliona|porco dio|porca madonna|zoccola|figlio di puttana)\y';
$function$
;

-- ── _chat_restrizioni_traccia_modifica ──
CREATE OR REPLACE FUNCTION public._chat_restrizioni_traccia_modifica()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    new.impostato_da := auth.uid();
    new.impostato_il := now();
    return new;
end;
$function$
;

-- ── _chat_utente_vietato ──
CREATE OR REPLACE FUNCTION public._chat_utente_vietato(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select coalesce((select minorenne from chat_restrizioni_utente where owner_id = p_uid), false);
$function$
;

-- ── _coda_carte_view_delete ──
CREATE OR REPLACE FUNCTION public._coda_carte_view_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_proprietario uuid;
begin
  select creato_da into v_proprietario from coda_lavoro where id = old.id;
  if v_proprietario is distinct from auth.uid() and not is_admin() then
    raise exception 'puoi cancellare solo le tue righe di coda';
  end if;
  delete from coda_lavoro where id = old.id;
  return old;
end;
$function$
;

-- ── _coda_carte_view_insert ──
CREATE OR REPLACE FUNCTION public._coda_carte_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── _coda_carte_view_update ──
CREATE OR REPLACE FUNCTION public._coda_carte_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── _rank_condizione ──
CREATE OR REPLACE FUNCTION public._rank_condizione(p_condizione text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select case p_condizione
        when 'MT' then 7 when 'NM' then 6 when 'EX' then 5 when 'GD' then 4
        when 'LP' then 3 when 'PL' then 2 when 'PO' then 1
        else 0
    end;
$function$
;

-- ── _rank_integrita ──
CREATE OR REPLACE FUNCTION public._rank_integrita(p_integrita text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select case p_integrita
        when 'sigillato_integro' then 4 when 'sigillo_danneggiato' then 3
        when 'confezione_danneggiata' then 2 when 'aperto_non_sealed' then 1
        else 0
    end;
$function$
;

-- ── accetta_riga_richiesta ──
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

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_accettata', jsonb_build_object('riga_id', p_riga_id));
end;
$function$
;

-- ── admin_ban_user ──
CREATE OR REPLACE FUNCTION public.admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set banned_until = p_until, ban_reason = p_reason where id = p_target;
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('ban', p_target, jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$function$
;

-- ── admin_hard_delete_user ──
CREATE OR REPLACE FUNCTION public.admin_hard_delete_user(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── admin_process_pending_request ──
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
$function$
;

-- ── admin_reset_password ──
CREATE OR REPLACE FUNCTION public.admin_reset_password(p_target uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── admin_restore_user ──
CREATE OR REPLACE FUNCTION public.admin_restore_user(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set deleted_at = null where id = p_target;
  perform public.log_admin_action('restore', p_target, null);
end;
$function$
;

-- ── admin_revoke_sessions ──
CREATE OR REPLACE FUNCTION public.admin_revoke_sessions(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('revoke_sessions', p_target, null);
end;
$function$
;

-- ── admin_soft_delete_user ──
CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set deleted_at = now() where id = p_target;
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.log_admin_action('soft_delete', p_target, null);
end;
$function$
;

-- ── admin_unban_user ──
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles set banned_until = null, ban_reason = null where id = p_target;
  perform public.log_admin_action('unban', p_target, null);
end;
$function$
;

-- ── aggiorna_nota_controllo_gruppo ──
CREATE OR REPLACE FUNCTION public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set note = p_nota
  where id = p_id
    and stato = 'collezione';
$function$
;

-- ── aggiorna_prezzo_controllo_gruppo ──
CREATE OR REPLACE FUNCTION public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_nome text;
  v_prezzo_vecchio numeric;
  v_qty integer;
begin
  select owner_id, nome, prezzo, qty into v_owner_id, v_nome, v_prezzo_vecchio, v_qty
  from carte where id = p_id and stato = 'collezione';

  if v_owner_id is null then
    return; -- carta non trovata/non in collezione: l'update sotto non toccherebbe nulla comunque
  end if;

  update carte
  set prezzo = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';

  if v_prezzo_vecchio is distinct from p_prezzo then
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
    values
        (v_owner_id, 'prezzo_automatico', 'carta', p_id, v_nome, null, p_prezzo,
         (p_prezzo - coalesce(v_prezzo_vecchio, p_prezzo)) * coalesce(v_qty, 1), 'estensione');
  end if;
end;
$function$
;

-- ── aggiorna_prezzo_controllo_gruppo_sealed ──
CREATE OR REPLACE FUNCTION public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_nome text;
  v_prezzo_cardmarket_vecchio numeric;
begin
  select owner_id, nome, prezzo_cardmarket into v_owner_id, v_nome, v_prezzo_cardmarket_vecchio
  from prodotti_sealed where id = p_id and stato = 'collezione';

  if v_owner_id is null then
    return;
  end if;

  update prodotti_sealed
  set prezzo_cardmarket = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';

  if v_prezzo_cardmarket_vecchio is distinct from p_prezzo then
    -- valore_delta SEMPRE null qui — vedi header del file: prezzo_cardmarket
    -- non è il campo che conta per il valore dichiarato della collezione.
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
    values
        (v_owner_id, 'prezzo_automatico', 'sealed', p_id, v_nome, null, p_prezzo, null, 'estensione');
  end if;
end;
$function$
;

-- ── aggiorna_updated_at ──
CREATE OR REPLACE FUNCTION public.aggiorna_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- ── aggiorna_url_controllo_gruppo ──
CREATE OR REPLACE FUNCTION public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$function$
;

-- ── aggiorna_url_controllo_gruppo_sealed ──
CREATE OR REPLACE FUNCTION public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$function$
;

-- ── annulla_riga_richiesta ──
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
    if auth.uid() <> v_riga.richiedente_id and auth.uid() <> v_riga.proprietario_id then
        raise exception 'Non autorizzato';
    end if;
    if v_riga.stato_riga not in ('in_attesa', 'accettata') then
        raise exception 'Questa riga non può più essere annullata';
    end if;

    update richieste_scambio_righe
    set stato_riga = 'annullata', motivo_chiusura = p_motivo, aggiornato_il = now()
    where id = p_riga_id;

    v_altra_parte := case when auth.uid() = v_riga.richiedente_id then v_riga.proprietario_id else v_riga.richiedente_id end;
    insert into activity_log (user_id, source, action, details)
    values (v_altra_parte, 'sito', 'riga_scambio_annullata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo, 'da', auth.uid()));
end;
$function$
;

-- ── apri_bustina ──
CREATE OR REPLACE FUNCTION public.apri_bustina(p_rarita_forzata text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid          uuid := auth.uid();
    v_oggi         date := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_ultimo       date;
    v_aperte       integer;
    v_mesi         integer;
    v_fonte        text;
    v_guadagnate   integer;
    v_slot         smallint;
    v_tot_peso     integer;
    v_roll         integer;
    v_rarita       text;
    v_carta        record;
    v_esistente    integer;
    v_doppione     boolean;
    v_polvere      integer;
    v_polvere_tot  integer := 0;
    v_carte        jsonb   := '[]'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Utente non autenticato';
    END IF;

    -- ── NUOVO: controllo forzatura rarita', solo admin ──────────────────
    IF p_rarita_forzata IS NOT NULL AND NOT is_admin() THEN
        RAISE EXCEPTION 'Invece di barare, vieni a lavorare per noi: sei evidentemente troppo bravo per perdere tempo con la console. — Giovanni';
    END IF;

    -- FOR UPDATE: blocca la riga del profilo per tutta la transazione. Senza,
    -- due clic ravvicinati (o due schede aperte) potrebbero leggere entrambi
    -- "giornaliera disponibile" e consumarla due volte.
    SELECT bustina_giornaliera_ultimo_giorno, bustine_aperte, mesi_completati
      INTO v_ultimo, v_aperte, v_mesi
    FROM profiles WHERE id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profilo non trovato per l''utente %', v_uid;
    END IF;

    -- ── Quale bustina consumo ───────────────────────────────────────────
    IF v_ultimo IS NULL OR v_ultimo < v_oggi THEN
        v_fonte := 'giornaliera';

        UPDATE profiles
           SET bustina_giornaliera_ultimo_giorno = v_oggi
         WHERE id = v_uid;

        -- Storico: UNA riga con quantita=0. Traccia l'apertura con data e ora
        -- senza toccare il saldo, che somma le quantita'.
        INSERT INTO inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        VALUES (v_uid, 'bustina', 'giornaliera', 0);
    ELSE
        v_fonte := 'guadagnata';

        SELECT COALESCE(SUM(quantita), 0) INTO v_guadagnate
        FROM inventario_ricompense
        WHERE owner_id = v_uid AND tipo = 'bustina';

        IF v_guadagnate < 1 THEN
            RAISE EXCEPTION 'Nessuna bustina disponibile';
        END IF;

        INSERT INTO inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        VALUES (v_uid, 'bustina', 'guadagnata', -1);
    END IF;

    -- ── Contatore cutscene: 1..30, poi riparte e conta un mese ──────────
    -- Incrementato PRIMA di scegliere la cutscene: la primissima apertura
    -- in assoluto vale 1 e mostra giorno1.
    v_aperte := v_aperte + 1;
    IF v_aperte > 30 THEN
        v_aperte := 1;
        v_mesi   := v_mesi + 1;
    END IF;
    UPDATE profiles SET bustine_aperte = v_aperte, mesi_completati = v_mesi
     WHERE id = v_uid;

    -- ── Sorteggio dei 4 slot ────────────────────────────────────────────
    FOR v_slot IN 1..4 LOOP

        -- ── NUOVO: slot 4 forzato, solo se ammesso dal controllo sopra ──
        -- Slot 1-3 NON sono mai forzabili di proposito: il bottone serve a
        -- vedere la carta voluta, non a fabbricare bustine finte ovunque.
        IF v_slot = 4 AND p_rarita_forzata IS NOT NULL THEN
            v_rarita := p_rarita_forzata;

            IF NOT EXISTS (
                SELECT 1 FROM bustina_probabilita
                WHERE slot = v_slot AND rarita = v_rarita
            ) THEN
                RAISE EXCEPTION 'Rarita'' "%" non valida per lo slot %', v_rarita, v_slot;
            END IF;
        ELSE
            -- Rarita': estrazione pesata sul totale dei pesi dello slot. I pesi
            -- non devono sommare a 100 — vedi commento su bustina_probabilita.
            SELECT COALESCE(SUM(peso), 0) INTO v_tot_peso
            FROM bustina_probabilita WHERE slot = v_slot;

            IF v_tot_peso <= 0 THEN
                RAISE EXCEPTION 'Slot % senza probabilita'' configurate', v_slot;
            END IF;

            v_roll := floor(random() * v_tot_peso)::integer + 1;   -- 1..v_tot_peso

            SELECT t.rarita INTO v_rarita FROM (
                SELECT rarita,
                       SUM(peso) OVER (ORDER BY rarita ROWS UNBOUNDED PRECEDING) AS cum
                FROM bustina_probabilita WHERE slot = v_slot
            ) t
            WHERE t.cum >= v_roll
            ORDER BY t.cum
            LIMIT 1;
        END IF;

        -- Carta: una a caso fra le attive di quella rarita'.
        -- NESSUN ripiego su altre rarita' (decisione: "non sara' mai vuota").
        -- Se capita e' un errore di configurazione e deve farsi sentire
        -- subito, non travestirsi da bustina sfortunata. L'eccezione annulla
        -- l'intera transazione: la bustina NON risulta consumata.
        SELECT carta_id, rarita, nome, nome_file INTO v_carta
        FROM bustina_catalogo
        WHERE rarita = v_rarita AND attiva
        ORDER BY random()
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nessuna carta attiva per la rarita'' "%" (slot %). Apertura annullata.', v_rarita, v_slot;
        END IF;

        -- Nuova o doppione? Una carta gia' uscita in QUESTA stessa bustina
        -- risulta correttamente doppione: la riga e' stata appena inserita
        -- dal giro precedente del ciclo.
        UPDATE bustina_carte_possedute
           SET quantita = quantita + 1
         WHERE owner_id = v_uid AND carta_id = v_carta.carta_id;

        GET DIAGNOSTICS v_esistente = ROW_COUNT;
        v_doppione := (v_esistente > 0);

        IF v_doppione THEN
            SELECT polvere INTO v_polvere
            FROM bustina_polvere_doppione WHERE rarita = v_carta.rarita;
            v_polvere     := COALESCE(v_polvere, 0);
            v_polvere_tot := v_polvere_tot + v_polvere;
        ELSE
            v_polvere := 0;
            INSERT INTO bustina_carte_possedute (owner_id, carta_id, quantita)
            VALUES (v_uid, v_carta.carta_id, 1);
        END IF;

        v_carte := v_carte || jsonb_build_object(
            'slot',      v_slot,
            'carta_id',  v_carta.carta_id,
            'rarita',    v_carta.rarita,
            'nome',      v_carta.nome,
            'nome_file', v_carta.nome_file,
            'doppione',  v_doppione,
            'polvere',   v_polvere
        );
    END LOOP;

    -- ── Polvere: UNA riga aggregata per bustina ─────────────────────────
    IF v_polvere_tot > 0 THEN
        INSERT INTO inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        VALUES (v_uid, 'polvere', 'doppione', v_polvere_tot);
    END IF;

    RETURN jsonb_build_object(
        'fonte',           v_fonte,        -- 'giornaliera' | 'guadagnata'
        'carte',           v_carte,        -- 4 oggetti, in ordine di slot
        'polvere_totale',  v_polvere_tot,
        'cutscene_giorno', v_aperte,       -- 1..30, per cutscenes/giorno{N}.json
        'mesi_completati', v_mesi
    );
END;
$function$
;

-- ── blocca_utente ──
CREATE OR REPLACE FUNCTION public.blocca_utente(p_bloccato_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if auth.uid() is null then raise exception 'Non autenticato'; end if;
    if auth.uid() = p_bloccato_id then raise exception 'Non puoi bloccare te stesso'; end if;
    insert into blocchi_chat (blocca_id, bloccato_id) values (auth.uid(), p_bloccato_id)
    on conflict do nothing;
end;
$function$
;

-- ── bustine_stato ──
CREATE OR REPLACE FUNCTION public.bustine_stato()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid           uuid := auth.uid();
    v_oggi          date := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_ultimo        date;
    v_disponibile   boolean;
    v_guadagnate    integer;
    v_ap_giorn      integer;
    v_ap_guad       integer;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Utente non autenticato';
    END IF;

    SELECT bustina_giornaliera_ultimo_giorno INTO v_ultimo
    FROM profiles WHERE id = v_uid;

    v_disponibile := (v_ultimo IS NULL OR v_ultimo < v_oggi);

    -- Saldo delle 'guadagnata': le coppie +1/-1 della giornaliera si
    -- annullano da sole, quindi questa somma resta il saldo corretto senza
    -- bisogno di escluderle.
    SELECT COALESCE(SUM(quantita), 0) INTO v_guadagnate
    FROM inventario_ricompense
    WHERE owner_id = v_uid AND tipo = 'bustina';

    -- Giornaliere: una riga con quantita=0 per apertura. Si CONTANO le righe,
    -- non si sommano: la somma darebbe sempre zero, che e' precisamente il
    -- motivo per cui queste righe non sporcano il saldo.
    SELECT COUNT(*) INTO v_ap_giorn
    FROM inventario_ricompense
    WHERE owner_id = v_uid AND tipo = 'bustina'
      AND quantita = 0 AND riferimento_id = 'giornaliera';

    -- Guadagnate: righe negative, qui la somma serve davvero. -SUM e non
    -- COUNT(*): regge anche se un domani una riga di consumo valesse piu' di 1.
    SELECT COALESCE(-SUM(quantita), 0) INTO v_ap_guad
    FROM inventario_ricompense
    WHERE owner_id = v_uid AND tipo = 'bustina'
      AND quantita < 0 AND riferimento_id = 'guadagnata';

    RETURN jsonb_build_object(
        'giornaliera_disponibile', v_disponibile,
        'saldo_guadagnate',        v_guadagnate,
        'saldo_totale',            v_guadagnate + (CASE WHEN v_disponibile THEN 1 ELSE 0 END),
        'aperte_giornaliere',      v_ap_giorn,
        'aperte_guadagnate',       v_ap_guad,
        'aperte_totali',           v_ap_giorn + v_ap_guad
    );
END;
$function$
;

-- ── completa_lavoro ──
CREATE OR REPLACE FUNCTION public.completa_lavoro(p_id bigint, p_esito jsonb DEFAULT NULL::jsonb, p_errore_msg text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update coda_lavoro
  set stato = case when p_errore_msg is null then 'completato' else 'errore' end,
      esito = p_esito, errore_msg = p_errore_msg,
      completato_il = now()
  where id = p_id;
$function$
;

-- ── completa_riga_coda_carte ──
CREATE OR REPLACE FUNCTION public.completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_destinazione text DEFAULT 'collezione'::text, p_prezzo_obiettivo numeric DEFAULT NULL::numeric)
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
$function$
;

-- ── concludi_riga_richiesta ──
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

        insert into carte (owner_id, tipo, nome, codice, location, qty, lingua, condizione, reverse_holo, first_ed, url, prezzo, note, immagine, sigillata_originale, variante, stato)  -- VARIANTE: colonna aggiunta
        values (
            v_riga.richiedente_id, 'carta', v_snap->>'nome', v_snap->>'codice', coalesce(nullif(p_location_scelta, ''), '?'),
            v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'condizione',
            coalesce((v_snap->>'reverse_holo')::boolean, false), coalesce((v_snap->>'first_ed')::boolean, false),
            v_snap->>'url', v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine',
            coalesce((v_snap->>'sigillata_originale')::boolean, false), v_snap->>'variante', 'collezione'  -- VARIANTE: valore aggiunto (NULL se lo snapshot è vecchio)
        )
        returning id into v_nuovo_id;

        -- Fase 8, Step 2 (2026-09-13): log su entrambi i lati.
        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'carta', v_carta.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
                (v_riga.richiedente_id, 'vendita_scambio', 'carta', v_nuovo_id, v_snap->>'nome',
                 v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
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

        insert into prodotti_sealed (owner_id, nome, codice, set_espansione, qty, lingua, integrita_packaging, prezzo, note, immagine, stato)
        values (
            v_riga.richiedente_id, v_snap->>'nome', v_snap->>'codice', v_snap->>'set_espansione',
            v_riga.quantita_richiesta, v_snap->>'lingua', v_snap->>'integrita_packaging',
            v_riga.prezzo_congelato, v_snap->>'note', v_snap->>'immagine', 'collezione'
        )
        returning id into v_nuovo_id;

        if v_riga.prezzo_congelato is not null then
            insert into public.movimenti_collezione
                (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
            values
                (v_riga.proprietario_id, 'vendita_scambio', 'sealed', v_prodotto.id, v_snap->>'nome',
                 -v_riga.quantita_richiesta, v_riga.prezzo_congelato, -(v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc'),
                (v_riga.richiedente_id, 'vendita_scambio', 'sealed', v_nuovo_id, v_snap->>'nome',
                 v_riga.quantita_richiesta, v_riga.prezzo_congelato, (v_riga.prezzo_congelato * v_riga.quantita_richiesta), 'rpc');
        end if;
    end if;

    update richieste_scambio_righe
    set stato_riga = 'conclusa', location_scelta = coalesce(nullif(p_location_scelta, ''), '?'), aggiornato_il = now()
    where id = p_riga_id;

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_conclusa', jsonb_build_object('riga_id', p_riga_id));
end;
$function$
;

-- ── conta_carte_da_controllare_gruppo ──
CREATE OR REPLACE FUNCTION public.conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_location text[] DEFAULT NULL::text[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── conta_lavoro_pendente ──
CREATE OR REPLACE FUNCTION public.conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean DEFAULT false, p_tipi text[] DEFAULT NULL::text[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from coda_lavoro
  where stato = 'pending'
    and (p_aiuta_gruppo or creato_da = p_user_id)
    and (p_tipi is null or tipo = any(p_tipi));
$function$
;

-- ── conta_prodotti_sealed_da_controllare_gruppo ──
CREATE OR REPLACE FUNCTION public.conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_scaffali uuid[] DEFAULT NULL::uuid[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
  v_soglia timestamptz;
begin
  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from prodotti_sealed p
  where p.stato = 'collezione'
    and (not p_solo_proprie or p.owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    and (p_filtro_scaffali is null or array_length(p_filtro_scaffali, 1) is null or exists (
      select 1 from scaffale_prodotti sp where sp.prodotto_id = p.id and sp.scaffale_id = any(p_filtro_scaffali)
    ))
    and (not p_solo_vecchie or p.ultimo_controllo is null or p.ultimo_controllo < v_soglia);

  return v_count;
end;
$function$
;

-- ── handle_new_user ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, username, role)
  values (new.id, split_part(new.email, '@', 1), 'user')
  on conflict (id) do nothing;
  return new;
end;
$function$
;

-- ── handle_password_verification_attempt ──
CREATE OR REPLACE FUNCTION public.handle_password_verification_attempt(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── imposta_colore_cornice ──
CREATE OR REPLACE FUNCTION public.imposta_colore_cornice(p_principale text, p_secondario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF p_principale !~ '^#[0-9a-fA-F]{6}$' OR p_secondario !~ '^#[0-9a-fA-F]{6}$' THEN
        RAISE EXCEPTION 'Formato colore non valido — atteso #RRGGBB';
    END IF;

    UPDATE public.profiles
    SET colore_principale = p_principale,
        colore_secondario = p_secondario
    WHERE id = auth.uid();
END;
$function$
;

-- ── imposta_nickname ──
CREATE OR REPLACE FUNCTION public.imposta_nickname(p_nickname text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_pulito text := nullif(trim(coalesce(p_nickname, '')), '');
begin
    if v_me is null then raise exception 'Non autenticato'; end if;
    if v_pulito is not null and char_length(v_pulito) > 30 then
        raise exception 'Nickname troppo lungo (max 30 caratteri)';
    end if;

    update preferenze_utente set nickname = v_pulito, aggiornato_il = now() where owner_id = v_me;
    if not found then
        insert into preferenze_utente (owner_id, nickname) values (v_me, v_pulito);
    end if;
end;
$function$
;

-- ── invia_messaggio ──
CREATE OR REPLACE FUNCTION public.invia_messaggio(p_conversazione_id uuid, p_testo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_conv record;
    v_altro uuid;
    v_ultimo timestamptz;
    v_conta_10min integer;
    v_id uuid;
begin
    if v_me is null then raise exception 'Non autenticato'; end if;

    select * into v_conv from conversazioni where id = p_conversazione_id;
    if v_conv is null or v_me not in (v_conv.owner_a, v_conv.owner_b) then
        raise exception 'Conversazione non trovata';
    end if;
    v_altro := case when v_conv.owner_a = v_me then v_conv.owner_b else v_conv.owner_a end;

    -- AGGIUNTO (2026-09-24, sql/72): accesso vietato ai minorenni, sia
    -- come mittente sia come destinatario — un minorenne non può né
    -- scrivere né ricevere messaggi.
    if _chat_utente_vietato(v_me) or _chat_utente_vietato(v_altro) then
        raise exception 'Chat non disponibile per questo account';
    end if;

    if exists (select 1 from blocchi_chat where (blocca_id = v_me and bloccato_id = v_altro)
                                              or (blocca_id = v_altro and bloccato_id = v_me)) then
        raise exception 'Contatto non disponibile';
    end if;

    -- AGGIUNTO (2026-09-24, sql/72): filtro parolacce/link esterni — da
    -- questa migration in poi è l'UNICA barriera reale (quella lato
    -- client in ui/widget-chat.ui.js resta solo un primo avviso,
    -- aggirabile chiamando questa RPC direttamente).
    if _chat_ha_parolacce(p_testo) then
        raise exception 'Messaggio non consentito: contiene linguaggio non ammesso';
    end if;
    if _chat_ha_link_esterno(p_testo) then
        raise exception 'Messaggio non consentito: sono ammessi solo link interni a Bindex';
    end if;

    -- debounce: max 1 messaggio/secondo da questo mittente
    select max(creato_il) into v_ultimo from messaggi
    where conversazione_id = p_conversazione_id and mittente_id = v_me;
    if v_ultimo is not null and v_ultimo > now() - interval '1 second' then
        raise exception 'Troppo veloce, riprova tra un attimo';
    end if;

    -- flood: max 60 messaggi ogni 10 minuti da questo mittente in questa conversazione
    select count(*) into v_conta_10min from messaggi
    where conversazione_id = p_conversazione_id and mittente_id = v_me and creato_il > now() - interval '10 minutes';
    if v_conta_10min >= 60 then
        raise exception 'Troppi messaggi in poco tempo, rallenta';
    end if;

    insert into messaggi (conversazione_id, mittente_id, testo)
    values (p_conversazione_id, v_me, p_testo)
    returning id into v_id;
    return v_id;
end;
$function$
;

-- ── invia_richiesta_scambio ──
CREATE OR REPLACE FUNCTION public.invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_richiedente_id uuid := auth.uid();
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
begin
    if v_richiedente_id is null then
        raise exception 'Non autenticato';
    end if;
    if v_richiedente_id = p_proprietario_id then
        raise exception 'Non puoi inviare una richiesta a te stesso';
    end if;
    if jsonb_array_length(p_righe) = 0 then
        raise exception 'Nessuna riga nella richiesta';
    end if;

    insert into richieste_scambio (richiedente_id, proprietario_id)
    values (v_richiedente_id, p_proprietario_id)
    returning id into v_richiesta_id;

    select id into v_binder_scambio_id from binders where owner_id = p_proprietario_id and tipo = 'scambio';
    select id into v_scaffale_scambio_id from scaffali where owner_id = p_proprietario_id and tipo = 'scambio';

    for v_riga in select * from jsonb_array_elements(p_righe)
    loop
        v_tipo := v_riga->>'tipo';
        v_oggetto_id := (v_riga->>'oggetto_id')::uuid;
        v_quantita := coalesce((v_riga->>'quantita')::integer, 1);
        if v_quantita < 1 then
            raise exception 'Quantità non valida per un oggetto della richiesta';
        end if;

        if v_tipo = 'carta' then
            select c.* into v_carta from carte c where c.id = v_oggetto_id and c.owner_id = p_proprietario_id and c.stato = 'collezione';
            if v_carta is null then
                raise exception 'Carta non trovata o non più del proprietario indicato';
            end if;
            select bc.quantita_offerta into v_offerta
            from binder_carte bc where bc.binder_id = v_binder_scambio_id and bc.carta_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then
                raise exception 'Quantità richiesta superiore a quella offerta per questa carta';
            end if;

            v_prezzo := v_carta.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_carta.nome, 'codice', v_carta.codice, 'lingua', v_carta.lingua,
                'condizione', v_carta.condizione, 'reverse_holo', v_carta.reverse_holo,
                'first_ed', v_carta.first_ed, 'url', v_carta.url, 'immagine', v_carta.immagine,
                'sigillata_originale', v_carta.sigillata_originale, 'note', v_carta.note,
                'variante', v_carta.variante,  -- VARIANTE (2026-09-20)
                'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', v_richiedente_id, 'proprietario_id', p_proprietario_id,
                'data', now()
            );

            insert into richieste_scambio_righe
                (richiesta_id, richiedente_id, proprietario_id, carta_id, quantita_richiesta, prezzo_congelato, snapshot)
            values
                (v_richiesta_id, v_richiedente_id, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);

        elsif v_tipo = 'sealed' then
            select p.* into v_prodotto from prodotti_sealed p where p.id = v_oggetto_id and p.owner_id = p_proprietario_id and p.stato = 'collezione';
            if v_prodotto is null then
                raise exception 'Prodotto sealed non trovato o non più del proprietario indicato';
            end if;
            select sp.quantita_offerta into v_offerta
            from scaffale_prodotti sp where sp.scaffale_id = v_scaffale_scambio_id and sp.prodotto_id = v_oggetto_id;
            if v_offerta is null or v_offerta < v_quantita then
                raise exception 'Quantità richiesta superiore a quella offerta per questo prodotto';
            end if;

            v_prezzo := v_prodotto.prezzo;
            v_snapshot := jsonb_build_object(
                'nome', v_prodotto.nome, 'codice', v_prodotto.codice, 'set_espansione', v_prodotto.set_espansione,
                'lingua', v_prodotto.lingua, 'integrita_packaging', v_prodotto.integrita_packaging,
                'immagine', v_prodotto.immagine, 'note', v_prodotto.note, 'prezzo', v_prezzo, 'quantita', v_quantita,
                'richiedente_id', v_richiedente_id, 'proprietario_id', p_proprietario_id,
                'data', now()
            );

            insert into richieste_scambio_righe
                (richiesta_id, richiedente_id, proprietario_id, prodotto_sealed_id, quantita_richiesta, prezzo_congelato, snapshot)
            values
                (v_richiesta_id, v_richiedente_id, p_proprietario_id, v_oggetto_id, v_quantita, v_prezzo, v_snapshot);
        else
            raise exception 'Tipo oggetto non riconosciuto: %', v_tipo;
        end if;
    end loop;

    insert into activity_log (user_id, source, action, details)
    values (p_proprietario_id, 'sito', 'richiesta_scambio_ricevuta', jsonb_build_object('richiesta_id', v_richiesta_id, 'richiedente_id', v_richiedente_id));

    return v_richiesta_id;
end;
$function$
;

-- ── is_admin ──
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$function$
;

-- ── leggi_binder_id_owner ──
CREATE OR REPLACE FUNCTION public.leggi_binder_id_owner(p_owner_id uuid, p_tipo text, p_location_valore text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM binders
  WHERE owner_id = p_owner_id
    AND tipo = p_tipo
    AND (p_location_valore IS NULL OR location_valore = p_location_valore)
  LIMIT 1;
$function$
;

-- ── leggi_binder_pubblico ──
CREATE OR REPLACE FUNCTION public.leggi_binder_pubblico(p_binder_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, prezzo_obiettivo numeric, note text, url text, immagine text, riservato integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_binder record;
begin
    select b.* into v_binder from public.binders b where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
    if v_binder is null then
        return;
    end if;
    if v_binder.tipo = 'location' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine, 0::integer as riservato
        from public.carte c
        where c.owner_id = v_binder.owner_id
          and c.location = v_binder.location_valore
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'extra' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine, 0::integer as riservato
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'wishlist' then
        return query
        select w.id, w.nome, w.codice, w.lingua, w.condizione, w.qty, w.prezzo, w.prezzo_obiettivo, w.note, w.url, w.immagine, 0::integer as riservato
        from public.wishlist w
        where w.owner_id = v_binder.owner_id
        order by w.nome;
    elsif v_binder.tipo = 'scambio' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, bc.quantita_offerta as qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine,
               coalesce((select sum(rsr.quantita_richiesta)::integer from public.richieste_scambio_righe rsr
                         where rsr.carta_id = c.id and rsr.stato_riga = 'accettata'), 0) as riservato
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
          and bc.quantita_offerta > 0
        order by c.nome;
    end if;
end;
$function$
;

-- ── leggi_binder_pubblico_info ──
CREATE OR REPLACE FUNCTION public.leggi_binder_pubblico_info(p_binder_id uuid)
 RETURNS TABLE(nome text, tipo text, location_valore text, owner_id uuid, layout text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select b.nome, b.tipo, b.location_valore, b.owner_id, b.layout
    from public.binders b
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$function$
;

-- ── leggi_card_back_approvata ──
CREATE OR REPLACE FUNCTION public.leggi_card_back_approvata(p_owner_id uuid, p_binder_id uuid)
 RETURNS TABLE(storage_path text, source text, metadata jsonb, reviewed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT storage_path, source, metadata, reviewed_at
  FROM user_media
  WHERE user_id = p_owner_id
    AND binder_id = p_binder_id
    AND slot = 'card_back'
    AND status = 'approved'
  LIMIT 1;
$function$
;

-- ── leggi_colore_cornice_pubblico ──
CREATE OR REPLACE FUNCTION public.leggi_colore_cornice_pubblico(p_owner_id uuid)
 RETURNS TABLE(colore_principale text, colore_secondario text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT p.colore_principale, p.colore_secondario
    FROM public.profiles p
    WHERE p.id = p_owner_id;
$function$
;

-- ── leggi_contributi_gruppo ──
CREATE OR REPLACE FUNCTION public.leggi_contributi_gruppo()
 RETURNS TABLE(miei bigint, persone_aiutate bigint, gruppo bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_io UUID := auth.uid();
BEGIN
    IF v_io IS NULL THEN
        RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        -- I miei: quante volte ho completato il lavoro di qualcun altro.
        (SELECT count(*) FROM activity_log
          WHERE action = 'aiuto_gruppo' AND user_id = v_io),
        -- Quante persone diverse ho aiutato. Sempre dalle MIE righe.
        (SELECT count(DISTINCT details->>'owner') FROM activity_log
          WHERE action = 'aiuto_gruppo' AND user_id = v_io),
        -- Il totale del gruppo: UN NUMERO SOLO, mai spezzato per utente.
        -- E' il punto in cui il livello intermedio vive o muore: non
        -- aggiungere qui un GROUP BY user_id "per comodita'".
        (SELECT count(*) FROM activity_log
          WHERE action = 'aiuto_gruppo');
END;
$function$
;

-- ── leggi_media_binder_pubblico ──
CREATE OR REPLACE FUNCTION public.leggi_media_binder_pubblico(p_binder_id uuid)
 RETURNS TABLE(slot text, storage_path text, source text, metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select um.slot, um.storage_path, um.source, um.metadata
    from public.user_media um
    join public.binders b on b.id = um.binder_id
    where um.binder_id = p_binder_id
      and um.status = 'approved'
      and b.stato_pubblicazione = 'pubblico';
$function$
;

-- ── leggi_scaffale_pubblico ──
CREATE OR REPLACE FUNCTION public.leggi_scaffale_pubblico(p_scaffale_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, set_espansione text, lingua text, integrita_packaging text, qty integer, prezzo numeric, note text, immagine text, riservato integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_scaffale record;
begin
    select * into v_scaffale from public.scaffali where id = p_scaffale_id and stato_pubblicazione = 'pubblico';
    if v_scaffale is null then
        return;
    end if;

    if v_scaffale.tipo = 'scambio' then
        return query
        select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
               p.integrita_packaging, sp.quantita_offerta as qty, p.prezzo, p.note, p.immagine,
               coalesce((select sum(rsr.quantita_richiesta)::integer from public.richieste_scambio_righe rsr
                         where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0) as riservato
        from public.prodotti_sealed p
        join public.scaffale_prodotti sp on sp.prodotto_id = p.id
        where sp.scaffale_id = p_scaffale_id
          and sp.owner_id = v_scaffale.owner_id
          and p.owner_id = v_scaffale.owner_id
          and p.stato = 'collezione'
          and sp.quantita_offerta > 0
        order by p.nome;
    else
        return query
        select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
               p.integrita_packaging, p.qty, p.prezzo, p.note, p.immagine, 0::integer as riservato
        from public.prodotti_sealed p
        join public.scaffale_prodotti sp on sp.prodotto_id = p.id
        where sp.scaffale_id = p_scaffale_id
          and sp.owner_id = v_scaffale.owner_id
          and p.owner_id = v_scaffale.owner_id
          and p.stato = 'collezione'
        order by p.nome;
    end if;
end;
$function$
;

-- ── leggi_scaffale_pubblico_info ──
CREATE OR REPLACE FUNCTION public.leggi_scaffale_pubblico_info(p_scaffale_id uuid)
 RETURNS TABLE(nome text, tipo text, owner_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select s.nome, s.tipo, s.owner_id
    from public.scaffali s
    where s.id = p_scaffale_id and s.stato_pubblicazione = 'pubblico';
$function$
;

-- ── leggi_scambio_condiviso ──
CREATE OR REPLACE FUNCTION public.leggi_scambio_condiviso(p_owner_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, note text, url text, immagine text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           note, url, immagine
    from public.carte
    where owner_id = p_owner_id
      and location = 'SCAMBIO'
      and stato = 'collezione'
    order by nome;
$function$
;

-- ── leggi_sealed_condiviso ──
CREATE OR REPLACE FUNCTION public.leggi_sealed_condiviso(p_owner_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, note text, url text, immagine text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           note, url, immagine
    from public.carte
    where owner_id = p_owner_id
      and tipo = 'sealed'
      and stato = 'collezione'
      and location = 'SCAMBIO'
    order by nome;
$function$
;

-- ── leggi_stato_claim_gruppo ──
CREATE OR REPLACE FUNCTION public.leggi_stato_claim_gruppo(p_soglia_minuti integer DEFAULT 10)
 RETURNS TABLE(id uuid, dispositivo text, claimed_by uuid, claimed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, dispositivo, claimed_by, claimed_at
  from carte
  where stato = 'collezione'
    and claimed_by is not null
    and claimed_at > (now() - (p_soglia_minuti || ' minutes')::interval)
  order by claimed_at desc;
$function$
;

-- ── leggi_variazioni_da ──
CREATE OR REPLACE FUNCTION public.leggi_variazioni_da(p_da timestamp with time zone)
 RETURNS TABLE(oggetto_id uuid, tabella text, prezzo_base numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    with dopo as (
        select s.carta_id, s.tabella, count(*) as n_dopo
        from public.storico_prezzi s
        where s.owner_id = auth.uid()
          and s.registrato_il > p_da
        group by s.carta_id, s.tabella
    ),
    prima as (
        select distinct on (s.carta_id, s.tabella)
               s.carta_id, s.tabella, s.prezzo
        from public.storico_prezzi s
        join dopo d on d.carta_id = s.carta_id and d.tabella = s.tabella
        where s.owner_id = auth.uid()
          and s.registrato_il <= p_da
        order by s.carta_id, s.tabella, s.registrato_il desc
    ),
    risolto as (
        select d.carta_id, d.tabella,
               coalesce(
                   p.prezzo,
                   case when d.n_dopo = 1 then
                       case d.tabella
                           when 'carte' then
                               (select c.prezzo_precedente from public.carte c where c.id = d.carta_id)
                           when 'prodotti_sealed' then
                               (select b.prezzo_precedente from public.prodotti_sealed b where b.id = d.carta_id)
                       end
                   end
               ) as prezzo_base
        from dopo d
        left join prima p on p.carta_id = d.carta_id and p.tabella = d.tabella
    )
    select r.carta_id, r.tabella, r.prezzo_base
    from risolto r
    where r.prezzo_base is not null
    order by r.tabella, r.carta_id;
$function$
;

-- ── leggi_wishlist_condivisa ──
CREATE OR REPLACE FUNCTION public.leggi_wishlist_condivisa(p_owner_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, prezzo_obiettivo numeric, note text, url text, immagine text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select id, nome, codice, lingua, condizione, qty, prezzo,
           prezzo_obiettivo, note, url, immagine
    from public.wishlist
    where owner_id = p_owner_id
    order by nome;
$function$
;

-- ── leggi_wishlist_sealed_condivisa ──
CREATE OR REPLACE FUNCTION public.leggi_wishlist_sealed_condivisa(p_owner_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, set_espansione text, lingua text, integrita_minima text, qty integer, prezzo_obiettivo numeric, note text, immagine text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select id, nome, codice, set_espansione, lingua, integrita_minima, qty,
           prezzo_obiettivo, note, immagine
    from public.wishlist_sealed
    where owner_id = p_owner_id
    order by nome;
$function$
;

-- ── log_admin_action ──
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action text, p_target uuid, p_details jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target, p_details);
end;
$function$
;

-- ── ottieni_nicknames ──
CREATE OR REPLACE FUNCTION public.ottieni_nicknames(p_owner_ids uuid[])
 RETURNS TABLE(owner_id uuid, nickname text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if auth.uid() is null then raise exception 'Non autenticato'; end if;
    return query select p.owner_id, p.nickname from preferenze_utente p where p.owner_id = any(p_owner_ids);
end;
$function$
;

-- ── ottieni_o_crea_conversazione ──
CREATE OR REPLACE FUNCTION public.ottieni_o_crea_conversazione(p_altro_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_a uuid; v_b uuid;
    v_id uuid;
    v_nuove_oggi integer;
begin
    if v_me is null then raise exception 'Non autenticato'; end if;
    if v_me = p_altro_id then raise exception 'Non puoi aprire una chat con te stesso'; end if;

    -- AGGIUNTO (2026-09-24, sql/72): stesso controllo di invia_messaggio.
    if _chat_utente_vietato(v_me) or _chat_utente_vietato(p_altro_id) then
        raise exception 'Chat non disponibile per questo account';
    end if;

    if exists (select 1 from blocchi_chat where (blocca_id = v_me and bloccato_id = p_altro_id)
                                              or (blocca_id = p_altro_id and bloccato_id = v_me)) then
        raise exception 'Contatto non disponibile';
    end if;

    v_a := least(v_me, p_altro_id);
    v_b := greatest(v_me, p_altro_id);

    select id into v_id from conversazioni where owner_a = v_a and owner_b = v_b;
    if v_id is not null then return v_id; end if;

    -- rate limit: max 20 nuove conversazioni al giorno per utente
    select count(*) into v_nuove_oggi from conversazioni
    where (owner_a = v_me or owner_b = v_me) and creato_il > now() - interval '1 day';
    if v_nuove_oggi >= 20 then
        raise exception 'Hai raggiunto il limite di nuove conversazioni per oggi';
    end if;

    insert into conversazioni (owner_a, owner_b) values (v_a, v_b)
    on conflict (owner_a, owner_b) do nothing
    returning id into v_id;

    if v_id is null then
        select id into v_id from conversazioni where owner_a = v_a and owner_b = v_b;
    end if;
    return v_id;
end;
$function$
;

-- ── polvere_saldo ──
CREATE OR REPLACE FUNCTION public.polvere_saldo()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT COALESCE(SUM(quantita), 0)::integer
    FROM inventario_ricompense
    WHERE owner_id = auth.uid() AND tipo = 'polvere';
$function$
;

-- ── pulisci_storico_prezzi ──
CREATE OR REPLACE FUNCTION public.pulisci_storico_prezzi()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── reclama_carte_per_controllo_prezzi ──
CREATE OR REPLACE FUNCTION public.reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_location text[] DEFAULT NULL::text[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3, p_lotto_size integer DEFAULT 3)
 RETURNS SETOF carte
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── reclama_lavoro ──
CREATE OR REPLACE FUNCTION public.reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean DEFAULT false, p_lotto_size integer DEFAULT 3, p_tipi text[] DEFAULT NULL::text[])
 RETURNS SETOF coda_lavoro
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── reclama_prodotti_sealed_per_controllo_prezzi ──
CREATE OR REPLACE FUNCTION public.reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid DEFAULT NULL::uuid, p_solo_proprie boolean DEFAULT true, p_filtro_scaffali uuid[] DEFAULT NULL::uuid[], p_solo_vecchie boolean DEFAULT false, p_giorni_minimi integer DEFAULT 3, p_lotto_size integer DEFAULT 3)
 RETURNS SETOF prodotti_sealed
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
begin
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  update prodotti_sealed c
  set claimed_by = p_user_id, claimed_at = now()
  where c.id in (
    select p.id from prodotti_sealed p
    where p.stato = 'collezione'
      and (p_solo_proprie = false or p.owner_id = coalesce(p_owner_id_richiesto, p_user_id))
      and (p_filtro_scaffali is null or array_length(p_filtro_scaffali, 1) is null or exists (
        select 1 from scaffale_prodotti sp where sp.prodotto_id = p.id and sp.scaffale_id = any(p_filtro_scaffali)
      ))
      and (p_solo_vecchie = false or p.ultimo_controllo is null or p.ultimo_controllo < v_soglia_vecchie)
      and (p.claimed_by is null or p.claimed_by = p_user_id or p.claimed_at < v_soglia_claim)
    order by p.ultimo_controllo asc nulls first
    limit p_lotto_size
    for update skip locked
  )
  returning c.*;
end;
$function$
;

-- ── registra_aiuto_gruppo ──
CREATE OR REPLACE FUNCTION public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text DEFAULT 'coda_carte'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_io UUID := auth.uid();
BEGIN
    IF v_io IS NULL THEN
        RETURN; -- non autenticato: niente da registrare
    END IF;

    -- LAVORARE UNA PROPRIA RIGA NON E' UN CONTRIBUTO. Il worker autonomo
    -- risolve sempre le proprie carte, a prescindere dal flag "Aiuta il
    -- gruppo": senza questo controllo il contatore misurerebbe "quanto uso
    -- l'app" invece di "quanto aiuto gli altri". Il controllo sta QUI e non
    -- nel client apposta: e' la regola che definisce il dato.
    IF p_owner_riga IS NULL OR p_owner_riga = v_io THEN
        RETURN;
    END IF;

    INSERT INTO activity_log (user_id, source, action, details)
    VALUES (
        v_io,
        'estensione',
        'aiuto_gruppo',
        jsonb_build_object(
            'riga_id', p_riga_id,
            -- Serve a contare le PERSONE aiutate, non solo le carte. E'
            -- visibile solo a chi ha scritto la riga (e' la sua), quindi
            -- non incrina il livello intermedio.
            'owner', p_owner_riga::text,
            'tipo', p_tipo
        )
    );
END;
$function$
;

-- ── registra_apertura_binder_pubblico ──
CREATE OR REPLACE FUNCTION public.registra_apertura_binder_pubblico(p_binder_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_owner_id uuid;
    v_pubblico boolean;
BEGIN
    -- Valida che il binder esista e sia DAVVERO pubblico ORA — non fidarsi
    -- ciecamente dell'input: un binder_id valido ma privato non deve
    -- generare un evento.
    SELECT owner_id, (stato_pubblicazione = 'pubblico')
    INTO v_owner_id, v_pubblico
    FROM binders WHERE id = p_binder_id;
    IF v_owner_id IS NULL OR NOT v_pubblico THEN
        RETURN; -- silenzioso: nessun errore visibile al visitatore anonimo
    END IF;
    INSERT INTO activity_log (user_id, source, action, details)
    VALUES (v_owner_id, 'sito', 'aperto', jsonb_build_object('binder_id', p_binder_id));
END;
$function$
;

-- ── registra_apertura_scaffale_pubblico ──
CREATE OR REPLACE FUNCTION public.registra_apertura_scaffale_pubblico(p_scaffale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_owner_id uuid;
    v_pubblico boolean;
begin
    select owner_id, (stato_pubblicazione = 'pubblico')
    into v_owner_id, v_pubblico
    from public.scaffali where id = p_scaffale_id;

    if v_owner_id is null or not v_pubblico then
        return;
    end if;

    insert into public.activity_log (user_id, source, action, details)
    values (v_owner_id, 'sito', 'scaffale_pubblico_aperto', jsonb_build_object('scaffale_id', p_scaffale_id));
end;
$function$
;

-- ── registra_visita ──
CREATE OR REPLACE FUNCTION public.registra_visita(p_pausa_ore numeric DEFAULT 4)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
    v_baseline timestamptz;
begin
    if auth.uid() is null then
        raise exception 'Non autenticato';
    end if;
    if p_pausa_ore is null or p_pausa_ore < 0 or p_pausa_ore > 720 then
        raise exception 'Pausa non valida (0-720 ore)';
    end if;

    -- Un solo statement atomico: in ON CONFLICT DO UPDATE le espressioni del
    -- SET leggono i valori VECCHI della riga (u.ultima_apertura e' quella
    -- precedente anche se piu' in basso la si riassegna a now()), quindi due
    -- dispositivi che aprono insieme non possono pestarsi i piedi.
    insert into public.ultima_visita as u (owner_id, ultima_apertura, baseline, aggiornata_il)
    values (auth.uid(), now(), null, now())
    on conflict (owner_id) do update
        set baseline = case
                           when u.ultima_apertura < now() - (interval '1 hour' * p_pausa_ore)
                               then u.ultima_apertura
                           else u.baseline
                       end,
            ultima_apertura = now(),
            aggiornata_il = now()
    returning u.baseline into v_baseline;

    return v_baseline;
end;
$function$
;

-- ── request_password_reset ──
CREATE OR REPLACE FUNCTION public.request_password_reset(p_username text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- ── rifiuta_riga_richiesta ──
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

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_rifiutata', jsonb_build_object('riga_id', p_riga_id));
end;
$function$
;

-- ── rilascia_claim_controllo_prezzi ──
CREATE OR REPLACE FUNCTION public.rilascia_claim_controllo_prezzi(p_dispositivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set claimed_by = null, claimed_at = null, dispositivo = null
  where claimed_by = auth.uid()
    and (p_dispositivo is null or dispositivo = p_dispositivo);
$function$
;

-- ── rilascia_claim_controllo_prezzi_sealed ──
CREATE OR REPLACE FUNCTION public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set claimed_by = null, claimed_at = null, dispositivo = null
  where claimed_by = auth.uid()
    and (p_dispositivo is null or dispositivo = p_dispositivo);
$function$
;

-- ── rinomina_location ──
CREATE OR REPLACE FUNCTION public.rinomina_location(p_da text, p_a text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid            uuid := auth.uid();
    v_da             text := nullif(p_da, '');
    v_a              text := btrim(coalesce(p_a, ''));
    v_n_location     int  := 0;
    v_n_carte        int  := 0;
    v_binder_id      uuid;
    v_binder_nome    text;
    v_binder_stato   text;
    v_binder_prop    text;
    v_proposta_nome  boolean := false;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Non autenticato';
    END IF;
    IF v_da IS NULL OR v_a = '' THEN
        RAISE EXCEPTION 'Nome mancante';
    END IF;
    IF v_da = v_a THEN
        RAISE EXCEPTION 'Il nuovo nome coincide con quello attuale';
    END IF;
    IF upper(btrim(v_da)) IN ('?', 'SCAMBIO', 'WISHLIST', '—')
       OR upper(v_a) IN ('?', 'SCAMBIO', 'WISHLIST', '—') THEN
        RAISE EXCEPTION 'Contenitore di sistema: non si può rinominare né usare come nuovo nome';
    END IF;

    -- La location di partenza deve esistere da qualche parte (può essere
    -- "orfana": usata da carte ma senza riga in location).
    IF NOT EXISTS (SELECT 1 FROM public.location WHERE owner_id = v_uid AND tipo = 'carta' AND nome = v_da)
       AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)
       AND NOT EXISTS (SELECT 1 FROM public.binders WHERE owner_id = v_uid AND tipo = 'location' AND location_valore = v_da) THEN
        RAISE EXCEPTION 'Location "%" non trovata', v_da;
    END IF;

    -- Nome di arrivo già in uso (case-insensitive, esclusa la location
    -- stessa: "bulk" → "BULK" resta un cambio di maiuscole lecito).
    IF EXISTS (SELECT 1 FROM public.location WHERE owner_id = v_uid AND tipo = 'carta' AND nome <> v_da AND lower(nome) = lower(v_a))
       OR EXISTS (SELECT 1 FROM public.binders WHERE owner_id = v_uid AND tipo = 'location' AND location_valore <> v_da AND lower(location_valore) = lower(v_a))
       OR EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location <> v_da AND lower(location) = lower(v_a)) THEN
        RAISE EXCEPTION 'Esiste già una location "%"', v_a;
    END IF;

    UPDATE public.location SET nome = v_a
     WHERE owner_id = v_uid AND tipo = 'carta' AND nome = v_da;
    GET DIAGNOSTICS v_n_location = ROW_COUNT;

    UPDATE public.carte SET location = v_a
     WHERE owner_id = v_uid AND location = v_da;
    GET DIAGNOSTICS v_n_carte = ROW_COUNT;

    -- Binder-location: location_valore sempre; nome MAI. Il nuovo nome va
    -- in nome_proposto/'pending' solo se il binder "seguiva" la location.
    SELECT id, nome, nome_stato, nome_proposto
      INTO v_binder_id, v_binder_nome, v_binder_stato, v_binder_prop
      FROM public.binders
     WHERE owner_id = v_uid AND tipo = 'location' AND location_valore = v_da;
    IF FOUND THEN
        IF v_binder_nome = v_da
           OR (v_binder_stato = 'pending' AND v_binder_prop = v_da) THEN
            UPDATE public.binders
               SET location_valore = v_a,
                   nome_proposto   = v_a,
                   nome_stato      = 'pending',
                   nome_admin_note = null
             WHERE id = v_binder_id;
            v_proposta_nome := true;
        ELSE
            UPDATE public.binders SET location_valore = v_a WHERE id = v_binder_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'location',       v_n_location,
        'carte',          v_n_carte,
        'binder_id',      v_binder_id,
        'proposta_nome',  v_proposta_nome
    );
END;
$function$
;

-- ── riscatta_missione_completata ──
CREATE OR REPLACE FUNCTION public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_owner_id uuid := auth.uid();
    v_ricompensa record;
begin
    if v_owner_id is null then
        raise exception 'Non autenticato';
    end if;

    begin
        insert into public.missioni_completate (owner_id, missione_id, finestra, periodo, origine, completato_il)
        values (v_owner_id, p_missione_id, p_finestra, p_periodo, 'normale', now());
    exception when unique_violation then
        return false; -- già completata per questo periodo, nessuna nuova ricompensa
    end;

    select tipo_ricompensa, quantita, riferimento into v_ricompensa
    from public.catalogo_ricompense
    where voce_id = p_missione_id and categoria = 'missione';

    if v_ricompensa is null then
        -- Completamento registrato comunque; nessuna ricompensa nel
        -- catalogo per questo id (dato mancante/da sincronizzare col
        -- catalogo JS) — mai inventare una quantità.
        return true;
    end if;

    insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
    values (v_owner_id, v_ricompensa.tipo_ricompensa, p_missione_id, coalesce(v_ricompensa.quantita, 1), now());

    return true;
end;
$function$
;

-- ── riscatta_traguardo ──
CREATE OR REPLACE FUNCTION public.riscatta_traguardo(p_traguardo_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_owner_id uuid := auth.uid();
    v_ricompensa record;
begin
    if v_owner_id is null then
        raise exception 'Non autenticato';
    end if;

    begin
        insert into public.traguardi_riscossi (owner_id, traguardo_id, riscosso_il)
        values (v_owner_id, p_traguardo_id, now());
    exception when unique_violation then
        return false;
    end;

    select tipo_ricompensa, quantita, riferimento into v_ricompensa
    from public.catalogo_ricompense
    where voce_id = p_traguardo_id and categoria = 'traguardo';

    if v_ricompensa is null then
        return true;
    end if;

    insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
    values (v_owner_id, v_ricompensa.tipo_ricompensa, p_traguardo_id, coalesce(v_ricompensa.quantita, 1), now());

    -- RIMOSSO (2026-09-25): scrittura in achievement_sbloccati. Il widget
    -- Achievement ora legge da traguardi_riscossi (già scritta sopra),
    -- non serve più duplicare lo sblocco in una seconda tabella.
    return true;
end;
$function$
;

-- ── rls_auto_enable ──
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- ── sblocca_riga_richiesta ──
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

    insert into activity_log (user_id, source, action, details)
    values (v_riga.richiedente_id, 'sito', 'riga_scambio_sbloccata', jsonb_build_object('riga_id', p_riga_id, 'motivo', p_motivo));
end;
$function$
;

-- ── sblocca_utente ──
CREATE OR REPLACE FUNCTION public.sblocca_utente(p_bloccato_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    delete from blocchi_chat where blocca_id = auth.uid() and bloccato_id = p_bloccato_id;
end;
$function$
;

-- ── segna_controllata_gruppo ──
CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione';
$function$
;

-- ── segna_controllata_gruppo_sealed ──
CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo_sealed(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione';
$function$
;

-- ── segna_letti_conversazione ──
CREATE OR REPLACE FUNCTION public.segna_letti_conversazione(p_conversazione_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    update messaggi set letto_il = now()
    where conversazione_id = p_conversazione_id
      and mittente_id <> auth.uid()
      and letto_il is null;
end;
$function$
;

-- ── segnala_conversazione ──
CREATE OR REPLACE FUNCTION public.segnala_conversazione(p_conversazione_id uuid, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_conv record;
    v_id uuid;
begin
    if v_me is null then raise exception 'Non autenticato'; end if;
    select * into v_conv from conversazioni where id = p_conversazione_id;
    if v_conv is null or v_me not in (v_conv.owner_a, v_conv.owner_b) then
        raise exception 'Conversazione non trovata';
    end if;
    insert into segnalazioni_chat (conversazione_id, segnalato_da, motivo)
    values (p_conversazione_id, v_me, p_motivo)
    returning id into v_id;
    return v_id;
end;
$function$
;

-- ── set_carte_conteggi ──
CREATE OR REPLACE FUNCTION public.set_carte_conteggi()
 RETURNS TABLE(sigla text, carte integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select c.sigla, count(*)::integer
    from public.set_carte c
    group by c.sigla;
$function$
;

-- ── sposta_riga_in_correzione_manuale ──
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
$function$
;

-- ── tagga_dispositivo_claim_gruppo ──
CREATE OR REPLACE FUNCTION public.tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set dispositivo = p_dispositivo
  where id = any(p_ids)
    and claimed_by = auth.uid()
    and stato = 'collezione';
$function$
;

-- ── tagga_dispositivo_claim_gruppo_sealed ──
CREATE OR REPLACE FUNCTION public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set dispositivo = p_dispositivo
  where id = any(p_ids)
    and claimed_by = auth.uid()
    and stato = 'collezione';
$function$
;

-- ── trova_match_scambio_wishlist ──
CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist(p_owner_id uuid)
 RETURNS TABLE(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select c.id, c.nome, c.prezzo, w.owner_id, u.email, w.id, w.prezzo_obiettivo
    from public.carte c
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join public.wishlist w on upper(trim(w.codice)) = upper(trim(c.codice))
    join auth.users u on u.id = w.owner_id
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
$function$
;

-- ── trova_match_scambio_wishlist_sealed ──
CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist_sealed(p_owner_id uuid)
 RETURNS TABLE(mio_prodotto_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_sealed_id uuid, altro_prezzo_obiettivo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select p.id, p.nome, p.prezzo, ws.owner_id, u.email, ws.id, ws.prezzo_obiettivo
    from public.prodotti_sealed p
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join public.wishlist_sealed ws on upper(trim(ws.codice)) = upper(trim(p.codice))
    join auth.users u on u.id = ws.owner_id
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
$function$
;

-- ── trova_match_wishlist_scambio ──
CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, u.email, c.id, c.prezzo
    from public.wishlist w
    join public.carte c on upper(trim(c.codice)) = upper(trim(w.codice))
    join public.binder_carte bc on bc.carta_id = c.id
    join public.binders b on b.id = bc.binder_id and b.owner_id = c.owner_id and b.tipo = 'scambio'
    join auth.users u on u.id = c.owner_id
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
$function$
;

-- ── trova_match_wishlist_scambio_sealed ──
CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio_sealed(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_sealed_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altro_prodotto_id uuid, altro_prezzo numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select ws.id, ws.nome, ws.prezzo_obiettivo, p.owner_id, u.email, p.id, p.prezzo
    from public.wishlist_sealed ws
    join public.prodotti_sealed p on upper(trim(p.codice)) = upper(trim(ws.codice))
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    join public.scaffali s on s.id = sp.scaffale_id and s.owner_id = p.owner_id and s.tipo = 'scambio'
    join auth.users u on u.id = p.owner_id
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
$function$
;

-- ── verifica_versione_minima ──
CREATE OR REPLACE FUNCTION public.verifica_versione_minima(p_versione_client text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;


-- ============================================================================
-- VISTE
-- ============================================================================

create or replace view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
    payload ->> 'location'::text AS location,
    payload ->> 'url_diretto'::text AS url_diretto,
    payload ->> 'tipo_prodotto'::text AS tipo,
    COALESCE(payload ->> 'destinazione'::text, 'collezione'::text) AS destinazione,
    NULLIF(payload ->> 'prezzo_obiettivo'::text, ''::text)::numeric AS prezzo_obiettivo,
    stato,
    creato_da AS owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    esito -> 'opzioni_disambiguazione'::text AS opzioni_disambiguazione,
    tentativi_falliti
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);


-- ============================================================================
-- VINCOLI (chiavi primarie, esterne, unique, check)
-- ============================================================================

alter table public.achievement_catalogo add constraint achievement_catalogo_pkey PRIMARY KEY (id);

alter table public.achievement_catalogo add constraint achievement_catalogo_rarita_check CHECK ((rarita = ANY (ARRAY['comune'::text, 'rara'::text, 'leggendaria'::text])));

alter table public.achievement_sbloccati add constraint achievement_sbloccati_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievement_catalogo(id);

alter table public.achievement_sbloccati add constraint achievement_sbloccati_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.achievement_sbloccati add constraint achievement_sbloccati_pkey PRIMARY KEY (owner_id, achievement_id);

alter table public.activity_log add constraint activity_log_pkey PRIMARY KEY (id);

alter table public.activity_log add constraint activity_log_source_check CHECK ((source = ANY (ARRAY['sito'::text, 'estensione'::text])));

alter table public.activity_log add constraint activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table public.admin_audit_log add constraint admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);

alter table public.admin_audit_log add constraint admin_audit_log_pkey PRIMARY KEY (id);

alter table public.binder_carte add constraint binder_carte_binder_id_fkey FOREIGN KEY (binder_id) REFERENCES binders(id) ON DELETE CASCADE;

alter table public.binder_carte add constraint binder_carte_carta_id_fkey FOREIGN KEY (carta_id) REFERENCES carte(id) ON DELETE CASCADE;

alter table public.binder_carte add constraint binder_carte_owner_binder_carta_key UNIQUE (owner_id, binder_id, carta_id);

alter table public.binder_carte add constraint binder_carte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.binder_carte add constraint binder_carte_pkey PRIMARY KEY (id);

alter table public.binders add constraint binders_location_valore_richiesto CHECK (((tipo <> 'location'::text) OR (location_valore IS NOT NULL)));

alter table public.binders add constraint binders_location_valore_solo_per_location CHECK (((tipo = 'location'::text) OR (location_valore IS NULL)));

alter table public.binders add constraint binders_nome_stato_check CHECK ((nome_stato = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.binders add constraint binders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.binders add constraint binders_owner_tipo_location_uniq UNIQUE (owner_id, tipo, location_valore);

alter table public.binders add constraint binders_pkey PRIMARY KEY (id);

alter table public.binders add constraint binders_stato_pubblicazione_check CHECK ((stato_pubblicazione = ANY (ARRAY['privato'::text, 'in_approvazione'::text, 'pubblico'::text])));

alter table public.binders add constraint binders_tipo_check CHECK ((tipo = ANY (ARRAY['location'::text, 'wishlist'::text, 'extra'::text, 'scambio'::text])));

alter table public.blocchi_chat add constraint blocchi_chat_blocca_id_fkey FOREIGN KEY (blocca_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.blocchi_chat add constraint blocchi_chat_bloccato_id_fkey FOREIGN KEY (bloccato_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.blocchi_chat add constraint blocchi_chat_pkey PRIMARY KEY (blocca_id, bloccato_id);

alter table public.blocchi_chat add constraint blocchi_no_autoblocco CHECK ((blocca_id <> bloccato_id));

alter table public.bustina_carte_possedute add constraint bustina_carte_possedute_owner_carta_key UNIQUE (owner_id, carta_id);

alter table public.bustina_carte_possedute add constraint bustina_carte_possedute_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.bustina_carte_possedute add constraint bustina_carte_possedute_pkey PRIMARY KEY (id);

alter table public.bustina_carte_possedute add constraint bustina_carte_possedute_quantita_check CHECK ((quantita > 0));

alter table public.bustina_catalogo add constraint bustina_catalogo_pkey PRIMARY KEY (carta_id);

alter table public.bustina_catalogo add constraint bustina_catalogo_rarita_check CHECK ((rarita = ANY (ARRAY['comuni'::text, 'non comuni'::text, 'rare'::text, 'ultra rare'::text, 'leggendarie'::text])));

alter table public.bustina_polvere_doppione add constraint bustina_polvere_doppione_pkey PRIMARY KEY (rarita);

alter table public.bustina_polvere_doppione add constraint bustina_polvere_doppione_polvere_check CHECK ((polvere >= 0));

alter table public.bustina_polvere_doppione add constraint bustina_polvere_doppione_rarita_check CHECK ((rarita = ANY (ARRAY['comuni'::text, 'non comuni'::text, 'rare'::text, 'ultra rare'::text, 'leggendarie'::text])));

alter table public.bustina_probabilita add constraint bustina_probabilita_peso_check CHECK ((peso >= 0));

alter table public.bustina_probabilita add constraint bustina_probabilita_pkey PRIMARY KEY (slot, rarita);

alter table public.bustina_probabilita add constraint bustina_probabilita_rarita_check CHECK ((rarita = ANY (ARRAY['comuni'::text, 'non comuni'::text, 'rare'::text, 'ultra rare'::text, 'leggendarie'::text])));

alter table public.bustina_probabilita add constraint bustina_probabilita_slot_check CHECK (((slot >= 1) AND (slot <= 4)));

alter table public.carte add constraint carte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.carte add constraint carte_pkey PRIMARY KEY (id);

alter table public.catalogo_ricompense add constraint catalogo_ricompense_categoria_check CHECK ((categoria = ANY (ARRAY['missione'::text, 'traguardo'::text])));

alter table public.catalogo_ricompense add constraint catalogo_ricompense_pkey PRIMARY KEY (voce_id);

alter table public.chat_restrizioni_utente add constraint chat_restrizioni_utente_impostato_da_fkey FOREIGN KEY (impostato_da) REFERENCES auth.users(id);

alter table public.chat_restrizioni_utente add constraint chat_restrizioni_utente_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.chat_restrizioni_utente add constraint chat_restrizioni_utente_pkey PRIMARY KEY (owner_id);

alter table public.coda_lavoro add constraint coda_lavoro_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id);

alter table public.coda_lavoro add constraint coda_lavoro_creato_da_fkey FOREIGN KEY (creato_da) REFERENCES auth.users(id);

alter table public.coda_lavoro add constraint coda_lavoro_pkey PRIMARY KEY (id);

alter table public.coda_lavoro add constraint coda_lavoro_stato_check CHECK ((stato = ANY (ARRAY['pending'::text, 'in_corso'::text, 'completato'::text, 'errore'::text])));

alter table public.coda_lavoro add constraint coda_lavoro_tipo_check CHECK ((tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text, 'controlla_prezzi'::text, 'controlla_prezzi_wishlist'::text])));

alter table public.coda_wishlist add constraint coda_wishlist_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id);

alter table public.coda_wishlist add constraint coda_wishlist_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.coda_wishlist add constraint coda_wishlist_pkey PRIMARY KEY (id);

alter table public.configurazione_app add constraint configurazione_app_pkey PRIMARY KEY (chiave);

alter table public.conversazioni add constraint conversazioni_coppia_unica UNIQUE (owner_a, owner_b);

alter table public.conversazioni add constraint conversazioni_ordine CHECK ((owner_a < owner_b));

alter table public.conversazioni add constraint conversazioni_owner_a_fkey FOREIGN KEY (owner_a) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.conversazioni add constraint conversazioni_owner_b_fkey FOREIGN KEY (owner_b) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.conversazioni add constraint conversazioni_pkey PRIMARY KEY (id);

alter table public.correzioni_manuali_carte add constraint correzioni_manuali_carte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.correzioni_manuali_carte add constraint correzioni_manuali_carte_pkey PRIMARY KEY (id);

alter table public.foto_carte add constraint foto_carte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.foto_carte add constraint foto_carte_pkey PRIMARY KEY (id);

alter table public.inventario_ricompense add constraint inventario_ricompense_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.inventario_ricompense add constraint inventario_ricompense_pkey PRIMARY KEY (id);

alter table public.inventario_ricompense add constraint inventario_ricompense_tipo_check CHECK ((tipo = ANY (ARRAY['polvere'::text, 'stampino'::text, 'bustina'::text, 'skip_missione'::text])));

alter table public.location add constraint location_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.location add constraint location_owner_id_nome_tipo_key UNIQUE (owner_id, nome, tipo);

alter table public.location add constraint location_pkey PRIMARY KEY (id);

alter table public.location add constraint location_tipo_check CHECK ((tipo = ANY (ARRAY['carta'::text, 'sealed'::text])));

alter table public.messaggi add constraint messaggi_conversazione_id_fkey FOREIGN KEY (conversazione_id) REFERENCES conversazioni(id) ON DELETE CASCADE;

alter table public.messaggi add constraint messaggi_mittente_id_fkey FOREIGN KEY (mittente_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.messaggi add constraint messaggi_pkey PRIMARY KEY (id);

alter table public.messaggi add constraint messaggi_testo_check CHECK (((char_length(testo) >= 1) AND (char_length(testo) <= 2000)));

alter table public.missioni_completate add constraint missioni_completate_finestra_check CHECK ((finestra = ANY (ARRAY['giornaliera'::text, 'settimanale'::text, 'mensile'::text, 'una_tantum'::text])));

alter table public.missioni_completate add constraint missioni_completate_origine_check CHECK ((origine = ANY (ARRAY['normale'::text, 'skip'::text])));

alter table public.missioni_completate add constraint missioni_completate_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.missioni_completate add constraint missioni_completate_owner_id_periodo_missione_id_key UNIQUE (owner_id, periodo, missione_id);

alter table public.missioni_completate add constraint missioni_completate_pkey PRIMARY KEY (id);

alter table public.movimenti_collezione add constraint movimenti_collezione_fonte_check CHECK ((fonte = ANY (ARRAY['sito'::text, 'estensione'::text, 'rpc'::text])));

alter table public.movimenti_collezione add constraint movimenti_collezione_oggetto_tipo_check CHECK ((oggetto_tipo = ANY (ARRAY['carta'::text, 'sealed'::text])));

alter table public.movimenti_collezione add constraint movimenti_collezione_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.movimenti_collezione add constraint movimenti_collezione_pkey PRIMARY KEY (id);

alter table public.movimenti_collezione add constraint movimenti_collezione_tipo_evento_check CHECK ((tipo_evento = ANY (ARRAY['aggiunta'::text, 'rimozione'::text, 'vendita_scambio'::text, 'prezzo_automatico'::text, 'prezzo_manuale'::text, 'variazione_quantita'::text, 'correzione'::text])));

alter table public.ordini add constraint ordini_creato_da_fkey FOREIGN KEY (creato_da) REFERENCES auth.users(id);

alter table public.ordini add constraint ordini_pkey PRIMARY KEY (id);

alter table public.ordini add constraint ordini_preso_in_carico_da_fkey FOREIGN KEY (preso_in_carico_da) REFERENCES auth.users(id);

alter table public.ordini add constraint ordini_tipo_check CHECK ((tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_carte'::text, 'aggiungi_wishlist'::text, 'controlla_prezzi'::text, 'controlla_prezzi_wishlist'::text, 'controlla_prezzi_sealed'::text])));

alter table public.pending_requests add constraint pending_requests_pkey PRIMARY KEY (id);

alter table public.pending_requests add constraint pending_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

alter table public.pending_requests add constraint pending_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.pending_requests add constraint pending_requests_type_check CHECK ((type = ANY ('{photo_upload,password_reset,username_change,other,binder_nome,scaffale_nome}'::text[])));

alter table public.pending_requests add constraint pending_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table public.preferenze_utente add constraint preferenze_utente_binder_modalita_visualizzazione_check CHECK ((binder_modalita_visualizzazione = ANY (ARRAY['immagini'::text, 'elenco'::text])));

alter table public.preferenze_utente add constraint preferenze_utente_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.preferenze_utente add constraint preferenze_utente_pkey PRIMARY KEY (owner_id);

alter table public.prodotti_sealed add constraint prodotti_sealed_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.prodotti_sealed add constraint prodotti_sealed_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));

alter table public.richieste_scambio add constraint richieste_scambio_pkey PRIMARY KEY (id);

alter table public.richieste_scambio add constraint richieste_scambio_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES auth.users(id);

alter table public.richieste_scambio add constraint richieste_scambio_richiedente_id_fkey FOREIGN KEY (richiedente_id) REFERENCES auth.users(id);

alter table public.richieste_scambio add constraint richieste_scambio_stato_check CHECK ((stato = ANY (ARRAY['aperta'::text, 'chiusa'::text])));

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_carta_id_fkey FOREIGN KEY (carta_id) REFERENCES carte(id) ON DELETE SET NULL;

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_motivo_chiusura_check CHECK (((motivo_chiusura IS NULL) OR (motivo_chiusura = ANY (ARRAY['ho_cambiato_idea'::text, 'non_piu_disponibile'::text, 'accordo_non_concluso'::text, 'errore_prenotazione'::text, 'sostituito_altro_accordo'::text, 'intervento_amministrativo'::text]))));

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_pkey PRIMARY KEY (id);

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_prodotto_sealed_id_fkey FOREIGN KEY (prodotto_sealed_id) REFERENCES prodotti_sealed(id) ON DELETE SET NULL;

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES auth.users(id);

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_quantita_richiesta_check CHECK ((quantita_richiesta > 0));

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_richiedente_id_fkey FOREIGN KEY (richiedente_id) REFERENCES auth.users(id);

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_richiesta_id_fkey FOREIGN KEY (richiesta_id) REFERENCES richieste_scambio(id) ON DELETE CASCADE;

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_stato_riga_check CHECK ((stato_riga = ANY (ARRAY['in_attesa'::text, 'accettata'::text, 'rifiutata'::text, 'annullata'::text, 'conclusa'::text])));

alter table public.richieste_scambio_righe add constraint richieste_scambio_righe_un_solo_tipo CHECK (((((carta_id IS NOT NULL))::integer + ((prodotto_sealed_id IS NOT NULL))::integer) <= 1));

alter table public.scaffale_prodotti add constraint scaffale_prodotti_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.scaffale_prodotti add constraint scaffale_prodotti_owner_id_scaffale_id_prodotto_id_key UNIQUE (owner_id, scaffale_id, prodotto_id);

alter table public.scaffale_prodotti add constraint scaffale_prodotti_pkey PRIMARY KEY (id);

alter table public.scaffale_prodotti add constraint scaffale_prodotti_prodotto_id_fkey FOREIGN KEY (prodotto_id) REFERENCES prodotti_sealed(id) ON DELETE CASCADE;

alter table public.scaffale_prodotti add constraint scaffale_prodotti_scaffale_id_fkey FOREIGN KEY (scaffale_id) REFERENCES scaffali(id) ON DELETE CASCADE;

alter table public.scaffali add constraint scaffali_nome_stato_check CHECK ((nome_stato = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.scaffali add constraint scaffali_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.scaffali add constraint scaffali_pkey PRIMARY KEY (id);

alter table public.scaffali add constraint scaffali_stato_pubblicazione_check CHECK ((stato_pubblicazione = ANY (ARRAY['privato'::text, 'in_approvazione'::text, 'pubblico'::text])));

alter table public.scaffali add constraint scaffali_tipo_check CHECK ((tipo = ANY (ARRAY['libero'::text, 'vetrina'::text, 'scambio'::text])));

alter table public.segnalazioni_bug add constraint segnalazioni_bug_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.segnalazioni_bug add constraint segnalazioni_bug_pkey PRIMARY KEY (id);

alter table public.segnalazioni_chat add constraint segnalazioni_chat_conversazione_id_fkey FOREIGN KEY (conversazione_id) REFERENCES conversazioni(id) ON DELETE CASCADE;

alter table public.segnalazioni_chat add constraint segnalazioni_chat_pkey PRIMARY KEY (id);

alter table public.segnalazioni_chat add constraint segnalazioni_chat_segnalato_da_fkey FOREIGN KEY (segnalato_da) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.set_carte add constraint set_carte_numero_check CHECK ((numero > 0));

alter table public.set_carte add constraint set_carte_pkey PRIMARY KEY (sigla, numero, variante);

alter table public.set_carte add constraint set_carte_sigla_fkey FOREIGN KEY (sigla) REFERENCES set_espansioni(sigla) ON UPDATE CASCADE ON DELETE CASCADE;

alter table public.set_carte_ignorate add constraint set_carte_ignorate_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.set_carte_ignorate add constraint set_carte_ignorate_pkey PRIMARY KEY (owner_id, sigla, numero, variante);

alter table public.set_espansioni add constraint set_espansioni_carte_totali_check CHECK ((carte_totali > 0));

alter table public.set_espansioni add constraint set_espansioni_pkey PRIMARY KEY (sigla);

alter table public.set_espansioni add constraint set_espansioni_totale_coerente CHECK (((carte_base IS NULL) OR (carte_totali >= carte_base)));

alter table public.set_nascosti add constraint set_nascosti_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.set_nascosti add constraint set_nascosti_pkey PRIMARY KEY (owner_id, sigla);

alter table public.set_soglie_notificate add constraint set_soglie_notificate_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.set_soglie_notificate add constraint set_soglie_notificate_pkey PRIMARY KEY (owner_id, sigla, soglia);

alter table public.set_soglie_notificate add constraint set_soglie_notificate_soglia_check CHECK ((soglia = ANY (ARRAY[0, 25, 50, 75, 90, 99, 100])));

alter table public.storico_prezzi add constraint storico_prezzi_pkey PRIMARY KEY (id);

alter table public.storico_valore_collezione add constraint storico_valore_collezione_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.storico_valore_collezione add constraint storico_valore_collezione_pkey PRIMARY KEY (id);

alter table public.storico_valore_collezione add constraint storico_valore_uno_al_giorno UNIQUE (owner_id, giorno);

alter table public.traguardi_riscossi add constraint traguardi_riscossi_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.traguardi_riscossi add constraint traguardi_riscossi_owner_id_traguardo_id_key UNIQUE (owner_id, traguardo_id);

alter table public.traguardi_riscossi add constraint traguardi_riscossi_pkey PRIMARY KEY (id);

alter table public.ultima_visita add constraint ultima_visita_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.ultima_visita add constraint ultima_visita_pkey PRIMARY KEY (owner_id);

alter table public.user_media add constraint user_media_binder_id_fkey FOREIGN KEY (binder_id) REFERENCES binders(id) ON DELETE CASCADE;

alter table public.user_media add constraint user_media_binder_o_scaffale_non_entrambi CHECK (((binder_id IS NULL) OR (scaffale_id IS NULL)));

alter table public.user_media add constraint user_media_pkey PRIMARY KEY (id);

alter table public.user_media add constraint user_media_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

alter table public.user_media add constraint user_media_scaffale_id_fkey FOREIGN KEY (scaffale_id) REFERENCES scaffali(id) ON DELETE CASCADE;

alter table public.user_media add constraint user_media_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'default'::text])));

alter table public.user_media add constraint user_media_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.user_media add constraint user_media_user_binder_slot_uniq UNIQUE (user_id, binder_id, slot);

alter table public.user_media add constraint user_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table public.wishlist add constraint wishlist_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.wishlist add constraint wishlist_pkey PRIMARY KEY (id);

alter table public.wishlist_sealed add constraint wishlist_sealed_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table public.wishlist_sealed add constraint wishlist_sealed_pkey PRIMARY KEY (id);

alter table public.work_in_progress add constraint work_in_progress_attivato_da_fkey FOREIGN KEY (attivato_da) REFERENCES auth.users(id);

alter table public.work_in_progress add constraint work_in_progress_messaggio_check CHECK ((messaggio = ANY (ARRAY['Un Ditto ha copiato qualche impostazione di troppo. Stiamo sistemando.'::text, 'Il Professor Oak sta facendo un controllo qualità. Torniamo presto.'::text, 'Team Rocket ha temporaneamente preso possesso di questa pagina. Stiamo recuperando tutto.'::text, 'Porygon sta aggiornando questa funzione. Nessun Pokémon è stato danneggiato.'::text, 'Questa funzione è in evoluzione. Torna a trovarci tra poco.'::text])));

alter table public.work_in_progress add constraint work_in_progress_pkey PRIMARY KEY (id);

alter table public.work_in_progress add constraint work_in_progress_target_tipo_check CHECK ((target_tipo = ANY (ARRAY['widget'::text, 'pagina'::text, 'binder_speciale'::text, 'funzione'::text])));

alter table public.work_in_progress add constraint work_in_progress_target_tipo_target_id_key UNIQUE (target_tipo, target_id);

alter table public.worker_presenza add constraint worker_presenza_pkey PRIMARY KEY (user_id);

alter table public.worker_presenza add constraint worker_presenza_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


-- ============================================================================
-- INDICI
-- ============================================================================

CREATE INDEX activity_log_user_idx ON public.activity_log USING btree (user_id, created_at DESC);

CREATE INDEX binder_carte_binder_id_idx ON public.binder_carte USING btree (binder_id);

CREATE INDEX binders_owner_id_idx ON public.binders USING btree (owner_id);

CREATE INDEX bustina_catalogo_rarita_attiva_idx ON public.bustina_catalogo USING btree (rarita) WHERE attiva;

CREATE INDEX idx_activity_log_aiuto_gruppo ON public.activity_log USING btree (action, user_id) WHERE (action = 'aiuto_gruppo'::text);

CREATE INDEX idx_carte_claim ON public.carte USING btree (stato, claimed_by, claimed_at);

CREATE INDEX idx_carte_lookup ON public.carte USING btree (owner_id, codice, lingua, condizione);

CREATE INDEX idx_carte_stato ON public.carte USING btree (stato);

CREATE INDEX idx_carte_ultimo_controllo ON public.carte USING btree (owner_id, stato, ultimo_controllo);

CREATE INDEX idx_coda_lavoro_creato_da ON public.coda_lavoro USING btree (creato_da);

CREATE INDEX idx_coda_lavoro_stato_creato ON public.coda_lavoro USING btree (stato, creato_il);

CREATE INDEX idx_correzioni_manuali_owner ON public.correzioni_manuali_carte USING btree (owner_id);

CREATE INDEX idx_inventario_owner_tipo ON public.inventario_ricompense USING btree (owner_id, tipo);

CREATE INDEX idx_messaggi_conversazione ON public.messaggi USING btree (conversazione_id, creato_il);

CREATE INDEX idx_movimenti_collezione_owner_data ON public.movimenti_collezione USING btree (owner_id, avvenuto_il DESC);

CREATE INDEX idx_movimenti_collezione_owner_tipo ON public.movimenti_collezione USING btree (owner_id, tipo_evento);

CREATE INDEX idx_prodotti_sealed_claim ON public.prodotti_sealed USING btree (stato, claimed_by, claimed_at);

CREATE INDEX idx_prodotti_sealed_owner ON public.prodotti_sealed USING btree (owner_id);

CREATE INDEX idx_prodotti_sealed_stato ON public.prodotti_sealed USING btree (stato);

CREATE INDEX idx_richieste_scambio_righe_accettate ON public.richieste_scambio_righe USING btree (carta_id, prodotto_sealed_id) WHERE (stato_riga = 'accettata'::text);

CREATE INDEX idx_richieste_scambio_righe_carta ON public.richieste_scambio_righe USING btree (carta_id) WHERE (carta_id IS NOT NULL);

CREATE INDEX idx_richieste_scambio_righe_prodotto ON public.richieste_scambio_righe USING btree (prodotto_sealed_id) WHERE (prodotto_sealed_id IS NOT NULL);

CREATE INDEX idx_richieste_scambio_righe_richiesta ON public.richieste_scambio_righe USING btree (richiesta_id);

CREATE INDEX idx_segnalazioni_conversazione ON public.segnalazioni_chat USING btree (conversazione_id);

CREATE INDEX idx_storico_prezzi_carta ON public.storico_prezzi USING btree (carta_id, registrato_il);

CREATE INDEX idx_storico_valore_owner_giorno ON public.storico_valore_collezione USING btree (owner_id, giorno DESC);

CREATE UNIQUE INDEX scaffali_owner_vetrina_uniq ON public.scaffali USING btree (owner_id) WHERE (tipo = 'vetrina'::text);

CREATE INDEX set_carte_cardmarket_id_idx ON public.set_carte USING btree (cardmarket_id) WHERE (cardmarket_id IS NOT NULL);

CREATE INDEX set_espansioni_data_uscita_idx ON public.set_espansioni USING btree (data_uscita DESC NULLS LAST);

CREATE UNIQUE INDEX user_media_user_scaffale_slot_uniq ON public.user_media USING btree (user_id, scaffale_id, slot) WHERE (scaffale_id IS NOT NULL);


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.achievement_catalogo enable row level security;

alter table public.achievement_sbloccati enable row level security;

alter table public.activity_log enable row level security;

alter table public.activity_log_accessi_duplicati_bak enable row level security;

alter table public.admin_audit_log enable row level security;

alter table public.binder_carte enable row level security;

alter table public.binders enable row level security;

alter table public.blocchi_chat enable row level security;

alter table public.bustina_carte_possedute enable row level security;

alter table public.bustina_catalogo enable row level security;

alter table public.bustina_polvere_doppione enable row level security;

alter table public.bustina_probabilita enable row level security;

alter table public.carte enable row level security;

alter table public.catalogo_ricompense enable row level security;

alter table public.chat_restrizioni_utente enable row level security;

alter table public.coda_lavoro enable row level security;

alter table public.coda_wishlist enable row level security;

alter table public.configurazione_app enable row level security;

alter table public.conversazioni enable row level security;

alter table public.correzioni_manuali_carte enable row level security;

alter table public.foto_carte enable row level security;

alter table public.inventario_ricompense enable row level security;

alter table public.location enable row level security;

alter table public.messaggi enable row level security;

alter table public.missioni_completate enable row level security;

alter table public.movimenti_collezione enable row level security;

alter table public.ordini enable row level security;

alter table public.pending_requests enable row level security;

alter table public.preferenze_utente enable row level security;

alter table public.prodotti_sealed enable row level security;

alter table public.profiles enable row level security;

alter table public.richieste_scambio enable row level security;

alter table public.richieste_scambio_righe enable row level security;

alter table public.scaffale_prodotti enable row level security;

alter table public.scaffali enable row level security;

alter table public.segnalazioni_bug enable row level security;

alter table public.segnalazioni_chat enable row level security;

alter table public.set_carte enable row level security;

alter table public.set_carte_ignorate enable row level security;

alter table public.set_espansioni enable row level security;

alter table public.set_nascosti enable row level security;

alter table public.set_soglie_notificate enable row level security;

alter table public.storico_prezzi enable row level security;

alter table public.storico_valore_collezione enable row level security;

alter table public.traguardi_riscossi enable row level security;

alter table public.ultima_visita enable row level security;

alter table public.user_media enable row level security;

alter table public.wishlist enable row level security;

alter table public.wishlist_sealed enable row level security;

alter table public.work_in_progress enable row level security;

alter table public.worker_presenza enable row level security;


-- ============================================================================
-- POLICY RLS (tabelle)
-- ============================================================================

create policy "chiunque autenticato legge il catalogo achievement" on public.achievement_catalogo as PERMISSIVE for SELECT to public using ((auth.role() = 'authenticated'::text));

create policy "utenti leggono i propri achievement sbloccati" on public.achievement_sbloccati as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "admin legge tutto il log attività" on public.activity_log as PERMISSIVE for SELECT to public using (is_admin());

create policy "utente crea le proprie voci di log" on public.activity_log as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));

create policy "utente legge le proprie voci di log" on public.activity_log as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));

create policy "solo admin legge il log admin" on public.admin_audit_log as PERMISSIVE for SELECT to public using (is_admin());

create policy "utenti gestiscono il proprio binder" on public.binder_carte as PERMISSIVE for ALL to public using ((auth.uid() = owner_id)) with check ((auth.uid() = owner_id));

create policy "utenti gestiscono i propri binder" on public.binders as PERMISSIVE for ALL to public using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy blocchi_select on public.blocchi_chat as PERMISSIVE for SELECT to public using ((auth.uid() = blocca_id));

create policy "admin vede tutte le carte bustina" on public.bustina_carte_possedute as PERMISSIVE for SELECT to public using (is_admin());

create policy "propria collezione bustina" on public.bustina_carte_possedute as PERMISSIVE for SELECT to public using ((owner_id = auth.uid()));

create policy "catalogo bustina in lettura" on public.bustina_catalogo as PERMISSIVE for SELECT to authenticated using (true);

create policy "polvere doppione in lettura" on public.bustina_polvere_doppione as PERMISSIVE for SELECT to authenticated using (true);

create policy "probabilita bustina in lettura" on public.bustina_probabilita as PERMISSIVE for SELECT to authenticated using (true);

create policy "propria collezione" on public.carte as PERMISSIVE for ALL to public using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy "chiunque autenticato legge il catalogo ricompense" on public.catalogo_ricompense as PERMISSIVE for SELECT to public using ((auth.role() = 'authenticated'::text));

create policy chat_restrizioni_admin_delete on public.chat_restrizioni_utente as PERMISSIVE for DELETE to public using (is_admin());

create policy chat_restrizioni_admin_insert on public.chat_restrizioni_utente as PERMISSIVE for INSERT to public with check (is_admin());

create policy chat_restrizioni_admin_select on public.chat_restrizioni_utente as PERMISSIVE for SELECT to public using (is_admin());

create policy chat_restrizioni_admin_update on public.chat_restrizioni_utente as PERMISSIVE for UPDATE to public using (is_admin()) with check (is_admin());

create policy chat_restrizioni_select_proprio on public.chat_restrizioni_utente as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "crea proprie richieste" on public.coda_lavoro as PERMISSIVE for INSERT to public with check ((creato_da = auth.uid()));

create policy "vede le proprie richieste" on public.coda_lavoro as PERMISSIVE for SELECT to public using ((creato_da = auth.uid()));

create policy "utenti aggiornano la propria coda_wishlist" on public.coda_wishlist as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_id));

create policy "utenti gestiscono la propria coda_wishlist" on public.coda_wishlist as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy "utenti inseriscono nella propria coda_wishlist" on public.coda_wishlist as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_id));

create policy "chiunque legge la configurazione" on public.configurazione_app as PERMISSIVE for SELECT to authenticated using (true);

create policy conversazioni_select on public.conversazioni as PERMISSIVE for SELECT to public using (((auth.uid() = owner_a) OR (auth.uid() = owner_b)));

create policy "owner elimina le proprie correzioni manuali" on public.correzioni_manuali_carte as PERMISSIVE for DELETE to public using ((owner_id = auth.uid()));

create policy "owner inserisce le proprie correzioni manuali" on public.correzioni_manuali_carte as PERMISSIVE for INSERT to public with check ((owner_id = auth.uid()));

create policy "owner legge le proprie correzioni manuali" on public.correzioni_manuali_carte as PERMISSIVE for SELECT to public using ((owner_id = auth.uid()));

create policy "utenti gestiscono le foto delle proprie carte" on public.foto_carte as PERMISSIVE for ALL to authenticated using ((auth.uid() = owner_id)) with check ((auth.uid() = owner_id));

create policy "utenti leggono le proprie ricompense" on public.inventario_ricompense as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "proprie location" on public.location as PERMISSIVE for ALL to public using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy messaggi_select on public.messaggi as PERMISSIVE for SELECT to public using (((auth.uid() IN ( SELECT conversazioni.owner_a
   FROM conversazioni
  WHERE (conversazioni.id = messaggi.conversazione_id)
UNION
 SELECT conversazioni.owner_b
   FROM conversazioni
  WHERE (conversazioni.id = messaggi.conversazione_id))) OR (is_admin() AND (EXISTS ( SELECT 1
   FROM segnalazioni_chat s
  WHERE (s.conversazione_id = messaggi.conversazione_id))))));

create policy "utenti leggono le proprie missioni completate" on public.missioni_completate as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "utenti leggono i propri movimenti collezione" on public.movimenti_collezione as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "utenti scrivono i propri movimenti collezione" on public.movimenti_collezione as PERMISSIVE for INSERT to public with check ((auth.uid() = owner_id));

create policy "utenti autenticati possono aggiornare ordini" on public.ordini as PERMISSIVE for UPDATE to authenticated using (true);

create policy "utenti autenticati possono creare ordini" on public.ordini as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = creato_da));

create policy "utenti autenticati possono leggere ordini" on public.ordini as PERMISSIVE for SELECT to authenticated using (true);

create policy "admin aggiorna le richieste" on public.pending_requests as PERMISSIVE for UPDATE to public using (is_admin());

create policy "admin vede tutte le richieste" on public.pending_requests as PERMISSIVE for SELECT to public using (is_admin());

create policy "utente crea le proprie richieste" on public.pending_requests as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));

create policy "utente vede le proprie richieste" on public.pending_requests as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));

create policy "utenti gestiscono le proprie preferenze" on public.preferenze_utente as PERMISSIVE for ALL to authenticated using ((auth.uid() = owner_id)) with check ((auth.uid() = owner_id));

create policy "propria collezione sealed" on public.prodotti_sealed as PERMISSIVE for ALL to public using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy "admin modifica i profili" on public.profiles as PERMISSIVE for UPDATE to public using (is_admin());

create policy "admin vede tutti i profili" on public.profiles as PERMISSIVE for SELECT to public using (is_admin());

create policy "utente vede il proprio profilo" on public.profiles as PERMISSIVE for SELECT to public using ((auth.uid() = id));

create policy "coinvolti leggono la propria richiesta" on public.richieste_scambio as PERMISSIVE for SELECT to public using (((auth.uid() = richiedente_id) OR (auth.uid() = proprietario_id) OR is_admin()));

create policy "coinvolti leggono le proprie righe" on public.richieste_scambio_righe as PERMISSIVE for SELECT to public using (((auth.uid() = richiedente_id) OR (auth.uid() = proprietario_id) OR is_admin()));

create policy "utenti gestiscono il proprio scaffale" on public.scaffale_prodotti as PERMISSIVE for ALL to public using ((auth.uid() = owner_id)) with check ((auth.uid() = owner_id));

create policy "utenti gestiscono i propri scaffali" on public.scaffali as PERMISSIVE for ALL to public using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy "admin legge tutte le segnalazioni" on public.segnalazioni_bug as PERMISSIVE for SELECT to public using (is_admin());

create policy "utenti inviano le proprie segnalazioni" on public.segnalazioni_bug as PERMISSIVE for INSERT to public with check ((auth.uid() = owner_id));

create policy segnalazioni_select on public.segnalazioni_chat as PERMISSIVE for SELECT to public using (((auth.uid() = segnalato_da) OR is_admin()));

create policy "admin aggiorna il catalogo set" on public.set_carte as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());

create policy "admin elimina dal catalogo set" on public.set_carte as PERMISSIVE for DELETE to authenticated using (is_admin());

create policy "admin inserisce nel catalogo set" on public.set_carte as PERMISSIVE for INSERT to authenticated with check (is_admin());

create policy "chiunque legge il catalogo set" on public.set_carte as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy "utenti aggiornano le proprie carte ignorate" on public.set_carte_ignorate as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_id));

create policy "utenti eliminano le proprie carte ignorate" on public.set_carte_ignorate as PERMISSIVE for DELETE to authenticated using ((auth.uid() = owner_id));

create policy "utenti inseriscono le proprie carte ignorate" on public.set_carte_ignorate as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_id));

create policy "utenti leggono le proprie carte ignorate" on public.set_carte_ignorate as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy "admin aggiorna le espansioni" on public.set_espansioni as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());

create policy "admin elimina le espansioni" on public.set_espansioni as PERMISSIVE for DELETE to authenticated using (is_admin());

create policy "admin inserisce le espansioni" on public.set_espansioni as PERMISSIVE for INSERT to authenticated with check (is_admin());

create policy "chiunque legge le espansioni" on public.set_espansioni as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy "utenti aggiornano i propri set nascosti" on public.set_nascosti as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_id));

create policy "utenti eliminano i propri set nascosti" on public.set_nascosti as PERMISSIVE for DELETE to authenticated using ((auth.uid() = owner_id));

create policy "utenti inseriscono i propri set nascosti" on public.set_nascosti as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_id));

create policy "utenti leggono i propri set nascosti" on public.set_nascosti as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy "utenti aggiornano le proprie soglie set" on public.set_soglie_notificate as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_id));

create policy "utenti eliminano le proprie soglie set" on public.set_soglie_notificate as PERMISSIVE for DELETE to authenticated using ((auth.uid() = owner_id));

create policy "utenti inseriscono le proprie soglie set" on public.set_soglie_notificate as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_id));

create policy "utenti leggono le proprie soglie set" on public.set_soglie_notificate as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy "utenti leggono il proprio storico prezzi" on public.storico_prezzi as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy storico_valore_aggiornamento_proprio on public.storico_valore_collezione as PERMISSIVE for UPDATE to public using ((auth.uid() = owner_id)) with check ((auth.uid() = owner_id));

create policy storico_valore_lettura_propria on public.storico_valore_collezione as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy storico_valore_scrittura_propria on public.storico_valore_collezione as PERMISSIVE for INSERT to public with check ((auth.uid() = owner_id));

create policy "utenti leggono i propri traguardi riscossi" on public.traguardi_riscossi as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "propria visita" on public.ultima_visita as PERMISSIVE for ALL to authenticated using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));

create policy "admin aggiorna tutti i media" on public.user_media as PERMISSIVE for UPDATE to public using (is_admin());

create policy "admin vede tutti i media" on public.user_media as PERMISSIVE for SELECT to public using (is_admin());

create policy "utente aggiorna sempre i propri media" on public.user_media as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "utente crea/aggiorna i propri media" on public.user_media as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));

create policy "utente vede i propri media" on public.user_media as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));

create policy "utenti aggiornano la propria wishlist" on public.wishlist as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_id));

create policy "utenti eliminano dalla propria wishlist" on public.wishlist as PERMISSIVE for DELETE to authenticated using ((auth.uid() = owner_id));

create policy "utenti inseriscono nella propria wishlist" on public.wishlist as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_id));

create policy "utenti leggono la propria wishlist" on public.wishlist as PERMISSIVE for SELECT to authenticated using ((auth.uid() = owner_id));

create policy "utenti aggiornano la propria wishlist sealed" on public.wishlist_sealed as PERMISSIVE for UPDATE to public using ((auth.uid() = owner_id));

create policy "utenti eliminano dalla propria wishlist sealed" on public.wishlist_sealed as PERMISSIVE for DELETE to public using ((auth.uid() = owner_id));

create policy "utenti inseriscono nella propria wishlist sealed" on public.wishlist_sealed as PERMISSIVE for INSERT to public with check ((auth.uid() = owner_id));

create policy "utenti leggono la propria wishlist sealed" on public.wishlist_sealed as PERMISSIVE for SELECT to public using ((auth.uid() = owner_id));

create policy "chiunque autenticato legge i work in progress" on public.work_in_progress as PERMISSIVE for SELECT to public using ((auth.role() = 'authenticated'::text));

create policy "solo admin scrive i work in progress" on public.work_in_progress as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());

create policy "propria presenza" on public.worker_presenza as PERMISSIVE for ALL to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));


-- ============================================================================
-- TRIGGER
-- ============================================================================

CREATE TRIGGER trg_binders_blocca_rinomina_diretta BEFORE UPDATE ON public.binders FOR EACH ROW EXECUTE FUNCTION _binders_blocca_rinomina_diretta();

CREATE TRIGGER trg_binders_forza_condivisione BEFORE INSERT OR UPDATE ON public.binders FOR EACH ROW EXECUTE FUNCTION _binders_forza_condivisione();

CREATE TRIGGER trg_carte_updated_at BEFORE UPDATE ON public.carte FOR EACH ROW EXECUTE FUNCTION aggiorna_updated_at();

CREATE TRIGGER trg_chat_restrizioni_traccia BEFORE INSERT OR UPDATE ON public.chat_restrizioni_utente FOR EACH ROW EXECUTE FUNCTION _chat_restrizioni_traccia_modifica();

CREATE TRIGGER trg_prodotti_sealed_updated_at BEFORE UPDATE ON public.prodotti_sealed FOR EACH ROW EXECUTE FUNCTION aggiorna_updated_at();

CREATE TRIGGER trg_storico_prezzo_carte AFTER INSERT OR UPDATE ON public.carte FOR EACH ROW EXECUTE FUNCTION _cardsync_registra_storico_prezzo();

CREATE TRIGGER trg_storico_prezzo_sealed AFTER INSERT OR UPDATE ON public.prodotti_sealed FOR EACH ROW EXECUTE FUNCTION _cardsync_registra_storico_prezzo();

CREATE TRIGGER trg_storico_prezzo_wishlist AFTER INSERT OR UPDATE ON public.wishlist FOR EACH ROW EXECUTE FUNCTION _cardsync_registra_storico_prezzo();

CREATE TRIGGER trg_traccia_prezzo_precedente BEFORE UPDATE ON public.carte FOR EACH ROW EXECUTE FUNCTION _cardsync_traccia_prezzo_precedente();

CREATE TRIGGER trg_traccia_prezzo_precedente_sealed BEFORE UPDATE ON public.prodotti_sealed FOR EACH ROW EXECUTE FUNCTION _cardsync_traccia_prezzo_precedente();

CREATE TRIGGER trg_traccia_prezzo_precedente_wishlist BEFORE UPDATE ON public.wishlist FOR EACH ROW EXECUTE FUNCTION _cardsync_traccia_prezzo_precedente();


-- ============================================================================
-- BUCKET STORAGE
-- ============================================================================

insert into storage.buckets (id, name, public) values ('bustina-assets', 'bustina-assets', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('bustina-immagini', 'bustina-immagini', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('bustina-quotes', 'bustina-quotes', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('bustina-testi', 'bustina-testi', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('default-assets', 'default-assets', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('foto-carte', 'foto-carte', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('immagini-carte', 'immagini-carte', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('immaginivisibili', 'immaginivisibili', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('user-media', 'user-media', false) on conflict (id) do nothing;


-- ============================================================================
-- POLICY STORAGE (storage.objects)
-- ============================================================================

create policy "Public read bustina-assets" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'bustina-assets'::text));

create policy "admin elimina file bustina" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = ANY (ARRAY['bustina-immagini'::text, 'bustina-testi'::text, 'bustina-assets'::text])) AND is_admin()));

create policy "admin legge tutti i file" on storage.objects as PERMISSIVE for SELECT to public using (((bucket_id = 'user-media'::text) AND is_admin()));

create policy "admin modifica file bustina" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = ANY (ARRAY['bustina-immagini'::text, 'bustina-testi'::text, 'bustina-assets'::text])) AND is_admin())) with check (((bucket_id = ANY (ARRAY['bustina-immagini'::text, 'bustina-testi'::text, 'bustina-assets'::text])) AND is_admin()));

create policy "admin scrive file bustina" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = ANY (ARRAY['bustina-immagini'::text, 'bustina-testi'::text, 'bustina-assets'::text])) AND is_admin()));

create policy "admin scrive immaginivisibili" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'immaginivisibili'::text) AND is_admin()));

create policy "admin sovrascrive immaginivisibili" on storage.objects as PERMISSIVE for UPDATE to public using (((bucket_id = 'immaginivisibili'::text) AND is_admin()));

create policy "chiunque legge le immagini carte (bucket pubblico)" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'immagini-carte'::text));

create policy "chiunque puo vedere le foto dettaglio (bucket pubblico)" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'foto-carte'::text));

create policy "lettura pubblica bustina-immagini" on storage.objects as PERMISSIVE for SELECT to anon, authenticated using ((bucket_id = 'bustina-immagini'::text));

create policy "lettura pubblica bustina-testi" on storage.objects as PERMISSIVE for SELECT to anon, authenticated using ((bucket_id = 'bustina-testi'::text));

create policy "lettura pubblica default-assets" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'default-assets'::text));

create policy "lettura pubblica immaginivisibili" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'immaginivisibili'::text));

create policy "utente carica i propri file" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "utente legge i propri file" on storage.objects as PERMISSIVE for SELECT to public using (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "utente sostituisce i propri file" on storage.objects as PERMISSIVE for UPDATE to public using (((bucket_id = 'user-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "utenti autenticati caricano immagini carte" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'immagini-carte'::text));

create policy "utenti autenticati leggono i file approvati altrui" on storage.objects as PERMISSIVE for SELECT to public using (((bucket_id = 'user-media'::text) AND (EXISTS ( SELECT 1
   FROM user_media m
  WHERE ((m.storage_path = objects.name) AND (m.status = 'approved'::text))))));

create policy "utenti autenticati sovrascrivono immagini carte" on storage.objects as PERMISSIVE for UPDATE to authenticated using ((bucket_id = 'immagini-carte'::text));

create policy "utenti caricano le proprie foto dettaglio" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'foto-carte'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "utenti eliminano le proprie foto dettaglio" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'foto-carte'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


-- ============================================================================
-- PERMESSI DI ESECUZIONE DELLE FUNZIONI (solo documentazione)
-- ============================================================================

-- _binders_blocca_rinomina_diretta() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- _binders_forza_condivisione() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- _cardsync_registra_storico_prezzo() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- _cardsync_traccia_prezzo_precedente() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- _chat_ha_link_esterno(p_testo text) → postgres=X/postgres

-- _chat_ha_parolacce(p_testo text) → postgres=X/postgres

-- _chat_restrizioni_traccia_modifica() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- _chat_utente_vietato(p_uid uuid) → postgres=X/postgres

-- _coda_carte_view_delete() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- _coda_carte_view_insert() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- _coda_carte_view_update() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- _rank_condizione(p_condizione text) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- _rank_integrita(p_integrita text) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- accetta_riga_richiesta(p_riga_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_ban_user(p_target uuid, p_until timestamp with time zone, p_reason text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_hard_delete_user(p_target uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_process_pending_request(p_request_id uuid, p_decisione text, p_payload jsonb) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_reset_password(p_target uuid, p_new_password text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_restore_user(p_target uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_revoke_sessions(p_target uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_soft_delete_user(p_target uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- admin_unban_user(p_target uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- aggiorna_updated_at() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- aggiorna_url_controllo_gruppo(p_id uuid, p_url text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- annulla_riga_richiesta(p_riga_id uuid, p_motivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- apri_bustina(p_rarita_forzata text) → postgres=X/postgres, authenticated=X/postgres

-- blocca_utente(p_bloccato_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- bustine_stato() → postgres=X/postgres, authenticated=X/postgres

-- completa_lavoro(p_id bigint, p_esito jsonb, p_errore_msg text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- completa_riga_coda_carte(p_riga_coda_id uuid, p_nome text, p_codice text, p_location text, p_qty integer, p_lingua text, p_condizione text, p_url text, p_prezzo numeric, p_note text, p_immagine text, p_tipo text, p_destinazione text, p_prezzo_obiettivo numeric) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- concludi_riga_richiesta(p_riga_id uuid, p_location_scelta text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- conta_carte_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- conta_lavoro_pendente(p_user_id uuid, p_aiuta_gruppo boolean, p_tipi text[]) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- conta_prodotti_sealed_da_controllare_gruppo(p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- handle_new_user() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- handle_password_verification_attempt(event jsonb) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- imposta_colore_cornice(p_principale text, p_secondario text) → postgres=X/postgres, authenticated=X/postgres

-- imposta_nickname(p_nickname text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- invia_messaggio(p_conversazione_id uuid, p_testo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- invia_richiesta_scambio(p_proprietario_id uuid, p_righe jsonb) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- is_admin() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_binder_id_owner(p_owner_id uuid, p_tipo text, p_location_valore text) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_binder_pubblico(p_binder_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_binder_pubblico_info(p_binder_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_card_back_approvata(p_owner_id uuid, p_binder_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_colore_cornice_pubblico(p_owner_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_contributi_gruppo() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- leggi_media_binder_pubblico(p_binder_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_scaffale_pubblico(p_scaffale_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_scaffale_pubblico_info(p_scaffale_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_scambio_condiviso(p_owner_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- leggi_sealed_condiviso(p_owner_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_stato_claim_gruppo(p_soglia_minuti integer) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- leggi_variazioni_da(p_da timestamp with time zone) → postgres=X/postgres, authenticated=X/postgres

-- leggi_wishlist_condivisa(p_owner_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- leggi_wishlist_sealed_condivisa(p_owner_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- log_admin_action(p_action text, p_target uuid, p_details jsonb) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- ottieni_nicknames(p_owner_ids uuid[]) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- ottieni_o_crea_conversazione(p_altro_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- polvere_saldo() → postgres=X/postgres, authenticated=X/postgres

-- pulisci_storico_prezzi() → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- reclama_carte_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_location text[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- reclama_lavoro(p_user_id uuid, p_dispositivo text, p_aiuta_gruppo boolean, p_lotto_size integer, p_tipi text[]) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- reclama_prodotti_sealed_per_controllo_prezzi(p_user_id uuid, p_owner_id_richiesto uuid, p_solo_proprie boolean, p_filtro_scaffali uuid[], p_solo_vecchie boolean, p_giorni_minimi integer, p_lotto_size integer) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- registra_apertura_binder_pubblico(p_binder_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- registra_apertura_scaffale_pubblico(p_scaffale_id uuid) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- registra_visita(p_pausa_ore numeric) → postgres=X/postgres, authenticated=X/postgres

-- request_password_reset(p_username text) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- rifiuta_riga_richiesta(p_riga_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- rilascia_claim_controllo_prezzi(p_dispositivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- rilascia_claim_controllo_prezzi_sealed(p_dispositivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- rinomina_location(p_da text, p_a text) → postgres=X/postgres, authenticated=X/postgres

-- riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- riscatta_traguardo(p_traguardo_id text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- rls_auto_enable() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- sblocca_riga_richiesta(p_riga_id uuid, p_motivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- sblocca_utente(p_bloccato_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- segna_controllata_gruppo(p_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- segna_controllata_gruppo_sealed(p_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- segna_letti_conversazione(p_conversazione_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- segnala_conversazione(p_conversazione_id uuid, p_motivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- set_carte_conteggi() → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres

-- sposta_riga_in_correzione_manuale(p_riga_id bigint, p_errore_msg text, p_opzioni jsonb) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- tagga_dispositivo_claim_gruppo(p_ids uuid[], p_dispositivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- trova_match_scambio_wishlist(p_owner_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- trova_match_scambio_wishlist_sealed(p_owner_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- trova_match_wishlist_scambio(p_owner_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- trova_match_wishlist_scambio_sealed(p_owner_id uuid) → postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres

-- verifica_versione_minima(p_versione_client text) → =X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres
