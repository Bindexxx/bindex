-- 133 — Catalogo: nomi veri delle carte McDonald's 2011, 2012, 2016 e 2019 (11/11/2026).
-- In questi quattro set il catalogo (set_carte) aveva il nome dell'ATTACCO al posto del nome della
-- carta (MCD16 8 = "Rollout" invece di "Jigglypuff"): scrivendo "jigglypuff 8" nell'Inserimento il
-- catalogo non la trovava. Verificato sul DB l'11/11/2026: 48 righe, una per carta.
-- Nomi veri presi da TCGdex (set 2011bw, 2012bw, 2016xy, 2019sm) e controllati uno per uno contro
-- l'attacco che c'era (Sandile → Sand Tomb, Jigglypuff → Rollout, Dewott → Water Gun, ...).
-- Cambia solo "nome", e solo se c'è ancora il nome dell'attacco. Rollback: 133_catalogo_nomi_mcdonald_ROLLBACK.sql.

update public.set_carte s
set nome = v.nome, aggiornato_il = now()
from (values
    ('MCD11',  1, 'Snivy', 'Slam'),
    ('MCD11',  2, 'Maractus', 'Mega Drain'),
    ('MCD11',  3, 'Tepig', 'Ember'),
    ('MCD11',  4, 'Oshawott', 'Water Pulse'),
    ('MCD11',  5, 'Alomomola', 'Pound'),
    ('MCD11',  6, 'Blitzle', 'Quick Attack'),
    ('MCD11',  7, 'Munna', 'Yawn'),
    ('MCD11',  8, 'Sandile', 'Sand Tomb'),
    ('MCD11',  9, 'Zorua', 'Scratch'),
    ('MCD11', 10, 'Klink', 'Charge Beam'),
    ('MCD11', 11, 'Pidove', 'Growl'),
    ('MCD11', 12, 'Audino', 'Double Slap'),
    ('MCD12',  1, 'Servine', 'Wrap'),
    ('MCD12',  2, 'Pansage', 'Collect'),
    ('MCD12',  3, 'Dwebble', 'Withdraw'),
    ('MCD12',  4, 'Pignite', 'Flame Charge'),
    ('MCD12',  5, 'Dewott', 'Water Gun'),
    ('MCD12',  6, 'Emolga', 'Thundershock'),
    ('MCD12',  7, 'Woobat', 'Psy Bolt'),
    ('MCD12',  8, 'Drilbur', 'Hone Claws'),
    ('MCD12',  9, 'Purrloin', 'Knock Off'),
    ('MCD12', 10, 'Scraggy', 'Headbutt'),
    ('MCD12', 11, 'Klang', 'Metal Sound'),
    ('MCD12', 12, 'Axew', 'Dual Chop'),
    ('MCD16',  1, 'Vulpix', 'Roar'),
    ('MCD16',  2, 'Torchic', 'Ember'),
    ('MCD16',  3, 'Fennekin', 'Will-O-Wisp'),
    ('MCD16',  4, 'Magikarp', 'Epic Splash'),
    ('MCD16',  5, 'Totodile', 'Fury Strikes'),
    ('MCD16',  6, 'Pikachu', 'Tail Whip'),
    ('MCD16',  7, 'Scraggy', 'Corkscrew Punch'),
    ('MCD16',  8, 'Jigglypuff', 'Rollout'),
    ('MCD16',  9, 'Togepi', 'Sweet Kiss'),
    ('MCD16', 10, 'Dedenne', 'Nuzzle'),
    ('MCD16', 11, 'Meowth', 'Act Tough'),
    ('MCD16', 12, 'Eevee', 'Tackle'),
    ('MCD19',  1, 'Caterpie', 'Surprise Attack'),
    ('MCD19',  2, 'Alolan Exeggutor', 'Tropical Shake'),
    ('MCD19',  3, 'Magmar', 'Controlled Burn'),
    ('MCD19',  4, 'Alolan Sandshrew', 'Fury Swipes'),
    ('MCD19',  5, 'Lapras', 'Aqua Bullet'),
    ('MCD19',  6, 'Pikachu', 'Iron Tail'),
    ('MCD19',  7, 'Gastly', 'Ominous Eyes'),
    ('MCD19',  8, 'Mankey', 'Three-Step Strike'),
    ('MCD19',  9, 'Onix', 'Screech'),
    ('MCD19', 10, 'Alolan Meowth', 'Spoil the Fun'),
    ('MCD19', 11, 'Alolan Dugtrio', 'Gold Rush'),
    ('MCD19', 12, 'Eevee', 'Gnaw')
) as v(sigla, numero, nome, attacco)
where s.sigla = v.sigla and s.numero = v.numero and s.nome = v.attacco;

-- Controllo a occhio (non cambia niente): devono uscire i nomi dei Pokémon.
select sigla, string_agg(numero || ' ' || nome, ', ' order by numero) as carte
from public.set_carte
where sigla in ('MCD11', 'MCD12', 'MCD16', 'MCD19')
group by sigla order by sigla;
