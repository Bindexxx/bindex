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

// Aggiunti 26/08/2026 (fix binder_id + libro sfogliabile condiviso, vedi
// ui/binder-flipbook.ui.js): _ownerBinderId = binder_id del binder
// location='SCAMBIO' di questo owner, risolto in caricaCatalogo() via
// leggi_binder_id_owner. _binderId/_binderInfo sono il bridge di stato
// atteso da ui/binder-flipbook.ui.js (stessi nomi di state/
// binder-pubblico.state.js) — erano temporaneamente dichiarati in cima a
// ui/scambio.ui.js per assenza di questo file durante quella sessione,
// consolidati qui ora che il file è disponibile.
let _ownerBinderId = null;
let _binderId = null;
let _binderInfo = null;
// Aggiunti ORA (26/08/2026, fix crash "_binderPagina is not defined"):
// dimenticati nel giro precedente quando ho consolidato _binderId/
// _binderInfo qui. Entrambi richiesti da ui/binder-flipbook.ui.js — la
// prima è letta PRIMA di essere mai scritta su questa pagina
// (_libroKDaPagina(_binderPagina) dentro renderBinderLibro), quindi senza
// "let" qui è un ReferenceError vero, non un semplice valore undefined.
let _binderPagina = 0;
let _modalita = 'elenco';
