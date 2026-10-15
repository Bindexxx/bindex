-- ============================================================================
-- 111 — PUNTO 27: DIAGNOSI DEL CONTROLLO PREZZI FUORI DALLE NOTE +
--       SCRITTURE DI GRUPPO SOLO SU CARTE PRENOTATE O PROPRIE
-- (decisioni di Claudio, 2026-10-15: 27a variante A + 27b)
--
-- Letto sul DB LIVE il 2026-10-15 (pg_get_functiondef, information_schema,
-- pg_policies, trigger di carte):
-- - aggiorna_nota_controllo_gruppo: "update carte set note = p_nota" →
--   sostituiva l'INTERA nota della carta con il testo di diagnosi a ogni
--   Esaurita/Timeout. 27 carte hanno oggi solo il testo di diagnosi (22 "Prezzo
--   non trovato per lingua e/o condizione", 5 "Timeout: pagina troppo lenta a
--   rispondere"); le note di prima non sono recuperabili (nessuna storia del
--   campo). La diagnosi non veniva mai tolta.
-- - Le 7 funzioni di scrittura del controllo prezzi di gruppo (SECURITY
--   DEFINER, EXECUTE ad authenticated) aggiornavano qualunque carta/prodotto
--   in collezione di chiunque: prezzo (+ movimento in movimenti_collezione),
--   immagine, link, nota, data di controllo. Nessun controllo.
-- - carte ha la sola policy "propria collezione"; trigger su UPDATE:
--   updated_at, prezzo_precedente e storico_prezzi SOLO se il prezzo cambia
--   (lo spostamento qui sotto non tocca il prezzo → nessuno storico).
-- - Nel codice dell'estensione (5.18–5.20, popup.js eseguiSessione) ogni
--   scrittura avviene su carte appena prenotate da reclama_carte_per_
--   controllo_prezzi (claimed_by = chi chiama) e PRIMA del rilascio a fine
--   lotto (le scritture "segnaControllata" vengono attese prima del rilascio).
--
-- COSA FA
-- 1. Nuove colonne carte.esito_controllo (testo di diagnosi) e
--    carte.esito_controllo_il (quando). aggiorna_nota_controllo_gruppo (stesso
--    nome e argomenti: l'estensione non cambia) scrive lì, MAI più in note.
--    aggiorna_prezzo_controllo_gruppo svuota l'esito quando trova un prezzo
--    DIVERSO da quello salvato (se è uguale l'esito resta: l'estensione
--    riscrive lo stesso prezzo anche solo per salvare l'immagine, pure su
--    una carta "Esaurita" — popup.js, ramo "Δ < soglia").
-- 2. Le 27 note fatte solo di diagnosi passano in esito_controllo; note vuote.
-- 3. 27b — le 7 funzioni toccano una carta/prodotto SOLO se chi chiama l'ha
--    prenotata (claimed_by = auth.uid()) o ne è il proprietario. Altrimenti
--    non fanno nulla (nessun errore: se un altro PC ha ripreso la carta dopo
--    i 10 minuti di prenotazione, la controlla lui).
--
-- Stesse firme: solo CREATE OR REPLACE (permessi invariati). Nessun DROP,
-- REVOKE o DELETE: eseguibile anche via connettore. Compatibile con
-- l'estensione 5.18, 5.19, 5.20 e con un controllo prezzi in corso.
--
-- ESEGUITO sul DB il 2026-10-15 (connettore), dopo la prova in un blocco
-- annullato (17/17 come atteso). Verifica: 0 note di diagnosi rimaste,
-- 27 esiti, 7 funzioni aggiornate, permessi invariati.
-- PER ANNULLARE: sql/111_esito_controllo_e_scritture_gruppo_ROLLBACK.sql
-- ============================================================================

-- ── 1. COLONNE NUOVE ───────────────────────────────────────────────────────
alter table public.carte
  add column esito_controllo text,
  add column esito_controllo_il timestamptz;
comment on column public.carte.esito_controllo is
  'sql/111 (punto 27): ultimo problema del controllo prezzi automatico (es. "Prezzo non trovato per lingua e/o condizione"). Mai nella nota dell''utente.';
comment on column public.carte.esito_controllo_il is
  'sql/111: quando è stato registrato esito_controllo.';

-- ── 2. NOTE FATTE SOLO DI DIAGNOSI → esito_controllo ───────────────────────
update public.carte
set esito_controllo = note,
    esito_controllo_il = coalesce(ultimo_controllo, now()),
    note = null
where note in ('Prezzo non trovato per lingua e/o condizione',
               'Prezzo non trovato (pagina non caricata correttamente)',
               'Timeout: pagina troppo lenta a rispondere');

-- ── 3. FUNZIONI ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- sql/111 (punto 27): la diagnosi va in esito_controllo, mai in note; solo
  -- su carte prenotate da chi chiama o proprie.
  update carte
  set esito_controllo = p_nota,
      esito_controllo_il = now()
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.aggiorna_prezzo_controllo_gruppo(p_id uuid, p_prezzo numeric, p_immagine text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_nome text;
  v_prezzo_vecchio numeric;
  v_qty integer;
begin
  -- sql/111 (punto 27b): solo carte prenotate da chi chiama o proprie.
  select owner_id, nome, prezzo, qty into v_owner_id, v_nome, v_prezzo_vecchio, v_qty
  from carte
  where id = p_id and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());

  if v_owner_id is null then
    return; -- carta non trovata, non in collezione, o non prenotata da chi chiama
  end if;

  update carte
  set prezzo = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine),
      -- sql/111: prezzo nuovo trovato → la diagnosi precedente non vale più
      esito_controllo = case when prezzo is distinct from p_prezzo then null else esito_controllo end,
      esito_controllo_il = case when prezzo is distinct from p_prezzo then null else esito_controllo_il end
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());

  if v_prezzo_vecchio is distinct from p_prezzo then
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
    values
        (v_owner_id, 'prezzo_automatico', 'carta', p_id, v_nome, null, p_prezzo,
         (p_prezzo - coalesce(v_prezzo_vecchio, p_prezzo)) * coalesce(v_qty, 1), 'estensione');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_nome text;
  v_prezzo_cardmarket_vecchio numeric;
begin
  -- sql/111 (punto 27b): solo prodotti prenotati da chi chiama o propri.
  select owner_id, nome, prezzo_cardmarket into v_owner_id, v_nome, v_prezzo_cardmarket_vecchio
  from prodotti_sealed
  where id = p_id and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());

  if v_owner_id is null then
    return;
  end if;

  update prodotti_sealed
  set prezzo_cardmarket = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());

  if v_prezzo_cardmarket_vecchio is distinct from p_prezzo then
    -- valore_delta SEMPRE null qui — vedi header del file: prezzo_cardmarket
    -- non è il campo che conta per il valore dichiarato della collezione.
    insert into public.movimenti_collezione
        (owner_id, tipo_evento, oggetto_tipo, oggetto_id, nome_snapshot, quantita_delta, prezzo_unitario, valore_delta, fonte)
    values
        (v_owner_id, 'prezzo_automatico', 'sealed', p_id, v_nome, null, p_prezzo, null, 'estensione');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aggiorna_url_controllo_gruppo(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if not (p_url is null or p_url in ('', '#') or (p_url ~ '^https://(www\.)?cardmarket\.com/' and p_url !~ '[[:space:]"<>'']')) then
        raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
    end if;
    -- sql/111 (punto 27b): solo carte prenotate da chi chiama o proprie.
    update carte
    set url = p_url
    where id = p_id
      and stato = 'collezione'
      and (claimed_by = auth.uid() or owner_id = auth.uid());
end;
$function$;

CREATE OR REPLACE FUNCTION public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if not (p_url is null or p_url in ('', '#') or (p_url ~ '^https://(www\.)?cardmarket\.com/' and p_url !~ '[[:space:]"<>'']')) then
        raise exception 'Link non valido: e'' ammesso solo un indirizzo https://www.cardmarket.com/';
    end if;
    -- sql/111 (punto 27b): solo prodotti prenotati da chi chiama o propri.
    update prodotti_sealed
    set url = p_url
    where id = p_id
      and stato = 'collezione'
      and (claimed_by = auth.uid() or owner_id = auth.uid());
end;
$function$;

CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- sql/111 (punto 27b): solo carte prenotate da chi chiama o proprie.
  update carte
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo_sealed(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- sql/111 (punto 27b): solo prodotti prenotati da chi chiama o propri.
  update prodotti_sealed
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione'
    and (claimed_by = auth.uid() or owner_id = auth.uid());
$function$;

-- ── VERIFICHE ──────────────────────────────────────────────────────────────
-- attesi: 0 note di diagnosi, 27 esiti (al 2026-10-15), 7 funzioni con "sql/111"
select (select count(*) from public.carte where note in ('Prezzo non trovato per lingua e/o condizione',
          'Prezzo non trovato (pagina non caricata correttamente)', 'Timeout: pagina troppo lenta a rispondere')) as note_diagnosi_rimaste,
       (select count(*) from public.carte where esito_controllo is not null) as esiti,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%sql/111%') as funzioni_aggiornate;
