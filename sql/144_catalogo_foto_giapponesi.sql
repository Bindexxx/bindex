-- 144 — Miniature dei set giapponesi da TCGdex in giapponese (13/11/2026). Seguito della 142/143.
-- TCGdex ha le foto delle carte giapponesi solo per alcuni set: SV2a, S12a, SV4a, S12, S9a, SV10, SV3,
-- SV7a, SV8a (letti il 13/11/2026 da api.tcgdex.net/v2/ja/sets/<id>). Per S8b, M1L, M1S, S4a, M-P, SM10,
-- S5R, S6K, CP2 e altri TCGdex ha le carte ma nessuna foto; in cinese e coreano non ha carte.
-- Solo le righe @JP: le versioni cinesi e coreane degli stessi set restano senza, per avere sempre la foto
-- nella lingua della carta (le copriranno le foto di Cardmarket caricate dall'estensione).
-- Il numero TCGdex è il numero della carta (001 → 1) e combacia col codice del catalogo su tutte le righe
-- (controllati i nomi a inizio e fine set e ai buchi di SV4a e S12a).
-- Si scrive solo dove la miniatura manca: le foto vere delle carte del gruppo restano. Una foto da TCGdex
-- verrà poi sostituita da una vera appena una carta del gruppo la porta (_catalogo_impara, sql/137).
-- Il giro notturno (sql/140) lavora solo sui set INT: queste righe non le tocca.
-- Righe scritte: 1572 meno le 17 che hanno già una foto = 1555.
-- VA ESEGUITA DOPO sql/143. Rollback: 144_catalogo_foto_giapponesi_ROLLBACK.sql.

begin;

do $$
begin
    if (select count(*) from public.set_carte where sigla = 'SV4A@JP') <> 360 then
        raise exception 'Prima va eseguita sql/143_catalogo_asiatici_grandi.sql';
    end if;
end $$;

-- set, cartella TCGdex, numeri con la foto (intervalli)
create temp table _foto_144 (sigla text, base text, dal integer, al integer) on commit drop;
insert into _foto_144 values
  ('SV2A@JP', 'https://assets.tcgdex.net/ja/SV/SV2a', 1, 210),
  ('S12A@JP', 'https://assets.tcgdex.net/ja/S/S12a', 1, 250),
  ('S12A@JP', 'https://assets.tcgdex.net/ja/S/S12a', 259, 262),
  ('SV4A@JP', 'https://assets.tcgdex.net/ja/SV/SV4a', 1, 126),
  ('SV4A@JP', 'https://assets.tcgdex.net/ja/SV/SV4a', 147, 147),
  ('SV4A@JP', 'https://assets.tcgdex.net/ja/SV/SV4a', 168, 360),
  ('S12@JP', 'https://assets.tcgdex.net/ja/S/S12', 1, 125),
  ('S9A@JP', 'https://assets.tcgdex.net/ja/S/S9a', 1, 93),
  ('SV10@JP', 'https://assets.tcgdex.net/ja/SV/SV10', 1, 98),
  ('SV3@JP', 'https://assets.tcgdex.net/ja/SV/SV3', 1, 141),
  ('SV7A@JP', 'https://assets.tcgdex.net/ja/SV/SV7a', 1, 94),
  ('SV8A@JP', 'https://assets.tcgdex.net/ja/SV/SV8a', 1, 237);

update public.set_carte s
   set immagine = f.base || '/' || lpad(s.numero::text, 3, '0') || '/low.webp',
       aggiornato_il = now()
  from _foto_144 f
 where s.sigla = f.sigla
   and s.numero between f.dal and f.al
   and s.immagine is null;

-- controllo: ogni numero dell'elenco ha ora una miniatura (di TCGdex o una foto vera già presente)
do $$
declare v_mancano integer;
begin
    select count(*) into v_mancano
      from _foto_144 f
      cross join lateral generate_series(f.dal, f.al) n
      left join public.set_carte s on s.sigla = f.sigla and s.numero = n
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
 where sigla in ('SV2A@JP','S12A@JP','SV4A@JP','S12@JP','S9A@JP','SV10@JP','SV3@JP','SV7A@JP','SV8A@JP')
 group by sigla order by sigla;
