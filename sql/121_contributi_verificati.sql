-- ============================================================================
-- 121 — CONTRIBUTI AL GRUPPO VERIFICATI (estensione 5.40)
-- Piano 2026-10-23, Fase 4.5 (B11).
--
-- Letto sul DB LIVE il 2026-10-24:
-- - registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text):
--   scarta solo le righe proprie; non controlla che la riga esista né che
--   l'abbia lavorata chi chiama, e non evita i doppioni (prova annullata T2
--   del 23/10: stessa riga due volte + riga inventata = 3 contributi falsi).
-- - activity_log: policy INSERT "utente crea le proprie voci di log"
--   (user_id = auth.uid()) → chiunque poteva anche scriversi da solo righe
--   'aiuto_gruppo' senza passare dalla funzione. Il sito non scrive mai
--   'aiuto_gruppo' (solo leggi_contributi_gruppo le legge).
-- - Oggi: 107 contributi 'coda_carte' e 73 'controllo_prezzi_wishlist',
--   nessun doppione.
-- - Chi chiama la funzione e quando (estensione 5.39):
--   coda_carte → dopo completa_riga_coda_carte (riga 'completato', claimed_by
--   = chi la lavora); controllo prezzi carte/wishlist/sealed → durante il
--   lotto, quando la riga è prenotata da chi controlla (claimed_by, claimed_at
--   del lotto). ultimo_controllo NON si usa: viene scritto in parallelo e può
--   arrivare dopo.
--
-- COSA FA
-- 1. Indice unico parziale: niente doppioni (vedi sotto).
-- 2. registra_aiuto_gruppo conta solo il lavoro vero:
--    - 'coda_carte': la riga di coda_lavoro esiste, è completata, presa in
--      carico da chi chiama e creata dal proprietario indicato;
--    - 'controllo_prezzi' / '_wishlist' / '_sealed': la carta/riga/prodotto
--      è del proprietario indicato ed è prenotata da chi chiama da meno di
--      15 minuti;
--    - tipi sconosciuti: niente.
--    Un controllo prezzi conta una volta per carta al giorno (details.giorno):
--    la stessa carta controllata di nuovo domani è un nuovo aiuto.
--    Doppione = stessa persona, stessa riga, stesso tipo, stesso giorno. Le
--    righe di oggi non hanno 'giorno': restano valide così, nessun dato toccato.
-- 3. activity_log: le righe 'aiuto_gruppo' si scrivono solo dalla funzione.
-- Ritorno indietro: 121_..._ROLLBACK.sql.
-- ============================================================================

-- ── 1. NIENTE DOPPIONI ───────────────────────────────────────────────────────
create unique index if not exists activity_log_aiuto_gruppo_unico
  on public.activity_log (user_id, (details ->> 'riga_id'), (details ->> 'tipo'), (coalesce(details ->> 'giorno', '')))
  where action = 'aiuto_gruppo';


-- ── 2. FUNZIONE ──────────────────────────────────────────────────────────────
create or replace function public.registra_aiuto_gruppo(p_riga_id text, p_owner_riga uuid, p_tipo text default 'coda_carte')
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_tipo text := coalesce(p_tipo, 'coda_carte');
  v_recente timestamptz := now() - interval '15 minutes';
  v_ok boolean := false;
begin
  if v_io is null then
    return; -- non autenticato: niente da registrare
  end if;
  -- LAVORARE UNA PROPRIA RIGA NON E' UN CONTRIBUTO (regola invariata).
  if p_owner_riga is null or p_owner_riga = v_io or p_riga_id is null then
    return;
  end if;

  if v_tipo = 'coda_carte' then
    if p_riga_id ~ '^[0-9]{1,18}$' then
      select exists (
        select 1 from coda_lavoro c
         where c.id = p_riga_id::bigint
           and c.stato = 'completato'
           and c.claimed_by = v_io
           and c.creato_da = p_owner_riga
      ) into v_ok;
    end if;
  elsif v_tipo = 'controllo_prezzi' then
    select exists (
      select 1 from carte k
       where k.id::text = p_riga_id and k.owner_id = p_owner_riga
         and k.claimed_by = v_io and k.claimed_at > v_recente
    ) into v_ok;
  elsif v_tipo = 'controllo_prezzi_wishlist' then
    select exists (
      select 1 from wishlist w
       where w.id::text = p_riga_id and w.owner_id = p_owner_riga
         and w.claimed_by = v_io and w.claimed_at > v_recente
    ) into v_ok;
  elsif v_tipo = 'controllo_prezzi_sealed' then
    select exists (
      select 1 from prodotti_sealed s
       where s.id::text = p_riga_id and s.owner_id = p_owner_riga
         and s.claimed_by = v_io and s.claimed_at > v_recente
    ) into v_ok;
  end if;

  if not v_ok then
    return; -- riga inesistente, non lavorata da chi chiama, o tipo sconosciuto
  end if;

  insert into activity_log (user_id, source, action, details)
  values (
    v_io,
    'estensione',
    'aiuto_gruppo',
    jsonb_build_object(
      'riga_id', p_riga_id,
      -- Serve a contare le PERSONE aiutate (vedi leggi_contributi_gruppo).
      'owner', p_owner_riga::text,
      'tipo', v_tipo
    ) || case when v_tipo = 'coda_carte' then '{}'::jsonb
              else jsonb_build_object('giorno', to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD')) end
  )
  on conflict (user_id, (details ->> 'riga_id'), (details ->> 'tipo'), (coalesce(details ->> 'giorno', '')))
     where action = 'aiuto_gruppo'
  do nothing;
end;
$function$;

-- ── 3. SCRITTURA DIRETTA: TUTTO TRANNE 'aiuto_gruppo' ────────────────────────
alter policy "utente crea le proprie voci di log" on public.activity_log
  with check ((( select auth.uid() as uid) = user_id) and action <> 'aiuto_gruppo');
