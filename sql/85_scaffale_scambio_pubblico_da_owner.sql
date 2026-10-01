-- ═══════════════════════════════════════════════════════════════════════
-- 85_scaffale_scambio_pubblico_da_owner.sql — 2026-10-01 (Restyle Bindex, FASE 8e)
-- Rollback: 85_scaffale_scambio_pubblico_da_owner_ROLLBACK.sql
--
-- Per la schermata "Questa pagina si è spostata" di sealed.html: dato il
-- proprietario (?u= del vecchio link) restituisce l'id del suo scaffale
-- Scambio SE è pubblico, altrimenti NULL. VERIFICATO sul DB live:
-- scaffali(id, owner_id, tipo CHECK libero/vetrina/scambio,
-- stato_pubblicazione CHECK privato/in_approvazione/pubblico).
-- Espone solo un id di uno scaffale che il proprietario ha GIÀ reso pubblico
-- (lo stesso che si trova nel suo link di condivisione). Chiamabile da anon.
-- ═══════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.leggi_scaffale_scambio_pubblico(p_owner_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select s.id
    from public.scaffali s
    where s.owner_id = p_owner_id and s.tipo = 'scambio' and s.stato_pubblicazione = 'pubblico'
    order by s.created_at
    limit 1;
$function$;
REVOKE ALL ON FUNCTION public.leggi_scaffale_scambio_pubblico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_scaffale_scambio_pubblico(uuid) TO anon, authenticated, service_role;
