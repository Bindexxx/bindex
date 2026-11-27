-- ROLLBACK di 156: rimette link e foto com'erano (sbagliati) su Stormfront n. 25.
update public.set_carte
set cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Single-Strike-Rapid-Strike-Premium-Trainer-Boxes/Turffield-Stadium-sF25',
    immagine = 'https://xpfibrzsffurdlypxnrw.supabase.co/storage/v1/object/public/immagini-carte/c45cc91f13d35de2ae167b03.jpg',
    aggiornato_il = now()
where sigla = 'SF' and numero = 25 and cardmarket_url is null;
