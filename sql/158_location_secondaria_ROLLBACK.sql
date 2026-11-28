-- ROLLBACK di 158: toglie la location secondaria (le secondarie già date si perdono).
-- Contiene DROP: va lanciato nell'SQL Editor. Se è già stato lanciato 159, prima il ROLLBACK di 159.

begin;

-- 1. funzioni come prima di 158
do $$
declare
  v_def text;
  v_n int;
  r record;
begin
  for r in
    select * from (values
      ('public._coda_carte_view_insert()',
       $b$'nota', new.nota, 'location', new.location, 'location_secondaria', nullif(btrim(new.location_secondaria), ''), 'url_diretto', new.url_diretto,$b$,
       $a$'nota', new.nota, 'location', new.location, 'url_diretto', new.url_diretto,$a$),
      ('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)',
       $b$insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale, location_secondaria)$b$,
       $a$insert into carte (owner_id, nome, codice, location, qty, lingua, condizione, url, prezzo, note, immagine, tipo, stato, sigillata_originale)$a$),
      ('public.completa_riga_coda_carte(bigint,text,text,text,integer,text,text,text,numeric,text,text,text,text,numeric,boolean)',
       $b$values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false), nullif(v_riga.payload ->> 'location_secondaria', ''))$b$,
       $a$values (v_riga.creato_da, p_nome, p_codice, v_location, p_qty, p_lingua, p_condizione, p_url, p_prezzo, p_note, p_immagine, p_tipo, 'collezione', coalesce(p_sigillata_originale, false))$a$),
      ('public.rinomina_location(text,text)',
       $b$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND (location = v_da OR location_secondaria = v_da))$b$,
       $a$AND NOT EXISTS (SELECT 1 FROM public.carte WHERE owner_id = v_uid AND location = v_da)$a$),
      ('public.rinomina_location(text,text)',
       $b$GET DIAGNOSTICS v_n_carte = ROW_COUNT;
    -- sql/158: location secondaria
    UPDATE public.carte SET location_secondaria = v_a
     WHERE owner_id = v_uid AND location_secondaria = v_da;$b$,
       $a$GET DIAGNOSTICS v_n_carte = ROW_COUNT;$a$)
    ) as t(funzione, prima, dopo)
  loop
    v_def := pg_get_functiondef(r.funzione::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, r.prima, ''))) / length(r.prima);
    if v_n <> 1 then
      raise exception 'ROLLBACK 158: in % la riga attesa compare % volte invece di 1: %', r.funzione, v_n, r.prima;
    end if;
    execute replace(v_def, r.prima, r.dopo);
  end loop;
end $$;

-- 2. vista come prima (una colonna in meno: va ricreata, con permessi e trigger INSTEAD OF)
drop view public.coda_carte;
create view public.coda_carte as
 SELECT id,
    payload ->> 'nome'::text AS nome,
    COALESCE(payload ->> 'lingua'::text, 'IT'::text) AS lingua,
    COALESCE(payload ->> 'condizione'::text, 'NM'::text) AS condizione,
    COALESCE((payload ->> 'qty'::text)::integer, 1) AS qty,
    COALESCE((payload ->> 'reverse'::text)::boolean, false) AS reverse,
    COALESCE((payload ->> 'first_ed'::text)::boolean, false) AS first_ed,
    payload ->> 'nota'::text AS nota,
        CASE
            WHEN creato_da = auth.uid() THEN payload ->> 'location'::text
            ELSE NULL::text
        END AS location,
    payload ->> 'url_diretto'::text AS url_diretto,
    payload ->> 'tipo_prodotto'::text AS tipo,
    COALESCE(payload ->> 'destinazione'::text, 'collezione'::text) AS destinazione,
    NULLIF(payload ->> 'prezzo_obiettivo'::text, ''::text)::numeric AS prezzo_obiettivo,
    stato,
    creato_da AS owner_id,
    creato_il,
    claimed_by,
    claimed_at,
    dispositivo,
    errore_msg,
    completato_il,
    esito -> 'opzioni_disambiguazione'::text AS opzioni_disambiguazione,
    tentativi_falliti,
    COALESCE((payload ->> 'sigillata_originale'::text)::boolean, false) AS sigillata_originale,
    payload ->> 'integrita_packaging'::text AS integrita_packaging
   FROM coda_lavoro
  WHERE tipo = ANY (ARRAY['aggiungi_carta'::text, 'aggiungi_wishlist'::text]);
revoke all on public.coda_carte from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger on public.coda_carte to authenticated;
grant truncate, references, trigger on public.coda_carte to service_role;
create trigger coda_carte_instead_delete instead of delete on public.coda_carte for each row execute function _coda_carte_view_delete();
create trigger coda_carte_instead_insert instead of insert on public.coda_carte for each row execute function _coda_carte_view_insert();
create trigger coda_carte_instead_update instead of update on public.coda_carte for each row execute function _coda_carte_view_update();

-- 3. trigger e colonne
drop trigger if exists trg_carte_location_secondaria on public.carte;
drop function if exists public._carte_location_secondaria_pulisci();
alter table public.correzioni_manuali_carte drop column if exists location_secondaria;
alter table public.carte drop column if exists location_secondaria;

commit;
