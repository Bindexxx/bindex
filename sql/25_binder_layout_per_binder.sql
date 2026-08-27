-- ============================================================================
-- 25_binder_layout_per_binder.sql
-- Fix: il layout della griglia (2×2/3×3/4×3/4×4) era una preferenza
-- GLOBALE per dispositivo (localStorage, chiave cardsync_binder_layout),
-- non per singolo binder. Il libro sfogliabile pubblico (scambio/wishlist/
-- binder-pubblico) non aveva quindi modo di sapere quale layout usare —
-- fisso a 3x3. Decisione confermata da Claudio (26/08/2026): il layout
-- diventa per-binder, salvato su DB, nessuna preferenza locale.
-- ============================================================================

ALTER TABLE public.binders ADD COLUMN layout text NOT NULL DEFAULT '3x3';

-- Cambio di firma (aggiunta colonna in RETURNS TABLE): DROP esplicito,
-- stesso motivo già visto in 24_card_back_binder_id.sql.
DROP FUNCTION IF EXISTS public.leggi_binder_pubblico_info(uuid);

CREATE OR REPLACE FUNCTION public.leggi_binder_pubblico_info(p_binder_id uuid)
RETURNS TABLE(nome text, tipo text, location_valore text, owner_id uuid, layout text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    select b.nome, b.tipo, b.location_valore, b.owner_id, b.layout
    from public.binders b
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$function$;

GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leggi_binder_pubblico_info(uuid) TO PUBLIC;
-- postgres ha già EXECUTE come owner, nessun grant esplicito necessario.
