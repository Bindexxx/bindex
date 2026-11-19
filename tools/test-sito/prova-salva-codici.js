// Inserimento: al salvataggio le righe scritte a codice e mai uscite dal campo si collegano al
// catalogo (19/11/2026), così vanno in coda col link e l'estensione non le cerca su Cardmarket.
// Pagina di prova in Chromium con i file veri ui/entry.ui.js e ui/selettore-carte.ui.js; finti
// solo il catalogo (catalogoCerca), le sigle (setEspansioniLeggiTutte) e la coda (queueInsertRighe).
//   - codice preciso, una sola carta nel catalogo → link della pagina (o ?idProduct=) e testo
//     normalizzato;
//   - due carte possibili, solo un nome, "Non è questa" → riga lasciata com'era (testo);
//   - riga già scelta dal catalogo → resta la sua scelta;
//   - avviso finale con quanti codici sono stati collegati.
// Serve Playwright: PLAYWRIGHT_MODULE = modulo se non è installato qui, CHROME_PATH = Chrome.
const fs = require('fs');
const path = require('path');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const STUB = `
  let _tipoInserimento = 'carta';
  let _destinazioneInserimento = 'collezione';
  window.__coda = []; window.__avvisi = []; window.__ricerche = [];
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  async function authGetUserId() { return 'u-prova'; }
  async function assicuraLoginSupabase() {}
  async function queueInsertRighe(righe) { window.__coda.push(...righe); return { error: null }; }
  function mostraAvviso(t) { window.__avvisi.push(String(t)); }
  function prefEntryDraftClear() {}
  function prefEntryDraftSet() {}
  async function setEspansioniLeggiTutte() {
    return ['DRI', 'JTG', 'ASC', 'MEP', 'SVI', 'PAL'].map(s => ({ sigla: s, lingua: 'INT' }));
  }
  const CATALOGO = {
    'DRI|210': [{ sigla: 'DRI', numero: 210, variante: 'normale', nome: 'Garchomp ex di Camilla', cardmarket_url: '${B}Destined-Rivals/Cynthias-Garchomp-ex-DRI210', cardmarket_id: 830001, base: true }],
    'JTG|163': [{ sigla: 'JTG', numero: 163, variante: 'normale', nome: 'Kilowattrel di Kissara', cardmarket_url: '${B}Journey-Together/Ionos-Kilowattrel-JTG163', cardmarket_id: 817315, base: true }],
    'ASC|80':  [{ sigla: 'ASC', numero: 80, variante: 'normale', nome: 'Carta A', cardmarket_url: '${B}Ascended-Heroes/Carta-A-ASC080', base: true },
                { sigla: 'ASC', numero: 80, variante: 'holo', nome: 'Carta A', cardmarket_url: '${B}Ascended-Heroes/Carta-A-V2-ASC080', base: true }],
    'MEP|98':  [{ sigla: 'MEP', numero: 98, variante: 'normale', nome: 'Promo', cardmarket_url: null, cardmarket_id: 912345, base: true }],
  };
  async function catalogoCerca(p) {
    window.__ricerche.push(p);
    const righe = (p.sigle && p.numero != null) ? (CATALOGO[p.sigle[0] + '|' + p.numero] || []) : [];
    return { data: righe.map(r => ({ ...r, set_nome: r.sigla, lingua: 'INT', trovate: righe.length })), error: null };
  }
`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const pg = await browser.newPage();
  const errori = [];
  pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
  await pg.setContent(`<!doctype html><html><body>
    <select id="selectLocationComune"><option value="">per riga</option></select>
    <button id="btnSalvaCarte">Salva</button>
    <table><tbody id="entryTableBody"></tbody></table></body></html>`);
  await pg.addScriptTag({ content: STUB });
  for (const f of ['ui/entry.ui.js', 'ui/selettore-carte.ui.js']) {
    await pg.addScriptTag({ content: fs.readFileSync(path.join(RADICE, f), 'utf8') + '\n//# sourceURL=' + f });
  }
  const esito = await pg.evaluate(async (B) => {
    // righe come le crea la pagina (addNewEntryRow), mai uscite dal campo
    document.getElementById('entryTableBody').innerHTML = '';
    addNewEntryRow({ name: 'dri210' });                    // codice preciso, una carta con pagina
    addNewEntryRow({ name: 'jtg 163' });                   // come sopra, ma "Non è questa"
    addNewEntryRow({ name: 'asc080' });                    // due carte base possibili
    addNewEntryRow({ name: 'pikachu' });                   // solo un nome
    addNewEntryRow({ name: 'mep098' });                    // una carta, solo numero di prodotto
    addNewEntryRow({ name: 'Scelta Dal Catalogo PAL 54', blocco: { sigla: 'PAL', numero: 54, variante: 'normale', nome: 'Scelta', link: B + 'Paldea-Evolved/Scelta-PAL054', codice: 'PAL · 054', testo: 'pal 54', testoCoda: 'Scelta Dal Catalogo PAL 54' } });
    const righe = [...document.querySelectorAll('#entryTableBody tr')];
    righe[1].dataset.selManuale = '1';
    await salvaCarteReali();
    return { coda: window.__coda.map(r => ({ nome: r.nome, url: r.url_diretto || null })), avvisi: window.__avvisi, ricerche: window.__ricerche.length };
  }, B);

  uguale('6 righe in coda', esito.coda.length, 6);
  uguale('codice preciso, una carta: parte col link della pagina e il testo del catalogo', esito.coda[0], { nome: 'Garchomp ex di Camilla DRI 210', url: B + 'Destined-Rivals/Cynthias-Garchomp-ex-DRI210' });
  uguale('"Non è questa": resta testo', esito.coda[1], { nome: 'jtg 163', url: null });
  uguale('due carte possibili: resta testo', esito.coda[2], { nome: 'asc080', url: null });
  uguale('solo un nome: resta testo', esito.coda[3], { nome: 'pikachu', url: null });
  uguale('una carta col solo numero di prodotto: link ?idProduct=', esito.coda[4].url, 'https://www.cardmarket.com/it/Pokemon/Products?idProduct=912345');
  uguale('riga già scelta dal catalogo: resta la sua scelta', esito.coda[5], { nome: 'Scelta Dal Catalogo PAL 54', url: B + 'Paldea-Evolved/Scelta-PAL054' });
  controlla('avviso: 2 codici trovati nel catalogo', esito.avvisi.length === 1 && /2 codici trovati nel catalogo/.test(esito.avvisi[0]), esito.avvisi);
  controlla('ricerca nel catalogo solo per le righe da guardare (non per quella già scelta né per "Non è questa")', esito.ricerche >= 4 && esito.ricerche <= 6, esito.ricerche);
  controlla('nessun errore nella pagina', errori.length === 0, errori);
  await browser.close();
  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
