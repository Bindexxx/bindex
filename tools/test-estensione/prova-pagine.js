// Avvia ogni pagina dell'estensione in jsdom con Chrome e Supabase finti e controlla che
// parta senza errori (elementi mancanti, funzioni non definite, nomi doppi tra gli <script>).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();

async function avvia(pagina) {
  const html = fs.readFileSync(path.join(EXT, pagina), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  vc.on('error', (...a) => errori.push('console.error: ' + a.map(String).join(' ').slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + pagina + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  const env = creaAmbiente({ store: { aiutaGruppo: true } });
  w.chrome = env.chrome; w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '5.35', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.navigator.clipboard = { writeText: async () => {} };
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  w.addEventListener('unhandledrejection', (e) => errori.push('promise: ' + (e.reason && e.reason.message)));
  // Stesso ordine dei <script> della pagina vera: un nome let/const doppio tra due file
  // blocca la pagina intera (vedi istruzioni del progetto).
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  for (const s of scripts) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    try { w.document.body.appendChild(el); } catch (e) { errori.push(`${s}: ${e.message}`); }
  }
  await new Promise(r => setTimeout(r, 2500));
  w.close();
  return [...new Set(errori)];
}

(async () => {
  const pagine = fs.readdirSync(EXT).filter(f => f.endsWith('.html')).sort();
  console.log('Estensione provata:', EXT, '\n');
  for (const p of pagine) {
    let errori;
    try { errori = await avvia(p); } catch (e) { errori = ['crash: ' + e.message]; }
    controlla(`${p} parte senza errori`, errori.length === 0, errori);
  }
  chiudi();
})();
