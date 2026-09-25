-- 78_fix_admin_hard_delete_user_ROLLBACK.sql — 2026-09-25
-- Rimette la definizione IDENTICA a quella live prima della 78 (letta con
-- pg_get_functiondef il 2026-09-25; unica differenza: fine riga \n invece
-- di \r\n). Attenzione: questa versione NON funziona (vedi 78).
-- Permessi invariati: CREATE OR REPLACE non tocca i GRANT.

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
$function$;
