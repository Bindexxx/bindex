-- ============================================================================
-- CardSync Pro — 46: Fase 3, Step 4 — leggi_scaffale_pubblico distingue
-- Scambio da libero/vetrina
--
-- Oggi (sql/43) restituisce sempre p.qty (posseduta) per qualunque tipo di
-- scaffale — sbagliato per tipo='scambio': il pubblico deve vedere quanto è
-- OFFERTO (scaffale_prodotti.quantita_offerta), non quanto è posseduto,
-- stesso principio già applicato a leggi_binder_pubblico per le carte
-- (sql/45b). STESSA firma di ritorno di sql/43 — nessun DROP+CREATE
-- necessario, riuso lo slot 'qty' esattamente come per le carte.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leggi_scaffale_pubblico(p_scaffale_id uuid)
returns table(
    id uuid, nome text, codice text, set_espansione text, lingua text,
    integrita_packaging text, qty integer, prezzo numeric, note text, immagine text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_scaffale record;
begin
    select * into v_scaffale from public.scaffali where id = p_scaffale_id and stato_pubblicazione = 'pubblico';
    if v_scaffale is null then
        return;
    end if;

    if v_scaffale.tipo = 'scambio' then
        -- Fase 3, Step 4 (2026-09-12): quantita_offerta al posto di qty —
        -- il pubblico vede quanto è offerto, non quanto è posseduto. Solo
        -- righe con quantita_offerta > 0 (offerta a 0 = non ancora messa
        -- in vendita, non deve comparire nella vetrina pubblica) — stesso
        -- principio del ramo 'scambio' di leggi_binder_pubblico (sql/45b).
        return query
        select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
               p.integrita_packaging, sp.quantita_offerta as qty, p.prezzo, p.note, p.immagine
        from public.prodotti_sealed p
        join public.scaffale_prodotti sp on sp.prodotto_id = p.id
        where sp.scaffale_id = p_scaffale_id
          and sp.owner_id = v_scaffale.owner_id
          and p.owner_id = v_scaffale.owner_id
          and p.stato = 'collezione'
          and sp.quantita_offerta > 0
        order by p.nome;
    else
        return query
        select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
               p.integrita_packaging, p.qty, p.prezzo, p.note, p.immagine
        from public.prodotti_sealed p
        join public.scaffale_prodotti sp on sp.prodotto_id = p.id
        where sp.scaffale_id = p_scaffale_id
          and sp.owner_id = v_scaffale.owner_id
          and p.owner_id = v_scaffale.owner_id
          and p.stato = 'collezione'
        order by p.nome;
    end if;
end;
$$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select pg_get_functiondef(oid) from pg_proc where proname = 'leggi_scaffale_pubblico';
-- -- deve contenere il ramo "if v_scaffale.tipo = 'scambio'"
