-- ============================================================================
-- 112 — PUNTO 28: ORDINI MODIFICABILI SOLO DA CHI LI PRENDE IN CARICO
-- (decisione di Claudio, 2026-10-15)
--
-- Letto sul DB LIVE il 2026-10-15 (pg_policies, role_table_grants):
-- - "utenti autenticati possono aggiornare ordini": UPDATE, using (true),
--   nessun with check → chiunque del gruppo poteva cambiare qualunque ordine,
--   anche tipo, creato_da e parametri.
-- - "utenti autenticati possono creare ordini": INSERT, check creato_da =
--   auth.uid() → si poteva creare un ordine già "completato" o già preso in
--   carico da qualcun altro.
-- - Permessi: anon e authenticated con TUTTI i privilegi sulla tabella (anon
--   bloccato solo dalle regole di riga).
-- Nel codice (estensione 5.18–5.20; il sito crea e legge soltanto):
--   a) presa in carico: pending → in_corso, preso_in_carico_da = chi prende
--      (background.js _controllaOrdini, filtro stato = 'pending');
--   b) chiusura del proprio ordine: stato, risultato | errore_msg,
--      completato_il (popup.js, aggiungi_wishlist_popup.js, background.js);
--   c) rimessa in attesa del proprio ordine: stato = 'pending',
--      preso_in_carico_da/il = null (popup.js _rimettiOrdineInAttesa,
--      aggiungi_wishlist_popup.js);
--   d) chiusura dei propri ordini abbandonati >6h (background.js).
--   Nessuno cancella ordini dal client; crea_ordine_controllo_prezzi
--   (sql/108) è SECURITY DEFINER e non dipende da queste regole.
--
-- COSA FA
-- 1. UPDATE: solo su ordini in attesa o presi in carico da chi modifica; dopo
--    la modifica l'ordine deve risultare preso da chi modifica, oppure di
--    nuovo in attesa e libero (copre a–d, niente altro).
-- 2. INSERT: solo ordini propri, in attesa, non presi, senza esito.
-- 3. Permessi: anon niente; authenticated solo SELECT, INSERT e UPDATE delle
--    6 colonne di stato (stato, preso_in_carico_da, preso_in_carico_il,
--    completato_il, risultato, errore_msg). tipo, creato_da, parametri,
--    creato_il e id non si possono più cambiare.
--
-- Regole modificate con ALTER POLICY (nessuna rimozione). Contiene REVOKE:
-- da eseguire nell'SQL editor di Supabase.
-- PER ANNULLARE: sql/112_ordini_regole_modifica_ROLLBACK.sql
-- ============================================================================

-- ── 1. MODIFICA ────────────────────────────────────────────────────────────
alter policy "utenti autenticati possono aggiornare ordini" on public.ordini
  using (stato = 'pending' or preso_in_carico_da = (select auth.uid()))
  with check (preso_in_carico_da = (select auth.uid())
              or (stato = 'pending' and preso_in_carico_da is null));
alter policy "utenti autenticati possono aggiornare ordini" on public.ordini
  rename to "ordini: modifica se in attesa o preso in carico da me";

-- ── 2. CREAZIONE ───────────────────────────────────────────────────────────
alter policy "utenti autenticati possono creare ordini" on public.ordini
  with check (creato_da = (select auth.uid())
              and stato = 'pending'
              and preso_in_carico_da is null
              and preso_in_carico_il is null
              and completato_il is null
              and risultato is null
              and errore_msg is null);
alter policy "utenti autenticati possono creare ordini" on public.ordini
  rename to "ordini: creazione solo propri e in attesa";

-- ── 3. PERMESSI ────────────────────────────────────────────────────────────
revoke all on table public.ordini from anon, authenticated;
grant select, insert on table public.ordini to authenticated;
grant update (stato, preso_in_carico_da, preso_in_carico_il, completato_il, risultato, errore_msg)
  on table public.ordini to authenticated;

-- ── VERIFICHE ──────────────────────────────────────────────────────────────
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'ordini' order by cmd;
-- attesi: anon nessuna riga; authenticated INSERT, SELECT a livello tabella
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as permessi_tabella
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'ordini' and grantee in ('anon', 'authenticated')
group by grantee;
-- attese: le 6 colonne di stato
select string_agg(column_name, ', ' order by column_name) as colonne_modificabili
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'ordini' and grantee = 'authenticated' and privilege_type = 'UPDATE';
