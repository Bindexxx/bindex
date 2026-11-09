-- 130 — Correzione di 129 (09/11/2026): accendere/spegnere la spunta dal sito dava
-- "permission denied for function _binder_scambio_di" (imposta_location_scambio_automatico gira con
-- i permessi dell'utente e chiamava una funzione riservata ai trigger). Ora trova/crea il binder
-- Scambio da sola, con la RLS dell'utente, come fa il sito. Trigger e resto di 129 invariati.
-- Contiene DELETE nel corpo della funzione: va lanciato dall'SQL Editor.
-- Rollback: 130_fix_imposta_location_scambio_ROLLBACK.sql (rimette la versione di 129).

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

    -- Binder Scambio cercato/creato qui, con i permessi dell'utente (RLS): _binder_scambio_di
    -- è riservata ai trigger e l'utente non la può chiamare.
    select id into v_binder from public.binders where owner_id = v_uid and tipo = 'scambio' order by created_at limit 1;
    if v_binder is null then
        insert into public.binders (owner_id, tipo, nome) values (v_uid, 'scambio', 'Scambio') returning id into v_binder;
    end if;
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

-- Verifica: deve dire false (la funzione non chiama più _binder_scambio_di).
select position('_binder_scambio_di(v_uid)' in pg_get_functiondef('public.imposta_location_scambio_automatico(text, boolean)'::regprocedure)) > 0 as chiama_ancora_binder_scambio_di;
