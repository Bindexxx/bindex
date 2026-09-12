-- ============================================================================
-- CardSync Pro — 39: Fase 1.2 (parte database) — controllo prezzi di
-- gruppo per prodotti_sealed
--
-- Duplicazione intenzionale (Regola d'Oro #1) delle funzioni già esistenti
-- per 'carte', stesso comportamento esatto, puntate su 'prodotti_sealed'.
-- Le funzioni originali restano intoccate.
--
-- Aggiunge anche prodotti_sealed.url, mancante da 37_fase1_fondazioni_sealed
-- (serve per salvare il link Cardmarket trovato, come carte.url).
-- ============================================================================

ALTER TABLE public.prodotti_sealed ADD COLUMN url text;


CREATE OR REPLACE FUNCTION public.conta_prodotti_sealed_da_controllare_gruppo(
  p_owner_id_richiesto uuid DEFAULT NULL::uuid,
  p_solo_proprie boolean DEFAULT true,
  p_filtro_location text[] DEFAULT NULL::text[],
  p_solo_vecchie boolean DEFAULT false,
  p_giorni_minimi integer DEFAULT 3
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
  v_soglia timestamptz;
begin
  v_soglia := now() - (p_giorni_minimi || ' days')::interval;

  select count(*) into v_count
  from prodotti_sealed
  where stato = 'collezione'
    and (not p_solo_proprie or owner_id = coalesce(p_owner_id_richiesto, auth.uid()))
    and (p_filtro_location is null or location = any(p_filtro_location))
    and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia);

  return v_count;
end;
$function$;


CREATE OR REPLACE FUNCTION public.reclama_prodotti_sealed_per_controllo_prezzi(
  p_user_id uuid,
  p_owner_id_richiesto uuid DEFAULT NULL::uuid,
  p_solo_proprie boolean DEFAULT true,
  p_filtro_location text[] DEFAULT NULL::text[],
  p_solo_vecchie boolean DEFAULT false,
  p_giorni_minimi integer DEFAULT 3,
  p_lotto_size integer DEFAULT 3
)
 RETURNS SETOF prodotti_sealed
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_soglia_claim timestamptz := now() - interval '10 minutes';
  v_soglia_vecchie timestamptz;
begin
  if p_solo_vecchie then
    v_soglia_vecchie := now() - (p_giorni_minimi || ' days')::interval;
  end if;

  return query
  update prodotti_sealed c
  set claimed_by = p_user_id, claimed_at = now()
  where c.id in (
    select id from prodotti_sealed
    where stato = 'collezione'
      and (p_solo_proprie = false or owner_id = coalesce(p_owner_id_richiesto, p_user_id))
      and (p_filtro_location is null or array_length(p_filtro_location, 1) is null or location = any(p_filtro_location))
      and (p_solo_vecchie = false or ultimo_controllo is null or ultimo_controllo < v_soglia_vecchie)
      and (claimed_by is null or claimed_by = p_user_id or claimed_at < v_soglia_claim)
    order by ultimo_controllo asc nulls first
    limit p_lotto_size
    for update skip locked
  )
  returning c.*;
end;
$function$;


CREATE OR REPLACE FUNCTION public.tagga_dispositivo_claim_gruppo_sealed(p_ids uuid[], p_dispositivo text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set dispositivo = p_dispositivo
  where id = any(p_ids)
    and claimed_by = auth.uid()
    and stato = 'collezione';
$function$;


CREATE OR REPLACE FUNCTION public.rilascia_claim_controllo_prezzi_sealed(p_dispositivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set claimed_by = null, claimed_at = null, dispositivo = null
  where claimed_by = auth.uid()
    and (p_dispositivo is null or dispositivo = p_dispositivo);
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


CREATE OR REPLACE FUNCTION public.aggiorna_prezzo_controllo_gruppo_sealed(p_id uuid, p_prezzo numeric, p_immagine text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set prezzo_cardmarket = p_prezzo,
      ultimo_controllo = now(),
      immagine = coalesce(p_immagine, immagine)
  where id = p_id
    and stato = 'collezione';
$function$;

-- NOTA: scrive prezzo_cardmarket, non prezzo — a differenza di carte
-- (dove 'prezzo' è l'unico prezzo che esiste), prodotti_sealed distingue
-- prezzo (richiesto/di vendita, manuale) da prezzo_cardmarket (trovato
-- automaticamente). Il controllo prezzi di gruppo aggiorna solo quello
-- automatico, mai quello impostato a mano dal proprietario.


CREATE OR REPLACE FUNCTION public.aggiorna_url_controllo_gruppo_sealed(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update prodotti_sealed
  set url = p_url
  where id = p_id
    and stato = 'collezione';
$function$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select conta_prodotti_sealed_da_controllare_gruppo();
-- -- deve tornare un numero (0 se non hai ancora prodotti sealed vecchi)
--
-- Test end-to-end (richiede un prodotto sealed di prova già inserito):
-- select * from reclama_prodotti_sealed_per_controllo_prezzi(auth.uid(), null, true, null, false, 3, 1);
-- -- la riga torna con claimed_by = auth.uid()
-- select aggiorna_prezzo_controllo_gruppo_sealed('<id riga sopra>'::uuid, 42.50);
-- select prezzo_cardmarket, ultimo_controllo from prodotti_sealed where id = '<id riga sopra>'::uuid;
-- select rilascia_claim_controllo_prezzi_sealed();
-- select claimed_by from prodotti_sealed where id = '<id riga sopra>'::uuid; -- deve essere null
