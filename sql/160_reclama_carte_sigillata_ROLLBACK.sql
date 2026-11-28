-- ROLLBACK di 160: reclama_carte_per_controllo_prezzi senza sigillata_originale per le carte degli altri.
-- (Le date di ultimo controllo azzerate non si rimettono: le carte vengono solo ricontrollate prima.)

begin;

do $$
declare
  v_def text;
  v_n int;
  v_prima text := $b$'claimed_by', r.claimed_by, 'claimed_at', r.claimed_at,
      'sigillata_originale', r.sigillata_originale)$b$;
begin
  v_def := pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_prima, ''))) / length(v_prima);
  if v_n <> 1 then
    raise exception 'ROLLBACK 160: la riga attesa compare % volte invece di 1', v_n;
  end if;
  execute replace(v_def, v_prima, $a$'claimed_by', r.claimed_by, 'claimed_at', r.claimed_at)$a$);
end $$;

commit;
