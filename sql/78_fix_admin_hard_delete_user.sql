-- ═══════════════════════════════════════════════════════════════════════
-- 78_fix_admin_hard_delete_user.sql — 2026-09-25
-- Rollback: 78_fix_admin_hard_delete_user_ROLLBACK.sql
--
-- PROBLEMA (verificato sul DB live, non dedotto dal codice):
-- la versione precedente NON poteva riuscire per nessun utente:
--   1. non cancellava public.profiles, ma profiles.id → auth.users è
--      NO ACTION: il "delete from auth.users" finale veniva sempre bloccato;
--   2. azzerava (set null) tre colonne NOT NULL: activity_log.user_id,
--      coda_lavoro.creato_da, coda_wishlist.owner_id → errore 23502;
--   3. ignorava 15 tabelle nate dopo (missioni, traguardi, inventario,
--      bustina, sealed, scaffali, scambi, wishlist_sealed, binder_carte,
--      achievement_sbloccati, segnalazioni_bug, worker_presenza…),
--      tutte NO ACTION verso auth.users.
-- Scoperto cancellando l'account di prova test1 (fatto a mano, stessa
-- logica di questo file).
--
-- REGOLA DELLA NUOVA VERSIONE (una riga per ciascuna delle 35 chiavi NO
-- ACTION verso auth.users, elenco preso da pg_constraint il 2026-09-25):
--   - colonna NOT NULL  → si cancellano le righe dell'utente;
--   - colonna nullable  → si azzera (la riga resta: storico di lavoro fatto
--     per altri, revisioni admin, ordini, richieste).
--   - le tabelle ON DELETE CASCADE (binders, scaffali, chat, movimenti,
--     storico_valore, set_*, ultima_visita, correzioni_manuali…) le chiude
--     da solo il delete finale su auth.users.
-- In più: un admin non può cancellare sé stesso (resterebbe senza admin).
-- Tutto in un'unica funzione = un'unica transazione: se qualcosa fallisce
-- non cambia nulla.
-- NON tocca: file nello Storage (restano nei bucket), storico_prezzi (non
-- ha chiave verso l'utente).
-- Firma, SECURITY DEFINER, search_path e permessi invariati (CREATE OR
-- REPLACE mantiene i GRANT esistenti).
-- ═══════════════════════════════════════════════════════════════════════

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
  if p_target = auth.uid() then
    raise exception 'Non puoi eliminare il tuo stesso account';
  end if;
  perform public.log_admin_action('hard_delete', p_target, null);

  -- 1. Scambi (le righe cadono in cascata dalla richiesta; poi gli avanzi)
  delete from public.richieste_scambio where proprietario_id = p_target or richiedente_id = p_target;
  delete from public.richieste_scambio_righe where proprietario_id = p_target or richiedente_id = p_target;

  -- 2. Dati propri (colonne NOT NULL) — figli prima dei padri
  delete from public.binder_carte where owner_id = p_target;
  delete from public.scaffale_prodotti where owner_id = p_target;
  delete from public.foto_carte where owner_id = p_target;
  delete from public.user_media where user_id = p_target;
  delete from public.carte where owner_id = p_target;
  delete from public.prodotti_sealed where owner_id = p_target;
  delete from public.wishlist where owner_id = p_target;
  delete from public.wishlist_sealed where owner_id = p_target;
  delete from public.location where owner_id = p_target;
  delete from public.preferenze_utente where owner_id = p_target;
  delete from public.missioni_completate where owner_id = p_target;
  delete from public.traguardi_riscossi where owner_id = p_target;
  delete from public.inventario_ricompense where owner_id = p_target;
  delete from public.bustina_carte_possedute where owner_id = p_target;
  delete from public.achievement_sbloccati where owner_id = p_target;
  delete from public.segnalazioni_bug where owner_id = p_target;
  delete from public.activity_log where user_id = p_target;
  delete from public.worker_presenza where user_id = p_target;
  delete from public.coda_lavoro where creato_da = p_target;
  delete from public.coda_wishlist where owner_id = p_target;

  -- 3. Tracce su righe altrui (colonne nullable) — la riga resta
  update public.admin_audit_log set admin_id = null where admin_id = p_target;
  update public.chat_restrizioni_utente set impostato_da = null where impostato_da = p_target;
  update public.coda_lavoro set claimed_by = null where claimed_by = p_target;
  update public.coda_wishlist set claimed_by = null where claimed_by = p_target;
  update public.ordini set creato_da = null where creato_da = p_target;
  update public.ordini set preso_in_carico_da = null where preso_in_carico_da = p_target;
  update public.pending_requests set user_id = null where user_id = p_target;
  update public.pending_requests set reviewed_by = null where reviewed_by = p_target;
  update public.user_media set reviewed_by = null where reviewed_by = p_target;
  update public.work_in_progress set attivato_da = null where attivato_da = p_target;

  -- 4. Profilo e utente (il resto va in cascata)
  delete from public.profiles where id = p_target;
  delete from auth.users where id = p_target;
end;
$function$;

-- VERIFICA (sola lettura): chiavi NO ACTION verso auth.users NON gestite
-- dalla funzione. Atteso: ZERO righe.
select c.conrelid::regclass as tabella, a.attname as colonna
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
  and c.confdeltype = 'a' and c.connamespace = 'public'::regnamespace
  and position(format('public.%s where %s', c.conrelid::regclass, a.attname)
               in pg_get_functiondef('public.admin_hard_delete_user'::regproc)) = 0
  and position(format('public.%s set %s', c.conrelid::regclass, a.attname)
               in pg_get_functiondef('public.admin_hard_delete_user'::regproc)) = 0
  and not (c.conrelid = 'public.profiles'::regclass)
  and not (c.conrelid = 'public.richieste_scambio'::regclass)
  and not (c.conrelid = 'public.richieste_scambio_righe'::regclass);
