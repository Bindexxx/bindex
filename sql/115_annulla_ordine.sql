-- ============================================================================
-- 115 — ANNULLARE UN PROPRIO ORDINE ALL'ESTENSIONE (2026-10-15)
--
-- Letto sul DB LIVE il 2026-10-15: dopo sql/112 chi ha creato un ordine non
-- può più toccarlo (la regola UPDATE lascia passare solo il passaggio
-- pending → preso da me, o la rimessa in attesa da parte di chi lo ha preso).
-- Risultato: un ordine rimasto 'pending' (nessun PC con estensione e login
-- Cardmarket acceso) o partito per sbaglio non si poteva fermare in nessun
-- modo. Sul DB c'erano 4 ordini di prezzi 'pending' fermi. Nessun trigger su
-- ordini; nessun CHECK sulla colonna stato (solo su tipo e parametri).
--
-- COSA FA
-- 1. annulla_ordine(p_ordine_id): SECURITY DEFINER. Solo chi ha creato
--    l'ordine, solo se è 'pending' o 'in_corso'. Lo porta a 'annullato' con
--    completato_il = now(). Errori: NON_AUTENTICATO, ORDINE_NON_ANNULLABILE
--    (non esiste, non è tuo, o è già chiuso).
-- 2. Trigger ordini_annullato_resta_annullato: l'esito di un ordine
--    'annullato' (stato, risultato, errore_msg, completato_il) non cambia
--    più (l'UPDATE riesce, senza errore, ma l'esito resta). Serve per gli
--    ordini già presi da un PC: l'estensione (5.18–5.21), finito il suo
--    giro, scrive 'completato'/'errore' o rimette l'ordine 'pending' — senza
--    questo trigger l'annullamento verrebbe sovrascritto o l'ordine
--    ripartirebbe. L'estensione non legge mai l'esito di quelle UPDATE come
--    errore, quindi non serve cambiarla.
--    Effetto pratico sugli ordini 'in_corso':
--    - controlla_prezzi con location private (sql/108): l'estensione si ferma
--      al lotto successivo (al massimo 3 carte), perché
--      reclama_carte_per_controllo_prezzi / conta_carte_da_controllare_gruppo
--      non danno più carte a un ordine che non è 'in_corso';
--    - wishlist / sealed / ordini vecchi senza riga privata: il PC che lo sta
--      già eseguendo finisce il giro in corso (i prezzi letti restano validi),
--      ma l'ordine resta 'annullato'.
--    L'estensione prende solo ordini 'pending': uno annullato non riparte mai.
--
-- Da eseguire nell'SQL editor di Supabase.
-- PER ANNULLARE: sql/115_annulla_ordine_ROLLBACK.sql
-- ============================================================================

-- ── 1. FUNZIONE ────────────────────────────────────────────────────────────
create or replace function public.annulla_ordine(p_ordine_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;

  update ordini
     set stato = 'annullato',
         completato_il = now()
   where id = p_ordine_id
     and creato_da = v_uid
     and stato in ('pending', 'in_corso');

  if not found then
    raise exception 'ORDINE_NON_ANNULLABILE';
  end if;
end;
$function$;

revoke execute on function public.annulla_ordine(uuid) from public, anon;
grant execute on function public.annulla_ordine(uuid) to authenticated, service_role;

-- ── 2. TRIGGER ─────────────────────────────────────────────────────────────
create or replace function public.ordini_annullato_resta_annullato()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Restano fermi SOLO i campi dell'esito: stato, risultato, errore_msg,
  -- completato_il. Gli altri si possono ancora cambiare, perché
  -- admin_hard_delete_user azzera creato_da / preso_in_carico_da degli
  -- ordini dell'utente cancellato (altrimenti la chiave esterna verso
  -- auth.users bloccherebbe la cancellazione). Nessun errore: l'UPDATE
  -- dell'estensione riesce, ma non cambia l'esito.
  if old.stato = 'annullato' then
    new.stato := old.stato;
    new.risultato := old.risultato;
    new.errore_msg := old.errore_msg;
    new.completato_il := old.completato_il;
  end if;
  return new;
end;
$function$;

create trigger ordini_annullato_resta_annullato
  before update on public.ordini
  for each row execute function public.ordini_annullato_resta_annullato();

-- ── VERIFICHE ──────────────────────────────────────────────────────────────
-- attese: annulla_ordine eseguibile da authenticated, non da anon
select has_function_privilege('authenticated', 'public.annulla_ordine(uuid)', 'execute') as authenticated_ok,
       has_function_privilege('anon', 'public.annulla_ordine(uuid)', 'execute') as anon_no;
-- atteso: 1 riga
select tgname from pg_trigger where tgrelid = 'public.ordini'::regclass and not tgisinternal;
