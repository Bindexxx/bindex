-- ============================================================================
-- 24_card_back_binder_id.sql
-- Fix: il retro carta (sleeve) pubblico su scambio.html/wishlist.html
-- prendeva una riga a caso tra tutte le sleeve approvate dell'owner,
-- ignorando che con Multi-Binder ogni binder ha la propria sleeve.
--
-- Decisione confermata da Claudio (26/08/2026): nessun fallback per righe
-- legacy pre-Multi-Binder (binder_id null) — ambiente di test, comportamento
-- corretto è filtrare in modo stretto per binder_id.
-- ============================================================================

-- ── A) Nuova RPC: risolve owner + tipo binder (+ location_valore per i
--       binder di tipo 'location', es. SCAMBIO) al binder_id corrispondente.
--       Pagine pubbliche (scambio.html/wishlist.html) la usano per sapere
--       DI QUALE binder chiedere la sleeve, dato che non hanno sessione.
CREATE OR REPLACE FUNCTION public.leggi_binder_id_owner(
    p_owner_id uuid,
    p_tipo text,
    p_location_valore text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM binders
  WHERE owner_id = p_owner_id
    AND tipo = p_tipo
    AND (p_location_valore IS NULL OR location_valore = p_location_valore)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.leggi_binder_id_owner(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.leggi_binder_id_owner(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leggi_binder_id_owner(uuid, text, text) TO PUBLIC;

-- ── B) leggi_card_back_approvata: firma cambiata da (uuid) a (uuid, uuid).
--       DROP esplicito perché è un cambio di firma, non una semplice
--       sostituzione del corpo (altrimenti Postgres crea un overload
--       invece di sostituire la funzione esistente).
DROP FUNCTION IF EXISTS public.leggi_card_back_approvata(uuid);

CREATE OR REPLACE FUNCTION public.leggi_card_back_approvata(
    p_owner_id uuid,
    p_binder_id uuid
)
RETURNS TABLE(storage_path text, source text, metadata jsonb, reviewed_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT storage_path, source, metadata, reviewed_at
  FROM user_media
  WHERE user_id = p_owner_id
    AND binder_id = p_binder_id
    AND slot = 'card_back'
    AND status = 'approved'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.leggi_card_back_approvata(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.leggi_card_back_approvata(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leggi_card_back_approvata(uuid, uuid) TO PUBLIC;
-- postgres ha già EXECUTE come owner/superuser, nessun grant esplicito necessario.
