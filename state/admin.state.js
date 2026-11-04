// Stato e riferimenti DOM della pagina admin.

const loginScreen  = document.getElementById('login-screen');
const deniedScreen = document.getElementById('denied-screen');
const mfaScreen    = document.getElementById('mfa-screen');
let _mfaFattoreInCorso = null;
const dash         = document.getElementById('dash');
const elUser  = document.getElementById('login-user');
const elPass  = document.getElementById('login-pass');
const elErr   = document.getElementById('login-error');
const elSubmit = document.getElementById('login-submit');
let _ultimeRichiesteCaricate = [];
let _mappaUsernameRichieste = {};
let _mappaAnteprimaFotoRichieste = {};
let _mappaPrimaRichieste = {};
let _mappaSlotRichieste = {};
let _nascondiGiaGestite = false;
let ultimaListaUtenti = [];
const modalBackdrop = document.getElementById('user-modal-backdrop');
const modalBody = document.getElementById('modal-body');
