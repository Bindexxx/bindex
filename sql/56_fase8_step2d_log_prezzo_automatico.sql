-- ============================================================================
-- CardSync Pro — 56: Fase 8, Step 2 (parte 4/5) — Log "prezzo_automatico"
-- dal controllo prezzi di gruppo (estensione)
--
-- Firme riconfermate identiche dal vivo prima di questo file (Regola d'Oro
-- #3) — CREATE OR REPLACE per entrambe, nessun DROP necessario (parametri
-- e tipo di ritorno invariati).
--
-- fonte='estensione': queste due RPC sono chiamate ESCLUSIVAMENTE dal
-- controllo prezzi di gruppo dell'estensione Chrome (mai dal sito) — unico
-- punto fin qui in cui questo valore del CHECK di sql/54 viene davvero usato.
--
-- DIFFERENZA IMPORTANTE fra carte e sealed, già documentata in sql/39:
--   - carte: aggiorna_prezzo_controllo_gruppo scrive 'prezzo' — è il campo
--     che storico_valore_collezione/il valore dichiarato della collezione
--     usano davvero. Qui valore_delta è calcolato per bene.
--   - sealed: aggiorna_prezzo_controllo_gruppo_sealed scrive
--     'prezzo_cardmarket' — un prezzo di RIFERIMENTO, mai quello sommato
--     nel valore della collezione (quello è 'prezzo', manuale, invariato
--     da questa RPC). Loggato comunque per completezza (utile a "Variazione
--     valore" per spiegare "abbiamo controllato il mercato" anche quando
--     non cambia nulla di dichiarato), ma con valore_delta SEMPRE null —
--     mai inventare un impatto economico che non esiste.
--
-- Entrambe passano da LANGUAGE sql a LANGUAGE plpgsql — necessario per
-- leggere owner_id/nome/prezzo vecchio PRIMA dell'update (serve per il log
-- e per calcolare il delta). Comportamento dell'update stesso invariato:
-- stesse colonne, stesso where.
--
-- Se la carta/prodotto non esiste o non è in stato 'collezione', la
-- funzione non fa nulla (comportamento preesistente: l'update con quel
-- where non tocca righe) — e di conseguenza NESSUN log viene scritto,
-- comportamento coerente con l'update stesso.
-- ============================================================================

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
  select owner_id, nome, prezzo, qty into v_owner_id, v_nome, v_prezzo_vecchio, v_qty
  from carte where id = p_id and stato = 'collezione';

  if v_owner_id is null then
    return; -- carta non trovata/non in collezione: l'update sotto non toccherebbe nulla comunque
  end if;

  update carte
  set prezzo = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';

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
  select owner_id, nome, prezzo_cardmarket into v_owner_id, v_nome, v_prezzo_cardmarket_vecchio
  from prodotti_sealed where id = p_id and stato = 'collezione';

  if v_owner_id is null then
    return;
  end if;

  update prodotti_sealed
  set prezzo_cardmarket = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';

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


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- 1. Firme (deve restare invariata la lista parametri, LANGUAGE ora plpgsql):
-- select pg_get_functiondef(oid) from pg_proc where proname in ('aggiorna_prezzo_controllo_gruppo','aggiorna_prezzo_controllo_gruppo_sealed');
--
-- 2. Prova end-to-end (serve un controllo prezzi di gruppo reale
--    dall'estensione, oppure una chiamata manuale di test):
-- select aggiorna_prezzo_controllo_gruppo('<id di una carta reale>', 12.34);
-- select * from movimenti_collezione where tipo_evento = 'prezzo_automatico' order by avvenuto_il desc limit 5;
-- -- deve comparire con valore_delta calcolato correttamente.
--
-- select aggiorna_prezzo_controllo_gruppo_sealed('<id di un prodotto sealed reale>', 45.00);
-- select * from movimenti_collezione where tipo_evento = 'prezzo_automatico' and oggetto_tipo = 'sealed' order by avvenuto_il desc limit 5;
-- -- deve comparire con valore_delta = null.
-- ============================================================================
