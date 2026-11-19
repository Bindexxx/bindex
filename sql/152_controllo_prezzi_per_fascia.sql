-- 152: controllo automatico dei prezzi del gruppo per fasce di prezzo (decisione di Claudio del
-- 19/11/2026, fasce "A"). Il controllo automatico (quello che parte da solo con "Aiuta il gruppo",
-- p_solo_vecchie = true) ricontrollava tutte le carte ogni 2 giorni: ~1.250 pagine Cardmarket e
-- ~7 ore di PC al giorno, per 2/3 su carte sotto 0,25 € (118 € su ~3.600 € di collezione). Nello
-- storico di 45 giorni, su 1.964 carte sotto 0,25 € una sola ha superato 1 € e 5 hanno superato 0,50 €.
--
-- Nuova soglia del controllo automatico (giorni dall'ultimo controllo):
--   prezzo sotto 0,25 €  → 30 giorni
--   da 0,25 a 1 €        → 14 giorni
--   da 1 a 5 €           →  7 giorni
--   da 5 € in su, o senza prezzo → come prima (p_giorni_minimi, oggi 2)
-- Stima: ~200 pagine e ~1,2 ore di PC al giorno.
-- I controlli lanciati a mano e gli ordini dal sito (p_solo_vecchie = false) non cambiano.
--
-- Cosa cambia:
--   _giorni_controllo_automatico(prezzo, giorni_minimi)  nuova, la regola in un posto solo
--   conta_carte_da_controllare_gruppo   una riga: la soglia del filtro p_solo_vecchie
--   reclama_carte_per_controllo_prezzi  una riga: la soglia del filtro p_solo_vecchie
-- Le due funzioni si cambiano partendo dal loro testo sul DB (pg_get_functiondef + replace):
-- se la riga da cambiare non c'è esattamente una volta, si ferma tutto e non cambia niente.
-- Si lancia dall'SQL Editor (contiene REVOKE).

begin;

create or replace function public._giorni_controllo_automatico(p_prezzo numeric, p_giorni_minimi integer)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  -- sql/152: giorni dall'ultimo controllo prima che il controllo automatico ripassi una carta
  select greatest(coalesce(p_giorni_minimi, 3),
                  case when p_prezzo is null then 0
                       when p_prezzo < 0.25 then 30
                       when p_prezzo < 1 then 14
                       when p_prezzo < 5 then 7
                       else 0 end);
$function$;

revoke execute on function public._giorni_controllo_automatico(numeric, integer) from public, anon;
grant execute on function public._giorni_controllo_automatico(numeric, integer) to authenticated, service_role;

do $do$
declare
  v_def text;
  v_vecchia text;
  v_nuova text;
begin
  -- conta_carte_da_controllare_gruppo
  v_def := pg_get_functiondef('public.conta_carte_da_controllare_gruppo(uuid,boolean,text[],boolean,integer,uuid)'::regprocedure);
  v_vecchia := 'and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia)';
  v_nuova := 'and (not p_solo_vecchie or ultimo_controllo is null'
          || ' or ultimo_controllo < now() - make_interval(days => public._giorni_controllo_automatico(prezzo, p_giorni_minimi))) -- sql/152';
  if (length(v_def) - length(replace(v_def, v_vecchia, ''))) / length(v_vecchia) <> 1 then
    raise exception 'sql/152: in conta_carte_da_controllare_gruppo la riga da cambiare non c''è una volta sola';
  end if;
  execute replace(v_def, v_vecchia, v_nuova);

  -- reclama_carte_per_controllo_prezzi
  v_def := pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure);
  v_vecchia := 'and (p_solo_vecchie = false or k.ultimo_controllo is null or k.ultimo_controllo < v_soglia_vecchie)';
  v_nuova := 'and (p_solo_vecchie = false or k.ultimo_controllo is null'
          || ' or k.ultimo_controllo < now() - make_interval(days => public._giorni_controllo_automatico(k.prezzo, p_giorni_minimi))) -- sql/152';
  if (length(v_def) - length(replace(v_def, v_vecchia, ''))) / length(v_vecchia) <> 1 then
    raise exception 'sql/152: in reclama_carte_per_controllo_prezzi la riga da cambiare non c''è una volta sola';
  end if;
  execute replace(v_def, v_vecchia, v_nuova);
end
$do$;

commit;

-- Verifica: le due funzioni hanno la riga nuova (true, true), i permessi sono rimasti, e quante
-- carte il controllo automatico vedrebbe adesso (prima di sql/152 erano tutte quelle non
-- controllate da 2 giorni).
select p.proname, pg_get_functiondef(p.oid) like '%_giorni_controllo_automatico(%' as nuova_regola, p.proacl::text as permessi
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('conta_carte_da_controllare_gruppo', 'reclama_carte_per_controllo_prezzi')
 order by 1;
select count(*) filter (where ultimo_controllo is null or ultimo_controllo < now() - interval '2 days') as prima,
       count(*) filter (where ultimo_controllo is null
                          or ultimo_controllo < now() - make_interval(days => public._giorni_controllo_automatico(prezzo, 2))) as adesso
  from public.carte where stato = 'collezione';
