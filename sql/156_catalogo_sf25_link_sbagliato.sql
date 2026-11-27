-- 156: catalogo — Stormfront (SF) n. 25 (Scizor, normale e reverse).
-- Il 25/11/2026 la coda ha cercato "Scizor SF 25": su Cardmarket "SF25" è il Turffield Stadium
-- delle Single Strike/Rapid Strike Premium Trainer Boxes ("sF 25"). La carta salvata ha insegnato
-- al catalogo (_catalogo_impara) link e foto sbagliati. Si toglie il link e si rimette la foto TCGdex.
update public.set_carte
set cardmarket_url = null,
    immagine = 'https://assets.tcgdex.net/en/dp/dp7/25/low.webp',
    aggiornato_il = now()
where sigla = 'SF' and numero = 25
  and cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Single-Strike-Rapid-Strike-Premium-Trainer-Boxes/Turffield-Stadium-sF25';

-- verifica: 0 righe col link sbagliato, 2 con la foto TCGdex
select count(*) filter (where cardmarket_url like '%Single-Strike%') as link_sbagliati,
       count(*) filter (where immagine = 'https://assets.tcgdex.net/en/dp/dp7/25/low.webp') as foto_tcgdex
from public.set_carte where sigla = 'SF' and numero = 25;
