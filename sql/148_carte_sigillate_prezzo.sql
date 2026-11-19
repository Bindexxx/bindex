-- 148: prezzo delle carte ancora sigillate nella bustina (spunta "Sigillata", carte.sigillata_originale).
-- Decisione di Claudio del 19/11/2026: su Cardmarket alcune offerte hanno nel commento "sealed",
-- "OVP", "sigillata"… e valgono diversamente. Per una carta con la spunta l'estensione (5.76)
-- prende come prezzo la prima offerta sigillata; accanto salva il minimo di Cardmarket (sigillata
-- o no) per il confronto. Se di sigillate non ce ne sono, il prezzo resta quello normale e si segna.
-- Niente nelle note dell'utente (regola del 15/10, punto 27): due colonne nuove, mostrate dal sito.
--
-- Cosa cambia:
--   carte.prezzo_minimo_cm     numeric  minimo di Cardmarket all'ultimo controllo (null = mai letto)
--   carte.prezzo_da_sigillata  boolean  true = il prezzo viene da un'offerta sigillata,
--                                       false = nessuna offerta sigillata, prezzo normale
--   aggiorna_sigillata_controllo(p_id, p_minimo, p_da_sigillata, p_riga_coda_id)
--     - controllo prezzi (p_riga_coda_id null): carta propria o prenotata da chi chiama, come
--       aggiorna_prezzo_controllo_gruppo;
--     - coda (p_riga_coda_id): la carta appena creata da completa_riga_coda_carte per quella riga,
--       completata da chi chiama (proprietario della riga o chi l'aveva presa);
--     - solo carte con la spunta "Sigillata".
--   trigger: togliendo la spunta le due colonne tornano vuote.
-- Si lancia dall'SQL Editor (contiene REVOKE), PRIMA di unire la PR.

begin;

alter table public.carte
  add column if not exists prezzo_minimo_cm numeric,
  add column if not exists prezzo_da_sigillata boolean;

comment on column public.carte.prezzo_minimo_cm is
  'sql/148: carte sigillate — minimo di Cardmarket (sigillata o no) all''ultimo controllo';
comment on column public.carte.prezzo_da_sigillata is
  'sql/148: carte sigillate — true = prezzo da un''offerta sigillata, false = nessuna offerta sigillata, prezzo normale';

create or replace function public.aggiorna_sigillata_controllo(
  p_id uuid,
  p_minimo numeric,
  p_da_sigillata boolean,
  p_riga_coda_id bigint default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ok boolean := false;
begin
  -- sql/148: prezzo delle carte sigillate (estensione 5.76).
  if v_uid is null then
    return;
  end if;
  if p_minimo is not null and (p_minimo < 0 or p_minimo > 1000000) then
    raise exception 'MINIMO_NON_VALIDO';
  end if;

  if p_riga_coda_id is null then
    -- controllo prezzi: stessa regola di aggiorna_prezzo_controllo_gruppo
    select true into v_ok
      from carte
     where id = p_id
       and stato = 'collezione'
       and sigillata_originale
       and (claimed_by = v_uid or owner_id = v_uid);
  else
    -- coda: la carta creata da completa_riga_coda_carte per quella riga (stessa transazione:
    -- created_at e completato_il coincidono), completata da chi chiama
    select true into v_ok
      from coda_lavoro q
      join carte c on c.id = p_id
     where q.id = p_riga_coda_id
       and q.stato = 'completato'
       and (q.creato_da = v_uid or q.claimed_by = v_uid)
       and c.owner_id = q.creato_da
       and c.stato = 'collezione'
       and c.sigillata_originale
       and c.created_at between q.completato_il - interval '1 minute' and q.completato_il + interval '1 minute';
  end if;

  if not coalesce(v_ok, false) then
    return;
  end if;

  update carte
     set prezzo_minimo_cm = case when p_minimo is null then null else round(p_minimo, 2) end,
         prezzo_da_sigillata = p_da_sigillata
   where id = p_id;
end;
$function$;

revoke execute on function public.aggiorna_sigillata_controllo(uuid, numeric, boolean, bigint) from public, anon;
grant execute on function public.aggiorna_sigillata_controllo(uuid, numeric, boolean, bigint) to authenticated, service_role;

create or replace function public._carte_sigillata_pulisci()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- sql/148: senza la spunta "Sigillata" il minimo e l'origine del prezzo non valgono più
  if not coalesce(new.sigillata_originale, false) then
    new.prezzo_minimo_cm := null;
    new.prezzo_da_sigillata := null;
  end if;
  return new;
end;
$function$;

create trigger trg_carte_sigillata_pulisci
  before update of sigillata_originale on public.carte
  for each row
  when (old.sigillata_originale is distinct from new.sigillata_originale)
  execute function public._carte_sigillata_pulisci();

commit;

-- Verifica (2 colonne, 1 funzione con permessi solo authenticated/service_role, 1 trigger):
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'carte'
   and column_name in ('prezzo_minimo_cm', 'prezzo_da_sigillata') order by 1;
select p.oid::regprocedure as firma, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aggiorna_sigillata_controllo';
select tgname from pg_trigger where tgrelid = 'public.carte'::regclass and tgname = 'trg_carte_sigillata_pulisci';
