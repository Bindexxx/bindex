-- ROLLBACK di 152: il controllo automatico torna a ricontrollare tutte le carte ogni p_giorni_minimi
-- giorni. Rimette la riga di prima nelle due funzioni (stesso metodo: testo dal DB + replace, si
-- ferma se la riga di sql/152 non c'è esattamente una volta) e toglie la funzione d'appoggio.
-- Corpo delle funzioni prima di sql/152 (md5 di pg_get_functiondef, 19/11/2026):
--   conta_carte_da_controllare_gruppo   aea4e4540efce015e545227152d5f685
--   reclama_carte_per_controllo_prezzi  0c54c791b17f557b70c66b49095a6425
-- Si lancia dall'SQL Editor (contiene DROP).

begin;

do $do$
declare
  v_def text;
  v_vecchia text;
  v_nuova text;
begin
  v_def := pg_get_functiondef('public.conta_carte_da_controllare_gruppo(uuid,boolean,text[],boolean,integer,uuid)'::regprocedure);
  v_nuova := 'and (not p_solo_vecchie or ultimo_controllo is null'
          || ' or ultimo_controllo < now() - make_interval(days => public._giorni_controllo_automatico(prezzo, p_giorni_minimi))) -- sql/152';
  v_vecchia := 'and (not p_solo_vecchie or ultimo_controllo is null or ultimo_controllo < v_soglia)';
  if (length(v_def) - length(replace(v_def, v_nuova, ''))) / length(v_nuova) <> 1 then
    raise exception 'ROLLBACK 152: in conta_carte_da_controllare_gruppo la riga di sql/152 non c''è una volta sola';
  end if;
  execute replace(v_def, v_nuova, v_vecchia);

  v_def := pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure);
  v_nuova := 'and (p_solo_vecchie = false or k.ultimo_controllo is null'
          || ' or k.ultimo_controllo < now() - make_interval(days => public._giorni_controllo_automatico(k.prezzo, p_giorni_minimi))) -- sql/152';
  v_vecchia := 'and (p_solo_vecchie = false or k.ultimo_controllo is null or k.ultimo_controllo < v_soglia_vecchie)';
  if (length(v_def) - length(replace(v_def, v_nuova, ''))) / length(v_nuova) <> 1 then
    raise exception 'ROLLBACK 152: in reclama_carte_per_controllo_prezzi la riga di sql/152 non c''è una volta sola';
  end if;
  execute replace(v_def, v_nuova, v_vecchia);
end
$do$;

drop function if exists public._giorni_controllo_automatico(numeric, integer);

commit;

-- Verifica: md5 uguali a quelli in testa (aea4e454…, 0c54c791…) e funzione d'appoggio sparita (0).
select md5(pg_get_functiondef('public.conta_carte_da_controllare_gruppo(uuid,boolean,text[],boolean,integer,uuid)'::regprocedure)) as md5_conta,
       md5(pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure)) as md5_reclama,
       (select count(*) from pg_proc where proname = '_giorni_controllo_automatico') as funzione_appoggio;
