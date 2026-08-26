-- ============================================================================
-- 22_binder_pubblico_generico.sql
-- Item 4 (condivisione binder), parte DB. leggi_binder_pubblico esisteva
-- solo per tipo 'location' (firma p_owner_id + p_location_valore) — il tipo
-- 'extra' (appartenenza tramite binder_carte, non location) non aveva
-- NESSUNA query pubblica. Cambio la firma a un solo parametro (p_binder_id)
-- e gestisco entrambi i tipi dentro la funzione — più semplice da chiamare
-- lato client, un solo binder_id in mano basta sempre.
--
-- DROP esplicito prima del CREATE: cambiare la lista parametri di una
-- funzione Postgres crea un OVERLOAD, non sostituisce quella vecchia — la
-- vecchia firma (p_owner_id uuid, p_location_valore text) andrebbe droppata
-- comunque per non lasciarla in giro inutilizzata. Non è mai stata
-- richiamata da nessun codice consegnato finora (verificato: bindersLeggiPubblico
-- in data/binder.repository.js non è ancora chiamata da nessuna UI), quindi
-- il drop è sicuro.
--
-- Wishlist NON passa da qui: ha già leggi_wishlist_condivisa dedicata e la
-- pagina wishlist.html esistente — resta così, non tocco nulla lì.
-- ============================================================================

drop function if exists public.leggi_binder_pubblico(uuid, text);

create or replace function public.leggi_binder_pubblico(p_binder_id uuid)
returns table(
    id uuid, nome text, codice text, lingua text, condizione text,
    qty integer, prezzo numeric, note text, url text, immagine text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_binder record;
begin
    select * into v_binder from public.binders where id = p_binder_id and stato_pubblicazione = 'pubblico';
    if v_binder is null then
        return; -- binder inesistente o non pubblico: nessuna riga, mai un errore che riveli la differenza
    end if;

    if v_binder.tipo = 'location' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, c.note, c.url, c.immagine
        from public.carte c
        where c.owner_id = v_binder.owner_id
          and c.location = v_binder.location_valore
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'extra' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, c.note, c.url, c.immagine
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
        order by c.nome;
    end if;
    -- tipo 'wishlist': mai raggiunto da qui, vedi nota in testa al file.
end;
$$;

-- Info di intestazione per la pagina pubblica (nome, tipo, owner) — separata
-- dalla lettura carte sopra così la pagina puo' mostrare "questo binder non
-- e' piu' pubblico" senza dover interpretare un array vuoto di carte (che
-- potrebbe anche solo significare "binder pubblico ma vuoto").
create or replace function public.leggi_binder_pubblico_info(p_binder_id uuid)
returns table(nome text, tipo text, location_valore text, owner_id uuid)
language sql
security definer
set search_path to 'public'
as $$
    select b.nome, b.tipo, b.location_valore, b.owner_id
    from public.binders b
    where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
$$;
