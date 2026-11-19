// Impostazioni del PC nell'estensione (dalla 5.74):
// - app: "Aiuta il gruppo", "Lavora anche a estensione chiusa", "Riapri l'app se viene chiusa",
//   "Apri l'app quando apri il sito" e "Mantienimi loggato" stanno nel menu Impostazioni
//   (parte "Su questo PC"); la Home non ha più interruttori;
// - service worker: il sito non può più cambiare "Aiuta il gruppo" e "Lavora a estensione chiusa"
//   (solo leggere "Aiuta il gruppo"); CARDSYNC_SITO_APERTO apre l'app solo se l'interruttore è
//   acceso e l'app non è già aperta; il vecchio "Apri sempre l'app" del sito si copia una volta;
//   CARDSYNC_OPEN_APP con impostazioni: true apre l'app sul menu Impostazioni;
// - sito (ui/extension.ui.js): niente interruttori, avvisa l'estensione all'apertura e, con
//   un'estensione più vecchia, usa ancora la scelta salvata sul sito.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const SITO = path.resolve(__dirname, '../..');
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const INTERRUTTORI = ['hubAiutaGruppo', 'hubLavoraAChiuso', 'hubRiapriApp', 'hubApriConIlSito', 'hubMantieniAccesso'];

function caricaPagina(file, env) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = env.chrome; w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '0.0', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    w.document.body.appendChild(el);
  }
  return { w, errori };
}
const senzaRumore = (errori) => errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));
function ambienteApp(versione, store) {
  const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando: Date.now() }, ...store } });
  env.listeners.onMessage.push((msg, sender, sendResponse) => {
    if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
    if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { sendResponse({ stato: 'ok' }); return false; }
    return false;
  });
  return env;
}

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 74) { console.log(`Versione ${versione}: prova dalla 5.74, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // ── app: dove stanno gli interruttori ──
  {
    const html = fs.readFileSync(path.join(EXT, 'app.html'), 'utf8');
    const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''));
    const d = dom.window.document;
    const menu = d.getElementById('impostazioniAvanzatePopover');
    uguale('app: i cinque interruttori del PC sono nel menu Impostazioni', INTERRUTTORI.filter(id => !menu.querySelector('#' + id)), []);
    uguale('app: la Home non ha più interruttori', d.querySelectorAll('main.home input[type=checkbox]').length, 0);
    uguale('app: menu diviso in "Su questo PC" e "Ritmo su Cardmarket"', [...menu.querySelectorAll('.imp-sezione')].map(e => e.textContent.trim()), ['Su questo PC', 'Ritmo su Cardmarket']);
  }

  // ── app: valori letti, salvati e aggiornati ──
  {
    const env = ambienteApp(versione, {});
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(400);
    const d = w.document;
    const stati = () => INTERRUTTORI.slice(0, 4).map(id => d.getElementById(id).checked);
    uguale('app: senza scelte salvate (aiuta no, lavora a chiusa sì, riapri no, apri col sito no)', stati(), [false, true, false, false]);
    const chiavi = { hubAiutaGruppo: 'aiutaGruppo', hubLavoraAChiuso: 'lavoraAChiuso', hubRiapriApp: 'riapriAppSeChiusa', hubApriConIlSito: 'apriAppConIlSito' };
    for (const [id, chiave] of Object.entries(chiavi)) {
      const el = d.getElementById(id);
      el.checked = !el.checked;
      el.dispatchEvent(new w.Event('change'));
    }
    uguale('app: cambiarli li salva', Object.values(chiavi).map(k => env.store[k]), [true, false, true, true]);
    await env.chrome.storage.local.set({ aiutaGruppo: false, apriAppConIlSito: false });
    uguale('app: si aggiornano se cambiano altrove', [d.getElementById('hubAiutaGruppo').checked, d.getElementById('hubApriConIlSito').checked], [false, false]);
    uguale('app: il menu resta chiuso senza richiesta dal sito', d.getElementById('impostazioniAvanzatePopover').classList.contains('visible'), false);
    await env.chrome.storage.local.set({ apriImpostazioniApp: Date.now() });
    uguale('app: richiesta dal sito → si apre il menu Impostazioni e la richiesta si toglie',
      [d.getElementById('impostazioniAvanzatePopover').classList.contains('visible'), 'apriImpostazioniApp' in env.store], [true, false]);
    await attendi(500);
    controlla('app: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }
  {
    const env = ambienteApp(versione, { aiutaGruppo: true, lavoraAChiuso: false, riapriAppSeChiusa: true, apriAppConIlSito: true, apriImpostazioniApp: Date.now() - 120000 });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(400);
    const d = w.document;
    uguale('app: scelte salvate lette', INTERRUTTORI.slice(0, 4).map(id => d.getElementById(id).checked), [true, false, true, true]);
    uguale('app: richiesta vecchia (2 minuti) → menu chiuso', d.getElementById('impostazioniAvanzatePopover').classList.contains('visible'), false);
    await attendi(500);
    controlla('app con scelte salvate: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }
  {
    const env = ambienteApp(versione, { apriImpostazioniApp: Date.now() });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(400);
    uguale('app appena aperta dal sito sulle Impostazioni: menu aperto', w.document.getElementById('impostazioniAvanzatePopover').classList.contains('visible'), true);
    await attendi(500);
    controlla('app aperta sulle Impostazioni: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── service worker: messaggi dal sito ──
  {
    const sw = (store) => {
      const b = caricaBackground({ version: versione, store: { nomeDispositivo: 'PC-PROVA', ...store } });
      const esterno = (msg) => new Promise((res) => {
        let risposta = 'nessuna risposta';
        b.env.listeners.onMessageExternal.forEach(f => f(msg, { tab: { id: 9, windowId: 1 } }, (r) => { risposta = r; }));
        setTimeout(() => res(risposta), 100);
      });
      const appAperte = () => b.env.log.tabs.filter(t => t[0] === 'create' && /app\.html/.test(t[1])).map(t => t[1]);
      return { ...b, esterno, appAperte };
    };

    const a = sw({ aiutaGruppo: false, lavoraAChiuso: true });
    uguale('sito: non può più accendere "Aiuta il gruppo"', [await a.esterno({ type: 'CARDSYNC_SET_AIUTA_GRUPPO', valore: true }), a.env.store.aiutaGruppo], [{ ok: false, errore: 'tipo sconosciuto' }, false]);
    uguale('sito: non può più spegnere "Lavora a estensione chiusa"', [await a.esterno({ type: 'CARDSYNC_SET_LAVORA_A_CHIUSO', valore: false }), a.env.store.lavoraAChiuso], [{ ok: false, errore: 'tipo sconosciuto' }, true]);
    uguale('sito: "Aiuta il gruppo" si legge ancora (widget del sito)', await a.esterno({ type: 'CARDSYNC_GET_AIUTA_GRUPPO' }), { ok: true, aiutaGruppo: false });

    const spento = sw({});
    uguale('sito aperto, interruttore spento: l\'app non si apre', [await spento.esterno({ type: 'CARDSYNC_SITO_APERTO', temaScuro: true }), spento.appAperte()], [{ ok: true, apriAppConIlSito: false, aperta: false }, []]);
    uguale('sito aperto: il tema scuro passa all\'estensione', spento.env.store.cardsyncDarkMode, true);

    const acceso = sw({ apriAppConIlSito: true });
    uguale('sito aperto, interruttore acceso, app chiusa: l\'app si apre', [await acceso.esterno({ type: 'CARDSYNC_SITO_APERTO' }), acceso.appAperte()], [{ ok: true, apriAppConIlSito: true, aperta: true }, ['chrome-extension://fake/app.html#coda']]);
    const giaAperta = sw({ apriAppConIlSito: true });
    giaAperta.env.tabs.set(5, { id: 5, url: 'chrome-extension://fake/app.html#coda', windowId: 1, status: 'complete' });
    uguale('sito aperto, app già aperta: nessuna scheda nuova e nessun salto all\'app',
      [await giaAperta.esterno({ type: 'CARDSYNC_SITO_APERTO' }), giaAperta.env.log.tabs], [{ ok: true, apriAppConIlSito: true, aperta: false }, []]);

    const migra = sw({});
    uguale('vecchio "Apri sempre l\'app" del sito: copiato nell\'estensione e app aperta',
      [await migra.esterno({ type: 'CARDSYNC_SITO_APERTO', migraApriSempre: true }), migra.env.store.apriAppConIlSito, migra.appAperte().length], [{ ok: true, apriAppConIlSito: true, aperta: true }, true, 1]);
    const nonMigra = sw({ apriAppConIlSito: false });
    uguale('vecchio "Apri sempre l\'app": se nell\'estensione è già stato spento, resta spento',
      [await nonMigra.esterno({ type: 'CARDSYNC_SITO_APERTO', migraApriSempre: true }), nonMigra.env.store.apriAppConIlSito, nonMigra.appAperte().length], [{ ok: true, apriAppConIlSito: false, aperta: false }, false, 0]);

    const imp = sw({});
    await imp.esterno({ type: 'CARDSYNC_OPEN_APP' });
    controlla('"Apri l\'app" dal sito: niente richiesta di Impostazioni', !('apriImpostazioniApp' in imp.env.store));
    const prima = Date.now();
    uguale('"Apri" in Impostazioni del sito: app aperta', await imp.esterno({ type: 'CARDSYNC_OPEN_APP', impostazioni: true }), { ok: true });
    controlla('"Apri" in Impostazioni del sito: l\'app aprirà il menu Impostazioni', typeof imp.env.store.apriImpostazioniApp === 'number' && imp.env.store.apriImpostazioniApp >= prima, imp.env.store.apriImpostazioniApp);
    controlla('service worker: nessun errore', [a, spento, acceso, giaAperta, migra, nonMigra, imp].every(x => x.env.log.errori.length === 0));
  }

  // ── sito: Impostazioni senza interruttori dell'estensione ──
  {
    const html = fs.readFileSync(path.join(SITO, 'index.html'), 'utf8');
    uguale('sito: niente interruttori dell\'estensione', ['chkAiutaGruppoDispositivo', 'chkLavoraAChiuso', 'chkApriSempreApp'].filter(id => html.includes(`id="${id}"`)), []);
    controlla('sito: la scheda rimanda all\'app dell\'estensione', /id="impostazioniEstensioneGroup"[\s\S]{0,600}apriImpostazioniEstensione\(\)/.test(html));
    const ext = fs.readFileSync(path.join(SITO, 'ui/extension.ui.js'), 'utf8');
    uguale('sito: non cambia più le impostazioni del PC', ['CARDSYNC_SET_AIUTA_GRUPPO', 'CARDSYNC_SET_LAVORA_A_CHIUSO', 'CARDSYNC_GET_LAVORA_A_CHIUSO'].filter(t => ext.includes(t)), []);

    // ui/extension.ui.js in una pagina finta: _aggiornaControlliApriApp con estensione nuova e vecchia
    const prova = async (rispostaSitoAperto, apriSempreSalvato) => {
      const dom = new JSDOM('<div id="appLaunchGroup"></div><div id="impostazioniEstensioneGroup" style="display:none"></div>', { url: 'https://bindexxx.github.io/bindex/', runScripts: 'outside-only' });
      const w = dom.window;
      const inviati = [];
      w.chrome = { runtime: { lastError: undefined, sendMessage: (id, msg, cb) => {
        inviati.push(msg.type + (msg.migraApriSempre ? '+migra' : ''));
        setTimeout(() => cb(msg.type === 'CARDSYNC_SITO_APERTO' ? rispostaSitoAperto : { ok: true }), 0);
      } } };
      if (apriSempreSalvato !== undefined) w.localStorage.setItem('cardsyncApriSempreApp', String(apriSempreSalvato));
      w.eval(`
        var ID_ESTENSIONE_CARDSYNC = 'id-finto';
        var CHIAVE_APRI_SEMPRE_APP = 'cardsyncApriSempreApp';
        var _versioneVecchiaRilevata = true;
        function prefDarkModeGet() { return false; }
        function prefSiteThemeGet() { return 'viola'; }
        function authGetUserId() { return Promise.resolve(null); }
        function authGetSession() { return Promise.resolve(null); }
        function avvisoFissoTogli() {}
        function avvisoFisso() {}
      `);
      w.eval(fs.readFileSync(path.join(SITO, 'data/preferences.repository.js'), 'utf8').match(/function prefApriSempreApp[\s\S]*?\n(?=\nfunction (?!prefApriSempreApp))/)[0]);
      w.eval(ext);
      await w.eval('_aggiornaControlliApriApp()');
      await attendi(50);
      return { inviati, chiave: w.localStorage.getItem('cardsyncApriSempreApp'), scheda: w.document.getElementById('impostazioniEstensioneGroup').style.display };
    };
    const nuova = await prova({ ok: true, apriAppConIlSito: true, aperta: true }, true);
    uguale('sito + estensione 5.74, "Apri sempre" acceso sul sito: lo passa all\'estensione e lo toglie dal sito',
      [nuova.inviati.filter(t => t !== 'CARDSYNC_GET_UTENTE'), nuova.chiave, nuova.scheda], [['CARDSYNC_SITO_APERTO+migra'], null, 'block']);
    const nuovaSpento = await prova({ ok: true, apriAppConIlSito: false, aperta: false }, undefined);
    uguale('sito + estensione 5.74, niente salvato sul sito: solo l\'avviso', nuovaSpento.inviati.filter(t => t !== 'CARDSYNC_GET_UTENTE'), ['CARDSYNC_SITO_APERTO']);
    const vecchia = await prova({ ok: false, errore: 'tipo sconosciuto' }, true);
    uguale('sito + estensione vecchia, "Apri sempre" acceso: apre l\'app come prima e tiene la scelta',
      [vecchia.inviati.filter(t => t !== 'CARDSYNC_GET_UTENTE'), vecchia.chiave], [['CARDSYNC_SITO_APERTO+migra', 'CARDSYNC_OPEN_APP'], 'true']);
    const vecchiaSpento = await prova({ ok: false, errore: 'tipo sconosciuto' }, false);
    uguale('sito + estensione vecchia, "Apri sempre" spento: l\'app non si apre', vecchiaSpento.inviati.filter(t => t !== 'CARDSYNC_GET_UTENTE'), ['CARDSYNC_SITO_APERTO']);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
