-- ═══════════════════════════════════════════════════════════════════════
-- 80_chat_link_per_dominio.sql — 2026-09-26
-- Rollback: 80_chat_link_per_dominio_ROLLBACK.sql
--
-- BUCO TROVATO (verificato sul DB live): _chat_ha_link_esterno (sql/72),
-- usata da invia_messaggio, bloccava un messaggio solo se conteneva un
-- link E da nessuna parte compariva "bindexxx.github.io". Passavano quindi:
--   "bindexxx.github.io https://sito-esterno.com"
--   "https://sito-esterno.com/bindexxx.github.io"
--   "https://bindexxx.github.io.sito-esterno.com"
--   "http://bindexxx.github.io:pw@sito-esterno.com"  (porta su sito-esterno)
-- NUOVA REGOLA: ogni singolo link (http://, https://, www.) deve avere come
-- dominio esattamente bindexxx.github.io (con o senza www.), seguito da
-- fine testo, / ? # ) ] , ; ! oppure da un punto di fine frase.
-- Identica, carattere per carattere, a quella del sito
-- (_chatContieneLinkEsterno in ui/widget-chat.ui.js): provate entrambe sugli
-- stessi 18 casi (PostgreSQL reale via PGlite + Node), stesso risultato.
-- Messaggi già salvati sul DB al 2026-09-26: 8, nessuno con link.
-- Firma, IMMUTABLE, search_path e permessi invariati (CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._chat_ha_link_esterno(p_testo text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select exists (
        select 1
        from regexp_matches(coalesce(p_testo, ''), '(?:https?://|www\.)\S+', 'gi') as m(arr)
        where m.arr[1] !~* '^(?:https?://)?(?:www\.)?bindexxx\.github\.io(?:$|[/?#)\],;!]|\.(?:$|[^a-z0-9-]))'
    );
$function$;

-- VERIFICA (sola lettura). Attese: tre colonne true.
select
  public._chat_ha_link_esterno('bindexxx.github.io https://sito-esterno.com') as misto_bloccato,
  not public._chat_ha_link_esterno('vedi https://bindexxx.github.io/bindex/binder-pubblico.html?b=1') as interno_ammesso,
  public._chat_ha_link_esterno('http://bindexxx.github.io:pw@sito-esterno.com') as trucco_bloccato;
