// Contenitori (sql/158 + sql/162, 28/11/2026): dove sta fisicamente la carta, facoltativo, elenco a
// parte dalle location (sulla carta: location_secondaria).
// Pagina di prova in Chromium con i file veri ui/entry.ui.js, ui/cards-filtro.ui.js,
// ui/cards-selezione.ui.js, ui/import-csv.ui.js e ui/widget-location.ui.js; finti DB e finestre.
//   - Inserimento: colonna "Contenitore" per riga (dall'elenco dei contenitori) e "Contenitore per
//     tutte" (vince su quella della riga); "?" → niente; Wishlist → niente; la bozza lo ricorda;
//   - Collezione: filtro Contenitore a parte (anche "Senza contenitore"), combinabile con la Location;
//   - Selezione multipla: contenitore solo alle carte (la Wishlist si salta), annullabile;
//   - Import CSV: colonna "contenitore" riconosciuta, sealed e wishlist → niente;
//   - Pagina contenitori: conti per contenitore e per location, "senza contenitore", vuoti.
// Serve Playwright: PLAYWRIGHT_MODULE = modulo se non è installato qui, CHROME_PATH = Chrome.
const fs = require('fs');
const path = require('path');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const STUB = `
  let _tipoInserimento = 'carta';
  let _destinazioneInserimento = 'collezione';
  var currentMode = 'visualizzazione', highlightedRowId = null, _filtriTipo = { carte: true, sealed: true, wishlist: true };
  var carteReali = [], _idsInScambio = new Set();
  const FILTRO_SENZA_CONTENITORE = '__senza__';
  var CATALOGO_WIDGET = {};
  function escapeJsAttr(s) { return String(s == null ? '' : s).split("'").join('&#39;'); }
  function formattaEuro(v) { return (Number(v) || 0).toFixed(2).replace('.', ',') + ' €'; }
  async function contenitoriList() { return { data: [{ nome: 'Binder Scambi' }, { nome: 'Toploader' }], error: null }; }
  window.__coda = []; window.__avvisi = []; window.__bozza = null; window.__visti = []; window.__aggiornamenti = []; window.__breve = [];
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  async function authGetUserId() { return 'u-prova'; }
  async function assicuraLoginSupabase() {}
  async function queueInsertRighe(righe) { window.__coda.push(...[].concat(righe)); return { error: null }; }
  function mostraAvviso(t) { window.__avvisi.push(String(t)); }
  function avvisoBreve(t, o) { window.__breve.push({ t: String(t), o }); }
  async function chiediConferma() { return true; }
  function prefEntryDraftClear() { window.__bozza = null; }
  function prefEntryDraftSet(v) { window.__bozza = v; }
  function prefEntryDraftGet() { return window.__bozza; }
  function insAggiornaPagina() {}
  function renderViewTable(righe) { window.__visti = righe.map(c => c.name); }
  async function cardsUpdateLocationSecondariaBatch(ids, valore) {
    window.__aggiornamenti.push({ ids: ids.map(String), valore: valore || null });
    carteReali.forEach(c => { if (c.tabella === 'carte' && ids.map(String).includes(String(c.id))) c.locationSecondaria = valore || ''; });
    return { error: null };
  }
  async function caricaCarteReali() {}
  async function locationsList() { return { data: [{ nome: 'Binder 1' }, { nome: 'Scatola' }, { nome: '?' }], error: null }; }
`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const pg = await browser.newPage();
  const errori = [];
  pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
  await pg.setContent(`<!doctype html><html><body>
    <div id="inserimento"></div>
    <div id="pannelloLocationComune"></div><div id="pannelloLocation2Comune"></div>
    <select id="selectLocationComune"><option value="">per riga</option></select>
    <select id="selectLocation2Comune"><option value="">per riga</option></select>
    <button id="btnSalvaCarte">Salva</button><button id="btnDestCollezione"></button><button id="btnDestWishlist"></button>
    <table><tbody id="entryTableBody"></tbody></table>
    <input id="searchInput" value=""><select id="filterLocation"><option value="">Tutte</option><option>Binder 1</option><option>Scatola</option></select>
    <select id="filterLang"><option value="">Tutte</option></select>
    <select id="filterContenitore"><option value="">Tutti</option><option value="__senza__">Senza</option><option>Toploader</option></select>
    <div id="importCsvVista"></div>
    <div id="barraSelezioneMultipla"></div><span id="conteggioSelezioneMultipla"></span>
    </body></html>`);
  await pg.addScriptTag({ content: STUB });
  for (const f of ['ui/entry.ui.js', 'ui/cards-filtro.ui.js', 'ui/cards-selezione.ui.js', 'ui/import-csv.ui.js', 'ui/widget-location.ui.js']) {
    await pg.addScriptTag({ content: fs.readFileSync(path.join(RADICE, f), 'utf8') + '\n//# sourceURL=' + f });
  }

  await pg.evaluate(() => { window.insAggiornaPagina = async () => {}; });   // il riquadro "ultimo invio" non c'entra

  // ---------- Inserimento ----------
  const ins = await pg.evaluate(async () => {
    const out = {};
    function insAggiornaBottone() {}
    window.insAggiornaBottone = insAggiornaBottone;
    await caricaSelectLocationComune();
    out.opzioniComune2 = [...document.querySelectorAll('#selectLocation2Comune option')].map(o => o.value);
    document.getElementById('entryTableBody').innerHTML = '';
    addNewEntryRow({ name: 'Carta A', loc: 'Binder 1', loc2: 'Toploader' });
    addNewEntryRow({ name: 'Carta B', loc: 'Binder 1', loc2: 'Binder Scambi' });
    addNewEntryRow({ name: 'Carta C', loc: '?' });
    const righe = [...document.querySelectorAll('#entryTableBody tr')];
    out.opzioniRiga2 = [...righe[2].querySelectorAll('td.ins-td-loc2 option')].map(o => o.value);
    out.sommarioA = righe[0].querySelector('.ins-sommario').textContent;
    out.noteSelettore = righe[0].querySelector('td.ins-td-note input') !== null;
    righe[2].querySelector('td.ins-td-note input').value = 'nota C';
    saveEntryDraft();
    out.bozza = JSON.parse(window.__bozza).map(r => r.loc2);
    restoreEntryDraft();
    out.dopoRipristino = [...document.querySelectorAll('#entryTableBody tr')].map(tr => tr.querySelector('td.ins-td-loc2 select')?.value);
    await salvaCarteReali();
    out.perRiga = window.__coda.map(r => ({ nome: r.nome, location: r.location, location_secondaria: r.location_secondaria, nota: r.nota }));

    window.__coda = [];
    document.getElementById('entryTableBody').innerHTML = '';
    addNewEntryRow({ name: 'Carta D', loc: 'Scatola', loc2: 'Binder Scambi' });
    addNewEntryRow({ name: 'Carta E', loc: 'Binder 1' });
    document.getElementById('selectLocation2Comune').value = 'Toploader';
    await salvaCarteReali();
    out.comune = window.__coda.map(r => ({ nome: r.nome, location: r.location, location_secondaria: r.location_secondaria }));

    window.__coda = [];
    _destinazioneInserimento = 'wishlist';
    document.getElementById('entryTableBody').innerHTML = '';
    addNewEntryRow({ name: 'Carta W', loc2: 'Toploader' });
    document.getElementById('selectLocation2Comune').value = 'Toploader';
    await salvaCarteReali();
    out.wishlist = window.__coda.map(r => ({ location: r.location, location_secondaria: r.location_secondaria }));
    _destinazioneInserimento = 'collezione';
    return out;
  });
  uguale('"Contenitore per tutte": l\'elenco dei contenitori (non le location)', ins.opzioniComune2, ['', 'Binder Scambi', 'Toploader']);
  uguale('"Contenitore" sulla riga: "nessuno" in cima, poi i contenitori', ins.opzioniRiga2, ['', 'Binder Scambi', 'Toploader']);
  controlla('sommario della riga col contenitore', /Binder 1 · 📦 Toploader/.test(ins.sommarioA), ins.sommarioA);
  controlla('Note lette dalla sua colonna (non più dalla posizione)', ins.noteSelettore);
  uguale('la bozza ricorda il contenitore', ins.bozza, ['Toploader', 'Binder Scambi', '']);
  uguale('e lo rimette dopo il ripristino', ins.dopoRipristino.slice(0, 3), ['Toploader', 'Binder Scambi', '']);
  uguale('per riga: contenitore inviato, facoltativo', ins.perRiga, [
    { nome: 'Carta A', location: 'Binder 1', location_secondaria: 'Toploader', nota: null },
    { nome: 'Carta B', location: 'Binder 1', location_secondaria: 'Binder Scambi', nota: null },
    { nome: 'Carta C', location: null, location_secondaria: null, nota: 'nota C' },
  ]);
  uguale('"per tutte" vince sulla riga', ins.comune, [
    { nome: 'Carta D', location: 'Scatola', location_secondaria: 'Toploader' },
    { nome: 'Carta E', location: 'Binder 1', location_secondaria: 'Toploader' },
  ]);
  uguale('Wishlist: niente contenitore', ins.wishlist, [{ location: 'WISHLIST', location_secondaria: null }]);

  // ---------- Filtro della Collezione ----------
  const filtro = await pg.evaluate(() => {
    carteReali = [
      { id: 1, tabella: 'carte', stato: 'collezione', name: 'Uno', code: '', lang: 'IT', location: 'Binder 1', locationSecondaria: '' },
      { id: 2, tabella: 'carte', stato: 'collezione', name: 'Due', code: '', lang: 'IT', location: 'Scatola', locationSecondaria: 'Toploader' },
      { id: 3, tabella: 'carte', stato: 'collezione', name: 'Tre', code: '', lang: 'IT', location: 'Scatola', locationSecondaria: '' },
      { id: 5, tabella: 'carte', stato: 'collezione', name: 'Cinque', code: '', lang: 'IT', location: 'Binder 1', locationSecondaria: 'Toploader', price: 2, qty: 1 },
      { id: 4, tabella: 'wishlist', stato: 'wishlist', name: 'Quattro', code: '', lang: 'IT', location: '' },
    ];
    const per = (v, modo, c = '') => { currentMode = modo; document.getElementById('filterLocation').value = v; document.getElementById('filterContenitore').value = c; filterTable(); return window.__visti.slice(); };
    return { loc: per('Binder 1', 'visualizzazione'), cont: per('', 'visualizzazione', 'Toploader'), entrambi: per('Binder 1', 'collezione', 'Toploader'),
      senza: per('', 'visualizzazione', '__senza__'), tutte: per('', 'collezione') };
  });
  uguale('filtro Location "Binder 1": solo la location (il contenitore non conta)', filtro.loc, ['Uno', 'Cinque']);
  uguale('filtro Contenitore "Toploader": carte di più location', filtro.cont, ['Due', 'Cinque']);
  uguale('Location + Contenitore insieme', filtro.entrambi, ['Cinque']);
  uguale('"Senza contenitore": solo carte, senza contenitore', filtro.senza, ['Uno', 'Tre']);
  uguale('nessun filtro: tutte le carte', filtro.tutte, ['Uno', 'Due', 'Tre', 'Cinque']);

  // ---------- Selezione multipla ----------
  const sel = await pg.evaluate(async () => {
    window.__aggiornamenti = []; window.__breve = [];
    await _impostaLocationSecondariaSelezionate([{ id: '1', tabella: 'carte' }, { id: '2', tabella: 'carte' }, { id: '4', tabella: 'wishlist' }], 'Binder Scambi');
    const dopo = carteReali.filter(c => c.tabella === 'carte').map(c => c.locationSecondaria);
    const primo = window.__aggiornamenti.slice();
    await window.__breve[0].o.azione.fn();
    const annullato = carteReali.filter(c => c.tabella === 'carte').map(c => c.locationSecondaria);
    window.__avvisi = [];
    await _impostaLocationSecondariaSelezionate([{ id: '4', tabella: 'wishlist' }], 'Scatola');
    return { primo, dopo, annullato, soloWishlist: window.__avvisi.slice() };
  });
  uguale('selezione: una sola scrittura, solo le carte (Wishlist saltata)', sel.primo, [{ ids: ['1', '2'], valore: 'Binder Scambi' }]);
  uguale('selezione: contenitore messo', sel.dopo, ['Binder Scambi', 'Binder Scambi', '', 'Toploader']);
  uguale('"Annulla": torna com\'era (nessuno e "Toploader")', sel.annullato, ['', 'Toploader', '', 'Toploader']);
  controlla('solo righe Wishlist: avviso e nessuna scrittura', sel.soloWishlist.length === 1 && /Wishlist/.test(sel.soloWishlist[0]), sel.soloWishlist);

  // ---------- Import CSV ----------
  const csv = await pg.evaluate(() => {
    const mappa = _importCsvMappaAuto(['Nome', 'Location', 'Contenitore']);
    const mappa2 = _importCsvMappaAuto(['name', 'box', 'dove']);
    const tabella = [['Nome', 'Location', 'Contenitore'], ['Carta 1', 'Binder 1', 'Toploader'], ['Carta 2', 'Binder 1', 'binder 1'], ['Carta 3', '', '?']];
    const prova = (tipo, dest) => {
      _impCsv = { tabella, mappa: mappa.slice(), tipo, dest, saltaGia: false };
      _importCsvValuta();
      return _impCsv.righe.map(r => r.db.location_secondaria);
    };
    return { mappa, mappa2, carte: prova('carta', 'collezione'), wish: prova('carta', 'wishlist'), sealed: prova('sealed', 'collezione') };
  });
  uguale('CSV: intestazione "Contenitore" riconosciuta', csv.mappa, ['nome', 'location', 'location_secondaria']);
  uguale('CSV: anche "box"', csv.mappa2, ['nome', 'location_secondaria', 'location']);
  uguale('CSV carte: contenitore (anche col nome di una location); "?" → niente', csv.carte, ['Toploader', 'binder 1', null]);

  // ---------- Pagina contenitori ----------
  const pag = await pg.evaluate(() => {
    _locDati.contenitori = ['Toploader', 'Binder Scambi', 'Vuoto'];
    carteReali = [
      { id: 1, tabella: 'carte', stato: 'collezione', location: 'Promo', locationSecondaria: 'Toploader', price: 10, qty: 1 },
      { id: 2, tabella: 'carte', stato: 'collezione', location: 'Promo', locationSecondaria: 'Toploader', price: 5, qty: 2 },
      { id: 3, tabella: 'carte', stato: 'collezione', location: 'Collezione', locationSecondaria: 'toploader', price: 1, qty: 1 },
      { id: 4, tabella: 'carte', stato: 'collezione', location: 'Promo', locationSecondaria: 'Binder Scambi', price: 3, qty: 1 },
      { id: 6, tabella: 'carte', stato: 'collezione', location: 'Promo', locationSecondaria: '', price: 1, qty: 1 },
      { id: 7, tabella: 'wishlist', stato: 'wishlist', location: '', locationSecondaria: 'Toploader', price: 1, qty: 1 },
    ];
    const voci = _contVoci().map(v => ({ nome: v.nome, n: v.n, valore: v.valore, perLoc: [...v.perLoc.entries()].map(([l, x]) => l + ':' + x.n) }));
    const senza = _contSenza();
    return { voci, senza: { n: senza.n, valore: senza.valore }, promo: _locContenitoriDellaLocationHtml('Promo').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      dett: _contDettaglioHtml('Toploader', false).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  });
  uguale('contenitori: carte e valore, per location; maiuscole unite; wishlist esclusa; vuoti in fondo', pag.voci, [
    { nome: 'Toploader', n: 3, valore: 21, perLoc: ['Promo:2', 'Collezione:1'] },
    { nome: 'Binder Scambi', n: 1, valore: 3, perLoc: ['Promo:1'] },
    { nome: 'Vuoto', n: 0, valore: 0, perLoc: [] },
  ]);
  uguale('senza contenitore', pag.senza, { n: 1, valore: 1 });
  controlla('nella location: in quali contenitori stanno le carte', /📦 Toploader 2/.test(pag.promo) && /📦 Binder Scambi 1/.test(pag.promo) && /senza contenitore 1/.test(pag.promo), pag.promo);
  controlla('dettaglio del contenitore: per location e azioni', /Per location/.test(pag.dett) && /Promo/.test(pag.dett) && /Collezione/.test(pag.dett) && /Svuota/.test(pag.dett) && /Elimina/.test(pag.dett), pag.dett);
  uguale('CSV wishlist: niente', csv.wish, [null, null, null]);
  uguale('CSV sealed: niente', csv.sealed, [null, null, null]);

  controlla('nessun errore nella pagina', errori.length === 0, errori);
  await browser.close();
  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
