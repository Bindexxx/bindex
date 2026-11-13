-- ROLLBACK della 143 — toglie dal catalogo le carte di S4A, SV4A, SM-P, S-P e XY-P giapponesi, i 2 set
-- nuovi (SM-P@JP, XY-P@JP) e rimette il totale di prima a S4A, SV4A e S-P della 131.
-- Le carte del gruppo non vengono toccate (vivono in "carte").

begin;
delete from public.set_carte where sigla in ('S4A@JP', 'SV4A@JP', 'SM-P@JP', 'S-P@JP', 'XY-P@JP');
delete from public.set_soglie_notificate where sigla in ('SM-P@JP', 'XY-P@JP');
delete from public.set_nascosti where sigla in ('SM-P@JP', 'XY-P@JP');
delete from public.set_carte_ignorate where sigla in ('SM-P@JP', 'XY-P@JP');
delete from public.set_espansioni where sigla in ('SM-P@JP', 'XY-P@JP');
update public.set_espansioni e set carte_totali = v.totale, aggiornato_il = now()
from (values ('S-P@JP', 354), ('S4A@JP', 330), ('SV4A@JP', 360)) v(sigla, totale)
where e.sigla = v.sigla;
commit;
