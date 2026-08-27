// ── state/wishlist.state.js ──────────────────────────────────────────────
// Stato di wishlist.html. Stessi valori iniziali del codice originale.

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
// tipo='wishlist' di questo owner, risolto in caricaCatalogo() via
// leggi_binder_id_owner. _binderId/_binderInfo sono il bridge di stato
// atteso da ui/binder-flipbook.ui.js (stessi nomi di state/
// binder-pubblico.state.js) — erano temporaneamente dichiarati in cima a
// ui/wishlist.ui.js per assenza di questo file durante quella sessione,
// consolidati qui ora che il file è disponibile.
let _ownerBinderId = null;
let _binderId = null;
let _binderInfo = null;

// A16: nome del proprietario della wishlist, passato nell'URL dal sito
// privato (stesso pattern già usato per tema/dark-mode) — nessuna nuova
// chiamata a Supabase, nessun dato sensibile in più esposto (solo il
// nome, non l'email completa). Link vecchi senza questo parametro
// restano compatibili: si usa il testo generico di prima.
const _nomeProprietarioWishlist = new URLSearchParams(window.location.search).get('nome');
