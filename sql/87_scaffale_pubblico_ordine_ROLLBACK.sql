-- Rollback di sql/87: ripristina l'ordinamento per nome (corpo originale).
CREATE OR REPLACE FUNCTION public.leggi_scaffale_pubblico(p_scaffale_id uuid)
 RETURNS TABLE(id uuid, nome text, codice text, set_espansione text, lingua text, integrita_packaging text, qty integer, prezzo numeric, note text, immagine text, riservato integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_scaffale record;
begin
    select * into v_scaffale from public.scaffali where id = p_scaffale_id and stato_pubblicazione = 'pubblico';
    if v_scaffale is null then
        return;
    end if;

    if v_scaffale.tipo = 'scambio' then
        return query
        select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
               p.integrita_packaging, sp.quantita_offerta as qty, p.prezzo, p.note, p.immagine,
               coalesce((select sum(rsr.quantita_richiesta)::integer from public.richieste_scambio_righe rsr
                         where rsr.prodotto_sealed_id = p.id and rsr.stato_riga = 'accettata'), 0) as riservato
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
               p.integrita_packaging, p.qty, p.prezzo, p.note, p.immagine, 0::integer as riservato
        from public.prodotti_sealed p
        join public.scaffale_prodotti sp on sp.prodotto_id = p.id
        where sp.scaffale_id = p_scaffale_id
          and sp.owner_id = v_scaffale.owner_id
          and p.owner_id = v_scaffale.owner_id
          and p.stato = 'collezione'
        order by p.nome;
    end if;
end;
$function$;
