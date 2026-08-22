// ── state/scambio.state.js ───────────────────────────────────────────────
// Stato di scambio.html. Stessi valori iniziali del codice originale.

let carte = [];
const selezioni = {}; // { [id]: quantitaSelezionata }
// FASE 4 (backcarte): owner della pagina (dal parametro ?u=), serve a
// renderRetroCartaViewer per sapere di chi cercare il card_back approvato.
// Impostato in caricaCatalogo().
let _ownerUserId = null;
// A16: flip-modal — timeout del giro automatico dopo l'apertura.
let _flipCardTimeout = null;
