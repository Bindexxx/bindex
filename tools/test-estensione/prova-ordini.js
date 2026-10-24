// Ordini e processi (dalla 5.40, Fase 4 del piano):
// service worker (background.js, Chrome e Supabase finti):
//   4.9 messaggio sconosciuto dal sito → risposta { ok:false }; versione del motore;
//   4.4 ordini abbandonati chiusi dal database (chiudi_ordini_abbandonati);
//   4.7 versione di questo PC sul database (segnala_dispositivo), al massimo una volta all'ora;
//   4.8 lettura di una scheda: 15 s, 10 s in più una volta sola se la pagina sta caricando;
//   4.1 app già aperta: nessuna ricarica se risponde, ricarica se non risponde;
//   4.10 carte della coda contate per il lotto di prezzi;
//   4.11 login: esito ricordato senza aprire schede; popup all'apertura dal sito solo senza login.
// pagine (jsdom):
//   4.1 app.js cambia sezione e avvisa la sezione; popup.js riparte con l'ordine senza ricaricare;
//   4.2 "Nessuna carta da controllare" → ordine 'completato' con totale 0, non errore;
//   4.3 "mi unisco" guarda anche l'ultima attività dell'ordine;
//   4.10 coda sempre piena: ogni 25 carte un lotto solo di 3 prezzi.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

// Carica una pagina dell'estensione in jsdom con gli script locali, come prova-ritmo.js.
function caricaPagina(file, env, { prima } = {}) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = env.chrome;
  w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '0.0', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  if (prima) prima(w);
  for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    w.document.body.appendChild(el);
  }
  return { w, errori };
}

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 40)) { console.log(`Versione ${versione}: prove dalla 5.40, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  // ═══ SERVICE WORKER ═══════════════════════════════════════════════════════
  const PAGINE = {
    [CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=ZUBAT+SIT+103']: `<html><head><title>Risultati Di Ricerca | Cardmarket</title></head><body><h1>Risultati Di Ricerca</h1>
      <a href="/it/Pokemon/Products/Singles/Silver-Tempest/Zubat-SIT103">a</a><a href="/it/Pokemon/Products/Singles/Trick-or-Trade-2023/Zubat-BOO23SIT-103">b</a></body></html>`,
    [CM + '/it/Pokemon/Products/Singles/Silver-Tempest/Zubat-SIT103']: `<html><head><title>Zubat | Cardmarket</title></head><body><h1>Zubat <span>x</span>(SIT 103)</h1></body></html>`,
  };
  const { ctx, env } = caricaBackground({
    version: versione,
    store: { nomeDispositivo: 'PC-PROVA' },
    fetch: async (url) => (PAGINE[url] ? rispostaFinta(PAGINE[url]) : null),
  });
  const esterno = (msg) => new Promise((res) => {
    let risposta = 'nessuna risposta';
    env.listeners.onMessageExternal.forEach(f => f(msg, { tab: { id: 9, windowId: 1 } }, (r) => { risposta = r; }));
    setTimeout(() => res(risposta), 100);
  });
  const interno = (msg) => new Promise((res) => {
    let fatto = false;
    env.listeners.onMessage.forEach(f => f(msg, { tab: null }, (r) => { if (!fatto) { fatto = true; res(r); } }));
    setTimeout(() => { if (!fatto) res('nessuna risposta'); }, 3000);
  });

  // 4.9
  uguale('sito, messaggio sconosciuto: risposta subito con errore', await esterno({ type: 'CARDSYNC_NON_ESISTE' }), { ok: false, errore: 'tipo sconosciuto' });
  uguale('sito, versione: anche quella del motore', await esterno({ type: 'CARDSYNC_GET_VERSION' }), { versione, motore: versione });

  // 4.4
  await ctx._chiudiOrdiniAbbandonati('u-me', false);
  controlla('ordini abbandonati: chiusi dal database (chiudi_ordini_abbandonati)', env.log.rpc.includes('chiudi_ordini_abbandonati'), env.log.rpc);
  controlla('ordini abbandonati: nessun UPDATE diretto da qui', !env.log.chiamate.some(c => c.tabella === 'ordini' && c.metodo === 'update'));

  // 4.7
  await ctx._segnalaDispositivo();
  const segnalazioni = () => env.log.chiamate.filter(c => c.rpc === 'segnala_dispositivo');
  uguale('versione del PC: nome e versione del motore', segnalazioni().map(c => c.args), [{ p_dispositivo: 'PC-PROVA', p_versione: versione }]);
  await ctx._segnalaDispositivo();
  uguale('versione del PC: non di nuovo entro l\'ora', segnalazioni().length, 1);
  controlla('versione del PC: sveglia oraria', env.log.alarms.some(a => a.name === 'segnala-dispositivo' && a.info.periodInMinutes === 60));
  const senzaLogin = caricaBackground({ version: versione, loggato: false });
  await senzaLogin.ctx._segnalaDispositivo();
  uguale('versione del PC: senza login niente', senzaLogin.env.log.rpc.filter(n => n === 'segnala_dispositivo').length, 0);

  // 4.8 — timer 100 volte più veloci: 15 s = 150 ms, 10 s = 100 ms
  const veloce = caricaBackground({ version: versione, accelera: 100 });
  const scadenza = (staCaricando, annullaDopo) => new Promise((res) => {
    const t0 = Date.now(); let timeout; let chiusa = null;
    timeout = veloce.ctx._scadenzaLettura(staCaricando, () => { chiusa = Date.now() - t0; }, (t) => { timeout = t; });
    if (annullaDopo) setTimeout(() => clearTimeout(timeout), annullaDopo);
    setTimeout(() => res(chiusa), 450);
  });
  const normale = await scadenza(() => false);
  controlla('lettura: pagina caricata → chiusa a 15 s', normale !== null && normale >= 130 && normale < 230, normale + ' ms (×100)');
  const lenta = await scadenza(() => true);
  controlla('lettura: pagina ancora in caricamento → 10 s in più, una volta', lenta !== null && lenta >= 230 && lenta < 340, lenta + ' ms (×100)');
  uguale('lettura: chiusa prima (clearTimeout del chiamante) → niente', await scadenza(() => true, 200), null);
  uguale('lettura: tempo massimo da shared.js', vm.runInContext('[TEMPO_MAX_LETTURA_MS, TEMPO_EXTRA_LETTURA_MS]', ctx), [15000, 10000]);

  // 4.1 — app già aperta
  const conApp = caricaBackground({ version: versione });
  conApp.env.tabs.set(5, { id: 5, url: 'chrome-extension://fake/app.html#carte', windowId: 1, status: 'complete' });
  const risponditoreApp = (msg, sender, sendResponse) => {
    if (msg && msg.type === 'CARDSYNC_APRI_SEZIONE_ORDINE' && msg.tabId === 5) { setTimeout(() => sendResponse({ ok: true }), 20); return true; }
    return false;
  };
  conApp.env.listeners.onMessage.push(risponditoreApp);
  await conApp.ctx._apriOFocalizzaAppSuSezione('prezzi', 'o-1');
  controlla('app aperta che risponde: nessuna ricarica', !conApp.env.log.tabs.some(t => t[0] === 'update'), conApp.env.log.tabs);
  conApp.env.listeners.onMessage.splice(conApp.env.listeners.onMessage.indexOf(risponditoreApp), 1);
  await conApp.ctx._apriOFocalizzaAppSuSezione('prezzi', 'o-2');
  controlla('app aperta che non risponde: ricaricata con l\'ordine', conApp.env.log.tabs.some(t => t[0] === 'update' && t[1] === 5 && /\?ordine=o-2#prezzi$/.test(t[2])), conApp.env.log.tabs);

  // 4.10 — conteggio delle carte della coda
  await ctx._leggiNomeDaCardmarket(CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=ZUBAT+SIT+103', 'IT', 'NM');
  await attendi(20);
  uguale('coda: una carta cercata = +1', env.store.carteCodaDaUltimiPrezzi, 1);
  await ctx._leggiNomeDaCardmarket(CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=NON+ESISTE', 'IT', 'NM');
  await attendi(20);
  uguale('coda: una carta non trovata conta una volta sola (nessun tentativo in più contato)', env.store.carteCodaDaUltimiPrezzi, 2);

  // 4.11 — login ricordato
  env.store.statoLoginCardmarket = { loggato: true, quando: Date.now() };
  const schedePrima = env.log.tabs.filter(t => t[0] === 'create').length;
  const silenziosa = await interno({ type: 'VERIFICA_LOGIN_SILENZIOSA', kind: 'carte' });
  uguale('login confermato da poco: risposta senza aprire Cardmarket', [silenziosa && silenziosa.loggato, env.log.tabs.filter(t => t[0] === 'create').length - schedePrima], [true, 0]);
  delete env.store.cardsyncLoginCheckToast;
  await esterno({ type: 'CARDSYNC_OPEN_APP' });
  await attendi(100);
  controlla('app aperta dal sito, login confermato: niente popup a tutto schermo', env.store.cardsyncLoginCheckToast === undefined);
  env.store.statoLoginCardmarket = { loggato: false, quando: Date.now() };
  await esterno({ type: 'CARDSYNC_OPEN_APP' });
  await attendi(100);
  controlla('app aperta dal sito, login mancante: popup', typeof env.store.cardsyncLoginCheckToast === 'number', env.store.cardsyncLoginCheckToast);
  controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);

  // ═══ PAGINE ═══════════════════════════════════════════════════════════════
  // 4.1 — app.js: cambia sezione e avvisa l'iframe della sezione
  {
    const envApp = creaAmbiente({ store: { selectedTheme: 'default' } });
    envApp.chrome.tabs.getCurrent = (cb) => setTimeout(() => cb({ id: 5 }), 0);
    const { w, errori } = caricaPagina('app.html', envApp);
    await attendi(300);
    const iframe = w.document.querySelector('.column[data-sezione="prezzi"] iframe');
    const avvisi = [];
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage = (m) => avvisi.push(m);
    const risposta = await new Promise((res) => {
      let r = 'nessuna risposta';
      envApp.listeners.onMessage.forEach(f => f({ type: 'CARDSYNC_APRI_SEZIONE_ORDINE', tabId: 5, sezione: 'prezzi', ordineId: 'o-1' }, {}, (x) => { r = x; }));
      setTimeout(() => res(r), 100);
    });
    uguale('app.js: risponde ok', risposta, { ok: true });
    controlla('app.js: sezione Prezzi mostrata', !!w.document.querySelector('.column[data-sezione="prezzi"].tab-attiva'));
    uguale('app.js: sezione avvisata dell\'ordine', avvisi.map(m => m.type), ['CARDSYNC_ORDINE_ARRIVATO']);
    const altra = await new Promise((res) => {
      let r = 'nessuna risposta';
      envApp.listeners.onMessage.forEach(f => f({ type: 'CARDSYNC_APRI_SEZIONE_ORDINE', tabId: 77, sezione: 'prezzi' }, {}, (x) => { r = x; }));
      setTimeout(() => res(r), 100);
    });
    uguale('app.js: messaggio per un\'altra scheda → nessuna risposta', altra, 'nessuna risposta');
    controlla('app.js: nessun errore', errori.length === 0, errori);
    w.close();
  }

  // popup.js con il service worker vero (stesso Chrome finto)
  const sw = caricaBackground({
    version: versione,
    store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, aiutaGruppo: false, statoLoginCardmarket: { loggato: true, quando: Date.now() } },
    conta: { coda_carte: 5, ordini: 0 },
  });
  const { w, errori } = caricaPagina('popup.html', sw.env);
  await attendi(900);
  const d = w.document;
  d.getElementById('sliderDelayMin').value = '1';
  d.getElementById('sliderDelayMax').value = '1';
  const pagine = [];
  w.apriTabEAspettaPrezzo = async (url) => { pagine.push(url); await attendi(50); return { prezzo: 1.5, nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null }; };
  const azioni = [];
  let totale = 0;
  const lotto = () => [1, 2, 3].map(i => ({ rigaSheet: 'c' + i + '-' + azioni.length, urlBase: CM + '/it/Pokemon/Products/Singles/Test/Carta-' + i, lingua: 'IT', condizione: 'NM', codice: 'TST ' + i, nome: 'Carta', prezzoPrecedente: 1.5, ownerId: 'u-altro' }));
  w.chiamaSupabase = async (azione, payload) => {
    azioni.push(azione);
    if (azione === 'leggi') return payload.soloConta ? { ok: true, totale } : { ok: true, carte: totale ? lotto() : [] };
    return { ok: true };
  };
  const scrittureOrdini = () => sw.env.log.chiamate.filter(c => c.tabella === 'ordini' && c.metodo === 'update').map(c => c.args[0]);

  // 4.2
  await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-vuoto', tipo: 'controlla_prezzi', parametri: { locations: [] }, creatoDa: 'u-altro', messoIl: Date.now() } });
  await w._avviaAutorunSeRichiesto();
  const ultima = scrittureOrdini().pop() || {};
  uguale('nessuna carta da controllare: ordine completato con totale 0', [ultima.stato, ultima.risultato && ultima.risultato.totale], ['completato', 0]);
  controlla('nessuna carta da controllare: messaggio non di errore', !d.getElementById('status').className.includes('errore'), d.getElementById('status').textContent);

  // 4.1 — ordine arrivato con la pagina già aperta: postMessage di app.js
  totale = 3;
  uguale('pagina pronta per gli ordini senza ricarica', w.eval('_paginaPronta'), true);
  await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-due', tipo: 'controlla_prezzi', parametri: { locations: [] }, creatoDa: 'u-altro', messoIl: Date.now() } });
  w.postMessage({ type: 'CARDSYNC_ORDINE_ARRIVATO', ordineId: 'o-due' }, '*');
  w.postMessage({ type: 'CARDSYNC_ORDINE_ARRIVATO', ordineId: 'o-due' }, '*'); // doppio: una catena sola
  for (let i = 0; i < 80 && !scrittureOrdini().some(u => u.stato === 'completato' && u.risultato && u.risultato.salite !== undefined && !('totale' in u.risultato)); i++) await attendi(250);
  const fatte = scrittureOrdini();
  controlla('ordine arrivato a pagina aperta: eseguito e scritto completato', fatte.some(u => u.stato === 'completato' && !('totale' in u.risultato)), fatte);
  uguale('ordine arrivato due volte: una sessione sola (3 pagine)', pagine.length, 3);
  const { ordinePendenteAutorun: rimasto } = await sw.env.chrome.storage.local.get('ordinePendenteAutorun');
  uguale('ordine consumato dallo storage', rimasto, undefined);

  // 4.3
  await w._unisciteControlloPrezziInCorsoSeCe();
  const or = sw.env.log.chiamate.filter(c => c.tabella === 'ordini' && c.metodo === 'or').map(c => c.args[0]);
  controlla('mi unisco: anche l\'ultima attività dell\'ordine (attivo_il)', or.some(x => /preso_in_carico_il\.gt\./.test(x) && /attivo_il\.gt\./.test(x)), or);

  // 4.10
  pagine.length = 0;
  await sw.env.chrome.storage.local.set({ aiutaGruppo: true, carteCodaDaUltimiPrezzi: 24 });
  await w._avviaControlloPrezziSeInattivo();
  uguale('coda piena, 24 carte: niente prezzi', pagine.length, 0);
  await sw.env.chrome.storage.local.set({ carteCodaDaUltimiPrezzi: 25 });
  totale = 30;
  const leggiPrima = azioni.filter(a => a === 'leggi').length;
  await w._avviaControlloPrezziSeInattivo();
  uguale('coda piena, 25 carte: un lotto solo di 3 prezzi', pagine.length, 3);
  // due conteggi (prima di partire e all'inizio della sessione) e UN lotto prenotato
  uguale('coda piena: un lotto prenotato soltanto', azioni.filter(a => a === 'leggi').length - leggiPrima, 3);
  uguale('coda piena: conteggio ripartito da zero', sw.env.store.carteCodaDaUltimiPrezzi, 0);
  const jsdomErrori = errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));
  controlla('pagina Prezzi: nessun errore', jsdomErrori.length === 0 && sw.env.log.errori.length === 0, { jsdomErrori, sw: sw.env.log.errori });
  w.close();
  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
