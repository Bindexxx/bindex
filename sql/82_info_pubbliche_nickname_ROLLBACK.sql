-- Rollback di 82_info_pubbliche_nickname.sql (torna allo stato dopo sql/81).
DROP FUNCTION IF EXISTS public.leggi_binder_pubblico_info(uuid);
CREATE FUNCTION public.leggi_binder_pubblico_info(p_binder_id uuid)
 RETURNS TABLE(nome text, tipo text, location_valore text, owner_id uuid, layout text, colore text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select b.nome, b.tipo, b.location_valore, b.owner_id, b.layout, b.colore
    from public.binders b
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$function$;
GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.leggi_scaffale_pubblico_info(uuid);
CREATE FUNCTION public.leggi_scaffale_pubblico_info(p_scaffale_id uuid)
 RETURNS TABLE(nome text, tipo text, owner_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select s.nome, s.tipo, s.owner_id
    from public.scaffali s
    where s.id = p_scaffale_id and s.stato_pubblicazione = 'pubblico';
$function$;
GRANT EXECUTE ON FUNCTION public.leggi_scaffale_pubblico_info(uuid) TO PUBLIC, anon, authenticated;
