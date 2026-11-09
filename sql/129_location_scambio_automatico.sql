-- 129 — Location che va in Scambio da sola (09/11/2026, punto 6).
-- Con la spunta su una location, le sue carte stanno sempre nel binder Scambio con tutte le copie:
--   * una carta che entra nella location (nuova, spostata, ricevuta da uno scambio, ripristinata) va in Scambio;
--   * una carta che esce verso una location senza spunta esce dallo Scambio;
--   * se cambiano le copie di una carta in quella location, l'offerta diventa tutte le copie.
-- concludi_riga_richiesta toglieva lei le copie scambiate da binder_carte.quantita_offerta: per le carte
-- di una location con la spunta lo salta (lo fa già il trigger), altrimenti le toglierebbe due volte.
-- Accendendo la spunta ci vanno anche le carte già dentro; spegnendola escono dallo Scambio tutte le
-- carte di quella location.
-- Contiene REVOKE e DELETE (nel corpo delle funzioni): va lanciato dall'SQL Editor, non dal connettore.
-- Rollback: 129_location_scambio_automatico_ROLLBACK.sql

alter table public.location add column if not exists scambio_automatico boolean not null default false;

-- Id del binder Scambio del proprietario, creato se manca (come fa il sito con binderScambioGarantisci).
create or replace function public._binder_scambio_di(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_id uuid;
begin
    select id into v_id from public.binders where owner_id = p_owner and tipo = 'scambio' order by created_at limit 1;
    if v_id is null then
        insert into public.binders (owner_id, tipo, nome) values (p_owner, 'scambio', 'Scambio') returning id into v_id;
    end if;
    return v_id;
end;
$function$;

create or replace function public._carte_scambio_automatico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_nuova_auto boolean := false;
    v_vecchia_auto boolean := false;
    v_binder uuid;
begin
    if new.stato = 'collezione' and new.location is not null then
        select exists (select 1 from public.location l
                        where l.owner_id = new.owner_id and l.tipo = 'carta' and l.nome = new.location and l.scambio_automatico)
          into v_nuova_auto;
    end if;

    if tg_op = 'UPDATE' and new.location is not distinct from old.location and new.owner_id = old.owner_id then
        -- Stessa location: si allinea quando cambiano le copie.
        if v_nuova_auto and coalesce(new.qty, 1) <> coalesce(old.qty, 1) and coalesce(new.qty, 1) > 0 then
            v_binder := public._binder_scambio_di(new.owner_id);
            insert into public.binder_carte (owner_id, binder_id, carta_id, quantita_offerta)
            values (new.owner_id, v_binder, new.id, coalesce(new.qty, 1))
            on conflict (owner_id, binder_id, carta_id) do update set quantita_offerta = excluded.quantita_offerta;
        end if;
        return new;
    end if;

    if v_nuova_auto then
        v_binder := public._binder_scambio_di(new.owner_id);
        insert into public.binder_carte (owner_id, binder_id, carta_id, quantita_offerta)
        values (new.owner_id, v_binder, new.id, coalesce(new.qty, 1))
        on conflict (owner_id, binder_id, carta_id) do update set quantita_offerta = excluded.quantita_offerta;
        return new;
    end if;

    if tg_op = 'UPDATE' and old.location is not null then
        select exists (select 1 from public.location l
                        where l.owner_id = old.owner_id and l.tipo = 'carta' and l.nome = old.location and l.scambio_automatico)
          into v_vecchia_auto;
        if v_vecchia_auto then
            delete from public.binder_carte bc
             using public.binders b
             where b.id = bc.binder_id and b.tipo = 'scambio' and b.owner_id = old.owner_id and bc.carta_id = new.id;
        end if;
    end if;
    return new;
end;
$function$;

drop trigger if exists trg_carte_scambio_automatico on public.carte;
create trigger trg_carte_scambio_automatico
    after insert or update of location, qty, stato, owner_id on public.carte
    for each row execute function public._carte_scambio_automatico();

-- Accende/spegne la spunta di una location dell'utente (la crea se è usata solo dalle carte).
-- Ritorna quante carte sono entrate o uscite dallo Scambio.
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

-- concludi_riga_richiesta: niente sottrazione per le carte di una location con la spunta.
-- Si cambia solo questa riga della funzione vera (se non la trova si ferma tutto).
do $patch$
declare
    v_def text := pg_get_functiondef('public.concludi_riga_richiesta(uuid, text)'::regprocedure);
    v_da text := 'where carta_id = v_carta.id and binder_id = (select id from binders where owner_id = v_riga.proprietario_id and tipo = ''scambio'');';
    v_a text := 'where carta_id = v_carta.id and binder_id = (select id from binders where owner_id = v_riga.proprietario_id and tipo = ''scambio'')'
             || ' and not exists (select 1 from location l where l.owner_id = v_carta.owner_id and l.tipo = ''carta'' and l.nome = v_carta.location and l.scambio_automatico);';
begin
    if position(v_a in v_def) > 0 then
        raise notice 'concludi_riga_richiesta già aggiornata';
        return;
    end if;
    if (length(v_def) - length(replace(v_def, v_da, ''))) / length(v_da) <> 1 then
        raise exception 'concludi_riga_richiesta non è quella attesa: riga da cambiare non trovata una sola volta';
    end if;
    execute replace(v_def, v_da, v_a);
end
$patch$;

-- Le funzioni dei trigger non si chiamano da fuori (come sql/126).
revoke execute on function public._carte_scambio_automatico() from public, anon, authenticated;
revoke execute on function public._binder_scambio_di(uuid) from public, anon, authenticated;
revoke execute on function public.imposta_location_scambio_automatico(text, boolean) from public, anon;
grant execute on function public.imposta_location_scambio_automatico(text, boolean) to authenticated;

-- Verifica
select column_name, data_type, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'location' and column_name = 'scambio_automatico';
select trigger_name, action_timing, event_manipulation from information_schema.triggers
 where trigger_schema = 'public' and trigger_name = 'trg_carte_scambio_automatico';
select position('l.scambio_automatico' in pg_get_functiondef('public.concludi_riga_richiesta(uuid, text)'::regprocedure)) > 0 as concludi_aggiornata;
