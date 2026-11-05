// Stato di wishlist.html.

let carte = [];
const selezioni = {};
let _ownerUserId = null;
let _flipCardTimeout = null;

let _ownerBinderId = null;
let _binderId = null;
let _binderInfo = null;
let _binderPagina = 0;
let _modalita = 'elenco';

const _nomeProprietarioWishlist = new URLSearchParams(window.location.search).get('nome');
