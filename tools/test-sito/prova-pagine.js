// Le 6 pagine aperte in Chromium da un server locale, con Supabase finto (nessun accesso fatto:
// le pagine mostrano il login o il messaggio "link non valido"), font e immagini esterne bloccati:
// - nessun errore JavaScript (pageerror);
// - nessun console.error che non sia una risorsa di rete bloccata apposta;
// - la pagina disegna qualcosa (body non vuoto).
// Serve Playwright con il suo Chromium: PLAYWRIGHT_MODULE = percorso del modulo se non è
// installato qui, CHROME_PATH = un Chrome diverso da quello di Playwright.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { RADICE, PAGINE } = require('./lib/pagine');
const { controlla, chiudi } = require('./lib/verifica');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

function server() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(RADICE, p);
      if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

// Supabase finto: nessuna sessione, tabelle vuote, nessun file.
async function supabaseFinto(route) {
  const url = new URL(route.request().url());
  const json = (status, corpo, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...extra }, body: JSON.stringify(corpo) });
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.pathname.startsWith('/auth/v1/')) return json(401, { code: 401, error_code: 'no_authorization', msg: 'nessuna sessione (Supabase finto)' });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return json(200, null);
  if (url.pathname.startsWith('/rest/v1/')) return json(200, [], { 'content-range': '*/0' });
  return json(404, { error: 'not_found', message: 'Supabase finto' });
}

const RETE_BLOCCATA = /Failed to load resource|net::ERR_|WebSocket|ERR_BLOCKED|status of 40[134]/i;

(async () => {
  const s = await server();
  const base = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const contesto = await browser.newContext({ serviceWorkers: 'block' });
  await contesto.route(/\.supabase\.co\//, supabaseFinto);
  await contesto.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/\.supabase\.co\//.test(r.request().url()) ? r.fallback() : r.abort()));
  await contesto.routeWebSocket(/supabase\.co/, (ws) => ws.close());

  for (const pagina of PAGINE) {
    const pg = await contesto.newPage();
    const errori = [], console_ = [];
    pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
    pg.on('console', (m) => { if (m.type() === 'error' && !RETE_BLOCCATA.test(m.text())) console_.push(m.text().slice(0, 200)); });
    try {
      await pg.goto(`${base}/${pagina}`, { waitUntil: 'load', timeout: 30000 });
      await pg.waitForTimeout(2500);
    } catch (e) { errori.push('apertura: ' + e.message.slice(0, 150)); }
    controlla(`${pagina}: nessun errore JavaScript`, errori.length === 0, errori);
    controlla(`${pagina}: nessun console.error`, console_.length === 0, console_);
    const testo = await pg.evaluate(() => (document.body && document.body.innerText || '').trim().length).catch(() => 0);
    controlla(`${pagina}: la pagina mostra qualcosa`, testo > 0, testo);
    await pg.close();
  }
  await browser.close();
  s.close();
  chiudi();
})().catch((e) => { console.log('CRASH', e.stack); process.exit(1); });
