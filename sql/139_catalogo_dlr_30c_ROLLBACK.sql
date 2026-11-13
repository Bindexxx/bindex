-- ROLLBACK della 139 — toglie le carte di DLR, 30C e 30C-CC dal catalogo (i tre set restano in
-- set_espansioni, vuoti come prima) e rimette il doppione '30C:CC' con le sue 2 soglie silenziose.
-- Nessuna carta del gruppo viene toccata (vivono in "carte", non nel catalogo).

begin;
delete from public.set_carte where sigla in ('DLR', '30C', '30C-CC');

insert into public.set_espansioni (sigla, tcgdex_id, nome, carte_base, carte_totali, data_uscita, lingua, aggiornato_il)
select '30C:CC', e.tcgdex_id, e.nome, e.carte_base, e.carte_totali, e.data_uscita, e.lingua, now()
from public.set_espansioni e where e.sigla = '30C-CC'
on conflict (sigla) do nothing;

insert into public.set_soglie_notificate (owner_id, sigla, soglia, raggiunta_il, vista_il)
select s.owner_id, '30C:CC', s.soglia, s.raggiunta_il, s.vista_il
from public.set_soglie_notificate s where s.sigla = '30C-CC'
on conflict do nothing;
commit;
