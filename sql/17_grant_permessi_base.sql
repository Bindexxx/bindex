-- ============================================================================
-- CardSync Pro — 17: GRANT di base per anon/authenticated
--
-- Diverso dalle RLS (15): i GRANT stabiliscono SE un ruolo può tentare
-- un'operazione su una tabella; le RLS stabiliscono QUALI RIGHE vede/tocca
-- una volta che il tentativo è permesso. Senza GRANT, PostgREST risponde
-- 403 anche se la RLS policy sarebbe stata soddisfatta — è quello che ha
-- dato l'errore "403" su profiles nel test di Claudio.
--
-- Sicuro da eseguire: le RLS già applicate in 15 restano il vero filtro,
-- questo file apre solo la porta d'ingresso di base.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Cosi qualunque NUOVA tabella/funzione creata in futuro erediti già i
-- grant giusti, senza doverli reimpostare a mano ogni volta.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- ============================================================================
-- ROLLBACK:
-- revoke all on all tables in schema public from anon, authenticated;
-- revoke all on all sequences in schema public from anon, authenticated;
-- revoke all on all functions in schema public from anon, authenticated;
-- revoke usage on schema public from anon, authenticated;
-- alter default privileges in schema public revoke select, insert, update, delete on tables from anon, authenticated;
-- alter default privileges in schema public revoke usage, select on sequences from anon, authenticated;
-- alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- ============================================================================

-- ============================================================================
-- VERIFICA DOPO L'ESECUZIONE:
-- Ri-lancia DIAGNOSTICA_grant_mancanti.sql — ora devono comparire righe
-- con grantee=anon e grantee=authenticated per profiles (SELECT, INSERT,
-- UPDATE, DELETE). Poi ricarica admin.html e riprova il login.
-- ============================================================================
