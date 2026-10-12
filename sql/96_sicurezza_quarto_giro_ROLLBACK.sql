-- ============================================================================
-- 96 — ROLLBACK: riporta tutto com'era il 2026-10-12 PRIMA della 96
-- (definizioni copiate dal DB live letto il 2026-10-12).
-- ============================================================================

begin;

-- A) vincoli sui link
alter table public.carte drop constraint if exists carte_url_cardmarket;
alter table public.prodotti_sealed drop constraint if exists prodotti_sealed_url_cardmarket;
alter table public.wishlist drop constraint if exists wishlist_url_cardmarket;
alter table public.correzioni_manuali_carte drop constraint if exists correzioni_url_diretto_cardmarket;

-- B) RPC del controllo di gruppo (versioni SQL originali)
create or replace function public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text)
returns void language sql security definer set search_path = public as $$
  update carte
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$$;

create or replace function public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text)
returns void language sql security definer set search_path = public as $$
  update prodotti_sealed
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$$;

-- C) trigger della vista coda_carte
create or replace function public._coda_carte_view_insert()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- D) registro admin (versione originale, senza controllo admin)
create or replace function public.log_admin_action(p_action text, p_target uuid, p_details jsonb default null::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target, p_details);
end;
$$;

-- E) reset password (versione originale, con l'errore oltre le 3 richieste/ora)
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

  if v_recenti >= 3 then
    raise exception 'Troppe richieste per questo utente, riprova più tardi.';
  end if;

  insert into public.pending_requests (user_id, type, status, payload)
  values (v_user_id, 'password_reset', 'pending', jsonb_build_object('richiesto_il', now()));
end;
$$;

-- F) bucket: nessun limite di tipo/dimensione (com'era)
update storage.buckets set allowed_mime_types = null, file_size_limit = null
 where id in ('immagini-carte', 'user-media');

-- G) foto-carte: elenco pubblico come prima
drop policy if exists "utenti elencano le proprie foto dettaglio" on storage.objects;
drop policy if exists "chiunque puo vedere le foto dettaglio (bucket pubblico)" on storage.objects;
create policy "chiunque puo vedere le foto dettaglio (bucket pubblico)" on storage.objects
    for select to public
    using (bucket_id = 'foto-carte');

commit;
