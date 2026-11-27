-- ROLLBACK di 157: toglie i link messi da 157 e rimette "Unown" come nome.
update public.set_carte
set cardmarket_url = null, aggiornato_il = now()
where sigla = 'DPP' and variante = 'normale'
  and cardmarket_url like 'https://www.cardmarket.com/it/Pokemon/Products/Singles/DP-Black-Star-Promos/%';

update public.set_carte
set cardmarket_url = null, aggiornato_il = now()
where sigla = 'XYA'
  and cardmarket_url ~ '^https://www\.cardmarket\.com/it/Pokemon/Products/Singles/(Phantom-Forces|Generations|Fates-Collide|Furious-Fists|Roaring-Skies|BREAKpoint)/[^/]+-V2-[A-Z]+[0-9]+a?$';

update public.set_carte
set cardmarket_url = null, nome = 'Unown', aggiornato_il = now()
where sigla = 'EXU'
  and cardmarket_url like 'https://www.cardmarket.com/it/Pokemon/Products/Singles/EX-Unseen-Forces/Unown-%';
