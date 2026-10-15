-- ============================================================================
-- ROLLBACK di sql/111 (punto 27).
-- 1. Il testo di diagnosi torna nel campo note (solo dove la nota è vuota:
--    le note scritte nel frattempo dagli utenti non si toccano).
-- 2. Le 7 funzioni di scrittura del controllo prezzi di gruppo tornano
--    IDENTICHE a prima di sql/111 (testo verificato con md5 sul DB il
--    2026-10-15): di nuovo senza controllo su prenotazione/proprietario.
-- 3. Vengono tolte le colonne carte.esito_controllo / esito_controllo_il.
-- Contiene DROP: da eseguire nell'SQL editor di Supabase.
-- ============================================================================

-- ── 1. DIAGNOSI DI NUOVO NELLE NOTE ────────────────────────────────────────
update public.carte
set note = esito_controllo
where esito_controllo is not null
  and coalesce(note, '') = '';

-- ── 2. FUNZIONI COME PRIMA DI sql/111 ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aggiorna_nota_controllo_gruppo(p_id uuid, p_nota text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set note = p_nota
  where id = p_id
    and stato = 'collezione';
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
    update carte
    set url = p_url
    where id = p_id
      and stato = 'collezione';
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
    update prodotti_sealed
    set url = p_url
    where id = p_id
      and stato = 'collezione';
end;
$function$;

CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update carte
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione';
$function$;

CREATE OR REPLACE FUNCTION public.segna_controllata_gruppo_sealed(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set ultimo_controllo = now()
  where id = p_id
    and stato = 'collezione';
$function$;

-- ── 3. VIA LE COLONNE NUOVE ────────────────────────────────────────────────
alter table public.carte
  drop column if exists esito_controllo,
  drop column if exists esito_controllo_il;

-- Verifica: nessuna funzione con "sql/111", colonne assenti.
select p.proname, pg_get_functiondef(p.oid) like '%sql/111%' as ancora_111
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('aggiorna_nota_controllo_gruppo', 'aggiorna_prezzo_controllo_gruppo', 'aggiorna_prezzo_controllo_gruppo_sealed',
                    'aggiorna_url_controllo_gruppo', 'aggiorna_url_controllo_gruppo_sealed',
                    'segna_controllata_gruppo', 'segna_controllata_gruppo_sealed');
select count(*) as colonne_esito_rimaste from information_schema.columns
where table_schema = 'public' and table_name = 'carte' and column_name like 'esito_controllo%';
