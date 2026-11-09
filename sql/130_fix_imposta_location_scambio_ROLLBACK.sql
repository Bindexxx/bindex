-- ROLLBACK di 130: rimette imposta_location_scambio_automatico come in 129 (quella che dava permission denied).

create or replace function public.imposta_location_scambio_automatico(p_nome text, p_attivo boolean)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
    v_uid uuid := auth.uid();
    v_nome text := btrim(coalesce(p_nome, ''));
    v_binder uuid;
    v_n int := 0;
begin
    if v_uid is null then raise exception 'Non autenticato'; end if;
    if v_nome = '' then raise exception 'Nome mancante'; end if;
    if upper(v_nome) in ('?', 'SCAMBIO', 'WISHLIST', '—') then
        raise exception 'Contenitore di sistema: non si può mandare in Scambio da solo';
    end if;

    insert into public.location (owner_id, nome, tipo, scambio_automatico)
    values (v_uid, v_nome, 'carta', coalesce(p_attivo, false))
    on conflict (owner_id, nome, tipo) do update set scambio_automatico = excluded.scambio_automatico;

    v_binder := public._binder_scambio_di(v_uid);
    if coalesce(p_attivo, false) then
        insert into public.binder_carte (owner_id, binder_id, carta_id, quantita_offerta)
        select v_uid, v_binder, c.id, coalesce(c.qty, 1)
          from public.carte c
         where c.owner_id = v_uid and c.stato = 'collezione' and c.location = v_nome
        on conflict (owner_id, binder_id, carta_id) do update set quantita_offerta = excluded.quantita_offerta;
        get diagnostics v_n = row_count;
    else
        delete from public.binder_carte bc
         using public.carte c
         where bc.binder_id = v_binder and bc.owner_id = v_uid and c.id = bc.carta_id
           and c.owner_id = v_uid and c.location = v_nome;
        get diagnostics v_n = row_count;
    end if;
    return jsonb_build_object('nome', v_nome, 'attivo', coalesce(p_attivo, false), 'carte', v_n);
end;
$function$;
