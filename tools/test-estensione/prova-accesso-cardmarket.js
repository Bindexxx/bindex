// Accesso a Cardmarket (dalla 5.63):
// service worker:
//   - stato per l'app (CM_ACCESSO_CONTROLLA): ricordato senza schede; "dentro" vale 6 ore;
//   - scheda per accedere (CM_ACCESSO_APRI): una sola, si chiude da sola quando l'accesso si vede;
//   - controllo in scheda nascosta: Cloudflare riconosciuto e ricordato come tale;
//   - pagine aperte per lavorare: dicono anche "fuori" (login-signup), non solo "dentro";
//   - coda autonoma ferma se fuori da Cardmarket.
// app.html (jsdom): pallino e finestra di blocco (Accedi a Cardmarket / Chiudi l'estensione).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM_HOME = 'https://www.cardmarket.com/it/Pokemon';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const DENTRO = '<html><head><title>Cardmarket</title></head><body><div id="account-dropdown">io</div></body></html>';
const FUORI = '<html><head><title>Cardmarket</title></head><body><div id="login-signup">Accedi</div></body></html>';
const CLOUDFLARE = '<html><head><title>Ci siamo quasi…</title></head><body>verifica</body></html>';

function caricaApp(env) {
  const html = fs.readFileSync(path.join(EXT, 'app.html'), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/app.html', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
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

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 63) { console.log(`Versione ${versione}: prova dalla 5.63, saltata`); chiudi(); return; }

  const interno = (env, msg) => new Promise((res) => {
    let fatto = false;
    env.listeners.onMessage.forEach(f => f(msg, { tab: null }, (r) => { if (!fatto) { fatto = true; res(r); } }));
    setTimeout(() => { if (!fatto) res('nessuna risposta'); }, 15000);
  });
  const schedeCm = (env) => env.log.tabs.filter(t => t[0] === 'create' && /cardmarket/.test(t[1])).length;

  // stato ricordato: nessuna scheda
  {
    const { env } = caricaBackground({ version: versione, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() - 3 * 60 * 60 * 1000 } } });
    const r = await interno(env, { type: 'CM_ACCESSO_CONTROLLA' });
    uguale('dentro da 3 ore: stato ok senza aprire Cardmarket', [r && r.stato, schedeCm(env)], ['ok', 0]);
  }
  {
    const { env } = caricaBackground({ version: versione, store: { statoLoginCardmarket: { loggato: false, quando: Date.now() } } });
    const r = await interno(env, { type: 'CM_ACCESSO_CONTROLLA' });
    uguale('fuori da poco: stato ko senza aprire Cardmarket', [r && r.stato, schedeCm(env)], ['ko', 0]);
  }

  // controllo in scheda nascosta: dentro, fuori, Cloudflare
  for (const [nome, pagina, atteso] of [['dentro', DENTRO, 'ok'], ['fuori', FUORI, 'ko'], ['Cloudflare', CLOUDFLARE, 'cloudflare']]) {
    const { env } = caricaBackground({ version: versione, accelera: 10, pagine: { [CM_HOME]: pagina } });
    const r = await interno(env, { type: 'CM_ACCESSO_CONTROLLA', forza: true });
    const rimosse = env.log.tabs.filter(t => t[0] === 'remove').length;
    uguale(`controllo adesso, pagina ${nome}: stato "${atteso}", la scheda nascosta si chiude`, [r && r.stato, schedeCm(env), rimosse], [atteso, 1, 1]);
    if (atteso === 'cloudflare') controlla('Cloudflare ricordato come tale', env.store.statoLoginCardmarket && env.store.statoLoginCardmarket.cloudflare === true, env.store.statoLoginCardmarket);
  }

  // scheda per accedere: una sola; quando l'accesso si vede si chiude e torna "dentro"
  {
    const pagine = { [CM_HOME]: FUORI };
    const { env } = caricaBackground({ version: versione, pagine, store: { statoLoginCardmarket: { loggato: false, quando: Date.now() } } });
    await interno(env, { type: 'CM_ACCESSO_APRI' });
    await interno(env, { type: 'CM_ACCESSO_APRI' });
    await attendi(1500);
    uguale('accedi: una sola scheda anche premendo due volte, resta aperta finché sei fuori', [schedeCm(env), env.log.tabs.filter(t => t[0] === 'remove').length], [1, 0]);
    const idScheda = env.store.cmSchedaAccesso && env.store.cmSchedaAccesso.id;
    const t = env.tabs.get(idScheda);
    // l'utente fa l'accesso: la pagina ricarica con l'account
    pagine[CM_HOME] = DENTRO;
    if (t) { t.url = CM_HOME + '?x=1'; pagine[CM_HOME + '?x=1'] = DENTRO; }
    env.listeners.onUpdated.forEach(f => { try { f(idScheda, { status: 'complete' }, t); } catch (_) {} });
    await attendi(1500);
    uguale('accedi: appena l\'accesso si vede la scheda si chiude e lo stato è "dentro"',
      [env.log.tabs.some(x => x[0] === 'remove' && x[1] === idScheda), env.store.statoLoginCardmarket && env.store.statoLoginCardmarket.loggato, env.store.cmSchedaAccesso], [true, true, undefined]);
    controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // coda autonoma: ferma se fuori
  {
    const { ctx } = caricaBackground({ version: versione, store: { statoLoginCardmarket: { loggato: false, quando: Date.now() } } });
    uguale('coda autonoma: fuori da Cardmarket non prende carte', await ctx._lavoraUnaCartaAutonoma(), 'cardmarket-non-collegato');
  }

  // app: pallino e finestra di blocco
  for (const [nome, stato, bloccata, pill] of [
    ['dentro', { loggato: true, quando: Date.now() }, true, 'Cardmarket connesso'],
    ['fuori', { loggato: false, quando: Date.now() }, false, 'Cardmarket: accedi'],
    ['Cloudflare', { loggato: false, quando: Date.now(), nonConfermato: true, cloudflare: true, consecutivi: 1 }, false, 'Cardmarket: verifica'],
  ]) {
    const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', statoLoginCardmarket: stato } });
    env.listeners.onMessage.push((msg, sender, sendResponse) => {
      if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
      if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { setTimeout(() => sendResponse({ stato: 'x' }), 10); return true; }
      if (msg && msg.type === 'CM_ACCESSO_APRI') { env.log.apri = (env.log.apri || 0) + 1; sendResponse({ ok: true }); return false; }
      return false;
    });
    let chiusa = null;
    env.chrome.tabs.getCurrent = (cb) => setTimeout(() => cb({ id: 77 }), 0);
    const remove0 = env.chrome.tabs.remove;
    env.chrome.tabs.remove = (id, cb) => { chiusa = id; return remove0(id, cb); };
    const { w, errori } = caricaApp(env);
    await attendi(400);
    const blocco = w.document.getElementById('cmBlocco');
    uguale(`app, ${nome}: finestra di blocco ${bloccata ? 'nascosta' : 'visibile'} e pallino "${pill}"`,
      [blocco.hidden, w.document.querySelector('#statoCardmarket span').textContent], [bloccata, pill]);
    if (!bloccata) {
      const accedi = w.document.getElementById('cmBloccoAccedi');
      controlla(`app, ${nome}: c'è "${accedi.textContent}" e "Chiudi l'estensione"`, !accedi.hidden && /Cardmarket/.test(accedi.textContent) && w.document.getElementById('cmBloccoChiudi').textContent.includes('Chiudi'));
      accedi.click();
      await attendi(50);
      uguale(`app, ${nome}: "Accedi" apre la scheda e cambia il testo`, [env.log.apri, w.document.getElementById('cmBloccoTitolo').textContent], [1, 'Accedi nella scheda di Cardmarket']);
      // l'accesso si vede: la finestra sparisce
      await env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: true, quando: Date.now() } });
      await attendi(50);
      uguale(`app, ${nome}: dopo l'accesso la finestra sparisce e il pallino è verde`, [blocco.hidden, w.document.getElementById('statoCardmarket').classList.contains('ok')], [true, true]);
      w.document.getElementById('cmBloccoChiudi').click();
      await attendi(50);
      uguale(`app, ${nome}: "Chiudi l'estensione" chiude la scheda dell'app`, chiusa, 77);
    } else {
      w.document.getElementById('statoCardmarket').click();
      await attendi(20);
      uguale('app, dentro: il pallino apre il pannello, senza "Accedi"', [w.document.getElementById('cmPannello').hidden, w.document.getElementById('cmPannelloAccedi').hidden], [false, true]);
    }
    controlla(`app, ${nome}: nessun errore`, errori.length === 0, errori);
  }
  chiudi();
})();
