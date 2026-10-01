-- ═══════════════════════════════════════════════════════════════════════
-- 90_foto_profilo.sql — 2026-10-01 (Restyle Bindex, FASE 8e "foto profilo")
-- Rollback: 90_foto_profilo_ROLLBACK.sql
--
-- FOTO PROFILO con approvazione admin (stesso percorso di retro carta e
-- copertina: user_media + pending_requests 'photo_upload').
-- VERIFICATO sul DB live (2026-10-01): user_media.slot testo libero;
-- UNIQUE(user_id, binder_id, slot) NON protegge le righe con binder_id NULL
-- (i NULL sono tutti diversi) → indice unico parziale per lo slot 'profilo';
-- user_media SELECT solo proprietario/admin → gli altri utenti leggono il
-- percorso delle foto APPROVATE con la funzione qui sotto; il file sta nel
-- bucket privato user-media, già leggibile dagli autenticati se la riga è
-- 'approved' (policy esistente "utenti autenticati leggono i file approvati
-- altrui").
-- ═══════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS user_media_un_profilo
    ON public.user_media (user_id)
    WHERE slot = 'profilo' AND binder_id IS NULL AND scaffale_id IS NULL;

CREATE OR REPLACE FUNCTION public.leggi_foto_profilo(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, storage_path text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select m.user_id, m.storage_path
    from user_media m
    where auth.uid() is not null
      and coalesce(array_length(p_user_ids, 1), 0) <= 100
      and m.user_id = any(p_user_ids)
      and m.slot = 'profilo' and m.binder_id is null and m.scaffale_id is null
      and m.status = 'approved' and m.source = 'upload';
$function$;
REVOKE ALL ON FUNCTION public.leggi_foto_profilo(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leggi_foto_profilo(uuid[]) TO authenticated, service_role;
