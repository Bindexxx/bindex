-- ROLLBACK della 147: crea_ordine_controllo_prezzi torna a 2 argomenti (corpo della 108).
-- Prima di lanciarlo: il sito non deve più passare p_soglia (PR del sito tolta), altrimenti
-- la creazione degli ordini della collezione con una soglia dà errore.
-- Gli ordini già creati con parametri.sogliaVariazione restano come sono.

begin;

drop function public.crea_ordine_controllo_prezzi(text[], boolean, numeric);

create function public.crea_ordine_controllo_prezzi(
  p_locations text[] default null::text[],
  p_aiuta_gruppo boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_locations text[];
  v_id uuid;
begin
  -- sql/108 (punto 26): ordine + location private in un colpo solo.
  if v_uid is null then
    raise exception 'NON_AUTENTICATO';
  end if;

  -- Location ripulite: niente vuoti, niente doppioni. Nessuna = tutte.
  select coalesce(array_agg(distinct l order by l), '{}'::text[]) into v_locations
  from unnest(coalesce(p_locations, '{}'::text[])) as l
  where l is not null and btrim(l) <> '';
  if coalesce(array_length(v_locations, 1), 0) > 200 then
    raise exception 'TROPPE_LOCATION';
  end if;
  if exists (select 1 from unnest(v_locations) as l where length(l) > 200) then
    raise exception 'LOCATION_NON_VALIDA';
  end if;

  insert into ordini (tipo, creato_da, parametri)
  values ('controlla_prezzi', v_uid, jsonb_build_object('aiutaGruppo', coalesce(p_aiuta_gruppo, false)))
  returning id into v_id;

  insert into ordini_parametri_privati (ordine_id, owner_id, locations)
  values (v_id, v_uid, v_locations);

  return v_id;
end;
$function$;

revoke execute on function public.crea_ordine_controllo_prezzi(text[], boolean) from public, anon;
grant execute on function public.crea_ordine_controllo_prezzi(text[], boolean) to authenticated, service_role;

commit;

select p.oid::regprocedure as firma, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'crea_ordine_controllo_prezzi';
