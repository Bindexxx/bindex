-- ROLLBACK di 159: sposta_riga_in_correzione_manuale come prima (senza location secondaria).
-- Va lanciato nell'SQL Editor, prima dell'eventuale ROLLBACK di 158.

begin;

do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      ($b$v_riga.integrita_packaging, coalesce(v_riga.sigillata_originale, false),
        (select nullif(l.payload ->> 'location_secondaria', '') from coda_lavoro l where l.id = p_riga_id)$b$,
       $a$v_riga.integrita_packaging, coalesce(v_riga.sigillata_originale, false)$a$),
      ($b$integrita_packaging, sigillata_originale, location_secondaria$b$,
       $a$integrita_packaging, sigillata_originale$a$)
    ) as t(prima, dopo)
  loop
    v_def := pg_get_functiondef('public.sposta_riga_in_correzione_manuale(bigint,text,jsonb)'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception 'ROLLBACK 159: la riga attesa compare % volte invece di 1: %', v_n, r.prima;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

commit;
