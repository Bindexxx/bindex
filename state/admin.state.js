// ── state/admin.state.js ──────────────────────────────────────────────
// Stato e riferimenti DOM globali della dashboard admin. Stessi valori
// iniziali del codice originale.

const loginScreen  = document.getElementById('login-screen');
const deniedScreen = document.getElementById('denied-screen');
const dash         = document.getElementById('dash');
const elUser  = document.getElementById('login-user');
const elPass  = document.getElementById('login-pass');
const elErr   = document.getElementById('login-error');
const elSubmit = document.getElementById('login-submit');
let _ultimeRichiesteCaricate = [];
let _mappaUsernameRichieste = {};
let _mappaAnteprimaFotoRichieste = {};
let _mappaSlotRichieste = {}; // media_id -> 'card_back' | 'binder_cover'
let _nascondiGiaGestite = false; // toggle "Nascondi già gestite" (Fase f, solo vista, non tocca il DB)
let ultimaListaUtenti = [];
const modalBackdrop = document.getElementById('user-modal-backdrop');
const modalBody = document.getElementById('modal-body');
