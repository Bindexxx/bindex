-- 147: soglia di variazione negli ordini di controllo prezzi della collezione.
-- Decisione di Claudio del 18/11/2026 (estensione più snella, rilascio 1 "Prezzi"):
-- "solo variazioni" con la soglia non è più un'opzione di ogni PC nell'estensione ma del
-- sito, e viaggia con l'ordine in ordini.parametri.sogliaVariazione (euro).
-- L'estensione (5.71) scrive il prezzo nuovo solo se cambia almeno di tanto; senza la
-- chiave lo scrive sempre. Wishlist e sealed: il sito mette la chiave in parametri da
-- solo (insert diretto), qui serve solo per la collezione, che passa da questa funzione.
--
-- Cosa cambia: crea_ordine_controllo_prezzi riceve p_soglia (facoltativo).
--   Va tolta la versione a 2 argomenti: con una seconda versione a 3 argomenti le chiamate
--   del sito (p_locations, p_aiuta_gruppo) diventerebbero ambigue. Con questa il sito di
--   oggi (2 argomenti, per nome) continua a funzionare: p_soglia vale null.
-- Si lancia dall'SQL Editor (contiene DROP), PRIMA di unire la PR del sito.

begin;

drop function public.crea_ordine_controllo_prezzi(text[], boolean);

create function public.crea_ordine_controllo_prezzi(
  p_locations text[] default null::text[],
  p_aiuta_gruppo boolean default false,
  p_soglia numeric default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_locations text[];
  v_parametri jsonb;
  v_id uuid;
begin
  -- sql/108 (punto 26): ordine + location private in un colpo solo.
  -- sql/147: soglia di variazione facoltativa (euro, > 0 e <= 100).
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
  if p_soglia is not null and (p_soglia <= 0 or p_soglia > 100) then
    raise exception 'SOGLIA_NON_VALIDA';
  end if;

  v_parametri := jsonb_build_object('aiutaGruppo', coalesce(p_aiuta_gruppo, false));
  if p_soglia is not null then
    v_parametri := v_parametri || jsonb_build_object('sogliaVariazione', round(p_soglia, 2));
  end if;

  insert into ordini (tipo, creato_da, parametri)
  values ('controlla_prezzi', v_uid, v_parametri)
  returning id into v_id;

  insert into ordini_parametri_privati (ordine_id, owner_id, locations)
  values (v_id, v_uid, v_locations);

  return v_id;
end;
$function$;

revoke execute on function public.crea_ordine_controllo_prezzi(text[], boolean, numeric) from public, anon;
grant execute on function public.crea_ordine_controllo_prezzi(text[], boolean, numeric) to authenticated, service_role;

commit;

-- Verifica (deve dare una sola riga, firma con numeric, permessi solo authenticated/service_role):
select p.oid::regprocedure as firma, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'crea_ordine_controllo_prezzi';
