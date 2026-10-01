-- ═══════════════════════════════════════════════════════════════════════
-- 82_info_pubbliche_nickname.sql — 2026-10-01 (Restyle Bindex, FASE 8)
-- Rollback: 82_info_pubbliche_nickname_ROLLBACK.sql
--
-- NICKNAME DEL PROPRIETARIO nelle info pubbliche di binder e scaffale, per
-- mostrare "di <nickname>" sulle pagine pubbliche (mai l'email).
-- VERIFICATO sul DB live prima di scrivere:
--   - leggi_binder_pubblico_info(uuid) → (nome, tipo, location_valore,
--     owner_id, layout, colore) [dopo sql/81]; leggi_scaffale_pubblico_info
--     (uuid) → (nome, tipo, owner_id). Entrambe SECURITY DEFINER, solo righe
--     con stato_pubblicazione = 'pubblico'.
--   - ottieni_nicknames() richiede auth.uid(): NON utilizzabile da un
--     visitatore anonimo → il nickname va letto qui dentro (SECURITY DEFINER),
--     solo per il proprietario di un binder/scaffale GIÀ pubblico.
--   - preferenze_utente(owner_id uuid, nickname text NULL), RLS "solo le
--     proprie righe": la funzione sotto non apre la tabella, espone solo il
--     nickname del proprietario di una pagina che lui ha reso pubblica.
--   - nessun oggetto dipende dalle due funzioni (pg_depend vuoto); permessi
--     attuali: PUBLIC/anon/authenticated (+postgres, + service_role per il binder).
-- Il nuovo campo è l'ULTIMO della tabella di ritorno: i client leggono per nome.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.leggi_binder_pubblico_info(uuid);
CREATE FUNCTION public.leggi_binder_pubblico_info(p_binder_id uuid)
 RETURNS TABLE(nome text, tipo text, location_valore text, owner_id uuid, layout text, colore text, nickname text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select b.nome, b.tipo, b.location_valore, b.owner_id, b.layout, b.colore, p.nickname
    from public.binders b
    left join public.preferenze_utente p on p.owner_id = b.owner_id
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$function$;
GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.leggi_scaffale_pubblico_info(uuid);
CREATE FUNCTION public.leggi_scaffale_pubblico_info(p_scaffale_id uuid)
 RETURNS TABLE(nome text, tipo text, owner_id uuid, nickname text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select s.nome, s.tipo, s.owner_id, p.nickname
    from public.scaffali s
    left join public.preferenze_utente p on p.owner_id = s.owner_id
    where s.id = p_scaffale_id and s.stato_pubblicazione = 'pubblico';
$function$;
GRANT EXECUTE ON FUNCTION public.leggi_scaffale_pubblico_info(uuid) TO PUBLIC, anon, authenticated;
