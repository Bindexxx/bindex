-- Migration 29: aggiunge altro_binder_id alle due RPC di match.
--
-- Aggiunge 'altro_binder_id' alle due RPC di match, per permettere al
-- client di costruire binder-pubblico.html?u=<owner>&binder=<id> verso il
-- binder dell'ALTRA persona — oggi le due funzioni restituiscono
-- altro_owner_id ma nessun binder_id, quindi il client non può linkare.
--
-- Wishlist e Scambio sono SEMPRE pubblici per chiunque li possieda
-- (trg_binders_forza_condivisione), quindi qui non filtriamo su
-- condivisibile/stato_pubblicazione: per questi due tipi è già garantito.
--
-- ASSUNZIONE (confermata da Claudio, 2026-08-28): un owner ha al più UN
-- binder con tipo='wishlist' e al più UN binder con tipo='location' AND
-- location_valore='SCAMBIO'. Se non fosse più vero in futuro, il JOIN
-- produrrebbe righe duplicate per lo stesso match — nessun LIMIT messo
-- apposta, per non nascondere silenziosamente una violazione.
-- 'wishlist' e 'location' verificati come valori reali in uso (query
-- "select tipo, count(*) from binders group by tipo" — 2/12/2 righe).

CREATE OR REPLACE FUNCTION public.trova_match_scambio_wishlist(p_owner_id uuid)
 RETURNS TABLE(mia_carta_id uuid, mio_nome text, mio_prezzo numeric, altro_owner_id uuid, altra_email text, altra_wishlist_id uuid, altro_prezzo_obiettivo numeric, altro_binder_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nome, c.prezzo, w.owner_id, u.email, w.id, w.prezzo_obiettivo, wb.id
  from carte c
  join wishlist w on lower(w.nome) = lower(c.nome)
  join auth.users u on u.id = w.owner_id
  left join binders wb on wb.owner_id = w.owner_id and wb.tipo = 'wishlist'
  where c.owner_id = p_owner_id
    and c.location = 'SCAMBIO'
    and c.stato = 'collezione'
    and w.owner_id != p_owner_id
    and not exists (
      select 1 from preferenze_utente pu
      where pu.owner_id = w.owner_id and pu.nascondi_wishlist_da_match = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.trova_match_wishlist_scambio(p_owner_id uuid)
 RETURNS TABLE(mia_wishlist_id uuid, mio_nome text, mio_prezzo_obiettivo numeric, altro_owner_id uuid, altra_email text, altra_carta_id uuid, altro_prezzo numeric, altro_binder_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.id, w.nome, w.prezzo_obiettivo, c.owner_id, u.email, c.id, c.prezzo, cb.id
  from wishlist w
  join carte c on lower(c.nome) = lower(w.nome)
  join auth.users u on u.id = c.owner_id
  left join binders cb on cb.owner_id = c.owner_id and cb.tipo = 'location' and cb.location_valore = 'SCAMBIO'
  where w.owner_id = p_owner_id
    and c.location = 'SCAMBIO'
    and c.stato = 'collezione'
    and c.owner_id != p_owner_id
    and not exists (
      select 1 from preferenze_utente pu
      where pu.owner_id = c.owner_id and pu.nascondi_scambio_da_match = true
    );
$function$;

-- Query di verifica in coda: nessun match dovrebbe scomparire per un
-- owner che possiede sia SCAMBIO che WISHLIST (l'aggiunta del JOIN non
-- deve MAI ridurre i risultati rispetto a prima, solo aggiungere la
-- colonna) — confrontare il conteggio prima/dopo su un owner_id di test.
