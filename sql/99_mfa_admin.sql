-- ============================================================================
-- 99 — POTERI ADMIN SOLO CON IL CODICE DA APP (S6, piano 2026-10-12;
-- scelta di Claudio: "Tutti i poteri admin")
-- Scritto partendo dalla definizione LIVE di is_admin() letta il 2026-10-12.
--
-- COSA FA: is_admin() è vera solo se, oltre al ruolo admin, la sessione è
-- stata verificata col secondo fattore (TOTP: codice dell'app di
-- autenticazione) — livello "aal2" nel token di Supabase. Verificato sul DB:
-- is_admin() è l'UNICO controllo di ruolo admin (37 policy e 14 funzioni la
-- usano; nessuna controlla role='admin' per conto suo), quindi la regola vale
-- per tutti i poteri admin. Senza codice l'account admin è un utente normale.
--
-- ORDINE (IMPORTANTE): eseguire SOLO DOPO che admin.html con la schermata del
-- codice è pubblicato (PR "database: contatori, cestino, codice admin"). Il
-- primo accesso al pannello chiede di configurare l'app (codice QR), poi il
-- codice a ogni accesso. Se l'SQL va prima del sito, il pannello admin non
-- funziona finché il sito nuovo non è online.
--
-- TELEFONO PERSO: dalla dashboard Supabase (Authentication → Users → utente →
-- Multi-factor) si elimina il fattore; al login successivo il pannello fa
-- configurare un'app nuova. In alternativa: sql/99_mfa_admin_ROLLBACK.sql.
--
-- PER ANNULLARE: sql/99_mfa_admin_ROLLBACK.sql
-- ============================================================================

begin;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$function$;

commit;

-- VERIFICA (dopo, da SQL editor: niente token → false come prima)
-- select public.is_admin();  -- false
