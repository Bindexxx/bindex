-- 131 — Set in altre lingue per il widget Set (11/11/2026).
-- Colonna "lingua" in set_espansioni (INT = internazionale, JP, KOR, CHN, CHN-T) e i set giapponesi,
-- coreani e cinesi di cui il gruppo ha già carte (decisione di Claudio: "prima solo i set del gruppo").
-- Sigla "CODICE@LINGUA": lo stesso codice esiste in più lingue (SV2A giapponese e coreano) e la sigla
-- è la chiave della tabella. Il sito mette ogni carta nel set della sua lingua (ui/set-libreria-sigle.ui.js).
-- Nomi inglesi e numero di carte da Cardmarket (pagina Espansioni, letta l'11/11/2026); carte_base
-- vuoto perché Cardmarket conta anche le carte segrete. In più McDonald's Collection 2026 (internazionale).
-- Solo aggiunte (ALTER ADD COLUMN + INSERT). Rollback: 131_set_espansioni_lingua_ROLLBACK.sql.

alter table public.set_espansioni add column if not exists lingua text not null default 'INT';
alter table public.set_espansioni drop constraint if exists set_espansioni_lingua_check;
alter table public.set_espansioni add constraint set_espansioni_lingua_check
  check (lingua in ('INT', 'JP', 'KOR', 'CHN', 'CHN-T'));

insert into public.set_espansioni (sigla, tcgdex_id, nome, carte_base, carte_totali, data_uscita, lingua, aggiornato_il) values
  -- giapponesi
  ('DP-P@JP',  null, 'DP Promos',                         null, 127, '2006-11-15', 'JP', now()),
  ('EXP@JP',   null, 'Expansion Pack',                    null, 102, '1996-10-20', 'JP', now()),
  ('HSZ@JP',   null, 'National Pokédex Beginning Set',    null,  48, '2012-04-20', 'JP', now()),
  ('M-P@JP',   null, 'M-P Promos',                        null, 171, '2025-08-01', 'JP', now()),
  ('M1L@JP',   'M1L', 'Mega Brave',                       null,  92, '2025-08-01', 'JP', now()),
  ('S-P@JP',   null, 'Sword & Shield Promos',             null, 354, '2019-11-17', 'JP', now()),
  ('S10D@JP',  null, 'Time Gazer',                        null,  88, '2022-04-08', 'JP', now()),
  ('S12A@JP',  null, 'VSTAR Universe',                    null, 262, '2022-12-02', 'JP', now()),
  ('S4A@JP',   null, 'Shiny Star V',                      null, 330, '2020-11-20', 'JP', now()),
  ('S8B@JP',   null, 'VMAX Climax',                       null, 293, '2021-12-03', 'JP', now()),
  ('SEF@JP',   null, 'VMAX Starter Deck: Venusaur VMAX',  null,  21, '2020-12-04', 'JP', now()),
  ('SM10@JP',  null, 'Double Blaze',                      null, 116, '2019-03-01', 'JP', now()),
  ('SV10@JP',  null, 'The Glory of Team Rocket',          null, 132, '2025-04-18', 'JP', now()),
  ('SV2A@JP',  'SV2a', 'Pokémon Card 151',                null, 210, '2023-06-16', 'JP', now()),
  ('SV3@JP',   null, 'Ruler of the Black Flame',          null, 141, '2023-07-28', 'JP', now()),
  ('SV4A@JP',  null, 'Shiny Treasure ex',                 null, 360, '2023-12-01', 'JP', now()),
  ('SV7A@JP',  null, 'Paradise Dragona',                  null,  94, '2024-09-13', 'JP', now()),
  ('SV8A@JP',  null, 'Terastal Festival ex',              null, 237, '2024-12-06', 'JP', now()),
  -- coreani (su Cardmarket sono le stesse espansioni giapponesi, in lingua coreana)
  ('CP6@KOR',  null, 'Expansion Pack 20th Anniversary',   null, 103, '2016-09-16', 'KOR', now()),
  ('M1L@KOR',  null, 'Mega Brave',                        null,  92, '2025-08-01', 'KOR', now()),
  ('S12A@KOR', null, 'VSTAR Universe',                    null, 262, '2022-12-02', 'KOR', now()),
  ('S1H@KOR',  null, 'Shield',                            null,  75, '2019-12-06', 'KOR', now()),
  ('S6K@KOR',  null, 'Jet Black Spirit',                  null,  95, '2021-04-23', 'KOR', now()),
  ('SV2A@KOR', null, 'Pokémon Card 151',                  null, 210, '2023-06-16', 'KOR', now()),
  ('SV3@KOR',  null, 'Ruler of the Black Flame',          null, 141, '2023-07-28', 'KOR', now()),
  ('SV9@KOR',  null, 'Battle Partners',                   null, 132, '2025-01-24', 'KOR', now()),
  -- cinesi (semplificato)
  ('151C@CHN',    null, 'Collect 151',                            null, 192, '2025-01-17', 'CHN', now()),
  ('CBB1C@CHN',   null, 'Gem Pack Vol. 1',                        null, 115, '2025-01-17', 'CHN', now()),
  ('CBB2C@CHN',   null, 'Gem Pack Vol. 2',                        null, 140, '2025-05-16', 'CHN', now()),
  ('CBB3C@CHN',   null, 'Gem Pack Vol. 3',                        null, 136, '2025-09-26', 'CHN', now()),
  ('CP2@CHN',     null, 'Legendary Shine Collection',             null,  27, '2015-07-18', 'CHN', now()),
  ('CS3AC@CHN',   null, 'Primordial Arts - Overgrow',             null, 184, '2023-11-17', 'CHN', now()),
  ('CS4AC@CHN',   null, 'Nine Colors Gathering - Friends',        null, 184, '2024-03-01', 'CHN', now()),
  ('CS6BC@CHN',   null, 'Azure Shadow - Pursuit',                 null, 172, '2024-09-20', 'CHN', now()),
  ('CSDC@CHN',    null, 'Pikachu Legendary Celebration',          null,  25, '2023-12-08', 'CHN', now()),
  ('CSFC@CHN',    null, 'Return of the Dragon',                   null,  26, '2024-03-01', 'CHN', now()),
  ('CSGC@CHN',    null, 'Pokémon Card Display Set Gift Box Eevee', null,  8, '2024-03-01', 'CHN', now()),
  ('CSV9.5C@CHN', null, 'Terastal Gathering',                     null, 259, '2026-06-12', 'CHN', now()),
  ('S12@CHN',     null, 'Paradigm Trigger',                       null, 125, '2022-10-21', 'CHN', now()),
  ('S8A@CHN',     null, '25th Anniversary Collection',            null,  38, '2021-10-22', 'CHN', now()),
  -- internazionale mancante
  ('MCD26',       null, 'McDonald''s Collection 2026',            null,  15, '2026-11-10', 'INT', now())
on conflict (sigla) do nothing;

-- verifica: 41 righe nuove + nessuna sigla con @ senza lingua giusta
select lingua, count(*) from public.set_espansioni group by lingua order by lingua;
