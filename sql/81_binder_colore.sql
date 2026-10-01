-- ═══════════════════════════════════════════════════════════════════════
-- 81_binder_colore.sql — 2026-10-01 (Restyle Bindex, FASE 8a)
-- Rollback: 81_binder_colore_ROLLBACK.sql
--
-- COLORE COPERTINA PER BINDER, scelto dall'utente (vale finché non carica
-- una foto di copertina). VERIFICATO sul DB live prima di scrivere:
--   - public.binders NON ha una colonna colore (13 colonne, ultima
--     nome_in_attesa);
--   - policy RLS: una sola, "utenti gestiscono i propri binder" (ALL,
--     owner_id = auth.uid()) → l'utente può già aggiornare la propria riga,
--     nessuna policy da toccare;
--   - trigger BEFORE UPDATE: _binders_blocca_rinomina_diretta (guarda solo
--     new.nome) e _binders_forza_condivisione (solo tipo/pubblicazione) →
--     non interferiscono con una colonna nuova;
--   - leggi_binder_pubblico_info(uuid): SECURITY DEFINER, restituisce
--     (nome, tipo, location_valore, owner_id, layout); nessun oggetto del
--     DB dipende da essa (pg_depend vuoto); EXECUTE a PUBLIC/anon/authenticated.
--
-- COSA FA
--  1) colonna binders.colore text NULL (NULL = nessuna scelta → il sito usa
--     la tinta automatica dal nome, come oggi), con CHECK '#rrggbb';
--  2) leggi_binder_pubblico_info restituisce anche "colore" (in fondo alla
--     tabella di ritorno: i client leggono per nome, nessuna rottura).
--     Cambia il tipo di ritorno → serve DROP + CREATE; i permessi vengono
--     riassegnati qui sotto identici a quelli di prima.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.binders
  ADD COLUMN IF NOT EXISTS colore text;

ALTER TABLE public.binders
  DROP CONSTRAINT IF EXISTS binders_colore_formato;
ALTER TABLE public.binders
  ADD CONSTRAINT binders_colore_formato
  CHECK (colore IS NULL OR colore ~ '^#[0-9a-fA-F]{6}$');

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
