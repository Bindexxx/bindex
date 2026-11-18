// "Carte fatte oggi" nella Home (dalla 5.75):
// - la pagina Prezzi conta ogni carta controllata in prezziFattiOggi { giorno (locale), n, tempi };
//   un giorno nuovo riparte da 1; si tengono al massimo gli ultimi 600 tempi;
// - la Home (coda_pendente.js) somma la coda (coda_carte completate da questo PC) e i prezzi,
//   con il dettaglio nel suggerimento; i prezzi di ieri non contano; si aggiorna da sola.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const giornoLocale = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

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

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 75) { console.log(`Versione ${versione}: prova dalla 5.75, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');
  const oggi = giornoLocale();
  const ieri = giornoLocale(new Date(Date.now() - 24 * 3600e3));

  // ── pagina Prezzi: il conteggio ──
  {
    const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', env);
    await attendi(600);
    w.chiamaSupabase = async () => ({ ok: true });
    await w._contaPrezziFattiOggi();
    w.eval('_registraControllata(null, 1, 1.5, 1.5)');
    w.eval('_registraControllata("u-altro", 2, 0, "Esaurita")');
    await w.eval('_codaContaPrezziOggi');
    const p = env.store.prezziFattiOggi || {};
    uguale('Prezzi: ogni carta controllata (anche di un altro, anche senza offerte) conta', [p.giorno, p.n, (p.tempi || []).length], [oggi, 3, 3]);

    env.store.prezziFattiOggi = { giorno: ieri, n: 500, tempi: [1, 2, 3] };
    await w._contaPrezziFattiOggi();
    uguale('Prezzi: il primo controllo di un giorno nuovo riparte da 1', [env.store.prezziFattiOggi.giorno, env.store.prezziFattiOggi.n, env.store.prezziFattiOggi.tempi.length], [oggi, 1, 1]);

    env.store.prezziFattiOggi = { giorno: oggi, n: 1000, tempi: Array.from({ length: 600 }, (_, i) => i) };
    await w._contaPrezziFattiOggi();
    uguale('Prezzi: il numero continua, i tempi restano 600', [env.store.prezziFattiOggi.n, env.store.prezziFattiOggi.tempi.length, env.store.prezziFattiOggi.tempi[0]], [1001, 600, 1]);

    await Promise.all([w._contaPrezziFattiOggi(), w._contaPrezziFattiOggi(), w._contaPrezziFattiOggi()]);
    uguale('Prezzi: tre carte di fila senza perderne', env.store.prezziFattiOggi.n, 1004);
    await attendi(300);
    controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── Home: coda + prezzi ──
  {
    const ora = Date.now();
    const coda = [{ completato_il: new Date(ora - 60e3).toISOString() }, { completato_il: new Date(ora - 40e3).toISOString() }];
    const env = creaAmbiente({ version: versione, dati: { coda_carte: coda },
      store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando: Date.now() },
        prezziFattiOggi: { giorno: oggi, n: 5, tempi: [ora - 120e3, ora - 100e3, ora - 80e3, ora - 20e3, ora - 1e3] } } });
    env.listeners.onMessage.push((msg, sender, sendResponse) => {
      if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
      if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: true, quando: Date.now() } }); sendResponse({ stato: 'ok' }); return false; }
      return false;
    });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(800);
    const d = w.document;
    const fatte = () => d.getElementById('numFatteOggi');
    uguale('Home: 2 della coda + 5 di prezzi = 7 carte fatte oggi', fatte().textContent, '7 carte fatte oggi');
    uguale('Home: il dettaglio dice coda e prezzi', fatte().title, 'Da mezzanotte, su questo PC: 2 in coda · 5 prezzi');
    uguale('Home: il ritmo tiene conto anche dei prezzi (una ogni 20 s)', [d.getElementById('numRitmo').hidden, d.getElementById('numRitmo').textContent], [false, 'una ogni 20 s']);
    await env.chrome.storage.local.set({ prezziFattiOggi: { giorno: oggi, n: 6, tempi: [ora - 120e3, ora - 100e3, ora - 80e3, ora - 20e3, ora - 1e3, ora] } });
    await attendi(50);
    uguale('Home: una carta di prezzi in più si vede subito', fatte().textContent, '8 carte fatte oggi');
    await env.chrome.storage.local.set({ prezziFattiOggi: { giorno: ieri, n: 900, tempi: [] } });
    await attendi(50);
    uguale('Home: i prezzi di ieri non contano', [fatte().textContent, fatte().title], ['2 carte fatte oggi', 'Da mezzanotte, su questo PC: 2 in coda · 0 prezzi']);
    await attendi(300);
    controlla('Home: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }
  {
    // solo prezzi, coda vuota (il caso del 18/11: coda ferma, prezzi tutto il pomeriggio)
    const env = creaAmbiente({ version: versione, dati: { coda_carte: [] },
      store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando: Date.now() }, prezziFattiOggi: { giorno: oggi, n: 1, tempi: [Date.now()] } } });
    env.listeners.onMessage.push((msg, sender, sendResponse) => {
      if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
      if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { sendResponse({ stato: 'ok' }); return false; }
      return false;
    });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(800);
    uguale('Home: coda vuota e una carta di prezzi → "1 carta fatta oggi"', w.document.getElementById('numFatteOggi').textContent, '1 carta fatta oggi');
    await attendi(300);
    controlla('Home solo prezzi: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
