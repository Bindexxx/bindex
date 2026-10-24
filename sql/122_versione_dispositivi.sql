-- ============================================================================
-- 122 — VERSIONE DELL'ESTENSIONE SU OGNI PC (estensione 5.40)
-- Piano 2026-10-23, Fase 4.7. Serve per alzare versione_minima (sql/103)
-- sapendo quali PC sono già aggiornati, senza chiedere in giro.
--
-- Letto sul DB LIVE il 2026-10-24: nessuna tabella con versione e
-- dispositivo; il nome del PC esiste solo lato estensione (nomeDispositivo()
-- in shared.js, es. "PC-DL8LI") e finisce in coda_lavoro/carte.dispositivo
-- solo mentre si lavora.
--
-- COSA FA
-- 1. dispositivi_estensione (owner_id, dispositivo, versione, visto_il), una
--    riga per account e PC. RLS: ognuno legge le proprie, l'admin tutte.
--    Nessuna scrittura diretta: solo dalla funzione.
-- 2. segnala_dispositivo(p_dispositivo, p_versione): SECURITY DEFINER, scrive
--    solo la riga di chi chiama. L'estensione la chiama all'avvio del service
--    worker e una volta all'ora. Senza utente loggato non fa nulla.
-- Permessi: authenticated (sezione 3, REVOKE da eseguire a mano).
-- Ritorno indietro: 122_..._ROLLBACK.sql.
-- ============================================================================

-- ── 1. TABELLA ───────────────────────────────────────────────────────────────
create table if not exists public.dispositivi_estensione (
  owner_id uuid not null references auth.users(id) on delete cascade,
  dispositivo text not null,
  versione text not null,
  visto_il timestamptz not null default now(),
  primary key (owner_id, dispositivo)
);
alter table public.dispositivi_estensione enable row level security;

create policy "dispositivi: lettura propri o admin" on public.dispositivi_estensione
  for select using (owner_id = (select auth.uid()) or is_admin());

-- ── 2. FUNZIONE ──────────────────────────────────────────────────────────────
create or replace function public.segnala_dispositivo(p_dispositivo text, p_versione text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_io uuid := auth.uid();
  v_disp text := left(trim(coalesce(p_dispositivo, '')), 60);
  v_ver text := left(trim(coalesce(p_versione, '')), 20);
begin
  if v_io is null or v_disp = '' or v_ver !~ '^[0-9]+(\.[0-9]+){0,3}$' then
    return;
  end if;
  insert into dispositivi_estensione (owner_id, dispositivo, versione, visto_il)
  values (v_io, v_disp, v_ver, now())
  on conflict (owner_id, dispositivo)
  do update set versione = excluded.versione, visto_il = excluded.visto_il;
end;
$function$;

-- ── 3. PERMESSI (REVOKE: da eseguire a mano, il connettore li annulla) ───────
revoke all on table public.dispositivi_estensione from anon;
revoke insert, update, delete, truncate on table public.dispositivi_estensione from authenticated;
revoke execute on function public.segnala_dispositivo(text, text) from public, anon;
grant select on table public.dispositivi_estensione to authenticated;
grant execute on function public.segnala_dispositivo(text, text) to authenticated, service_role;
