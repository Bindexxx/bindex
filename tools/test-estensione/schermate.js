// Schermate delle pagine dell'estensione con dati finti, in un Chrome vero senza finestra.
// Serve Playwright (npm i playwright, oppure PLAYWRIGHT_MODULE=/percorso/playwright) e un
// Chrome (CHROME_PATH, predefinito /opt/google/chrome/chrome).
// Uso: node schermate.js [cartella-di-uscita]
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { cartellaEstensione } = require('./lib/cartella-estensione');

const EXT = cartellaEstensione();
const OUT = process.argv[2] || path.join(__dirname, 'schermate');
fs.mkdirSync(OUT, { recursive: true });
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.md': 'text/markdown', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/supabase.bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('/* finto */'); }
  const f = path.join(EXT, p === '/' ? 'app.html' : p);
  if (!f.startsWith(EXT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': tipi[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8765);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const init = fs.readFileSync(path.join(__dirname, 'lib/browser-finto.js'), 'utf8');
  const schermate = [
    ['app-home-pc', 'app.html#coda', 1440, 900],
    ['app-home-portatile', 'app.html#coda', 1180, 720],
    ['app-carte-pc', 'app.html#carte', 1440, 900],
    ['app-prezzi-pc', 'app.html#prezzi', 1440, 900],
    ['app-dettaglio-coda', 'app.html#coda-dettaglio', 1440, 900],
    ['popup-solo', 'popup.html?modo=tab', 1280, 900],
    ['aggiungi-carte-solo', 'aggiungi_carta_popup.html?modo=tab', 1280, 900],
    ['changelog', 'changelog.html', 1100, 800],
  ];
  if (fs.existsSync(path.join(EXT, 'aggiungi_wishlist_popup.html'))) schermate.push(['app-wishlist-pc', 'app.html#wishlist', 1440, 900]);
  const errori = {};
  for (const [nome, url, w, h] of schermate) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(init);
    // Niente rete esterna: font, icone, Supabase e sito restano fuori.
    await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdnjs\.cloudflare|supabase\.co|github\.io/, r => r.abort());
    const page = await ctx.newPage();
    errori[nome] = [];
    page.on('pageerror', e => errori[nome].push(e.message));
    await page.goto('http://127.0.0.1:8765/' + url, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, nome + '.png'), fullPage: false });
    await ctx.close();
  }
  console.log('Schermate in', OUT);
  console.log(JSON.stringify(errori, null, 1));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
