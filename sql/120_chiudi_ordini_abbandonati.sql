-- ============================================================================
-- 120 — ORDINI ABBANDONATI CHIUSI PER TUTTI (estensione 5.40)
-- Piano 2026-10-23, Fase 4.4 (D6).
--
-- Letto sul DB LIVE il 2026-10-24:
-- - ordini: policy UPDATE "modifica se in attesa o preso in carico da me" →
--   l'estensione (_chiudiOrdiniAbbandonati, background.js) chiude solo gli
--   ordini presi dal PROPRIO utente. Un ordine preso dal PC di un altro che
--   si spegne resta "in corso" finché quel PC non riapre l'estensione.
-- - Nessun trigger su ordini, ordini non è in supabase_realtime (aggiungere
--   una colonna non cambia nulla per il sito, che legge solo colonne scelte).
-- - Un ordine lungo (637 righe di wishlist ≈ 4-5 ore) veniva chiuso dopo 6 ore
--   dall'INIZIO anche se un PC ci stava ancora lavorando (24/10: chiuso alle
--   17:57). Per questo la soglia ora parte dall'ultima attività: ogni lotto
--   prenotato per un ordine scrive ordini.attivo_il (qui per la wishlist,
--   in sql/123 per le carte).
--
-- COSA FA
-- 1. ordini + attivo_il (vuota).
-- 2. chiudi_ordini_abbandonati(): SECURITY DEFINER, chiude come 'errore' gli
--    ordini 'in_corso' di CHIUNQUE senza attività da più di 6 ore (stessa
--    soglia di _ORE_ORDINE_ABBANDONATO). Restituisce quanti ne ha chiusi.
--    Senza utente loggato non fa nulla.
-- 3. reclama_wishlist_per_controllo_prezzi (sql/118) segna l'attività
--    dell'ordine a ogni lotto. Per il resto identica.
-- Permessi: authenticated (sezione 4, REVOKE da eseguire a mano).
-- Ritorno indietro: 120_..._ROLLBACK.sql.
-- ============================================================================

-- ── 1. ATTIVITÀ DELL'ORDINE ──────────────────────────────────────────────────
alter table public.ordini add column if not exists attivo_il timestamptz;

-- ── 2. CHIUSURA ──────────────────────────────────────────────────────────────
create or replace function public.chiudi_ordini_abbandonati()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update ordini
     set stato = 'errore',
         errore_msg = 'Interrotto: nessun PC ci ha lavorato per più di 6 ore.',
         completato_il = now()
   where stato = 'in_corso'
     and greatest(coalesce(preso_in_carico_il, creato_il), coalesce(attivo_il, preso_in_carico_il, creato_il))
         < now() - interval '6 hours';
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- ── 3. WISHLIST: ATTIVITÀ A OGNI LOTTO ───────────────────────────────────────
create or replace function public.reclama_wishlist_per_controllo_prezzi(p_ordine_id uuid default null, p_lotto_size integer default 3)
returns table (id uuid, owner_id uuid, nome text, codice text, url text, lingua text, condizione text, prezzo numeric, ultimo_controllo timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_inizio timestamptz; -- inizio dell'ordine (null senza ordine)
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_lotto integer := least(greatest(coalesce(p_lotto_size, 3), 1), 10);
begin
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if p_ordine_id is null then
    v_owner := v_uid;
  else
    select o.creato_da, coalesce(o.preso_in_carico_il, o.creato_il) into v_owner, v_inizio
      from ordini o
     where o.id = p_ordine_id and o.tipo = 'controlla_prezzi_wishlist' and o.stato = 'in_corso';
    if v_owner is null then
      return; -- ordine non più in corso (finito, annullato) o non wishlist: niente
    end if;
    update ordini set attivo_il = now() where ordini.id = p_ordine_id; -- sql/120: l'ordine è vivo
  end if;

  return query
  with reclamate as (
    update wishlist w
       set claimed_by = v_uid, claimed_at = now()
     where w.id in (
       select k.id from wishlist k
        where k.owner_id = v_owner
          and k.url like '%/Singles/%'
          and (v_inizio is null or k.ultimo_controllo is null or k.ultimo_controllo < v_inizio)
          and (k.claimed_by is null or k.claimed_by = v_uid or k.claimed_at < v_soglia_claim)
        order by k.ultimo_controllo asc nulls first
        limit v_lotto
        for update skip locked
     )
    returning w.id, w.owner_id, w.nome, w.codice, w.url, w.lingua, w.condizione, w.prezzo, w.ultimo_controllo
  )
  select r.id, r.owner_id, r.nome, r.codice, r.url, r.lingua, r.condizione, r.prezzo, r.ultimo_controllo
    from reclamate r;
end;
$function$;

-- ── 4. PERMESSI (REVOKE: da eseguire a mano, il connettore li annulla) ───────
revoke execute on function public.chiudi_ordini_abbandonati() from public, anon;
grant execute on function public.chiudi_ordini_abbandonati() to authenticated, service_role;
