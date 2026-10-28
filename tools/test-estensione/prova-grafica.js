// Grafica (dalla 5.46, Fase 8b del piano):
// 1) chiaro/scuro del sito in ogni pagina (tema.js + tema.css), cambio senza ricaricare,
//    niente temi interni, niente Google Fonts né cdnjs (D13), icone nel manifest;
// 2) pagina Coda dentro l'app: dice all'app cosa sta facendo (CARDSYNC_ATTIVITA: lettura,
//    attesa con la prossima carta, fatta, ferma) e obbedisce a Ferma/Riprendi dall'app;
//    Varianti in una sola cella, intestazione e righe con le stesse colonne; B12;
// 3) pagina Prezzi: versione vera nel piede (B15), niente "Anteprima foglio" né profilo,
//    soglia come tendina, "Ultime controllate", Ferma dall'app;
// 4) auth_ui.js: stile di "Esci" sempre caricato (B14), "Esci" nel menu dell'app,
//    messaggio "estensione aggiornata" una volta per versione;
// 5) background.js: i Cloudflare del giorno contati per la home.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const SINGLES = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const PAGINE = ['app.html', 'popup.html', 'aggiungi_carta_popup.html', 'changelog.html'];

// Pagina vera in jsdom; con conGenitore la pagina è "dentro l'app": window.parent è
// un'altra finestra che registra i messaggi ricevuti.
function apriPagina(file, env, { conGenitore = false } = {}) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  const ricevuti = [];
  let genitore = null;
  if (conGenitore) {
    genitore = new JSDOM('', { url: 'chrome-extension://fake/app.html' }).window;
    genitore.postMessage = (m) => ricevuti.push(JSON.parse(JSON.stringify(m)));
    Object.defineProperty(w, 'parent', { configurable: true, get: () => genitore });
  }
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
  const dalGenitore = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: genitore }));
  return { w, errori, ricevuti, dalGenitore };
}

// Service worker finto per la pagina Coda: ogni carta trovata a 1,23 €.
function swCoda(msg, sender, sendResponse) {
  if (!msg || !msg.type) return false;
  const rispondi = (r, ms = 30) => { setTimeout(() => sendResponse(r), ms); return true; };
  switch (msg.type) {
    case 'VERIFICA_LOGIN_SILENZIOSA': return rispondi({ loggato: true });
    case 'PRECEDENZA_CODA_CARDMARKET': return rispondi({ ok: true, attendi: false });
    case 'PING_RICHIESTA': return rispondi({ attiva: true });
    case 'CONVERTI_IMMAGINE': return rispondi({ immagine: null });
    case 'LEGGI_NOME_CARTA': {
      const q = decodeURIComponent((msg.urlNome.split('searchString=')[1] || '').replace(/\+/g, ' ')).toUpperCase();
      return rispondi({ nome: 'Carta ' + q, codice: q, prezzo: 1.23, urlSingles: SINGLES + 'Set/Carta-' + q.replace(/\s+/g, '-') });
    }
    case 'AGGIUNGI_CARTA': return rispondi({ ok: true, riga: 'r1' });
    default: return false;
  }
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const [maj, min] = manifest.version.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 46)) { console.log(`Versione ${manifest.version}: prove dalla 5.46, saltate.`); process.exit(0); }

  // ── 1) tema, font, icone ──
  {
    for (const f of PAGINE) {
      const html = fs.readFileSync(path.join(EXT, f), 'utf8');
      const posStile = html.lastIndexOf('</style>');
      const posTema = html.indexOf('<link rel="stylesheet" href="tema.css">');
      const primoScript = (html.match(/<script[^>]*src="([^"]+)"/) || [])[1];
      controlla(`${f}: tema.css dopo lo <style> della pagina, tema.js primo script`, posTema > posStile && primoScript === 'tema.js', { posTema, posStile, primoScript });
      controlla(`${f}: niente Google Fonts né cdnjs`, !/(href|src)="https:\/\/(fonts\.googleapis|fonts\.gstatic|cdnjs)/.test(html));
    }
    const conTemi = fs.readdirSync(EXT).filter(f => /\.(js|html)$/.test(f))
      .filter(f => /LISTA_TEMI|applicaTema\(|theme-purple/.test(fs.readFileSync(path.join(EXT, f), 'utf8')));
    uguale('nessun file con i temi interni (LISTA_TEMI, applicaTema)', conTemi, []);
    const css = fs.readFileSync(path.join(EXT, 'tema.css'), 'utf8');
    const fontMancanti = [...css.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]).filter(u => !fs.existsSync(path.join(EXT, u)));
    uguale('tema.css: ogni font esiste', fontMancanti, []);
    const icone = Object.values(manifest.icons || {}).concat(Object.values((manifest.action || {}).default_icon || {}));
    controlla('manifest: icone presenti e i file esistono', icone.length >= 4 && icone.every(f => fs.existsSync(path.join(EXT, f))), icone);
    controlla('manifest: nome "CardSync Pro" (lo cerca aggiorna_cardsync.bat)', manifest.name === 'CardSync Pro');
    controlla('logo.png leggero (< 40 KB)', fs.statSync(path.join(EXT, 'logo.png')).size < 40 * 1024, fs.statSync(path.join(EXT, 'logo.png')).size);

    const env = creaAmbiente({ version: manifest.version, store: { cardsyncDarkMode: true } });
    const { w, errori } = apriPagina('changelog.html', env);
    await attendi(50);
    const b = w.document.body;
    uguale('scuro dal sito: classi modo-scuro e dark-mode', [b.classList.contains('modo-scuro'), b.classList.contains('dark-mode')], [true, true]);
    b.dataset.segno = 'stessa-pagina';
    await env.chrome.storage.local.set({ cardsyncDarkMode: false });
    await attendi(10);
    uguale('cambio dal sito: chiaro subito, senza ricaricare', [b.classList.contains('modo-scuro'), b.dataset.segno], [false, 'stessa-pagina']);
    controlla('changelog: piede con la versione del manifest', w.document.getElementById('footer-credit').textContent.includes('v' + manifest.version));
    controlla('changelog senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── 2) pagina Coda dentro l'app ──
  {
    const env = creaAmbiente({
      version: manifest.version,
      store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderPausaOgni: 4, sliderRicontrollo: 1, sliderCfTimeout: 1, aiutaGruppo: true, cardsyncMantieniAccessoEstensione: true },
      inoltraA: [swCoda],
    });
    const { w, errori, ricevuti, dalGenitore } = apriPagina('aggiungi_carta_popup.html', env, { conGenitore: true });
    w.verificaAccessoValido = async () => true;
    w.chiamaSupabase = async (azione) => (azione === 'elencaLocationTab' ? { ok: true, location: ['BULK'] } : { ok: true, giaEsistente: true, nome: 'BULK' });
    await attendi(600);
    const d = w.document;
    const colonneTesta = d.querySelectorAll('table.tabella-carte thead th').length;
    const rigaNuova = d.querySelector('#tbodyCarte tr.riga-nuova');
    uguale('stesse colonne in intestazione e nella riga per scrivere (11)', [colonneTesta, rigaNuova.children.length], [11, 11]);
    uguale('RH, 1ª e SIG nella stessa cella "Varianti"', rigaNuova.querySelectorAll('td.col-var .var-toggle').length, 3);
    controlla('B12: niente "prossima tra" fisso davanti al conto alla rovescia', !/prossima tra/i.test(d.getElementById('timerRigaAttiva').textContent.replace(d.getElementById('timerCountdownAttiva').textContent, '')));

    d.getElementById('inputLocation').value = 'BULK';
    const scrivi = (testo) => {
      const input = d.querySelector('#tbodyCarte tr.riga-nuova td input[type=text]');
      input.value = testo;
      input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    scrivi('PRIMA 1');
    scrivi('SECONDA 2');
    const fasi = () => ricevuti.filter(m => m.type === 'CARDSYNC_ATTIVITA' && m.chi === 'coda');
    for (let i = 0; i < 60 && !fasi().some(m => m.fase === 'attesa' && m.prossima); i++) await attendi(100);
    const lettura = fasi().find(m => m.fase === 'lettura');
    const fatta = fasi().find(m => m.fase === 'fatta');
    const attesa = fasi().find(m => m.fase === 'attesa' && m.prossima);
    controlla('all\'app: "sto leggendo" con la carta', lettura && lettura.carta && lettura.carta.nome === 'PRIMA 1' && lettura.carta.di === 'tua', lettura);
    controlla('all\'app: carta salvata con nome e prezzo', fatta && fatta.esito && fatta.esito.ok && fatta.esito.prezzo === 1.23 && /Carta PRIMA 1/.test(fatta.carta.nome), fatta);
    controlla('all\'app: attesa con la fine e la prossima carta', attesa && attesa.fino > Date.now() - 5000 && attesa.durataMs > 0 && attesa.prossima.nome === 'SECONDA 2', attesa);
    const righeCoda = [...d.querySelectorAll('#tbodyCarte tr:not(.riga-nuova)')];
    controlla('riga in coda: location e "tu"', righeCoda.some(tr => tr.querySelector('td.col-loc').textContent === 'BULK' && tr.querySelector('td.col-di').textContent === 'tu'));

    // Ferma dall'app durante l'attesa: la seconda carta resta in coda.
    dalGenitore({ type: 'CARDSYNC_FERMA' });
    for (let i = 0; i < 60 && !fasi().some(m => m.fase === 'ferma'); i++) await attendi(100);
    const ferma = fasi().find(m => m.fase === 'ferma');
    controlla('Ferma dall\'app: "in arresto" e poi ferma con 1 carta rimasta', fasi().some(m => m.fase === 'in-arresto') && ferma && ferma.rimaste === 1, fasi().map(m => m.fase + (m.rimaste != null ? ':' + m.rimaste : '')));
    // Un messaggio che non viene dall'app non conta.
    w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'CARDSYNC_RIPRENDI' } }));
    await attendi(300);
    controlla('Riprendi da un\'altra finestra: ignorato', !fasi().some(m => m.fase === 'lettura' && m.carta && m.carta.nome === 'SECONDA 2'));
    dalGenitore({ type: 'CARDSYNC_RIPRENDI' });
    for (let i = 0; i < 80 && !fasi().some(m => m.fase === 'fatta' && /SECONDA 2/.test((m.carta || {}).nome || '')); i++) await attendi(100);
    controlla('Riprendi dall\'app: la seconda carta viene salvata', fasi().some(m => m.fase === 'fatta' && /SECONDA 2/.test((m.carta || {}).nome || '')), fasi().map(m => m.fase));
    controlla('pagina Coda senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── 3) pagina Prezzi ──
  {
    const env = creaAmbiente({ version: manifest.version, store: { cardsyncMantieniAccessoEstensione: true } });
    const { w, errori, ricevuti, dalGenitore } = apriPagina('popup.html', env, { conGenitore: true });
    await attendi(500);
    const d = w.document;
    // Testo della pagina senza gli script (qui caricati dentro il <body>).
    const corpo = d.body.cloneNode(true);
    corpo.querySelectorAll('script').forEach(el => el.remove());
    controlla('B15: piede con la versione del manifest, non "v3.1"', d.getElementById('footer-credit').textContent.includes('v' + manifest.version) && !/v3\.1/.test(corpo.innerHTML));
    uguale('B15: niente Anteprima foglio, profilo, "apri in una tab", tema scuro interno',
      ['anteprimaLink', 'selectProfilo', 'btnSalvaProfilo', 'apriTabLink', 'temaScuroEstensione'].filter(id => d.getElementById(id)), []);
    controlla('B15: niente "foglio" nei testi della pagina', !/foglio/i.test(corpo.textContent));
    const soglia = d.getElementById('sliderSoglia');
    soglia.value = '2';
    soglia.dispatchEvent(new w.Event('input'));
    uguale('soglia come tendina: salvata come prima (indice)', [soglia.tagName, env.store.sliderSoglia], ['SELECT', 2]);
    w.eval("_segnaCartaHome({ nome: 'Charizard', codice: 'OBF 125', lingua: 'IT', cond: 'NM', di: 'tua' }, 3, 10)");
    w._registraControllata(null, 1.0, 1.2, 1.2);
    const riga = (d.querySelector('#ultimeControllateBody .ultime-riga') || {}).textContent || '';
    controlla('"Ultime controllate": prima, ora e variazione', /Charizard/.test(riga) && /1,00 €/.test(riga) && /1,20 €/.test(riga) && /▲ \+0,20 €/.test(riga), riga);
    const fatta = ricevuti.find(m => m.type === 'CARDSYNC_ATTIVITA' && m.chi === 'prezzi' && m.fase === 'fatta');
    controlla('all\'app: carta controllata, prezzo prima e dopo, avanzamento', fatta && fatta.esito.prezzo === 1.2 && fatta.esito.prezzoPrima === 1 && fatta.n === 3 && fatta.totale === 10, fatta);
    w.eval('isRunning = true; stopRequested = false;');
    dalGenitore({ type: 'CARDSYNC_FERMA' });
    await attendi(20);
    uguale('Ferma dall\'app: il controllo si ferma come col bottone', [w.eval('stopRequested'), d.getElementById('btnAvvia').textContent], [true, 'Arresto…']);
    controlla('pagina Prezzi senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── 4) auth_ui.js ──
  {
    const env = creaAmbiente({ version: manifest.version, store: { cardsyncMantieniAccessoEstensione: true } });
    const p1 = apriPagina('changelog.html', env); // nessun login qui: si prova su popup.html da sola
    p1.w.close();
    const { w, errori } = apriPagina('popup.html', env);
    await attendi(500);
    const d = w.document;
    controlla('B14: "Esci" fuori dall\'app con il suo stile', !!d.getElementById('cardsync-logout-btn') && !!d.getElementById('cardsync-auth-ui-style'));
    controlla('estensione aggiornata: messaggio la prima volta', !!d.getElementById('cardsync-toast-ok'));
    uguale('…e ricordato per questa versione', env.store.toastAggiornataVersione, manifest.version);
    w.close();
    const seconda = apriPagina('popup.html', env);
    await attendi(500);
    controlla('stessa versione: niente messaggio la seconda volta', !seconda.w.document.getElementById('cardsync-toast-ok'));
    seconda.w.close();
    const app = apriPagina('app.html', env);
    await attendi(500);
    controlla('nell\'app: niente bottone fisso, "Esci" nel menu utente', !app.w.document.getElementById('cardsync-logout-btn') && !!app.w.document.getElementById('menuEsci'));
    controlla('pagine senza errori', errori.length === 0 && seconda.errori.length === 0 && app.errori.length === 0, [errori, seconda.errori, app.errori]);
    app.w.close();
  }

  // ── 5) Cloudflare del giorno ──
  {
    const { ctx, env } = caricaBackground({ version: manifest.version });
    await ctx._prenotaTurnoCardmarket();
    await ctx._segnalaCloudflareAlTurno();
    await ctx._segnalaCloudflareAlTurno(); // stessa carta: conta una volta
    await ctx._chiudiTurnoCardmarket();
    await ctx._prenotaTurnoCardmarket();
    await ctx._segnalaCloudflareAlTurno();
    await ctx._chiudiTurnoCardmarket();
    const oggi = new Date();
    const giorno = oggi.getFullYear() + '-' + String(oggi.getMonth() + 1).padStart(2, '0') + '-' + String(oggi.getDate()).padStart(2, '0');
    uguale('Cloudflare di oggi: uno per carta, con la data di oggi', env.store.cloudflareOggi, { giorno, n: 2 });
    env.store.cloudflareOggi = { giorno: '2000-01-01', n: 9 };
    await ctx._prenotaTurnoCardmarket();
    await ctx._segnalaCloudflareAlTurno();
    await ctx._chiudiTurnoCardmarket();
    uguale('giorno nuovo: si riparte da 1', env.store.cloudflareOggi, { giorno, n: 1 });
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
