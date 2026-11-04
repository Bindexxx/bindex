// Carte degli altri anonime (dalla 5.49, richiesta di Claudio del 04/11):
// nel controllo prezzi (Home "Adesso", "Ultime controllate") e nella coda
// (colonna "Di", Home) una carta di un altro dice solo "del gruppo"/"gruppo",
// mai il nickname del proprietario. Dalla 5.46 alla 5.48 c'era il nickname
// (ottieni_nicknames). Il proprio nome nella barra dell'app (app.js) resta.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const NICK = [{ owner_id: 'u-me', nickname: 'ire' }, { owner_id: 'u-fra', nickname: 'francesco' }];

function caricaPagina(file, chromeFinto, supabaseFinto) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = chromeFinto; w.supabase = supabaseFinto;
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
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const [maj, min] = manifest.version.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 49)) { console.log(`Versione ${manifest.version}: prove dalla 5.49, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  // Nessuna pagina che lavora le carte chiede i nickname dei proprietari.
  for (const f of ['popup.js', 'aggiungi_carta_popup.js', 'background.js', 'coda_pendente.js']) {
    controlla(`${f}: nessuna lettura dei nickname`, !fs.readFileSync(path.join(EXT, f), 'utf8').includes('ottieni_nicknames'));
  }

  // ── Controllo prezzi ─────────────────────────────────────────────────────────
  {
    const env = creaAmbiente({ rpc: { ottieni_nicknames: NICK } });
    const { w, errori } = caricaPagina('popup.html', env.chrome, env.supabase);
    await attendi(800);
    w.eval("_mioUserIdSessionePrezzi = 'u-me'");
    uguale('prezzi: carta di un altro = "del gruppo", tua = "tua"', [w._diPrezzi('u-fra'), w._diPrezzi('u-me')], ['del gruppo', 'tua']);
    w._segnaCartaHome({ nome: 'Zubat', codice: 'SIT 103', di: w._diPrezzi('u-fra') }, 1, 2);
    w._registraControllata('u-fra', 0.1, 0.2, 0.2);
    await attendi(100);
    const di = [...w.document.querySelectorAll('#ultimeControllateBody .ultime-di')].map(e => e.textContent);
    uguale('prezzi, "Ultime controllate": colonna Di = "gruppo"', di, ['gruppo']);
    const corpo = w.document.body.cloneNode(true);
    corpo.querySelectorAll('script').forEach(s => s.remove()); // i testi degli script non sono a schermo
    controlla('prezzi: nessun nickname nella pagina', !/francesco/i.test(corpo.textContent), corpo.textContent.match(/.{0,30}francesco.{0,30}/i));
    controlla('prezzi: ottieni_nicknames mai chiamata', !env.log.rpc.includes('ottieni_nicknames'), env.log.rpc);
    controlla('prezzi: pagina senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── Coda "Aggiungi carte" ────────────────────────────────────────────────────
  {
    const env = creaAmbiente({ rpc: { ottieni_nicknames: NICK } });
    const { w, errori } = caricaPagina('aggiungi_carta_popup.html', env.chrome, env.supabase);
    await attendi(800);
    w.eval("_userIdCorrente = 'u-me'");
    uguale('coda: riga di un altro = "gruppo", tua = "tu"', [w._diPerOwner('u-fra'), w._diPerOwner('u-me')], [{ testo: 'gruppo', classe: 'gruppo' }, { testo: 'tu', classe: 'mia' }]);
    controlla('coda: ottieni_nicknames mai chiamata', !env.log.rpc.includes('ottieni_nicknames'), env.log.rpc);
    controlla('coda: pagina senza errori', errori.length === 0, errori);
    w.close();
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
