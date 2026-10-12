-- ============================================================================
-- 99 — ROLLBACK: is_admin() come prima (definizione LIVE del 2026-10-12),
-- basta il ruolo admin, senza codice da app.
-- ============================================================================

begin;

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
$function$;

commit;
