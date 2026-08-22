// ── state/sealed.state.js ────────────────────────────────────────────────
// Stato di sealed.html. Stessi valori iniziali del codice originale.

let carte = [];
const selezioni = {}; // { [id]: quantitaSelezionata }

// A16: stato dei filtri — Lingua è selezione MULTIPLA (Set vuoto = nessun
// filtro attivo, mostra tutte le lingue). Prezzo è un range [min, max]
// calcolato DINAMICAMENTE dai prodotti realmente disponibili al
// caricamento, non un range fisso.
const filtriStato = {
    lingue: new Set(),
    prezzoMin: 0,
    prezzoMax: 0,
};
let prezzoDatiMin = 0;
let prezzoDatiMax = 0;
