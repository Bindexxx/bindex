-- ROLLBACK della 141 — rimette gli 8 doppioni vuoti, copiando i dati dal set che è rimasto (erano
-- identici), e le loro soglie silenziose (copiate dalle gemelle, anch'esse identiche).

begin;
with coppie (tolto, resta) as (values
    ('BASEP', 'WP'), ('ASR:TG', 'ASR-TG'), ('BRS:TG', 'BRS-TG'), ('LOR:TG', 'LOR-TG'),
    ('SIT:TG', 'SIT-TG'), ('CRZ:GG', 'CRZ-GG'), ('SHF:SV', 'SHF-SV'), ('CEL:CC', 'CEL-CC'))
insert into public.set_espansioni (sigla, tcgdex_id, nome, carte_base, carte_totali, data_uscita, lingua, aggiornato_il)
select c.tolto, e.tcgdex_id, e.nome, e.carte_base, e.carte_totali, e.data_uscita, e.lingua, now()
from coppie c join public.set_espansioni e on e.sigla = c.resta
on conflict (sigla) do nothing;

with coppie (tolto, resta) as (values
    ('BASEP', 'WP'), ('ASR:TG', 'ASR-TG'), ('BRS:TG', 'BRS-TG'), ('LOR:TG', 'LOR-TG'),
    ('SIT:TG', 'SIT-TG'), ('CRZ:GG', 'CRZ-GG'), ('SHF:SV', 'SHF-SV'), ('CEL:CC', 'CEL-CC'))
insert into public.set_soglie_notificate (owner_id, sigla, soglia, raggiunta_il, vista_il)
select s.owner_id, c.tolto, s.soglia, s.raggiunta_il, s.vista_il
from coppie c join public.set_soglie_notificate s on s.sigla = c.resta and s.soglia = 0
on conflict do nothing;
commit;
