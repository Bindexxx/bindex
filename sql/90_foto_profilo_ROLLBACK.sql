-- Rollback di sql/90.
DROP FUNCTION IF EXISTS public.leggi_foto_profilo(uuid[]);
DROP INDEX IF EXISTS public.user_media_un_profilo;
