// Un solo accesso con l'estensione (estensione 5.83, 19/11/2026): index.html vero in Chromium da un
// server locale, Supabase finto con Auth e funzione biglietto-accesso, estensione finta (stato in
// Node, risponde come background.js 5.83). Si prova ui/extension.ui.js con ui/auth.ui.js:
//   - estensione dentro, sito fuori → il sito entra con il biglietto dell'estensione (verify con
//     token_hash), "Continua come …" ed entra da solo; nessuna password;
//   - sito dentro, estensione fuori → biglietto dalla funzione con la sessione del sito, passato
//     all'estensione; anche dopo un accesso a mano sul sito;
//   - "Esci" nell'estensione dopo l'accesso al sito, stesso account → esce anche il sito; account
//     diverso → niente; "Esci" sul sito → esce anche l'estensione (prima del logout del sito);
//   - "Esci" sul sito più recente dell'accesso dell'estensione → l'estensione esce, il sito non rientra;
//     di un altro account → niente in nessun verso;
//   - due account diversi dentro, interruttore spento, estensione vecchia → niente di nuovo;
//   - PC usato da più persone: da sola una parte entra solo con l'ultimo account entrato lì;
//   - la scheda torna in vista: estensione entrata nel frattempo → sito dentro; estensione uscita →
//     sito fuori.
// Serve Playwright: PLAYWRIGHT_MODULE = modulo se non è installato qui, CHROME_PATH = Chrome.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const VERSIONE = fs.readFileSync(path.join(RADICE, 'releases/latest-version.txt'), 'utf8').trim();
const CHIAVE_SESSIONE = 'sb-xpfibrzsffurdlypxnrw-auth-token';
const IO = { id: 'u-io', email: 'io@test.local' };
const ALTRO = { id: 'u-altro', email: 'altro@test.local' };
const UTENTI = { [IO.id]: IO, [ALTRO.id]: ALTRO };
const TIPI_NUOVI = ['CARDSYNC_STATO_ACCESSO', 'CARDSYNC_ACCEDI_CON_BIGLIETTO', 'CARDSYNC_DAMMI_BIGLIETTO', 'CARDSYNC_ESCI'];

const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

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

const sessioneDi = (u, gettone) => ({
  access_token: gettone, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'rt-' + gettone, user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
});
const utenteDalGettone = (g) => { const m = /-(u-[a-z]+)$/.exec(g || ''); return m ? UTENTI[m[1]] : null; };

// Supabase finto: Auth (verify, password, user, logout), funzione biglietto-accesso, tabelle vuote.
function supabaseFinto(reg) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, corpo) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: corpo === undefined ? '' : JSON.stringify(corpo) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const gettone = (req.headers().authorization || '').replace(/^Bearer\s+/i, '');
    let corpo = null;
    try { corpo = req.postDataJSON(); } catch (_) {   }
    if (url.pathname === '/functions/v1/biglietto-accesso') {
      const u = utenteDalGettone(gettone);
      reg.funzione.push(gettone);
      if (!u) return json(401, { ok: false, errore: 'accesso non valido' });
      const biglietto = `FN${reg.funzione.length}-${u.id}`;
      reg.bigliettiFunzione.add(biglietto);
      return json(200, { ok: true, biglietto, tipo: 'magiclink', userId: u.id });
    }
    if (url.pathname === '/auth/v1/verify') {
      reg.verify.push(corpo);
      const m = /^EST\d+-(u-[a-z]+)$/.exec((corpo && corpo.token_hash) || '');
      if (!m || reg.bigliettiUsati.has(corpo.token_hash) || !reg.bigliettiEstensione.has(corpo.token_hash)) return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      reg.bigliettiUsati.add(corpo.token_hash);
      return json(200, sessioneDi(UTENTI[m[1]], `at-v${reg.verify.length}-${m[1]}`));
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      reg.password.push(corpo && corpo.email);
      const u = Object.values(UTENTI).find(x => corpo && x.email === corpo.email);
      if (!u) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, sessioneDi(u, `at-pw${reg.password.length}-${u.id}`));
    }
    if (url.pathname === '/auth/v1/user') {
      const u = utenteDalGettone(gettone);
      return u ? json(200, sessioneDi(u, gettone).user) : json(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid' });
    }
    if (url.pathname === '/auth/v1/logout') { reg.logout.push(gettone); reg.ordine.push('logout-sito'); return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    if (url.pathname.startsWith('/auth/v1/')) return json(401, { code: 401, error_code: 'no_authorization', msg: 'Supabase finto' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(200, null);
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '*/0' }, body: '[]' });
    return json(404, { error: 'not_found' });
  };
}

// Estensione finta, come background.js 5.83 (prova-accesso-unico.js dell'estensione prova quello vero).
function estensioneFinta(iniziale, reg) {
  const e = { attivo: true, vecchia: false, userId: null, accessoDal: 0, uscita: null, ultimoUtente: null, messaggi: [], ...iniziale };
  const nome = () => (e.userId ? UTENTI[e.userId].email.split('@')[0] : null);
  const gestisci = (msg) => {
    e.messaggi.push(msg);
    switch (msg && msg.type) {
      case 'CARDSYNC_GET_VERSION': return { versione: VERSIONE, motore: VERSIONE };
      case 'CARDSYNC_GET_UTENTE': return { ok: true, userId: e.userId, nome: nome() };
      case 'CARDSYNC_GET_AIUTA_GRUPPO': return { ok: true, aiutaGruppo: false };
      case 'CARDSYNC_SITO_APERTO': return { ok: true, apriAppConIlSito: false, aperta: false };
      case 'CARDSYNC_SET_TEMA': return { ok: true };
      default: break;
    }
    if (e.vecchia || !TIPI_NUOVI.includes(msg.type)) return { ok: false, errore: 'tipo sconosciuto' };
    if (!e.attivo) return msg.type === 'CARDSYNC_STATO_ACCESSO' ? { ok: true, attivo: false } : { ok: false, errore: 'spento' };
    if (msg.type === 'CARDSYNC_STATO_ACCESSO') {
      if (e.userId) e.ultimoUtente = e.userId;
      return { ok: true, attivo: true, userId: e.userId, nome: nome(), accessoDal: e.accessoDal, uscita: e.uscita, ultimoUtente: e.ultimoUtente };
    }
    if (msg.type === 'CARDSYNC_DAMMI_BIGLIETTO') {
      if (!e.userId) return { ok: false, errore: 'fuori' };
      const biglietto = `EST${reg.bigliettiEstensione.size + 1}-${e.userId}`;
      reg.bigliettiEstensione.add(biglietto);
      return { ok: true, biglietto, tipo: 'magiclink', userId: e.userId, nome: nome() };
    }
    if (msg.type === 'CARDSYNC_ACCEDI_CON_BIGLIETTO') {
      if (e.userId) return { ok: false, errore: e.userId === msg.userId ? 'già dentro' : 'altro account' };
      if (!reg.bigliettiFunzione.has(msg.biglietto) || !msg.biglietto.endsWith('-' + msg.userId)) return { ok: false, errore: 'biglietto non accettato' };
      reg.bigliettiFunzione.delete(msg.biglietto);
      Object.assign(e, { userId: msg.userId, accessoDal: Date.now(), uscita: null, ultimoUtente: msg.userId });
      return { ok: true, userId: e.userId, nome: nome() };
    }
    if (msg.type === 'CARDSYNC_ESCI') {
      reg.ordine.push('esci-estensione');
      if (!e.userId || e.userId !== msg.userId) return { ok: true, uscito: false };
      Object.assign(e, { uscita: { userId: e.userId, quando: Date.now() }, userId: null });
      return { ok: true, uscito: true };
    }
    return { ok: false, errore: 'tipo sconosciuto' };
  };
  return { e, gestisci };
}

const RETE_BLOCCATA = /Failed to load resource|net::ERR_|WebSocket|ERR_BLOCKED|status of 40[134]/i;

(async () => {
  const s = await server();
  const base = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log(`Sito provato: ${RADICE} (estensione finta ${VERSIONE})\n`);

  // Un caso: localStorage del sito, estensione finta, pagina aperta; restituisce gli strumenti.
  async function apri({ sito = {}, estensione = {} }) {
    const reg = { verify: [], funzione: [], logout: [], password: [], ordine: [], bigliettiFunzione: new Set(), bigliettiEstensione: new Set(), bigliettiUsati: new Set() };
    const est = estensioneFinta(estensione, reg);
    const contesto = await browser.newContext({ serviceWorkers: 'block' });
    await contesto.route(/\.supabase\.co\//, supabaseFinto(reg));
    await contesto.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/\.supabase\.co\//.test(r.request().url()) ? r.fallback() : r.abort()));
    await contesto.routeWebSocket(/supabase\.co/, (ws) => ws.close());
    const pg = await contesto.newPage();
    const errori = [], consoleErrori = [];
    pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
    pg.on('console', (m) => { if (m.type() === 'error' && !RETE_BLOCCATA.test(m.text())) consoleErrori.push(m.text().slice(0, 200)); });
    await pg.exposeFunction('__estensioneFinta', (msg) => est.gestisci(msg));
    await pg.addInitScript(() => {
      window.chrome = { runtime: { lastError: undefined, sendMessage(id, msg, cb) {
        window.__estensioneFinta(msg).then((r) => { if (typeof cb === 'function') cb(r); });
      } } };
    });
    await pg.goto(`${base}/releases/latest-version.txt`);
    await pg.evaluate(({ sito, chiave }) => {
      localStorage.clear();
      localStorage.setItem('cardsyncMantieniAccesso', 'si');
      if (sito.sessione) localStorage.setItem(chiave, JSON.stringify(sito.sessione));
      if (sito.accessoDal) localStorage.setItem('bindexAccessoSitoDal', JSON.stringify(sito.accessoDal));
      if (sito.uscita) localStorage.setItem('bindexUscitaSito', JSON.stringify(sito.uscita));
      if (sito.ultimoUtente) localStorage.setItem('bindexUltimoUtenteSito', sito.ultimoUtente);
    }, { sito, chiave: CHIAVE_SESSIONE });
    await pg.goto(`${base}/index.html`, { waitUntil: 'load' });
    const stato = () => pg.evaluate((chiave) => {
      const vis = (id) => { const el = document.getElementById(id); return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; };
      let sessione = null;
      try { sessione = JSON.parse(localStorage.getItem(chiave) || 'null'); } catch (_) {   }
      return {
        utenteSito: sessione && sessione.user ? sessione.user.id : null,
        pannello: vis('cardsyncPanel'),
        modulo: vis('cardsyncPanel') && vis('statoBossFiero') && vis('bossFieroLoginForm'),
        continua: vis('cardsyncPanel') && vis('bossFieroGiaLoggato') ? document.getElementById('btnContinuaComeUtente').textContent.trim() : null,
        accessoDal: JSON.parse(localStorage.getItem('bindexAccessoSitoDal') || 'null'),
        uscita: JSON.parse(localStorage.getItem('bindexUscitaSito') || 'null'),
        ultimoUtente: localStorage.getItem('bindexUltimoUtenteSito'),
        avvisoAccount: !!document.querySelector('.avviso-fisso[data-id="account-estensione"]'),
      };
    }, CHIAVE_SESSIONE);
    const tipi = () => est.e.messaggi.map(m => m.type);
    return { pg, contesto, reg, est, errori, consoleErrori, stato, tipi };
  }
  const nessunErrore = [];

  // 1. estensione dentro, sito fuori → il sito entra da solo
  {
    const c = await apri({ estensione: { userId: IO.id, accessoDal: 1000 } });
    await c.pg.waitForTimeout(1200);
    const s1 = await c.stato();
    controlla('estensione dentro, sito fuori: biglietto chiesto all\'estensione', c.tipi().includes('CARDSYNC_DAMMI_BIGLIETTO'), c.tipi());
    uguale('il sito usa il biglietto con verify (token_hash, magiclink)', c.reg.verify.map(v => ({ token_hash: v.token_hash, type: v.type })), [{ token_hash: 'EST1-u-io', type: 'magiclink' }]);
    controlla('il sito è dentro con lo stesso account, "Continua come Io"', s1.utenteSito === IO.id && /Continua come Io/.test(s1.continua || ''), s1);
    controlla('ora dell\'accesso del sito salvata', s1.accessoDal && s1.accessoDal.userId === IO.id && s1.accessoDal.quando > 0, s1.accessoDal);
    uguale('nessuna password, nessun biglietto chiesto alla funzione', [c.reg.password.length, c.reg.funzione.length], [0, 0]);
    await c.pg.waitForTimeout(3000);
    const s2 = await c.stato();
    controlla('poi entra da solo nel sito', !s2.pannello && s2.utenteSito === IO.id, s2);
    nessunErrore.push(['estensione dentro, sito fuori', c.errori]);
    await c.contesto.close();
  }

  // 2. sito dentro, estensione fuori → biglietto all'estensione
  {
    const c = await apri({ sito: { sessione: sessioneDi(IO, 'at-sito-u-io') }, estensione: {} });
    await c.pg.waitForTimeout(1500);
    uguale('sito dentro, estensione fuori: biglietto dalla funzione con la sessione del sito', c.reg.funzione, ['at-sito-u-io']);
    const accedi = c.est.e.messaggi.filter(m => m.type === 'CARDSYNC_ACCEDI_CON_BIGLIETTO');
    uguale('il biglietto va all\'estensione con l\'account del sito', accedi.map(m => [m.biglietto, m.tipo, m.userId]), [['FN1-u-io', 'magiclink', IO.id]]);
    uguale('l\'estensione è dentro con lo stesso account', c.est.e.userId, IO.id);
    await c.pg.waitForTimeout(3000);
    uguale('dopo l\'ingresso nessun altro biglietto', [c.reg.funzione.length, c.est.e.messaggi.filter(m => m.type === 'CARDSYNC_ACCEDI_CON_BIGLIETTO').length], [1, 1]);
    nessunErrore.push(['sito dentro, estensione fuori', c.errori]);
    await c.contesto.close();
  }

  // 3. "Esci" nell'estensione dopo l'accesso al sito: stesso account → fuori anche il sito
  {
    const t = Date.now();
    const c = await apri({
      sito: { sessione: sessioneDi(IO, 'at-sito-u-io'), accessoDal: { userId: IO.id, quando: t - 60000 } },
      estensione: { uscita: { userId: IO.id, quando: t - 1000 } },
    });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('"Esci" nell\'estensione dopo l\'accesso al sito: il sito esce', s1.utenteSito === null && c.reg.logout.includes('at-sito-u-io'), [s1.utenteSito, c.reg.logout]);
    controlla('il sito mostra l\'accesso, non rientra', s1.modulo && s1.continua === null, s1);
    uguale('nessun biglietto in nessun verso', [c.reg.funzione.length, c.tipi().filter(x => x === 'CARDSYNC_DAMMI_BIGLIETTO' || x === 'CARDSYNC_ACCEDI_CON_BIGLIETTO').length], [0, 0]);
    controlla('uscita del sito ricordata', s1.uscita && s1.uscita.userId === IO.id, s1.uscita);
    nessunErrore.push(['esci nell\'estensione', c.errori]);
    await c.contesto.close();
  }
  {
    const t = Date.now();
    const c = await apri({
      sito: { sessione: sessioneDi(IO, 'at-sito-u-io'), accessoDal: { userId: IO.id, quando: t - 1000 } },
      estensione: { uscita: { userId: IO.id, quando: t - 60000 } },
    });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('"Esci" nell\'estensione prima dell\'accesso al sito: il sito resta e porta l\'accesso',
      s1.utenteSito === IO.id && c.reg.logout.length === 0 && c.est.e.userId === IO.id, [s1.utenteSito, c.reg.logout, c.est.e.userId]);
    await c.contesto.close();
  }
  {
    const t = Date.now();
    const c = await apri({
      sito: { sessione: sessioneDi(IO, 'at-sito-u-io'), accessoDal: { userId: IO.id, quando: t - 60000 } },
      estensione: { uscita: { userId: ALTRO.id, quando: t - 1000 } },
    });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('"Esci" nell\'estensione di un altro account: il sito resta, l\'estensione non entra da sola',
      s1.utenteSito === IO.id && c.reg.logout.length === 0 && c.reg.funzione.length === 0 && c.est.e.userId === null, [s1.utenteSito, c.reg.logout, c.reg.funzione, c.est.e.userId]);
    await c.contesto.close();
  }

  // 4. "Esci" sul sito più recente dell'accesso dell'estensione
  {
    const t = Date.now();
    const c = await apri({ sito: { uscita: { userId: IO.id, quando: t - 1000 } }, estensione: { userId: IO.id, accessoDal: t - 60000 } });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    uguale('"Esci" sul sito dopo l\'accesso dell\'estensione: esce anche l\'estensione', [c.est.e.messaggi.filter(m => m.type === 'CARDSYNC_ESCI').map(m => m.userId), c.est.e.userId], [[IO.id], null]);
    controlla('e il sito non rientra', s1.utenteSito === null && s1.modulo && !c.tipi().includes('CARDSYNC_DAMMI_BIGLIETTO'), s1);
    await c.contesto.close();
  }
  {
    const t = Date.now();
    const c = await apri({ sito: { uscita: { userId: IO.id, quando: t - 60000 } }, estensione: { userId: IO.id, accessoDal: t - 1000 } });
    await c.pg.waitForTimeout(1200);
    const s1 = await c.stato();
    controlla('accesso nell\'estensione dopo l\'"Esci" sul sito: il sito entra', s1.utenteSito === IO.id && !c.tipi().includes('CARDSYNC_ESCI'), [s1, c.tipi()]);
    await c.contesto.close();
  }
  {
    const t = Date.now();
    const c = await apri({ sito: { uscita: { userId: ALTRO.id, quando: t - 1000 } }, estensione: { userId: IO.id, accessoDal: t - 60000 } });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('"Esci" sul sito di un altro account: il sito non entra con l\'account dell\'estensione, l\'estensione resta',
      s1.utenteSito === null && s1.modulo && c.est.e.userId === IO.id && !c.tipi().includes('CARDSYNC_DAMMI_BIGLIETTO') && !c.tipi().includes('CARDSYNC_ESCI'), [s1, c.tipi()]);
    await c.contesto.close();
  }

  // 5. niente di nuovo: due account diversi, interruttore spento, estensione vecchia
  {
    const c = await apri({ sito: { sessione: sessioneDi(IO, 'at-sito-u-io') }, estensione: { userId: ALTRO.id } });
    await c.pg.waitForTimeout(4500);
    const s1 = await c.stato();
    controlla('due account diversi: nessuno sostituito', s1.utenteSito === IO.id && c.est.e.userId === ALTRO.id && c.reg.funzione.length === 0 && c.reg.logout.length === 0
      && !c.tipi().some(x => x === 'CARDSYNC_ESCI' || x === 'CARDSYNC_DAMMI_BIGLIETTO' || x === 'CARDSYNC_ACCEDI_CON_BIGLIETTO'), [s1, c.tipi()]);
    controlla('due account diversi: resta l\'avviso di sempre', s1.avvisoAccount, s1);
    nessunErrore.push(['due account', c.errori]);
    await c.contesto.close();
  }
  for (const [nome, estensione] of [['interruttore spento', { attivo: false, userId: IO.id }], ['estensione vecchia', { vecchia: true, userId: IO.id }]]) {
    const c = await apri({ estensione });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla(`${nome}: il sito chiede la password come prima`, s1.utenteSito === null && s1.modulo && c.reg.verify.length === 0
      && !c.tipi().some(x => x === 'CARDSYNC_DAMMI_BIGLIETTO' || x === 'CARDSYNC_ESCI'), [s1, c.tipi()]);
    nessunErrore.push([nome, c.errori]);
    await c.contesto.close();
  }

  // 5b. PC usato da più persone: da solo si entra solo con l'ultimo account entrato da quella parte
  {
    const c = await apri({ sito: { ultimoUtente: ALTRO.id }, estensione: { userId: IO.id } });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('sito usato l\'ultima volta da un altro account: non entra con quello dell\'estensione',
      s1.utenteSito === null && s1.modulo && !c.tipi().includes('CARDSYNC_DAMMI_BIGLIETTO') && c.reg.verify.length === 0, [s1, c.tipi()]);
    await c.contesto.close();
  }
  {
    const c = await apri({ sito: { ultimoUtente: IO.id }, estensione: { userId: IO.id } });
    await c.pg.waitForTimeout(1200);
    const s1 = await c.stato();
    controlla('sito usato l\'ultima volta dallo stesso account: entra', s1.utenteSito === IO.id && /Continua come Io/.test(s1.continua || ''), s1);
    await c.contesto.close();
  }
  {
    const c = await apri({ sito: { sessione: sessioneDi(IO, 'at-sito-u-io') }, estensione: { ultimoUtente: ALTRO.id } });
    await c.pg.waitForTimeout(1500);
    const s1 = await c.stato();
    controlla('estensione usata l\'ultima volta da un altro account: non le si porta il proprio',
      c.reg.funzione.length === 0 && c.est.e.userId === null && !c.tipi().includes('CARDSYNC_ACCEDI_CON_BIGLIETTO'), [c.reg.funzione, c.tipi()]);
    uguale('il sito ricorda chi è entrato da qui', s1.ultimoUtente, IO.id);
    await c.contesto.close();
  }

  // 6. accesso a mano sul sito con l'estensione fuori → l'estensione entra
  {
    const c = await apri({ estensione: {} });
    await c.pg.waitForTimeout(1200);
    await c.pg.fill('#authEmail', 'io');
    await c.pg.fill('#authPassword', 'segreta');
    await c.pg.click('#authSubmit');
    await c.pg.waitForTimeout(2000);
    const s1 = await c.stato();
    uguale('accesso a mano sul sito: password una volta', c.reg.password, [IO.email]);
    controlla('accesso a mano: ora dell\'accesso del sito salvata', s1.accessoDal && s1.accessoDal.userId === IO.id, s1.accessoDal);
    uguale('accesso a mano: l\'estensione entra con il biglietto', [c.reg.funzione.length, c.est.e.userId], [1, IO.id]);
    nessunErrore.push(['accesso a mano', c.errori]);
    await c.contesto.close();
  }

  // 7. "Esci" sul sito con l'estensione dentro: esce anche l'estensione, prima del sito
  {
    const c = await apri({ sito: { sessione: sessioneDi(IO, 'at-sito-u-io') }, estensione: { userId: IO.id } });
    await c.pg.waitForTimeout(4000);
    await c.pg.evaluate(() => document.getElementById('profiloMenuLogout').click());
    await c.pg.waitForSelector('.avviso-finestra .avviso-bottoni button.btn-main', { timeout: 5000 });
    await c.pg.click('.avviso-finestra .avviso-bottoni button.btn-main');
    await c.pg.waitForTimeout(3000);
    const s1 = await c.stato();
    uguale('"Esci" sul sito: esce anche l\'estensione, poi il sito', [c.reg.ordine, c.est.e.userId], [['esci-estensione', 'logout-sito'], null]);
    controlla('"Esci" sul sito: uscita ricordata e accesso chiesto di nuovo', s1.uscita && s1.uscita.userId === IO.id && s1.utenteSito === null && s1.modulo, s1);
    uguale('"Esci" sul sito: niente rientra da solo', [c.reg.verify.length, c.reg.funzione.length], [0, 0]);
    nessunErrore.push(['esci sul sito', c.errori]);
    await c.contesto.close();
  }

  // 8. la scheda torna in vista
  {
    const c = await apri({ estensione: {} });
    await c.pg.waitForTimeout(1200);
    controlla('ritorno: prima fuori tutti e due, accesso chiesto', (await c.stato()).modulo);
    Object.assign(c.est.e, { userId: IO.id, accessoDal: Date.now() });
    await c.pg.evaluate(() => window.dispatchEvent(new Event('focus')));
    await c.pg.waitForTimeout(1200);
    const s1 = await c.stato();
    controlla('ritorno: estensione entrata nel frattempo → il sito entra', s1.utenteSito === IO.id && /Continua come Io/.test(s1.continua || ''), s1);
    await c.pg.waitForTimeout(3000);
    Object.assign(c.est.e, { userId: null, uscita: { userId: IO.id, quando: Date.now() } });
    await c.pg.evaluate(() => window.dispatchEvent(new Event('focus')));
    await c.pg.waitForTimeout(3500);
    const s2 = await c.stato();
    controlla('ritorno: estensione uscita nel frattempo → il sito esce e chiede l\'accesso', s2.utenteSito === null && s2.modulo && c.reg.logout.length === 1, [s2, c.reg.logout]);
    nessunErrore.push(['ritorno', c.errori]);
    await c.contesto.close();
  }

  for (const [nome, errori] of nessunErrore) controlla(`${nome}: nessun errore JavaScript`, errori.length === 0, errori);
  await browser.close();
  s.close();
  chiudi();
})().catch((e) => { console.log('CRASH', e.stack); process.exit(1); });
