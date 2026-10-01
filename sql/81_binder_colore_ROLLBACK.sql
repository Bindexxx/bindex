-- Rollback di 81_binder_colore.sql: ripristina la funzione originale a 5
-- colonne e rimuove la colonna (il colore scelto dagli utenti va perso).
DROP FUNCTION IF EXISTS public.leggi_binder_pubblico_info(uuid);

CREATE FUNCTION public.leggi_binder_pubblico_info(p_binder_id uuid)
 RETURNS TABLE(nome text, tipo text, location_valore text, owner_id uuid, layout text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select b.nome, b.tipo, b.location_valore, b.owner_id, b.layout
    from public.binders b
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$function$;

GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.binders DROP CONSTRAINT IF EXISTS binders_colore_formato;
ALTER TABLE public.binders DROP COLUMN IF EXISTS colore;
