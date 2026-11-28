-- 160: le carte "Sigillata" degli altri lette bene da chi aiuta il gruppo (28/11/2026).
-- reclama_carte_per_controllo_prezzi, per le carte degli altri, restituisce solo i campi del
-- controllo prezzi (sql/106): mancava sigillata_originale, quindi il PC di chi aiuta leggeva il
-- prezzo normale (non quello dell'offerta sigillata) e non aggiornava minimo e origine del prezzo.
-- Effetto visto sul DB: prezzi che saltano (Delphox MEP 074: 37,90 → 6,95 → 37,90), carte con
-- "da offerta sigillata" ma prezzo normale (Pikachu SVP 027: 11 con minimo 12,50), 9 carte di un
-- utente controllate più volte senza mai l'offerta sigillata.
-- Location, note e il resto restano nascosti come prima.
-- Poi: le carte sigillate rimaste incoerenti tornano in cima alla coda del controllo prezzi.

begin;

do $$
declare
  v_def text;
  v_n int;
  v_prima text := $a$'claimed_by', r.claimed_by, 'claimed_at', r.claimed_at)$a$;
begin
  v_def := pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_prima, ''))) / length(v_prima);
  if v_n <> 1 then
    raise exception '160: la riga attesa compare % volte invece di 1', v_n;
  end if;
  execute replace(v_def, v_prima, $b$'claimed_by', r.claimed_by, 'claimed_at', r.claimed_at,
      'sigillata_originale', r.sigillata_originale)$b$);
end $$;

-- carte sigillate già controllate senza offerta sigillata, o col prezzo sotto il minimo letto
update public.carte
   set ultimo_controllo = null
 where stato = 'collezione'
   and sigillata_originale
   and ultimo_controllo is not null
   and (prezzo_da_sigillata is null
        or (prezzo_da_sigillata and prezzo_minimo_cm is not null and prezzo < prezzo_minimo_cm));

commit;

-- verifica: true e 0
select pg_get_functiondef('public.reclama_carte_per_controllo_prezzi(uuid,uuid,boolean,text[],boolean,integer,integer,uuid)'::regprocedure)
         like '%''sigillata_originale'', r.sigillata_originale%' as funzione_ok,
       (select count(*) from public.carte where stato = 'collezione' and sigillata_originale and ultimo_controllo is not null
          and (prezzo_da_sigillata is null or (prezzo_da_sigillata and prezzo_minimo_cm is not null and prezzo < prezzo_minimo_cm))) as incoerenti;
