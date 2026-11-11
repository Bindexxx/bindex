# tools/catalogo-promo

Come sono entrate nel catalogo (`set_carte`) le carte dei masterset promo: Trick or Trade (BOO),
Prize Pack Series (PPS), World Championship Decks (WCD), Battle Academy (BA).

1. `leggi-cardmarket.js` — si incolla nella console di una scheda di Cardmarket (estensione ferma):
   legge le pagine "Singole" di ogni espansione e scarica `bindex-promo-cardmarket.json`.
2. `node genera-sql.mjs <bindex-promo-cardmarket.json>` — scrive `sql/136_catalogo_carte_promo.sql`
   e il suo rollback (set, carte, codice, link, numero prodotto, miniatura della carta d'origine).

Quando esce una serie nuova (PPS10, WCD 2026…) si rifanno i due passi: la SQL si può rieseguire.
I file `.json` letti non stanno nel repo.
