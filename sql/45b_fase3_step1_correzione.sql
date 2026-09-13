-- ============================================================================
-- CardSync Pro — 45b: Fase 3, Step 1 — CORREZIONE blocchi 4+5 di sql/45
-- (i blocchi 1-3 di sql/45 sono già stati eseguiti con successo, non
-- ripeterli — ADD COLUMN fallirebbe su colonna già esistente)
--
-- ERRORE nel file originale: presumevo la firma di leggi_binder_pubblico
-- identica a sql/22 (10 colonne). Sul DB reale ha un'11ª colonna,
-- prezzo_obiettivo numeric (aggiunta da 27_leggi_binder_pubblico_
-- wishlist.sql, mai vista prima in questa sessione) — e gestisce GIÀ
-- tipo='wishlist' al proprio interno (il commento "mai raggiunto da qui"
-- di sql/22 era diventato stale dopo il file 27, non l'avevo notato).
-- Corretto qui: stessa firma reale a 11 colonne, ramo wishlist preservato
-- verbatim, nuovo ramo 'scambio' con null::numeric as prezzo_obiettivo
-- (Scambio non ha un concetto di prezzo obiettivo, come location/extra).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leggi_binder_pubblico(p_binder_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, lingua text, condizione text, qty integer, prezzo numeric, prezzo_obiettivo numeric, note text, url text, immagine text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_binder record;
begin
    select b.* into v_binder from public.binders b where b.id = p_binder_id and b.stato_pubblicazione = 'pubblico';
    if v_binder is null then
        return;
    end if;
    if v_binder.tipo = 'location' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine
        from public.carte c
        where c.owner_id = v_binder.owner_id
          and c.location = v_binder.location_valore
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'extra' then
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, c.qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
        order by c.nome;
    elsif v_binder.tipo = 'wishlist' then
        return query
        select w.id, w.nome, w.codice, w.lingua, w.condizione, w.qty, w.prezzo, w.prezzo_obiettivo, w.note, w.url, w.immagine
        from public.wishlist w
        where w.owner_id = v_binder.owner_id
        order by w.nome;
    elsif v_binder.tipo = 'scambio' then
        -- Fase 3, Step 1 (2026-09-12): quantita_offerta al posto di qty —
        -- il pubblico vede quanto è offerto, non quanto è posseduto. Solo
        -- righe con quantita_offerta > 0 (offerta a 0 = non ancora messa
        -- in vendita, non deve comparire nella vetrina pubblica).
        return query
        select c.id, c.nome, c.codice, c.lingua, c.condizione, bc.quantita_offerta as qty, c.prezzo, null::numeric as prezzo_obiettivo, c.note, c.url, c.immagine
        from public.carte c
        join public.binder_carte bc on bc.carta_id = c.id
        where bc.binder_id = p_binder_id
          and bc.owner_id = v_binder.owner_id
          and c.owner_id = v_binder.owner_id
          and c.stato = 'collezione'
          and bc.quantita_offerta > 0
        order by c.nome;
    end if;
end;
$function$;


-- ── Migrazione dell'unico binder Scambio esistente (invariata da sql/45) ──
DO $$
DECLARE
    v_binder record;
BEGIN
    FOR v_binder IN
        SELECT id, owner_id FROM public.binders WHERE tipo = 'location' AND location_valore = 'SCAMBIO'
    LOOP
        UPDATE public.binders SET tipo = 'scambio', location_valore = NULL WHERE id = v_binder.id;

        INSERT INTO public.binder_carte (owner_id, carta_id, binder_id, quantita_offerta)
        SELECT c.owner_id, c.id, v_binder.id, 0
        FROM public.carte c
        WHERE c.owner_id = v_binder.owner_id AND c.location = 'SCAMBIO' AND c.stato = 'collezione'
        ON CONFLICT (owner_id, binder_id, carta_id) DO NOTHING;

        UPDATE public.carte SET location = '?' WHERE owner_id = v_binder.owner_id AND location = 'SCAMBIO' AND stato = 'collezione';
    END LOOP;
END $$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE (identica a sql/45)
-- ============================================================================
-- select tipo, location_valore from binders where tipo = 'scambio';
-- select count(*) from carte where location = 'SCAMBIO'; -- deve essere 0
-- select count(*) from binder_carte bc join binders b on b.id = bc.binder_id where b.tipo = 'scambio';
