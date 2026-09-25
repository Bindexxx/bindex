-- 80_chat_link_per_dominio_ROLLBACK.sql — 2026-09-26
-- Rimette la versione di sql/72 (letta con pg_get_functiondef il
-- 2026-09-26). ATTENZIONE: riapre il buco descritto nella 80.

CREATE OR REPLACE FUNCTION public._chat_ha_link_esterno(p_testo text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select (p_testo ~* '(https?://|www\.)\S+')
       and (p_testo !~* 'bindexxx\.github\.io');
$function$;
