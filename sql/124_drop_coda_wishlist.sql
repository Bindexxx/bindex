-- ============================================================================
-- 124 — VIA LA TABELLA coda_wishlist (estensione 5.47)
-- Piano 2026-10-23, Fase 9 (pulizia), passo [OK] "DROP coda_wishlist".
--
-- Letto sul DB LIVE il 2026-10-28:
-- - coda_wishlist: 0 righe. Le richieste wishlist dal sito vanno in coda_lavoro
--   (vista coda_carte, destinazione 'wishlist') dalla Fase 2 (5.37); né il sito
--   (data/, ui/) né l'estensione la leggono o la scrivono.
-- - Nessuna vista, nessun trigger, nessuna chiave esterna verso di lei, non è
--   in nessuna publication. Ha 3 policy (select/insert/update del proprietario)
--   e 2 chiavi esterne verso auth.users: cadono con la tabella.
-- - L'unica funzione che la nomina è admin_hard_delete_user (eliminazione
--   definitiva di un utente dall'admin): con la tabella tolta quelle due righe
--   darebbero errore e l'eliminazione non andrebbe più. Qui sotto la funzione è
--   identica a quella live (md5 del corpo verificato) MENO le due righe su
--   coda_wishlist; owner e permessi restano (create or replace).
--
-- COSA FA, in una sola transazione:
-- 1. si ferma se nel frattempo qualcuno ha scritto in coda_wishlist;
-- 2. admin_hard_delete_user senza coda_wishlist;
-- 3. drop table coda_wishlist.
-- Ritorno indietro: 124_..._ROLLBACK.sql (tabella, policy, permessi e funzione
-- com'erano; le righe no, perché non ce n'erano).
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from public.coda_wishlist) then
    raise exception 'coda_wishlist non è vuota: niente DROP, controlla prima chi ci ha scritto';
  end if;
end $$;

create or replace function public.admin_hard_delete_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- 3. Tracce su righe altrui (colonne nullable) — la riga resta
  update public.admin_audit_log set admin_id = null where admin_id = p_target;
  update public.chat_restrizioni_utente set impostato_da = null where impostato_da = p_target;
  update public.coda_lavoro set claimed_by = null where claimed_by = p_target;
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


drop table public.coda_wishlist;

commit;

-- Controllo (deve dare: false, 0):
-- select to_regclass('public.coda_wishlist') is not null as tabella_ancora_li,
--        (select count(*) from pg_proc where proname = 'admin_hard_delete_user'
--           and prosrc ilike '%coda_wishlist%') as funzioni_che_la_nominano;
