// Widget Set, set letti pagina per pagina da Cardmarket (sql/142): asiatici ("SV2A@JP") e My First Battle.
// La tua carta conta nella riga della sua pagina; senza pagina, dal codice se nel set è unico. Le carte
// degli altri set continuano a contare per numero.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { RADICE } = require('./lib/pagine');
const { uguale, chiudi } = require('./lib/verifica');

const ctx = { console, Map, Set, Date, JSON, Math, String, Number, Array, Object, RegExp, parseInt, isNaN };
vm.createContext(ctx);
for (const f of ['ui/set-libreria-sigle.ui.js', 'ui/set-motore.ui.js']) vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), ctx, { filename: f });
const CM = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
ctx.__righe = {
  'SV2A@JP': [['SV2A 001', 'Pokemon-Card-151/Bulbasaur-V1-sv2a001'], ['SV2A 001', 'Pokemon-Card-151/Bulbasaur-V2-sv2a001'], ['SV2A 009', 'Pokemon-Card-151/Blastoise-ex-V1-sv2a009']],
  MFB: [['MFB', 'My-First-Battle/Pikachu-V1-MFB'], ['MFB', 'My-First-Battle/Pikachu-V2-MFB']],
  'CSV9.5C@CHN': [['CSV9.5C 036', 'Terastal-Gathering/Vaporeon-ex-V1-CSV95C036']],
};
vm.runInContext(`
_ballLIBRERIA_SET = { 'SV2A@JP': { lingua: 'JP' }, 'SV2A@KOR': { lingua: 'KOR' }, MFB: {}, PAL: {}, 'CSV9.5C@CHN': { lingua: 'CHN' } };
_setM.conteggi = new Map([['SV2A@JP', 3], ['MFB', 2], ['PAL', 5], ['CSV9.5C@CHN', 1]]);
Object.entries(__righe).forEach(([sigla, rr]) => {
  const righe = rr.map(([codice, slug], i) => ({ numero: i + 1, variante: 'normale', codice, pagina: _setMPagina('${CM}' + slug) }));
  _setM.righe.set(sigla, righe);
  const perCodice = new Map(); righe.forEach(r => { const k = _ballChiaveCodice(r.codice); perCodice.set(k, perCodice.has(k) ? null : r.numero); });
  perCodice.forEach((n, k) => { if (n == null) perCodice.delete(k); });
  _setM.codici.set(sigla, { pagine: new Map(righe.map(r => [r.pagina, r.numero])), codici: perCodice });
});`, ctx);

function possedute(carte) {
  ctx.carteReali = carte.map(c => ({ stato: 'collezione', tabella: 'carte', ...c }));
  const p = vm.runInContext('setMPossedute()', ctx);
  const o = {}; p.forEach((v, k) => { o[k] = { numeri: [...v.numeri.keys()].sort((a, b) => a - b), senzaNumero: v.senzaNumero }; });
  return o;
}

uguale('SV2A giapponese V2: conta la sua pagina (riga 2), non la V1',
  possedute([{ code: 'SV2A 001', lang: 'JP', link: CM + 'Pokemon-Card-151/Bulbasaur-V2-sv2a001?language=7' }]), { 'SV2A@JP': { numeri: [2], senzaNumero: 0 } });
uguale('codice scritto attaccato ("SV2A009") senza pagina: unico nel set, si riconosce',
  possedute([{ code: 'SV2A009', lang: 'JP', link: '' }]), { 'SV2A@JP': { numeri: [3], senzaNumero: 0 } });
uguale('codice con due versioni e senza pagina: non si indovina',
  possedute([{ code: 'SV2A 001', lang: 'JP', link: '' }]), { 'SV2A@JP': { numeri: [], senzaNumero: 1 } });
uguale('set coreano senza catalogo: conta per numero come prima',
  possedute([{ code: 'SV2A 001', lang: 'KOR', link: CM + 'Pokemon-Card-151/Bulbasaur-V1-sv2a001' }]), { 'SV2A@KOR': { numeri: [1], senzaNumero: 0 } });
uguale('My First Battle: codice "MFB" senza numero, si riconosce dalla pagina',
  possedute([{ code: 'MFB', lang: 'IT', link: CM + 'My-First-Battle/Pikachu-V2-MFB' }]), { MFB: { numeri: [2], senzaNumero: 0 } });
uguale('codice col punto ("CSV9.5C 036")',
  possedute([{ code: 'CSV9.5C 036', lang: 'CHN', link: '' }]), { 'CSV9.5C@CHN': { numeri: [1], senzaNumero: 0 } });
uguale('set internazionale: per numero, come prima',
  possedute([{ code: 'PAL 050', lang: 'IT', link: CM + 'Paldea-Evolved/Quaxly-V2-PAL050' }]), { PAL: { numeri: [50], senzaNumero: 0 } });
chiudi();
