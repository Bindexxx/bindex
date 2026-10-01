-- ═══════════════════════════════════════════════════════════════════════
-- 86_admin_contesto_richiesta.sql — 2026-10-01 (Restyle Bindex, FASE 8e)
-- Rollback: 86_admin_contesto_richiesta_ROLLBACK.sql
--
-- ADMIN "prima → dopo" per le richieste di rinomina binder/scaffale.
-- VERIFICATO sul DB live: pending_requests(id, user_id, type, payload jsonb,
-- status, ...); per type binder_nome/scaffale_nome il payload contiene
-- binder_id / scaffale_id (letto da admin_process_pending_request); binders e
-- scaffali hanno nome + nome_proposto + nome_stato; l'admin non legge le
-- tabelle altrui per RLS → funzione SECURITY DEFINER riservata agli admin.
-- Restituisce solo i due nomi (nome attuale approvato e nome proposto).
-- NOTA foto: user_media ha UNIQUE(user_id, binder_id, slot) → la nuova foto
-- sovrascrive la riga del precedente caricamento, quindi la foto "prima"
-- non è recuperabile dal DB: nessuna funzione per quella parte.
-- ═══════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.admin_contesto_richiesta(p_request_id uuid)
 RETURNS TABLE(prima text, dopo text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_req record;
begin
    if not public.is_admin() then
        raise exception 'Non autorizzato';
    end if;
    select * into v_req from public.pending_requests where id = p_request_id;
    if v_req is null then return; end if;
    if v_req.type = 'binder_nome' then
        return query select b.nome, b.nome_proposto from public.binders b
                     where b.id = (v_req.payload->>'binder_id')::uuid;
    elsif v_req.type = 'scaffale_nome' then
        return query select s.nome, s.nome_proposto from public.scaffali s
                     where s.id = (v_req.payload->>'scaffale_id')::uuid;
    end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_contesto_richiesta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_contesto_richiesta(uuid) TO authenticated, service_role;
