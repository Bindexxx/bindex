// Sigle del catalogo diverse da quelle di Cardmarket (dalla 5.84).
// Il catalogo del sito scrive nella coda le sigle ufficiali ("Marowak TRI 44", "SF 48", "Horsea N1 62"),
// Cardmarket per quei set ne usa altre (TM, STF, NG…): il 25/11/2026 "TRI 44" non trovava niente e
// "SF 25" prendeva il Turffield Stadium delle Single Strike Premium Trainer Box (sF 25).
// In più: "gastly tm63" (nome corto + codice di 2 lettere attaccato) diventava "GASTLYTM63", e
// POP1/B2/M24 facevano pensare a una carta giapponese.
// Sigle confermate il 27/11/2026 dai codici delle carte salvate nel DB e da ricerche su Cardmarket
// (EPO10, HGSS01, ASRTG01, CRZGG01, SHFSV1, XYPR10, SWSH016, M24002, POP311, M23012, SM04, TK110A portano dritti alla carta).
// Il 27/11 sera giro completo: una carta per ognuno dei 277 set del catalogo, testo come lo scrive il sito.
const fs = require('fs');
const path = require('path');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { uguale, chiudi } = require('./lib/verifica');

const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const slug = (u) => (u || '').split('/').pop();

const TESTI = [
  // sigla del catalogo staccata → sigla di Cardmarket
  ['Marowak TRI 44', 'Marowak TM 44'],
  ['Nidoking TRI 6', 'Nidoking TM 6'],
  ['SF 48', 'STF 48'],
  ['Scizor SF 25', 'Scizor STF 25'],
  ['onix und 21', 'onix UD 21'],
  ['Eevee COL 56', 'Eevee CL 56'],
  ['Abra RO 49', 'Abra TR 49'],
  ['Ponyta RG 76', 'Ponyta FL 76'],
  ['Horsea N1 62', 'Horsea NG 62'],
  ['Pineco N2 61', 'Pineco NDI 61'],
  ['Chinchou N3 42', 'Chinchou NR 42'],
  ['Dark Crobat N4 2', 'Dark Crobat NDE 2'],
  ['larvitar P1 11', 'larvitar POP1 11'],
  ['P6 14', 'POP6 14'],
  ['flareon SMP 186', 'flareon SM 186'],
  ['Pikachu SMP 4', 'Pikachu SM 04'],
  ['Fire Energy TK1A 10', 'Fire Energy TK1 10A'],
  ['Lightning Energy TK1O 10', 'Lightning Energy TK1 10O'],
  ['Inteleon V SWSHP 16', 'Inteleon V SWSH 016'],
  ['Pikachu XYP 152', 'Pikachu XYPR 152'],
  ['Pikachu MCD24 2', 'Pikachu M24 002'],
  ['Blissey MCD23 12', 'Blissey M23 012'],
  ['Cottonee EP 10', 'Cottonee EPO 10'],
  ['Ho-Oh HGSSP 1', 'Ho-Oh HGSS 01'],
  ['Bulbasaur MCD21 1', 'Bulbasaur MCD25 1'],
  ['Abomasnow ASR-TG 001', 'Abomasnow ASR TG01'],
  ['Flareon brs-tg 1', 'Flareon BRS TG01'],
  ['Parasect LOR-TG 001', 'Parasect LOR TG01'],
  ['Braixen SIT-TG 001', 'Braixen SIT TG01'],
  ['Voltorb di Hisui CRZ-GG 001', 'Voltorb di Hisui CRZ GG01'],
  ['Rowlet SHF-SV 1', 'Rowlet SHF SV1'],
  ['Dartrix SHF-SV 012', 'Dartrix SHF SV12'],
  // attaccate: solo le sigle di sole lettere
  ['tri44', 'TM44'],
  ['Scizor sf25', 'Scizor STF25'],
  ['swshp16', 'SWSH016'],
  ['ep10', 'EPO10'],
  ['n162', 'n162'],
  // già come su Cardmarket, o altre sigle: non cambia niente
  ['STF 48', 'STF 48'],
  ['banette tm 14', 'banette tm 14'],
  ['ZUBAT SIT 103', 'ZUBAT SIT 103'],
  ['BA22 C31', 'BA22 C31'],
  ['Pikachu', 'Pikachu'],
  ['Charizard ex 125', 'Charizard ex 125'],
  ['sf', 'sf'],
  ['', ''],
];

const COMPATTI = [
  // nome corto + 2 lettere attaccate al numero: è la sigla del set, non un pezzo di codice
  ['gastly tm63', 'TM63'], ['Abra TR49', 'TR49'], ['Grimer TR57', 'TR57'], ['Vulpix LC98', 'LC98'],
  ['Grass Energy GC129', 'GC129'], ['Pikachu Lv12 MD70', 'MD70'], ['onix ud21', 'UD21'],
  // come prima
  ['dratini tm62', 'TM62'], ['Pikachu EM60', 'EM60'], ['flareon sm186', 'SM186'],
  ['Jynx SIT TG04', 'SITTG04'], ['SHF SV12', 'SHFSV12'], ['Falinks V SHF SV115', 'SHFSV115'], ['Kricketune CRZ GG01', 'CRZGG01'],
  ['Pikachu GEN RC5', 'GENRC5'], ['Abomasnow ASR TG01', 'ASRTG01'], ['Rowlet SHF SV1', 'SHFSV1'], ['BA22 C31', 'BA22C31'], ['rotom ba24 p14', 'BA24P14'], ['Magikarp DR 60', 'DR60'],
  ['banette tm 14', 'TM14'], ['STF 50', 'STF50'], ['Roselia StF 72', 'STF72'], ['CUBONE CBB3C04', 'CBB3C04'],
  ['Pikachu 25', null], ['Pikachu', null],
];

const LINGUE = [
  ['larvitar POP1 11', null], ['POP6 14', null], ['Blastoise B2 2', null], ['EEVEE M24 013', null], ['tandemaus m23 013', null],
  ['heracross m6 001', 'giapponese'], ['m6001', 'giapponese'], ['Eevee SV2A 133', 'giapponese'], ['pikachu CSV2C 001', 'cinese'],
];

const paginaCarta = (nome, codice, url) => `<html><head><meta property="og:url" content="${url}">
  <title>${nome} | Cardmarket</title></head><body><h1>${nome}  (${codice})<span class="h4 text-muted"> Singles</span></h1></body></html>`;
const lista = (...sl) => `<html><head><meta property="og:url" content="${CM}/it/Pokemon/Products/Search"><title>Risultati</title></head><body><h1>Risultati Di Ricerca</h1>${sl.map(x => `<a href="/it/Pokemon/Products/Singles/${x}">x</a>`).join('')}</body></html>`;
const prezzoRiga = `<div class="article-row"><div class="product-attributes"><span aria-label="Italiano"></span></div><div class="price-container"><span class="fw-bold">1,00 €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
const conPrezzo = (nome, codice, url) => paginaCarta(nome, codice, url).replace('</body>', prezzoRiga + '<a id="account-dropdown">u</a></body>');
const ric = (t) => `${CM}/it/Pokemon/Products/Search?searchMode=v2&searchString=${encodeURIComponent(t).replace(/%20/g, '+')}`;

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(cartellaEstensione(), 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (!(maj > 5 || (maj === 5 && min >= 84))) { console.log(`Versione ${versione}: prova dalla 5.84, saltata`); chiudi(); return; }

  const { ctx } = caricaBackground();
  for (const [testo, atteso] of TESTI) uguale(`sigla di Cardmarket per "${testo}"`, ctx._testoConSiglaCardmarket(testo), atteso);
  console.log('');
  for (const [testo, atteso] of COMPATTI) uguale(`codice attaccato per "${testo}"`, ctx._codiceRicercaCompatto(testo), atteso);
  console.log('');
  for (const [testo, atteso] of LINGUE) uguale(`lingua dal codice di "${testo}"`, ctx._linguaProdottoDaQuery(testo), atteso);
  console.log('');
  uguale('link a una carta: resta com\'è', ctx._urlRicercaConSiglaCardmarket(B + 'Stormfront/Shelgon-Lv35-STF50'), B + 'Stormfront/Shelgon-Lv35-STF50');
  uguale('ricerca senza sigle del catalogo: stesso indirizzo', ctx._urlRicercaConSiglaCardmarket(ric('ZUBAT SIT 103') + '&language=5'), ric('ZUBAT SIT 103') + '&language=5');
  uguale('ricerca "Marowak TRI 44": cambia solo il testo', new URL(ctx._urlRicercaConSiglaCardmarket(ric('Marowak TRI 44') + '&language=5')).searchParams.toString(), 'searchMode=v2&searchString=Marowak+TM+44&language=5');
  uguale('indirizzo mancante', ctx._urlRicercaConSiglaCardmarket(null), null);

  // giro completo come la coda: testo del catalogo → ricerca col codice di Cardmarket → carta giusta
  const giro = async (testo, mappa) => {
    const chiesti = [];
    const pagine = {};
    for (const [u, h] of Object.entries(mappa)) if (u.includes('/Singles/')) pagine[u] = h;
    const { ctx: c } = caricaBackground({ version: versione, accelera: 10, pagine, fetch: async (url) => { chiesti.push(url); return mappa[url] ? rispostaFinta(mappa[url]) : null; } });
    const r = await c._leggiNomeDaCardmarket(c._urlRicercaAutonoma(testo), 'IT', 'NM', '', false, 0, null, null, null);
    return { r, chiesti: chiesti.filter(u => u.includes('/Search?')).map(u => new URL(u).searchParams.get('searchString')) };
  };
  console.log('');
  const MAROWAK = B + 'Triumphant/Marowak-TM44';
  const g1 = await giro('Marowak TRI 44', {
    [ric('TM44')]: paginaCarta('Marowak', 'TM 44', MAROWAK),
    [MAROWAK]: conPrezzo('Marowak', 'TM 44', MAROWAK),
  });
  uguale('"Marowak TRI 44": cercata come TM44 e trovata', [slug(g1.r.urlSingles), g1.r.codice, g1.chiesti], ['Marowak-TM44', 'TM 44', ['TM44']]);

  const SCIZOR = B + 'Stormfront/Scizor-Lv47-STF25';
  const TURFFIELD = B + 'Single-Strike-Rapid-Strike-Premium-Trainer-Boxes/Turffield-Stadium-sF25';
  const g2 = await giro('Scizor SF 25', {
    [ric('SF25')]: paginaCarta('Turffield Stadium', 'sF 25', TURFFIELD),
    [ric('STF25')]: paginaCarta('Scizor Lv.47', 'STF 25', SCIZOR),
    [SCIZOR]: conPrezzo('Scizor Lv.47', 'STF 25', SCIZOR),
    [TURFFIELD]: conPrezzo('Turffield Stadium', 'sF 25', TURFFIELD),
  });
  uguale('"Scizor SF 25": cercata come STF25, niente Turffield Stadium', [slug(g2.r.urlSingles), g2.chiesti], ['Scizor-Lv47-STF25', ['STF25']]);

  const SHELGON = B + 'Stormfront/Shelgon-Lv35-STF50';
  const g3 = await giro('STF 50', {
    [ric('STF50')]: paginaCarta('Shelgon Lv.35', 'STF 50', SHELGON),
    [SHELGON]: conPrezzo('Shelgon Lv.35', 'STF 50', SHELGON),
  });
  uguale('"STF 50" (già come Cardmarket): come prima', [slug(g3.r.urlSingles), g3.chiesti], ['Shelgon-Lv35-STF50', ['STF50']]);

  const GASTLY = B + 'Triumphant/Gastly-TM63';
  const g4 = await giro('gastly tm63', {
    [ric('TM63')]: paginaCarta('Gastly', 'TM 63', GASTLY),
    [ric('gastly tm63')]: lista(),
    [GASTLY]: conPrezzo('Gastly', 'TM 63', GASTLY),
  });
  uguale('"gastly tm63": cercata come TM63 e trovata', [slug(g4.r.urlSingles), g4.chiesti], ['Gastly-TM63', ['TM63']]);

  const ENERGIA = B + 'EX-Trainer-Kit/Fire-Energy-TK1Latias-10';
  const g5 = await giro('Fire Energy TK1A 10', {
    [ric('TK110A')]: paginaCarta('Energia Fuoco', 'TK1 10A', ENERGIA),
    [ENERGIA]: conPrezzo('Energia Fuoco', 'TK1 10A', ENERGIA),
  });
  uguale('"Fire Energy TK1A 10": cercata come TK110A e trovata', [slug(g5.r.urlSingles), g5.chiesti], ['Fire-Energy-TK1Latias-10', ['TK110A']]);

  const BLISSEY = B + 'McDonalds-Match-Battle-2023/Blissey-M23012';
  const g6 = await giro('Blissey MCD23 12', {
    [ric('M23012')]: paginaCarta('Blissey', 'M23 012', BLISSEY),
    [BLISSEY]: conPrezzo('Blissey', 'M23 012', BLISSEY),
  });
  uguale('"Blissey MCD23 12": cercata come M23012 e trovata', [slug(g6.r.urlSingles), g6.chiesti], ['Blissey-M23012', ['M23012']]);

  chiudi();
})();
