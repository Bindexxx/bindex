// Location secondaria (sql/158, 28/11/2026): un'etichetta in più sulla carta.
// Pagina di prova in Chromium con i file veri ui/entry.ui.js, ui/cards-filtro.ui.js,
// ui/cards-selezione.ui.js e ui/import-csv.ui.js; finti solo coda, DB e finestre.
//   - Inserimento: colonna "Loc. 2" per riga e "Location 2 per tutte" (vince su quella della riga);
//     uguale alla principale o "?" → niente; Wishlist → niente; la bozza la ricorda;
//   - Collezione: il filtro Location trova le carte con quella location come principale O secondaria;
//   - Selezione multipla: "Location secondaria" solo alle carte (la Wishlist si salta), annullabile;
//   - Import CSV: colonna riconosciuta dall'intestazione, uguale alla principale → niente, sealed e
//     wishlist → niente.
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
    <div id="importCsvVista"></div>
    <div id="barraSelezioneMultipla"></div><span id="conteggioSelezioneMultipla"></span>
    </body></html>`);
  await pg.addScriptTag({ content: STUB });
  for (const f of ['ui/entry.ui.js', 'ui/cards-filtro.ui.js', 'ui/cards-selezione.ui.js', 'ui/import-csv.ui.js']) {
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
    addNewEntryRow({ name: 'Carta A', loc: 'Binder 1', loc2: 'Scatola' });
    addNewEntryRow({ name: 'Carta B', loc: 'Binder 1', loc2: 'Binder 1' });   // uguale alla principale
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
    addNewEntryRow({ name: 'Carta D', loc: 'Scatola', loc2: 'Binder 1' });
    addNewEntryRow({ name: 'Carta E', loc: 'Binder 1' });
    document.getElementById('selectLocation2Comune').value = 'Scatola';
    await salvaCarteReali();
    out.comune = window.__coda.map(r => ({ nome: r.nome, location: r.location, location_secondaria: r.location_secondaria }));

    window.__coda = [];
    _destinazioneInserimento = 'wishlist';
    document.getElementById('entryTableBody').innerHTML = '';
    addNewEntryRow({ name: 'Carta W', loc2: 'Scatola' });
    document.getElementById('selectLocation2Comune').value = 'Scatola';
    await salvaCarteReali();
    out.wishlist = window.__coda.map(r => ({ location: r.location, location_secondaria: r.location_secondaria }));
    _destinazioneInserimento = 'collezione';
    return out;
  });
  uguale('"Location 2 per tutte": le location senza "?"', ins.opzioniComune2, ['', 'Binder 1', 'Scatola']);
  uguale('"Loc. 2" sulla riga: "nessuna" in cima, senza "?"', ins.opzioniRiga2, ['', 'Binder 1', 'Scatola']);
  controlla('sommario della riga con la 2ª location', /Binder 1 · 2ª: Scatola/.test(ins.sommarioA), ins.sommarioA);
  controlla('Note lette dalla sua colonna (non più dalla posizione)', ins.noteSelettore);
  uguale('la bozza ricorda la 2ª location', ins.bozza, ['Scatola', 'Binder 1', '']);
  uguale('e la rimette dopo il ripristino', ins.dopoRipristino.slice(0, 3), ['Scatola', 'Binder 1', '']);
  uguale('per riga: secondaria inviata, uguale alla principale → niente', ins.perRiga, [
    { nome: 'Carta A', location: 'Binder 1', location_secondaria: 'Scatola', nota: null },
    { nome: 'Carta B', location: 'Binder 1', location_secondaria: null, nota: null },
    { nome: 'Carta C', location: null, location_secondaria: null, nota: 'nota C' },
  ]);
  uguale('"per tutte" vince sulla riga; uguale alla principale → niente', ins.comune, [
    { nome: 'Carta D', location: 'Scatola', location_secondaria: null },
    { nome: 'Carta E', location: 'Binder 1', location_secondaria: 'Scatola' },
  ]);
  uguale('Wishlist: niente location secondaria', ins.wishlist, [{ location: 'WISHLIST', location_secondaria: null }]);

  // ---------- Filtro della Collezione ----------
  const filtro = await pg.evaluate(() => {
    carteReali = [
      { id: 1, tabella: 'carte', stato: 'collezione', name: 'Uno', code: '', lang: 'IT', location: 'Binder 1', locationSecondaria: '' },
      { id: 2, tabella: 'carte', stato: 'collezione', name: 'Due', code: '', lang: 'IT', location: 'Scatola', locationSecondaria: 'Binder 1' },
      { id: 3, tabella: 'carte', stato: 'collezione', name: 'Tre', code: '', lang: 'IT', location: 'Scatola', locationSecondaria: '' },
      { id: 4, tabella: 'wishlist', stato: 'wishlist', name: 'Quattro', code: '', lang: 'IT', location: '' },
    ];
    const per = (v, modo) => { currentMode = modo; document.getElementById('filterLocation').value = v; filterTable(); return window.__visti.slice(); };
    return { vis: per('Binder 1', 'visualizzazione'), coll: per('Binder 1', 'collezione'), scat: per('Scatola', 'collezione'), tutte: per('', 'collezione') };
  });
  uguale('filtro "Binder 1" (vista Collezione): principale o secondaria', filtro.vis, ['Uno', 'Due']);
  uguale('filtro "Binder 1" (tabella): principale o secondaria', filtro.coll, ['Uno', 'Due']);
  uguale('filtro "Scatola": solo chi ce l\'ha', filtro.scat, ['Due', 'Tre']);
  uguale('nessun filtro: tutte le carte', filtro.tutte, ['Uno', 'Due', 'Tre']);

  // ---------- Selezione multipla ----------
  const sel = await pg.evaluate(async () => {
    window.__aggiornamenti = []; window.__breve = [];
    await _impostaLocationSecondariaSelezionate([{ id: '1', tabella: 'carte' }, { id: '2', tabella: 'carte' }, { id: '4', tabella: 'wishlist' }], 'Scatola');
    const dopo = carteReali.filter(c => c.tabella === 'carte').map(c => c.locationSecondaria);
    const primo = window.__aggiornamenti.slice();
    await window.__breve[0].o.azione.fn();
    const annullato = carteReali.filter(c => c.tabella === 'carte').map(c => c.locationSecondaria);
    window.__avvisi = [];
    await _impostaLocationSecondariaSelezionate([{ id: '4', tabella: 'wishlist' }], 'Scatola');
    return { primo, dopo, annullato, soloWishlist: window.__avvisi.slice() };
  });
  uguale('selezione: una sola scrittura, solo le carte (Wishlist saltata)', sel.primo, [{ ids: ['1', '2'], valore: 'Scatola' }]);
  uguale('selezione: secondaria messa', sel.dopo, ['Scatola', 'Scatola', '']);
  uguale('"Annulla": torna com\'era (vuota e "Binder 1")', sel.annullato, ['', 'Binder 1', '']);
  controlla('solo righe Wishlist: avviso e nessuna scrittura', sel.soloWishlist.length === 1 && /Wishlist/.test(sel.soloWishlist[0]), sel.soloWishlist);

  // ---------- Import CSV ----------
  const csv = await pg.evaluate(() => {
    const mappa = _importCsvMappaAuto(['Nome', 'Location', 'Location secondaria']);
    const mappa2 = _importCsvMappaAuto(['name', 'loc2', 'dove']);
    const tabella = [['Nome', 'Location', 'Location secondaria'], ['Carta 1', 'Binder 1', 'Scatola'], ['Carta 2', 'Binder 1', 'binder 1'], ['Carta 3', '', '?']];
    const prova = (tipo, dest) => {
      _impCsv = { tabella, mappa: mappa.slice(), tipo, dest, saltaGia: false };
      _importCsvValuta();
      return _impCsv.righe.map(r => r.db.location_secondaria);
    };
    return { mappa, mappa2, carte: prova('carta', 'collezione'), wish: prova('carta', 'wishlist'), sealed: prova('sealed', 'collezione') };
  });
  uguale('CSV: intestazione "Location secondaria" riconosciuta', csv.mappa, ['nome', 'location', 'location_secondaria']);
  uguale('CSV: anche "loc2"', csv.mappa2, ['nome', 'location_secondaria', 'location']);
  uguale('CSV carte: secondaria; uguale alla principale (maiuscole a parte) o "?" → niente', csv.carte, ['Scatola', null, null]);
  uguale('CSV wishlist: niente', csv.wish, [null, null, null]);
  uguale('CSV sealed: niente', csv.sealed, [null, null, null]);

  controlla('nessun errore nella pagina', errori.length === 0, errori);
  await browser.close();
  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
