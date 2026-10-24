// Impronta su Cardmarket e login (dalla 5.42, Fase 5 del piano):
//   5.1 nessuna risorsa dell'estensione leggibile dalle pagine web;
//   5.2 nessuno script dichiarato su Cardmarket: popup.js inietta shared.js + content.js solo
//       nella scheda del controllo prezzi (una volta per pagina); background.js inietta shared.js
//       prima di leggere un prezzo (altrimenti i filtri lingua/condizione saltano in silenzio) e
//       segna il login che vede; content.js senza scroll né mouse finto;
//   5.3 il sito può parlare con l'estensione solo da /bindex/;
//   5.4 "Mantienimi loggato" spento → sessione in chrome.storage.session (si svuota alla
//       chiusura di Chrome), e cambiando l'interruttore la sessione si sposta;
//   5.5 il widget Turnstile su una pagina con offerte o con l'h1 di una carta non è Cloudflare;
//   più: la pulizia degli ordini abbandonati parte anche con il PC occupato.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

// Una riga d'offerta come su Cardmarket (bandiera = primo span[aria-label]).
const riga = (lingua, prezzo) => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span></div>
  <div class="price-container"><span class="fw-bold">${prezzo} €</span></div>
  <a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
// Pagina carta con il widget Turnstile del modulo di login (utente non loggato, D11):
// prima offerta inglese più economica, poi l'italiana.
const PAGINA_CARTA = `<html><head><title>Zubat | Cardmarket</title></head><body>
  <div id="login-signup"><div class="cf-turnstile"></div></div>
  <h1>Zubat <span>Silver Tempest</span>(SIT 103)</h1>
  ${riga('Inglese', '0,05')}${riga('Italiano', '0,10')}</body></html>`;
const PAGINA_CARTA_LOGGATO = PAGINA_CARTA.replace('<div id="login-signup"><div class="cf-turnstile"></div></div>', '<a id="account-dropdown">utente</a>');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const [maj, min] = manifest.version.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 42)) { console.log(`Versione ${manifest.version}: prove dalla 5.42, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  // ── 5.1 / 5.2 / 5.3 manifest ──
  uguale('5.1 nessuna risorsa leggibile dalle pagine web', manifest.web_accessible_resources, undefined);
  uguale('5.2 nessuno script dichiarato su Cardmarket', manifest.content_scripts, undefined);
  uguale('5.3 sito: solo /bindex/ (externally_connectable)', manifest.externally_connectable.matches, ['https://bindexxx.github.io/bindex/*']);
  controlla('5.3 sito: solo /bindex/ (host_permissions)', manifest.host_permissions.includes('https://bindexxx.github.io/bindex/*') && !manifest.host_permissions.includes('https://bindexxx.github.io/*'), manifest.host_permissions);
  const tuttiJs = fs.readdirSync(EXT).filter(f => f.endsWith('.js') && f !== 'supabase.bundle.js');
  const urlSito = tuttiJs.flatMap(f => (fs.readFileSync(path.join(EXT, f), 'utf8').match(/https:\/\/bindexxx\.github\.io[^'"`\s)]*/g) || []));
  controlla('5.3 ogni indirizzo del sito usato dall\'estensione sta sotto /bindex/', urlSito.length > 0 && urlSito.every(u => u.startsWith('https://bindexxx.github.io/bindex/')), urlSito);

  // ── content.js nella pagina (come lo inietta popup.js: shared.js + content.js) ──
  const codiceLettura = fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const leggiConContent = async (html, url, volte = 1) => {
    const mandati = [];
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const w = dom.window;
    let scroll = 0; let mouse = 0;
    w.scrollTo = () => { scroll++; };
    w.document.addEventListener('mousemove', () => { mouse++; });
    w.chrome = { runtime: { sendMessage: (m, cb) => { mandati.push(m); if (typeof cb === 'function') cb(); }, lastError: undefined } };
    Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; } });
    for (let i = 0; i < volte; i++) w.eval(i === 0 ? codiceLettura : fs.readFileSync(path.join(EXT, 'content.js'), 'utf8'));
    await attendi(500);
    w.close();
    return { tipi: mandati.map(m => m.type + (m.prezzo !== undefined ? ':' + m.prezzo : '')), scroll, mouse };
  };
  const conTurnstile = await leggiConContent(PAGINA_CARTA, B + 'Silver-Tempest/Zubat-SIT103?language=5', 2);
  uguale('5.5 widget Turnstile su una pagina con offerte: prezzo, non Cloudflare (iniezione doppia → un messaggio)', conTurnstile.tipi, ['PREZZO_TROVATO:0.1']);
  uguale('5.2 content.js: niente scroll né mouse finto', [conTurnstile.scroll, conTurnstile.mouse], [0, 0]);
  const soloWidget = await leggiConContent('<html><head><title>Cardmarket</title></head><body><h1>Accedi</h1><div class="cf-turnstile"></div></body></html>', CM + '/it/Pokemon');
  uguale('5.5 widget Turnstile senza offerte né carta: Cloudflare', soloWidget.tipi, ['CLOUDFLARE_DETECTED']);
  const verifica = await leggiConContent('<html><head><title>Ci siamo quasi...</title></head><body><div id="challenge-running"></div></body></html>', CM + '/it/Pokemon');
  uguale('5.5 pagina di verifica vera: Cloudflare', verifica.tipi, ['CLOUDFLARE_DETECTED']);

  // ── popup.js: scheda del controllo prezzi, iniezione e prezzo letto ──
  {
    const URL_CARTA = B + 'Silver-Tempest/Zubat-SIT103?language=5&minCondition=2';
    const sw = caricaBackground({ version: manifest.version, pagine: { [URL_CARTA]: PAGINA_CARTA_LOGGATO } });
    const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
    const errori = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
    const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), { url: 'chrome-extension://fake/popup.html?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true });
    const w = dom.window;
    w.chrome = sw.env.chrome; w.supabase = sw.env.supabase;
    w.fetch = async () => ({ ok: true, status: 200, text: async () => '0.0', json: async () => ({}), headers: { get: () => null } });
    w.confirm = () => false; w.alert = () => {};
    for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
      if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
      const el = w.document.createElement('script');
      el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8');
      w.document.body.appendChild(el);
    }
    await attendi(500);
    const prima = sw.env.log.script.length;
    const esito = await w.apriTabEAspettaPrezzo(URL_CARTA, 1);
    const iniezioni = sw.env.log.script.slice(prima).filter(x => x.files);
    uguale('5.2 scheda del controllo prezzi: shared.js + content.js iniettati una volta', iniezioni.map(x => x.files.join('+')), ['shared.js+content.js']);
    uguale('5.2 prezzo letto con il filtro lingua (italiano, non l\'inglese più economico)', esito && esito.prezzo, 0.1);
    controlla('5.2 content.js segnala il login visto nella scheda', sw.env.store.statoLoginCardmarket && sw.env.store.statoLoginCardmarket.loggato === true, sw.env.store.statoLoginCardmarket);
    controlla('pagina Prezzi: nessun errore', errori.length === 0, errori);
    w.close();
  }

  // ── background.js: lettura del prezzo nella scheda del worker ──
  {
    const URL_CARTA = B + 'Silver-Tempest/Zubat-SIT103?language=5&minCondition=2';
    const { ctx, env } = caricaBackground({ version: manifest.version, pagine: { [URL_CARTA]: PAGINA_CARTA } });
    const r = await ctx._leggiPrezzoDaSingles(URL_CARTA, null, null);
    uguale('5.2 lettura in background: prezzo con il filtro lingua (shared.js iniettato)', r && r.prezzo, 0.1);
    controlla('5.5 lettura in background: widget Turnstile del login non scambiato per Cloudflare', r && !r.cloudflareTimeout && r.prezzo !== null, r);
    const iniezioni = env.log.script.filter(x => x.files);
    uguale('5.2 shared.js iniettato una volta sola (giri di lettura ogni 600 ms)', iniezioni.map(x => x.files.join('+')), ['shared.js']);

    const conLogin = caricaBackground({ version: manifest.version, pagine: { [URL_CARTA]: PAGINA_CARTA_LOGGATO } });
    await conLogin.ctx._leggiPrezzoDaSingles(URL_CARTA, null, null);
    controlla('5.2 lettura in background: login visto nella scheda ricordato', conLogin.env.store.statoLoginCardmarket && conLogin.env.store.statoLoginCardmarket.loggato === true, conLogin.env.store.statoLoginCardmarket);
    controlla('service worker: nessun errore', env.log.errori.length === 0 && conLogin.env.log.errori.length === 0, [env.log.errori, conLogin.env.log.errori]);
  }

  // ── 5.4 "Mantienimi loggato" ──
  {
    const { env } = caricaBackground({ version: manifest.version });
    const archivio = env.log.opzioniClient && env.log.opzioniClient.auth && env.log.opzioniClient.auth.storage;
    controlla('5.4 la sessione usa l\'archivio dell\'estensione', !!archivio);
    const CH = 'sb-xpfibrzsffurdlypxnrw-auth-token';
    await archivio.setItem(CH, 'T1');
    uguale('5.4 interruttore acceso: sessione in storage.local', [env.store[CH], env.storeSessione[CH]], ['T1', undefined]);
    await env.chrome.storage.local.set({ cardsyncMantieniAccessoEstensione: false });
    await attendi(50);
    uguale('5.4 spento: la sessione passa in storage.session', [env.store[CH], env.storeSessione[CH]], [undefined, 'T1']);
    uguale('5.4 spento: login ancora valido (service worker riavviato)', await archivio.getItem(CH), 'T1');
    await archivio.setItem(CH, 'T2');
    uguale('5.4 spento: il rinnovo resta in storage.session', [env.store[CH], env.storeSessione[CH]], [undefined, 'T2']);
    delete env.storeSessione[CH]; // Chrome chiuso e riaperto: storage.session vuoto
    uguale('5.4 spento, Chrome riaperto: login richiesto', await archivio.getItem(CH), null);
    env.storeSessione[CH] = 'T3';
    await env.chrome.storage.local.set({ cardsyncMantieniAccessoEstensione: true });
    await attendi(50);
    uguale('5.4 riacceso: la sessione torna in storage.local', [env.store[CH], env.storeSessione[CH]], ['T3', undefined]);
    await archivio.removeItem(CH);
    uguale('5.4 uscita: sessione tolta da entrambi', [env.store[CH], env.storeSessione[CH]], [undefined, undefined]);
    controlla('5.4 nessun signOut quando il service worker si sospende', !/onSuspend\.addListener/.test(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8')));
  }

  // ── pulizia ordini abbandonati anche con il PC occupato ──
  {
    const { ctx, env } = caricaBackground({ version: manifest.version });
    await ctx._chiudiOrdiniAbbandonati('u-me', true);
    controlla('ordini abbandonati: chiusi anche con un controllo prezzi in corso', env.log.rpc.includes('chiudi_ordini_abbandonati'), env.log.rpc);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
