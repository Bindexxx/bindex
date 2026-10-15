-- ============================================================================
-- 109 — PUNTO 26, DOPO LA PUBBLICAZIONE: versione minima 5.20, pulizia,
--       vincolo "niente location in ordini.parametri"
--
-- QUANDO: SOLO dopo che sql/108 è stato eseguito E la PR del punto 26 è unita
-- e pubblicata (releases/latest-version.txt online = 5.20). Prima no:
-- - la versione minima bloccherebbe chi non ha ancora potuto aggiornare;
-- - il vincolo farebbe fallire gli ordini creati dal sito vecchio.
--
-- COSA FA
-- 1. versione_minima = 5.20: un PC con la 5.18/5.19 che prendesse un ordine
--    creato dal sito nuovo (location solo nella tabella privata) non le
--    vedrebbe e controllerebbe TUTTE le carte di chi l'ha chiesto. Con la
--    5.20 il filtro lo applica il database.
-- 2. Le location scritte dal sito vecchio tra sql/108 e la pubblicazione
--    passano nella tabella privata e vengono tolte da ordini.parametri (stesso
--    passaggio di sql/108).
-- 3. Vincolo: ordini.parametri non può più contenere "locations". Se in
--    futuro qualcosa ce le rimette, l'inserimento fallisce subito invece di
--    renderle leggibili a tutti (decisione di Claudio, 2026-10-15: 26b).
--
-- Nessun DROP/REVOKE/DELETE: eseguibile anche via connettore.
-- PER ANNULLARE: sql/109_ordini_senza_location_versione_5_20_ROLLBACK.sql
-- ============================================================================

-- ── 1. VERSIONE MINIMA ─────────────────────────────────────────────────────
insert into public.configurazione_app (chiave, valore)
values ('versione_minima', '5.20')
on conflict (chiave) do update
  set valore = excluded.valore,
      aggiornato_il = now();

-- ── 2. LOCATION RIMASTE → TABELLA PRIVATA ──────────────────────────────────
insert into public.ordini_parametri_privati (ordine_id, owner_id, locations)
select o.id, o.creato_da, array(select jsonb_array_elements_text(o.parametri -> 'locations'))
from public.ordini o
where o.tipo = 'controlla_prezzi'
  and o.creato_da is not null
  and jsonb_typeof(o.parametri -> 'locations') = 'array'
on conflict (ordine_id) do nothing;

update public.ordini
set parametri = parametri - 'locations'
where parametri ? 'locations';

-- ── 3. VINCOLO ─────────────────────────────────────────────────────────────
alter table public.ordini
  add constraint ordini_parametri_senza_location
  check (parametri is null or not (parametri ? 'locations'));

-- ── VERIFICHE ──────────────────────────────────────────────────────────────
-- attesi: versione_minima 5.20 | 0 ordini con location | vincolo presente
select (select valore from public.configurazione_app where chiave = 'versione_minima') as versione_minima,
       (select count(*) from public.ordini where parametri ? 'locations') as ordini_con_location,
       (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.ordini'::regclass and conname = 'ordini_parametri_senza_location') as vincolo;
