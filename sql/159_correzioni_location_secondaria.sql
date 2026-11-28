-- 159: la location secondaria passa anche nelle "carte da correggere" (28/11/2026).
-- Quando l'estensione non trova una carta, sposta_riga_in_correzione_manuale la copia in
-- correzioni_manuali_carte: ora copia anche la secondaria, presa dalla richiesta originale come la
-- location (la vista la nasconde per le righe altrui). Lanciare DOPO sql/158.
-- Il corpo della funzione contiene una cancellazione: va lanciato nell'SQL Editor.

begin;

do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      ($a$integrita_packaging, sigillata_originale$a$,
       $b$integrita_packaging, sigillata_originale, location_secondaria$b$),
      ($a$v_riga.integrita_packaging, coalesce(v_riga.sigillata_originale, false)$a$,
       $b$v_riga.integrita_packaging, coalesce(v_riga.sigillata_originale, false),
        (select nullif(l.payload ->> 'location_secondaria', '') from coda_lavoro l where l.id = p_riga_id)$b$)
    ) as t(prima, dopo)
  loop
    v_def := pg_get_functiondef('public.sposta_riga_in_correzione_manuale(bigint,text,jsonb)'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception '159: la riga attesa compare % volte invece di 1: %', v_n, r.prima;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

commit;

-- verifica (deve dare true)
select pg_get_functiondef('public.sposta_riga_in_correzione_manuale(bigint,text,jsonb)'::regprocedure)
       like '%payload ->> ''location_secondaria''%' as correzioni_ok;
