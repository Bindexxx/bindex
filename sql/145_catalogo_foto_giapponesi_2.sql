-- 145 — Altre miniature giapponesi da TCGdex (13/11/2026). Seguito della 144.
-- L'API di TCGdex non segnala tutte le foto che ha: sul suo server (assets.tcgdex.net/ja/...) ci sono anche
-- le foto di set per cui l'API non ne elenca nessuna. Le ho cercate una per una dal server Supabase (pg_net,
-- risposta 200 = c'è, 404 = non c'è) per i numeri del catalogo ancora senza foto, poi ho guardato a mano
-- circa 90 foto confrontandole col nome nel catalogo (inizio, metà e fine di ogni set e le carte segrete).
-- Tutte giuste tranne M1S (Mega Symphonia): lì le foto non corrispondono ai numeri (es. 079 e 092 sono
-- carte allenatore, nel catalogo sono Mega Latias ex e Mega Gardevoir ex) e il set resta fuori.
-- M1L, M-P e SV11B: nessuna foto sul server (una sola per SV11B, la 086). S12A: solo la 258.
-- Questi set sono "a pagine": il numero della carta è quello del codice ("S8B 001" → 1), non la colonna
-- numero. In tutti i set qui sotto ogni numero di codice compare una sola volta (controllato).
-- Stesse regole della 144: solo righe @JP, solo dove la miniatura manca.
-- Righe coperte: 1189; da scrivere 1173 (le altre 16 hanno già una foto vera, verificato il 13/11/2026).
-- Si può eseguire prima o dopo la 144. Rollback: 145_catalogo_foto_giapponesi_2_ROLLBACK.sql.

begin;

do $$
begin
    if (select count(*) from public.set_carte where sigla = 'S4A@JP') <> 330 then
        raise exception 'Prima va eseguita sql/143_catalogo_asiatici_grandi.sql';
    end if;
end $$;

-- set, cartella TCGdex, numeri di codice con la foto (intervalli)
create temp table _foto_145 (sigla text, base text, dal integer, al integer) on commit drop;
insert into _foto_145 values
  ('S8B@JP',   'https://assets.tcgdex.net/ja/S/S8b',    1,  52),
  ('S8B@JP',   'https://assets.tcgdex.net/ja/S/S8b',   54,  56),
  ('S8B@JP',   'https://assets.tcgdex.net/ja/S/S8b',   60, 226),
  ('S8B@JP',   'https://assets.tcgdex.net/ja/S/S8b',  230, 235),
  ('S8B@JP',   'https://assets.tcgdex.net/ja/S/S8b',  237, 277),
  ('S10B@JP',  'https://assets.tcgdex.net/ja/S/S10b',   1,  93),
  ('S10D@JP',  'https://assets.tcgdex.net/ja/S/S10D',   1,  88),
  ('S12A@JP',  'https://assets.tcgdex.net/ja/S/S12a', 258, 258),
  ('S1W@JP',   'https://assets.tcgdex.net/ja/S/S1W',    1,  68),
  ('S4A@JP',   'https://assets.tcgdex.net/ja/S/S4a',    1, 326),
  ('S5R@JP',   'https://assets.tcgdex.net/ja/S/S5R',    1,  81),
  ('S8A@JP',   'https://assets.tcgdex.net/ja/S/S8a',    1,  25),
  ('S8A@JP',   'https://assets.tcgdex.net/ja/S/S8a',   29,  29),
  ('SM10@JP',  'https://assets.tcgdex.net/ja/SM/SM10',  1, 107),
  ('SM4A@JP',  'https://assets.tcgdex.net/ja/SM/SM4A',  1,  55),
  ('SV10@JP',  'https://assets.tcgdex.net/ja/SV/SV10', 99, 132),
  ('SV11B@JP', 'https://assets.tcgdex.net/ja/SV/SV11B', 86, 86),
  ('SV4A@JP',  'https://assets.tcgdex.net/ja/SV/SV4a', 127, 146),
  ('SV4A@JP',  'https://assets.tcgdex.net/ja/SV/SV4a', 148, 167);

-- numero della carta letto dal codice ("S8B 001" → 1); solo codici "SIGLA numero"
create temp table _righe_145 on commit drop as
select s.sigla, s.numero, s.variante, split_part(s.codice, ' ', 2)::integer as n
  from public.set_carte s
 where s.sigla in (select sigla from _foto_145)
   and s.codice ~ '^\S+ [0-9]+$';

do $$
begin
    if exists (select 1 from _righe_145 group by sigla, n having count(*) > 1) then
        raise exception 'Un numero di codice compare su più righe: controllare il catalogo';
    end if;
end $$;

update public.set_carte s
   set immagine = f.base || '/' || lpad(r.n::text, 3, '0') || '/low.webp',
       aggiornato_il = now()
  from _righe_145 r
  join _foto_145 f on f.sigla = r.sigla and r.n between f.dal and f.al
 where s.sigla = r.sigla and s.numero = r.numero and s.variante = r.variante
   and s.immagine is null;

-- controllo: ogni numero dell'elenco ha ora una miniatura (di TCGdex o una foto vera già presente)
do $$
declare v_mancano integer;
begin
    select count(*) into v_mancano
      from _foto_145 f
      cross join lateral generate_series(f.dal, f.al) g(n)
      left join _righe_145 r on r.sigla = f.sigla and r.n = g.n
      left join public.set_carte s on s.sigla = r.sigla and s.numero = r.numero and s.variante = r.variante
     where s.immagine is null;
    if v_mancano > 0 then
        raise exception 'Restano % numeri senza miniatura: controllare il catalogo', v_mancano;
    end if;
end $$;

commit;

-- verifica
select sigla,
       count(*) as righe,
       count(*) filter (where immagine like 'https://assets.tcgdex.net/ja/%') as da_tcgdex,
       count(*) filter (where immagine is not null and immagine not like 'https://assets.tcgdex.net/%') as foto_vere,
       count(*) filter (where immagine is null) as senza
  from public.set_carte
 where sigla in ('S8B@JP','S10B@JP','S10D@JP','S12A@JP','S1W@JP','S4A@JP','S5R@JP','S8A@JP','SM10@JP','SM4A@JP','SV10@JP','SV11B@JP','SV4A@JP')
 group by sigla order by sigla;
