-- ============================================================================
-- 96 — SICUREZZA, QUARTO GIRO (audit 2026-10-12)
-- Scritto partendo dalle definizioni LIVE lette il 2026-10-12 (progetto
-- xpfibrzsffurdlypxnrw, connettore in sola lettura). NON ancora eseguito:
-- va lanciato da Claudio (SQL editor) oppure da Claude con OK esplicito.
--
-- Contesto: la coda carte e il controllo prezzi restano CONDIVISI (decisione
-- 2026-10-01): qui non si toglie nessuna funzione di gruppo, si chiude solo
-- la possibilita' di scrivere LINK arbitrari nei dati degli altri e qualche
-- dettaglio minore.
--
-- COSA FA (una transazione: o tutto o niente):
--  A) Link: carte.url, prodotti_sealed.url, wishlist.url e
--     correzioni_manuali_carte.url_diretto accettano solo vuoto/'#' oppure un
--     indirizzo https://www.cardmarket.com/... senza spazi, virgolette o < >.
--     Prima chiunque fosse loggato poteva mettere QUALSIASI testo nel link di
--     una carta altrui (aggiorna_url_controllo_gruppo non controllava nulla):
--     il link finisce nella pagina del proprietario e viene aperto dalle
--     estensioni che aiutano il gruppo. Verificato il 2026-10-12: tutte le
--     1159 carte con link sono gia' su www.cardmarket.com, quindi nessun dato
--     esistente viola la regola. Vincoli NOT VALID: valgono per ogni nuova
--     scrittura; la verifica sui dati vecchi e' la query in fondo.
--  B) aggiorna_url_controllo_gruppo / _sealed: stessa regola, con un errore
--     chiaro invece del vincolo violato.
--  C) Vista coda_carte (coda condivisa): url_diretto scritto da chiunque nella
--     riga di un altro ora deve rispettare la stessa regola (trigger insert e
--     update). L'estensione apre url_diretto per leggere la carta.
--  D) log_admin_action: solo un admin puo' scrivere nel registro admin (prima
--     qualunque utente loggato poteva aggiungere voci false).
--  E) request_password_reset: oltre le 3 richieste/ora non da' piu' errore ma
--     esce in silenzio. L'errore compariva SOLO per i nomi utente esistenti:
--     permetteva di scoprire quali username esistono.
--  F) Storage: bucket immagini-carte (scrivibile da ogni utente loggato, per
--     scelta) e user-media accettano solo immagini fino a 5 MB. Verificato:
--     i 520 file attuali di immagini-carte sono tutti immagini, il piu' grande
--     e' 83 KB.
--  G) Storage foto-carte: niente piu' ELENCO pubblico dei file (chiunque,
--     anche senza login, poteva elencare le foto e gli id utente nei nomi
--     delle cartelle). Le foto restano visibili dal loro indirizzo pubblico,
--     come prima; ognuno elenca solo la propria cartella.
--
-- PER ANNULLARE: sql/96_sicurezza_quarto_giro_ROLLBACK.sql
-- ============================================================================

begin;

-- ── A) Vincoli sui link (solo nuove scritture: NOT VALID) ─────────────────
alter table public.carte add constraint carte_url_cardmarket
    check (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']')) not valid;
alter table public.prodotti_sealed add constraint prodotti_sealed_url_cardmarket
    check (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']')) not valid;
alter table public.wishlist add constraint wishlist_url_cardmarket
    check (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']')) not valid;
alter table public.correzioni_manuali_carte add constraint correzioni_url_diretto_cardmarket
    check (url_diretto is null or url_diretto in ('', '#') or (url_diretto ~ '^https://(www\.)?cardmarket\.com/' and url_diretto !~ '[[:space:]"<>'']')) not valid;

-- ── B) RPC del controllo di gruppo: errore chiaro se il link non e' Cardmarket
create or replace function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not (p_url is null or p_url in ('', '#') or (p_url ~ '^https://(www\.)?cardmarket\.com/' and p_url !~ '[[:space:]"<>'']')) then
        raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
    end if;
    update carte
    set url = p_url
    where id = p_id
      and stato = 'collezione';
end;
$$;

create or replace function public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not (p_url is null or p_url in ('', '#') or (p_url ~ '^https://(www\.)?cardmarket\.com/' and p_url !~ '[[:space:]"<>'']')) then
        raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
    end if;
    update prodotti_sealed
    set url = p_url
    where id = p_id
      and stato = 'collezione';
end;
$$;

-- ── C) Vista coda_carte: url_diretto solo Cardmarket (insert e update) ────
create or replace function public._coda_carte_view_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'owner_id deve corrispondere all''utente autenticato';
  end if;
  if not (new.url_diretto is null or new.url_diretto in ('', '#') or (new.url_diretto ~ '^https://(www\.)?cardmarket\.com/' and new.url_diretto !~ '[[:space:]"<>'']')) then
    raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
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
      'prezzo_obiettivo', new.prezzo_obiettivo,
      'sigillata_originale', coalesce(new.sigillata_originale, false),
      'integrita_packaging', new.integrita_packaging
    ))
  );
  return new;
end;
$$;

create or replace function public._coda_carte_view_update()
returns trigger language plpgsql security definer set search_path = public as $$
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
$$;

-- ── D) Registro admin: solo admin ─────────────────────────────────────────
create or replace function public.log_admin_action(p_action text, p_target uuid, p_details jsonb default null::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo un admin puo'' scrivere nel registro admin';
  end if;
  insert into public.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target, p_details);
end;
$$;

-- ── E) Reset password: niente errore che riveli quali username esistono ───
create or replace function public.request_password_reset(p_username text)
returns void language plpgsql security definer set search_path = public as $$
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

  -- Limite invariato (3/ora), ma in silenzio: prima l'errore compariva solo
  -- per gli username esistenti.
  if v_recenti >= 3 then
    return;
  end if;

  insert into public.pending_requests (user_id, type, status, payload)
  values (v_user_id, 'password_reset', 'pending', jsonb_build_object('richiesto_il', now()));
end;
$$;

-- ── F) Storage: solo immagini, massimo 5 MB ───────────────────────────────
-- (Se l'SQL editor non ha i permessi su storage.buckets, stessa impostazione
-- dalla dashboard: Storage > bucket > Edit bucket > Allowed MIME types / size.)
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
       file_size_limit = 5242880
 where id in ('immagini-carte', 'user-media');

-- ── G) foto-carte: niente elenco pubblico, ognuno elenca la propria cartella
drop policy if exists "chiunque puo vedere le foto dettaglio (bucket pubblico)" on storage.objects;
create policy "utenti elencano le proprie foto dettaglio" on storage.objects
    for select to authenticated
    using (bucket_id = 'foto-carte' and (storage.foldername(name))[1] = (auth.uid())::text);

commit;

-- ============================================================================
-- VERIFICA (dopo l'esecuzione, tutte devono dare 0 righe o i valori attesi)
-- ============================================================================
-- 1) dati vecchi che violerebbero i nuovi vincoli (atteso: 0)
-- select 'carte' t, count(*) from carte where not (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']'))
-- union all select 'prodotti_sealed', count(*) from prodotti_sealed where not (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']'))
-- union all select 'wishlist', count(*) from wishlist where not (url is null or url in ('', '#') or (url ~ '^https://(www\.)?cardmarket\.com/' and url !~ '[[:space:]"<>'']'));
-- 2) permessi invariati sulle funzioni toccate (atteso: anon false, authenticated true)
-- select proname, has_function_privilege('anon', oid, 'EXECUTE') anon, has_function_privilege('authenticated', oid, 'EXECUTE') auth, prosecdef
--   from pg_proc where pronamespace = 'public'::regnamespace and proname in ('aggiorna_url_controllo_gruppo','aggiorna_url_controllo_gruppo_sealed','log_admin_action','_coda_carte_view_insert','_coda_carte_view_update');
-- (request_password_reset resta eseguibile anche da anon: serve alla pagina di login.)
-- 3) bucket
-- select id, allowed_mime_types, file_size_limit from storage.buckets where id in ('immagini-carte','user-media');
-- 4) policy foto-carte
-- select policyname, cmd, roles, qual from pg_policies where schemaname = 'storage' and qual like '%foto-carte%';
