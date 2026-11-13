-- ROLLBACK della 142 — toglie le carte dei set asiatici e di My First Battle dal catalogo, i 29 set
-- nuovi, rimette il totale di prima ai 40 set della 131 e il vincolo del codice di prima.
-- Le carte del gruppo non vengono toccate (vivono in "carte").

begin;
delete from public.set_carte where sigla in ('MFB', 'S8A@CHN', 'S8A@JP', 'CS6BC@CHN', 'CS6BC@JP', 'SVJL@JP', 'SV9@KOR', 'S9A@JP', 'BTV@JP', 'HSBW@JP', 'SV11B@JP', 'CS5BC@CHN', 'CS5AC@CHN', '151C@CHN', 'SM10@JP', 'DP-P@JP', 'CSV1C@CHN', 'WAK@JP', 'EXP@JP', 'CP6@KOR', 'CBB1C@CHN', 'CBB1C@JP', 'CBB2C@CHN', 'CBB3C@CHN', 'CSVH2C@CHN', 'S6K@KOR', 'CP2@CHN', 'M-P@JP', 'M1L@JP', 'M1L@KOR', 'M1S@JP', 'PCG8@CHN', 'HSZ@JP', 'CS4AC@CHN', 'S12@CHN', 'S12@CHN-T', 'S12@JP', 'SV7A@JP', 'CSDC@CHN', 'SV2A@CHN', 'SV2A@JP', 'SV2A@KOR', 'CSGC@CHN', 'S10B@JP', 'CS3AC@CHN', 'CS3AC@JP', 'CS3BC@CHN', 'CS3BC@JP', 'S5R@JP', 'CSFC@CHN', 'SV3@JP', 'SV3@KOR', 'S1H@KOR', 'CSM2CC@JP', 'S1W@JP', 'SV8A@JP', 'CSV9.5C@CHN', 'SV10@JP', 'S10D@JP', 'ADVB@JP', 'SM4A@JP', 'PCGA@JP', 'S8B@JP', 'SEF@JP', 'S12A@JP', 'S12A@KOR');
delete from public.set_soglie_notificate where sigla in ('MFB', 'S8A@JP', 'CS6BC@JP', 'SVJL@JP', 'S9A@JP', 'BTV@JP', 'HSBW@JP', 'SV11B@JP', 'CS5BC@CHN', 'CS5AC@CHN', 'CSV1C@CHN', 'WAK@JP', 'CBB1C@JP', 'CSVH2C@CHN', 'M1S@JP', 'PCG8@CHN', 'S12@CHN-T', 'S12@JP', 'SV2A@CHN', 'S10B@JP', 'CS3AC@JP', 'CS3BC@CHN', 'CS3BC@JP', 'S5R@JP', 'CSM2CC@JP', 'S1W@JP', 'ADVB@JP', 'SM4A@JP', 'PCGA@JP');
delete from public.set_nascosti where sigla in ('MFB', 'S8A@JP', 'CS6BC@JP', 'SVJL@JP', 'S9A@JP', 'BTV@JP', 'HSBW@JP', 'SV11B@JP', 'CS5BC@CHN', 'CS5AC@CHN', 'CSV1C@CHN', 'WAK@JP', 'CBB1C@JP', 'CSVH2C@CHN', 'M1S@JP', 'PCG8@CHN', 'S12@CHN-T', 'S12@JP', 'SV2A@CHN', 'S10B@JP', 'CS3AC@JP', 'CS3BC@CHN', 'CS3BC@JP', 'S5R@JP', 'CSM2CC@JP', 'S1W@JP', 'ADVB@JP', 'SM4A@JP', 'PCGA@JP');
delete from public.set_carte_ignorate where sigla in ('MFB', 'S8A@JP', 'CS6BC@JP', 'SVJL@JP', 'S9A@JP', 'BTV@JP', 'HSBW@JP', 'SV11B@JP', 'CS5BC@CHN', 'CS5AC@CHN', 'CSV1C@CHN', 'WAK@JP', 'CBB1C@JP', 'CSVH2C@CHN', 'M1S@JP', 'PCG8@CHN', 'S12@CHN-T', 'S12@JP', 'SV2A@CHN', 'S10B@JP', 'CS3AC@JP', 'CS3BC@CHN', 'CS3BC@JP', 'S5R@JP', 'CSM2CC@JP', 'S1W@JP', 'ADVB@JP', 'SM4A@JP', 'PCGA@JP');
delete from public.set_espansioni where sigla in ('MFB', 'S8A@JP', 'CS6BC@JP', 'SVJL@JP', 'S9A@JP', 'BTV@JP', 'HSBW@JP', 'SV11B@JP', 'CS5BC@CHN', 'CS5AC@CHN', 'CSV1C@CHN', 'WAK@JP', 'CBB1C@JP', 'CSVH2C@CHN', 'M1S@JP', 'PCG8@CHN', 'S12@CHN-T', 'S12@JP', 'SV2A@CHN', 'S10B@JP', 'CS3AC@JP', 'CS3BC@CHN', 'CS3BC@JP', 'S5R@JP', 'CSM2CC@JP', 'S1W@JP', 'ADVB@JP', 'SM4A@JP', 'PCGA@JP');
update public.set_espansioni e set carte_totali = v.totale, aggiornato_il = now()
from (values ('151C@CHN', 192), ('CBB1C@CHN', 115), ('CBB2C@CHN', 140), ('CBB3C@CHN', 136), ('CP2@CHN', 27), ('CP6@KOR', 103), ('CS3AC@CHN', 184), ('CS4AC@CHN', 184), ('CS6BC@CHN', 172), ('CSDC@CHN', 25), ('CSFC@CHN', 26), ('CSGC@CHN', 8), ('CSV9.5C@CHN', 259), ('DP-P@JP', 127), ('EXP@JP', 102), ('HSZ@JP', 48), ('M-P@JP', 171), ('M1L@JP', 92), ('M1L@KOR', 92), ('S-P@JP', 354), ('S10D@JP', 88), ('S12@CHN', 125), ('S12A@JP', 262), ('S12A@KOR', 262), ('S1H@KOR', 75), ('S4A@JP', 330), ('S6K@KOR', 95), ('S8A@CHN', 38), ('S8B@JP', 293), ('SEF@JP', 21), ('SM10@JP', 116), ('SV10@JP', 132), ('SV2A@JP', 210), ('SV2A@KOR', 210), ('SV3@JP', 141), ('SV3@KOR', 141), ('SV4A@JP', 360), ('SV7A@JP', 94), ('SV8A@JP', 237), ('SV9@KOR', 132)) v(sigla, totale)
where e.sigla = v.sigla;
do $$
begin
    if not exists (select 1 from public.set_carte where codice !~ '^[A-Z0-9]+( [A-Z0-9]+)?$') then
        alter table public.set_carte drop constraint if exists set_carte_codice_check;
        alter table public.set_carte add constraint set_carte_codice_check
          check (codice is null or codice ~ '^[A-Z0-9]+( [A-Z0-9]+)?$');
    end if;
end $$;
commit;
