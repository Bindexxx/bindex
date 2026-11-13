-- 141 — Tolti i doppioni vuoti di set_espansioni (13/11/2026, deciso da Claudio).
-- Stesso caso di '30C:CC' (sql/139): set con la stessa tcgdex_id di un altro, nessuna carta nel catalogo,
-- nessuna carta del gruppo. Il set che resta è quello con le carte.
--   tolto     resta     tcgdex
--   BASEP     WP        basep       (WP ha 74 righe e 3 carte del gruppo)
--   ASR:TG    ASR-TG    swsh10tg
--   BRS:TG    BRS-TG    swsh9tg
--   LOR:TG    LOR-TG    swsh11tg
--   SIT:TG    SIT-TG    swsh12tg
--   CRZ:GG    CRZ-GG    swsh12.5gg
--   SHF:SV    SHF-SV    swsh4.5sv
--   CEL:CC    CEL-CC    cel25cc
-- Verificato sul DB il 13/11/2026: 0 righe in set_carte, set_nascosti, set_carte_ignorate e
-- catalogo_aggiornamenti per gli 8 doppioni; 24 righe in set_soglie_notificate (soglia 0, silenziose),
-- tutte con la gemella uguale sul set che resta; nessun trigger su set_espansioni; FK verso
-- set_espansioni: set_carte e catalogo_aggiornamenti (CASCADE, 0 righe). Il codice del sito non li nomina.
-- Si ferma se uno dei doppioni nel frattempo ha preso carte.
-- Rollback: 141_set_doppioni_ROLLBACK.sql.

begin;

do $$
declare
    v_n integer;
begin
    select count(*) into v_n from public.set_carte
    where sigla in ('BASEP', 'ASR:TG', 'BRS:TG', 'LOR:TG', 'SIT:TG', 'CRZ:GG', 'SHF:SV', 'CEL:CC');
    if v_n > 0 then raise exception 'Un doppione ha % righe nel catalogo: non si toglie', v_n; end if;
    select count(*) into v_n from public.set_espansioni
    where sigla in ('WP', 'ASR-TG', 'BRS-TG', 'LOR-TG', 'SIT-TG', 'CRZ-GG', 'SHF-SV', 'CEL-CC');
    if v_n <> 8 then raise exception 'Manca uno dei set che restano (trovati % su 8)', v_n; end if;
end $$;

delete from public.set_soglie_notificate
where sigla in ('BASEP', 'ASR:TG', 'BRS:TG', 'LOR:TG', 'SIT:TG', 'CRZ:GG', 'SHF:SV', 'CEL:CC');
delete from public.set_nascosti
where sigla in ('BASEP', 'ASR:TG', 'BRS:TG', 'LOR:TG', 'SIT:TG', 'CRZ:GG', 'SHF:SV', 'CEL:CC');
delete from public.set_carte_ignorate
where sigla in ('BASEP', 'ASR:TG', 'BRS:TG', 'LOR:TG', 'SIT:TG', 'CRZ:GG', 'SHF:SV', 'CEL:CC');
delete from public.set_espansioni
where sigla in ('BASEP', 'ASR:TG', 'BRS:TG', 'LOR:TG', 'SIT:TG', 'CRZ:GG', 'SHF:SV', 'CEL:CC');

commit;

-- Controllo a occhio (non cambia niente): 0 doppioni rimasti
select tcgdex_id, string_agg(sigla, ', ') as sigle
from public.set_espansioni where tcgdex_id is not null
group by tcgdex_id having count(*) > 1;
