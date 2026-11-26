// Scambi tra utenti (proposte a due vie, sql/154): conti di utils/scambi.js in Node, poi index.html
// vero in Chromium da un server locale con Supabase finto (tabelle e RPC dello scambio). Si prova:
//   - saldo, pareggio con gli euro e scambio suggerito (centesimi, una parte sola mette gli euro);
//   - pagina Scambi: Da fare / In corso / Storico, richieste di prima ancora lì, righe delle
//     proposte tolte dalle richieste di prima, saldo, passi, Accetta / Rifiuta / Fatto / Annulla;
//   - finestra della proposta: oggetti già scelti, quantità, euro da una parte sola, Pareggia,
//     invio con i dati giusti, "Cambia" che manda la nuova al posto della vecchia;
//   - Match: scheda Scambi con lo scambio suggerito che apre la proposta;
//   - chat: striscia dello scambio aperto, etichetta cliccabile, proposta allegata togliibile;
//   - widget Scambi: conta richieste e proposte da gestire.
// Serve Playwright: PLAYWRIGHT_MODULE = modulo se non è installato qui, CHROME_PATH = Chrome.
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');

// 1. Conti puri, fuori dal browser
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'utils/scambi.js'), 'utf8'), ctx);
  const v = (prezzo, quantita) => ({ prezzo, quantita });
  uguale('valore in centesimi (0,10 + 0,20)', ctx.scambiValoreVoci([v(0.1), v(0.2)]), 30);
  uguale('valore con le copie', ctx.scambiValoreVoci([v(1.5, 3), v(null)]), 450);
  uguale('saldo: ricevi di più', ctx.scambiSaldo([v(3)], [v(4)], 0, 0.5), { dai: 3, ricevi: 4.5, differenza: 1.5 });
  uguale('saldo: pari con gli euro', ctx.scambiSaldo([v(3)], [v(4)], 1, 0).differenza, 0);
  uguale('pareggio: dai tu gli euro', ctx.scambiPareggio([v(3)], [v(4)]), { euroDai: 1, euroRicevi: 0 });
  uguale('pareggio: li dà l\'altro', ctx.scambiPareggio([v(4.2)], [v(1.1)]), { euroDai: 0, euroRicevi: 3.1 });
  uguale('pareggio: niente se pari', ctx.scambiPareggio([v(2)], [v(2)]), { euroDai: 0, euroRicevi: 0 });
  const r = (chiave, prezzo) => ({ chiave, prezzo });
  const s1 = ctx.scambiSuggerito([r('char', 4), r('squ', 0.5)], [r('pika', 3)]);
  uguale('suggerito: Charmander per Pikachu', s1 && { ricevi: s1.ricevi.map(x => x.chiave), dai: s1.dai.map(x => x.chiave), differenza: s1.differenza }, { ricevi: ['char'], dai: ['pika'], differenza: 1 });
  const s2 = ctx.scambiSuggerito([r('a', 10), r('b', 5), r('c', 2)], [r('x', 7), r('y', 6), r('z', 1)]);
  uguale('suggerito: il più ricco tra quelli pari', s2 && { va: s2.valoreRicevi, vd: s2.valoreDai }, { va: 15, vd: 14 });
  controlla('suggerito: entro la tolleranza', s2 && Math.abs(s2.differenza) <= Math.max(1, 0.1 * s2.valoreRicevi));
  uguale('suggerito: niente se manca una parte', ctx.scambiSuggerito([r('a', 1)], []), null);
  const molte = Array.from({ length: 30 }, (_, i) => r('m' + i, i + 1));
  const s3 = ctx.scambiSuggerito(molte, molte.slice(0, 20));
  controlla('suggerito: 30 voci per parte, al massimo 12 guardate', s3 && s3.ricevi.length <= 12 && s3.dai.length <= 12 && Math.abs(s3.differenza) <= Math.max(1, 0.1 * s3.valoreRicevi));
}

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const CHIAVE_SESSIONE = 'sb-xpfibrzsffurdlypxnrw-auth-token';
const IO = { id: 'u-io', email: 'io@test.local' };
const ALTRO = 'u-altro';
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

const sessione = {
  access_token: 'at-1-u-io', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'rt-1', user: { id: IO.id, email: IO.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};

const giorni = (n) => new Date(Date.now() - n * 86400000).toISOString();
const snap = (nome, prezzo, extra) => ({ nome, codice: 'PRV', lingua: 'IT', condizione: 'NM', prezzo, ...extra });
const riga = (id, da, a, carta, prezzo, nome, stato, q) => ({ id, richiedente_id: a, proprietario_id: da, carta_id: carta, prodotto_sealed_id: null,
  quantita_richiesta: q || 1, stato_riga: stato, prezzo_congelato: prezzo, snapshot: snap(nome, prezzo), motivo_chiusura: null });
const proposta = (o) => ({ tipo: 'proposta', stato: 'aperta', euro_da_richiedente: 0, euro_da_proprietario: 0, fatto_richiedente_il: null,
  fatto_proprietario_il: null, sostituisce_id: null, motivo_chiusura: null, chiusa_da: null, scade_il: giorni(-10), ...o });

const PROPOSTE = [
  proposta({ id: 'p1', stato_proposta: 'in_attesa', richiedente_id: ALTRO, proprietario_id: IO.id, euro_da_richiedente: 0.5, creato_il: giorni(1), aggiornato_il: giorni(0.01),
    richieste_scambio_righe: [riga('r11', IO.id, ALTRO, 'c-mio1', 3, 'Pikachu', 'in_attesa'), riga('r12', ALTRO, IO.id, 'c-suo1', 4, 'Charmander', 'in_attesa')] }),
  proposta({ id: 'p2', stato_proposta: 'accettata', richiedente_id: IO.id, proprietario_id: ALTRO, fatto_richiedente_il: giorni(0.5), creato_il: giorni(3), aggiornato_il: giorni(0.5),
    richieste_scambio_righe: [riga('r21', ALTRO, IO.id, 'c-suo2', 0.5, 'Squirtle', 'accettata', 2)] }),
  proposta({ id: 'p3', stato_proposta: 'conclusa', stato: 'chiusa', richiedente_id: IO.id, proprietario_id: ALTRO, creato_il: giorni(9), aggiornato_il: giorni(8),
    fatto_richiedente_il: giorni(8), fatto_proprietario_il: giorni(8),
    richieste_scambio_righe: [riga('r31', ALTRO, IO.id, 'c-x', 2, 'Mew', 'conclusa'), riga('r32', IO.id, ALTRO, 'c-y', 2, 'Eevee', 'conclusa')] }),
  proposta({ id: 'p4', stato_proposta: 'rifiutata', stato: 'chiusa', richiedente_id: IO.id, proprietario_id: ALTRO, chiusa_da: ALTRO, creato_il: giorni(12), aggiornato_il: giorni(11),
    richieste_scambio_righe: [riga('r41', ALTRO, IO.id, 'c-z', 6, 'Gengar', 'rifiutata')] }),
  proposta({ id: 'p5', stato_proposta: 'accettata', richiedente_id: ALTRO, proprietario_id: IO.id, fatto_richiedente_il: giorni(0.2), creato_il: giorni(2), aggiornato_il: giorni(0.2),
    richieste_scambio_righe: [riga('r51', IO.id, ALTRO, 'c-mio3', 1, 'Bulbasaur', 'accettata')] }),
];
// Righe ricevute: una richiesta di prima in attesa e una riga della proposta p1 (che la pagina deve togliere).
const RIGHE_RICEVUTE = [
  { ...riga('rq1', IO.id, ALTRO, 'c-mio4', 2.5, 'Vaporeon', 'in_attesa'), richiesta_id: 'rq', creato_il: giorni(0.3), aggiornato_il: giorni(0.3),
    richieste_scambio: { richiedente_id: ALTRO, creato_il: giorni(0.3), codice_rq: null, tipo: 'richiesta' } },
  { ...riga('r11', IO.id, ALTRO, 'c-mio1', 3, 'Pikachu', 'in_attesa'), richiesta_id: 'p1', creato_il: giorni(1), richieste_scambio: { richiedente_id: ALTRO, creato_il: giorni(1), tipo: 'proposta' } },
];
const SCAMBIO = [
  { owner_id: ALTRO, tipo: 'carta', oggetto_id: 'c-suo1', nome: 'Charmander', codice: 'PRV 4', lingua: 'IT', condizione: 'NM', variante: null, integrita: null, immagine: null, prezzo: 4, disponibili: 1 },
  { owner_id: ALTRO, tipo: 'carta', oggetto_id: 'c-suo2', nome: 'Squirtle', codice: 'PRV 5', lingua: 'IT', condizione: 'NM', variante: null, integrita: null, immagine: null, prezzo: 0.5, disponibili: 3 },
  { owner_id: ALTRO, tipo: 'sealed', oggetto_id: 's-suo1', nome: 'Busta', codice: null, lingua: 'IT', condizione: null, variante: null, integrita: 'Perfetta', immagine: null, prezzo: 5, disponibili: 1 },
  { owner_id: IO.id, tipo: 'carta', oggetto_id: 'c-mio1', nome: 'Pikachu', codice: 'PRV 1', lingua: 'IT', condizione: 'NM', variante: null, integrita: null, immagine: null, prezzo: 3, disponibili: 1 },
  { owner_id: IO.id, tipo: 'carta', oggetto_id: 'c-mio2', nome: 'Eevee', codice: 'PRV 2', lingua: 'IT', condizione: 'NM', variante: null, integrita: null, immagine: null, prezzo: 1.5, disponibili: 2 },
];
const MATCH = {
  trova_match_wishlist_scambio: [
    { mia_wishlist_id: 'w1', mio_nome: 'Charmander', mio_prezzo_obiettivo: null, altro_owner_id: ALTRO, altra_email: null, altra_carta_id: 'c-suo1', altro_prezzo: 4, altro_nickname: 'Marco', altra_disponibili: 1 },
    { mia_wishlist_id: 'w2', mio_nome: 'Squirtle', mio_prezzo_obiettivo: null, altro_owner_id: ALTRO, altra_email: null, altra_carta_id: 'c-suo2', altro_prezzo: 0.5, altro_nickname: 'Marco', altra_disponibili: 3 },
  ],
  trova_match_scambio_wishlist: [
    { mia_carta_id: 'c-mio1', mio_nome: 'Pikachu', mio_prezzo: 3, altro_owner_id: ALTRO, altra_email: null, altra_wishlist_id: 'aw1', altro_prezzo_obiettivo: null, altro_nickname: 'Marco', altra_disponibili: 1 },
  ],
};
const MESSAGGI = [
  { id: 'm1', conversazione_id: 'conv1', mittente_id: ALTRO, testo: 'Ti va questo scambio?', creato_il: giorni(1), letto_il: giorni(0.9), richiesta_id: 'p1', richiesta_etichetta: 'Proposta del 18/11 · 2 oggetti' },
];

function supabaseFinto(reg) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, corpo, extra) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(extra || {}) }, body: JSON.stringify(corpo) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    let corpo = null;
    try { corpo = req.postDataJSON(); } catch (_) { /* niente corpo */ }
    if (url.pathname === '/auth/v1/user') return json(200, sessione.user);
    if (url.pathname.startsWith('/auth/v1/')) return json(401, { code: 401, msg: 'Supabase finto' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const nome = url.pathname.slice('/rest/v1/rpc/'.length);
      (reg.rpc[nome] = reg.rpc[nome] || []).push(corpo);
      if (nome === 'ottieni_nicknames') return json(200, [{ owner_id: ALTRO, nickname: 'Marco' }]);
      if (nome === 'leggi_scambio_per_proposta') return json(200, SCAMBIO);
      if (nome === 'proponi_scambio') {
        if (corpo && Number(corpo.p_euro_do) === 77) return json(400, { code: 'P0001', message: 'Charmander: nello Scambio ne restano 0', details: null, hint: null });
        return json(200, 'p-nuova');
      }
      if (nome === 'segna_fatto_proposta') return json(200, 'conclusa');
      if (nome === 'ottieni_o_crea_conversazione') return json(200, 'conv1');
      if (nome === 'invia_messaggio') return json(200, 'm-nuovo');
      if (MATCH[nome]) return json(200, MATCH[nome]);
      if (/^trova_match/.test(nome)) return json(200, []);
      return json(200, null);
    }
    if (url.pathname === '/rest/v1/richieste_scambio' && req.method() === 'GET') {
      reg.letture.push(url.search);
      let lista = PROPOSTE;
      if ((url.searchParams.get('stato_proposta') || '').startsWith('in.')) lista = lista.filter(p => ['in_attesa', 'accettata'].includes(p.stato_proposta));
      return json(200, lista, { 'content-range': `0-${lista.length - 1}/${lista.length}` });
    }
    if (url.pathname === '/rest/v1/richieste_scambio_righe' && req.method() === 'GET') {
      const lista = url.searchParams.get('proprietario_id') === 'eq.u-io' ? RIGHE_RICEVUTE : [];
      return json(200, lista);
    }
    if (url.pathname === '/rest/v1/messaggi' && req.method() === 'GET') return json(200, MESSAGGI);
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '*/0' }, body: '[]' });
    return json(404, { error: 'not_found' });
  };
}

const RETE_BLOCCATA = /Failed to load resource|net::ERR_|WebSocket|ERR_BLOCKED|status of 40[0134]/i;

(async () => {
  const s = await server();
  const base = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log(`\nSito provato: ${RADICE}\n`);
  const reg = { rpc: {}, letture: [] };
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  await contesto.route(/\.supabase\.co\//, supabaseFinto(reg));
  await contesto.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/\.supabase\.co\//.test(r.request().url()) ? r.fallback() : r.abort()));
  await contesto.routeWebSocket(/supabase\.co/, (ws) => ws.close());
  const pg = await contesto.newPage();
  const errori = [], consoleErrori = [];
  pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
  pg.on('console', (m) => { if (m.type() === 'error' && !RETE_BLOCCATA.test(m.text())) consoleErrori.push(m.text().slice(0, 200)); });
  await pg.goto(`${base}/releases/latest-version.txt`);
  await pg.evaluate(({ chiave, sessione }) => {
    localStorage.clear();
    localStorage.setItem('cardsyncMantieniAccesso', 'si');
    localStorage.setItem(chiave, JSON.stringify(sessione));
  }, { chiave: CHIAVE_SESSIONE, sessione });
  await pg.goto(`${base}/index.html`, { waitUntil: 'load' });
  await pg.waitForTimeout(1500);
  // la pagina si sistema da sola dopo l'avvio: si aspetta che smetta di cambiare sezione
  for (let i = 0, prima = ''; i < 20; i++) {
    const ora = await pg.evaluate(() => [...document.querySelectorAll('.view-section.active')].map(x => x.id).join(','));
    if (ora === prima) break;
    prima = ora; await pg.waitForTimeout(500);
  }
  await pg.waitForTimeout(1500);
  const testo = (sel) => pg.evaluate((s) => { const el = document.querySelector(s); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const conferma = async () => { await pg.waitForSelector('.avviso-fondo .btn-main', { timeout: 3000 }); await pg.click('.avviso-fondo .btn-main'); await pg.waitForTimeout(400); };
  // SCATTI=cartella: salva le schermate dei passi principali, per guardarle a occhio.
  const scatto = async (nome) => { if (process.env.SCATTI) await pg.screenshot({ path: path.join(process.env.SCATTI, nome + '.png') }); };
  const ultima = (nome) => (reg.rpc[nome] || []).slice(-1)[0];

  // 2. Widget Scambi: 1 richiesta di prima + 2 proposte da gestire, 1 in corso
  const anteprima = await pg.evaluate(async () => { _widgetRichiesteSvuotaCache(); const p = await CATALOGO_WIDGET.richieste.preview(); return { totale: p.dati.totale, riservate: p.dati.riservate, righe: p.righe, titolo: CATALOGO_WIDGET.richieste.titolo }; });
  uguale('widget: da gestire e in corso', anteprima, { totale: 3, riservate: 1, righe: ['3 da gestire'], titolo: 'Scambi' });

  // 3. Pagina Scambi
  await pg.evaluate(() => apriDettaglioWidget('richieste'));
  await pg.waitForSelector('#richiesteContenuto .ric-riga', { timeout: 5000 });
  await pg.waitForTimeout(300);
  const apri = async (id) => { await pg.evaluate((x) => _richiesteApri(x), id); await pg.waitForTimeout(200); };
  await apri('p1');
  uguale('titolo della pagina', await testo('#richieste .page-title'), 'Scambi');
  controlla('riepilogo: 3 aspettano te', /3 scambi aspettano te/.test(await testo('#richiesteRiepilogo') || ''), await testo('#richiesteRiepilogo'));
  uguale('schede', await pg.$$eval('#richieste .match-tabbtn', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim())), ['Da fare · 3', 'In corso · 1', 'Storico · 2']);
  uguale('Da fare: righe', await pg.$$eval('#richieste .ric-riga', r => r.length), 3);
  const det = await testo('#richieste .ric-dettaglio');
  controlla('dettaglio: proposta di Marco', /Proposta di Marco/.test(det), det);
  controlla('dettaglio: Ricevi e Tu dai coi totali', /Ricevi da Marco\s*4,50 €/.test(det) && /Tu dai\s*3,00 €/.test(det), det);
  controlla('dettaglio: saldo', /Ricevi 1,50 € in più/.test(det), det);
  controlla('dettaglio: euro fuori dall\'app', /0,50 €\s*in euro, fuori dall'app/.test(det), det);
  uguale('dettaglio: azioni', await pg.$$eval('#richieste .scb-bottoni button', b => b.map(x => x.textContent.trim())), ['Accetta', 'Cambia', 'Rifiuta']);
  controlla('dettaglio: passi', (await pg.$$eval('#richieste .scb-passi li', l => l.length)) === 4);
  await scatto('1-scambi-da-fare');

  await pg.click('#richieste .scb-bottoni button:has-text("Accetta")');
  await conferma();
  uguale('Accetta → rispondi_proposta', ultima('rispondi_proposta'), { p_richiesta_id: 'p1', p_accetta: true });
  await pg.waitForSelector('#richieste .ric-riga.sel', { timeout: 3000 });
  uguale('dopo l\'azione resta su quella proposta', await pg.$eval('#richieste .ric-riga.sel .match-persona-nome', e => e.textContent.trim()), 'Marco');

  await pg.click('#richieste .scb-bottoni button:has-text("Rifiuta")');
  await conferma();
  uguale('Rifiuta → rispondi_proposta', ultima('rispondi_proposta'), { p_richiesta_id: 'p1', p_accetta: false });

  // proposta accettata che aspetta il mio Fatto (p5)
  await apri('p5');
  const det5 = await testo('#richieste .ric-dettaglio');
  controlla('accettata: Marco ha già premuto Fatto', /Marco ha già premuto Fatto/.test(det5), det5);
  await scatto('2-scambi-fatto');
  uguale('accettata: azioni', await pg.$$eval('#richieste .scb-bottoni button', b => b.map(x => x.textContent.trim())), ['Fatto', 'Annulla lo scambio']);
  await pg.click('#richieste .scb-bottoni button:has-text("Fatto")');
  await conferma();
  uguale('Fatto → segna_fatto_proposta', ultima('segna_fatto_proposta'), { p_richiesta_id: 'p5' });
  await pg.click('#richieste .scb-bottoni button:has-text("Annulla lo scambio")');
  await pg.waitForSelector('.prop-sopra input[value="accordo_non_concluso"]', { timeout: 3000 });
  controlla('Annulla: conferma spenta senza motivo', await pg.$eval('.prop-sopra [data-azione="conferma"]', b => b.disabled));
  await pg.click('.prop-sopra input[value="accordo_non_concluso"]');
  await pg.click('.prop-sopra [data-azione="conferma"]');
  await pg.waitForTimeout(400);
  uguale('Annulla → annulla_proposta col motivo', ultima('annulla_proposta'), { p_richiesta_id: 'p5', p_motivo: 'accordo_non_concluso' });

  // la richiesta di prima è ancora gestita riga per riga
  await apri('rq');
  controlla('richiesta di prima: Accetta e Rifiuta sulla riga', (await pg.$$eval('#richieste .ric-oggetto .ric-azioni button', b => b.map(x => x.textContent.trim()))).join('|') === 'Accetta|Rifiuta');

  await pg.evaluate(() => _scambiCambiaTab('corso'));
  await apri('p2');
  const det2 = await testo('#richieste .ric-dettaglio');
  controlla('In corso: aspetta il Fatto di Marco', /Hai premuto Fatto/.test(det2) && /quando lo preme anche Marco/.test(det2), det2);
  uguale('In corso: solo Annulla', await pg.$$eval('#richieste .scb-bottoni button', b => b.map(x => x.textContent.trim())), ['Annulla lo scambio']);

  await pg.evaluate(() => _scambiCambiaTab('storico'));
  await pg.waitForTimeout(200);
  uguale('Storico: filtri', await pg.$$eval('#richieste .ric-filtro', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim())), ['Tutti · 2', 'Fatti · 1', 'Non andati · 1']);
  controlla('Storico: riepilogo', /1 scambio fatto · 1 oggetto ricevuto · 1 dato/.test(await testo('#richieste .scb-storico-riep') || ''), await testo('#richieste .scb-storico-riep'));
  await pg.click('#richieste .ric-filtro:has-text("Non andati")');
  await apri('p4');
  controlla('Storico: rifiutata da Marco', /Marco ha rifiutato la proposta/.test(await testo('#richieste .ric-dettaglio') || ''));

  // 4. Cambia: la finestra parte dalla proposta p1 e la nuova la sostituisce
  await pg.evaluate(() => _scambiCambiaTab('fare'));
  await apri('p1');
  await pg.click('#richieste .scb-bottoni button:has-text("Cambia")');
  await pg.waitForSelector('#propostaScambio .prop-voce', { timeout: 4000 });
  uguale('Cambia: titolo', await testo('#propTitolo'), 'Cambia la proposta a Marco');
  uguale('Cambia: scelti', await pg.$$eval('#propostaScambio .prop-chip', c => c.map(x => x.textContent.trim())), ['Charmander', 'Pikachu']);
  uguale('Cambia: euro che ricevi', await pg.$eval('#propEuro_suo', i => i.value), '0,50');
  await pg.click('#propInvia');
  await pg.waitForTimeout(500);
  uguale('Cambia → proponi_scambio con p_sostituisce', ultima('proponi_scambio'), {
    p_destinatario: ALTRO, p_ricevo: [{ tipo: 'carta', oggetto_id: 'c-suo1', quantita: 1 }], p_do: [{ tipo: 'carta', oggetto_id: 'c-mio1', quantita: 1 }],
    p_euro_do: 0, p_euro_ricevo: 0.5, p_sostituisce: 'p1' });
  controlla('Cambia: finestra chiusa', !(await pg.$('#propostaScambio')));

  // 5. Finestra nuova: oggetto già scelto, uno sparito, quantità, euro da una parte, Pareggia, invio
  await pg.evaluate(() => apriPropostaScambio({ altroId: 'u-altro', nomeAltro: 'Marco', ricevi: [{ tipo: 'carta', oggettoId: 'c-suo1' }, { tipo: 'carta', oggettoId: 'c-sparita' }] }));
  await pg.waitForSelector('#propostaScambio .prop-voce', { timeout: 4000 });
  controlla('finestra: avviso per l\'oggetto non più libero', /1 oggetto non è più libero/.test(await testo('#propostaScambio .prop-avviso') || ''));
  uguale('finestra: elenco suo', await pg.$$eval('#propElenco_suo .prop-voce-nome', n => n.map(x => x.textContent)), ['Busta', 'Charmander', 'Squirtle']);
  await pg.click('#propostaScambio .prop-voce[data-chiave="carta:c-mio2"]');
  await pg.click('#propostaScambio .prop-voce[data-chiave="carta:c-mio2"] .prop-qty button:last-child');
  uguale('finestra: quantità 2 (non oltre le libere)', await pg.$eval('#propostaScambio .prop-voce[data-chiave="carta:c-mio2"] .prop-qty span', e => e.textContent), '2');
  controlla('finestra: + spento al massimo', await pg.$eval('#propostaScambio .prop-voce[data-chiave="carta:c-mio2"] .prop-qty button:last-child', b => b.disabled));
  await scatto('3-proposta');
  controlla('finestra: saldo con 2 copie', /Ricevi 4,00 €\s*Dai 3,00 €\s*Ricevi 1,00 € in più/.test(await testo('#propSaldo') || ''), await testo('#propSaldo'));
  await pg.click('#propostaScambio .prop-voce[data-chiave="carta:c-mio2"] .prop-qty button:first-child');
  controlla('finestra: saldo dopo una copia in meno', /Ricevi 2,50 € in più/.test(await testo('#propSaldo') || ''), await testo('#propSaldo'));
  await pg.fill('#propEuro_suo', '2');
  await pg.fill('#propEuro_mio', '1,5');
  uguale('finestra: gli euro li mette una parte sola', await pg.$eval('#propEuro_suo', i => i.value), '');
  await pg.click('#propostaScambio .prop-pareggia').catch(() => {});
  await pg.waitForTimeout(100);
  uguale('Pareggia: euro che dai', await pg.$eval('#propEuro_mio', i => i.value), '2,50');
  controlla('Pareggia: pari', /Pari/.test(await testo('#propSaldo') || ''));
  await pg.fill('#propEuro_mio', '77');
  await pg.click('#propInvia');
  await pg.waitForTimeout(500);
  controlla('errore del DB mostrato nella finestra', /ne restano 0/.test(await testo('#propErrore') || ''), await testo('#propErrore'));
  await pg.click('#propostaScambio .prop-pareggia');
  await pg.click('#propInvia');
  await pg.waitForTimeout(500);
  uguale('Invia → proponi_scambio', ultima('proponi_scambio'), {
    p_destinatario: ALTRO, p_ricevo: [{ tipo: 'carta', oggetto_id: 'c-suo1', quantita: 1 }], p_do: [{ tipo: 'carta', oggetto_id: 'c-mio2', quantita: 1 }],
    p_euro_do: 2.5, p_euro_ricevo: 0, p_sostituisce: null });
  controlla('Invia: finestra chiusa', !(await pg.$('#propostaScambio')));

  await pg.evaluate(() => apriPropostaScambio({ altroId: 'u-altro', nomeAltro: 'Marco' }));
  await pg.waitForSelector('#propostaScambio .prop-voce', { timeout: 4000 });
  const prima = (reg.rpc.proponi_scambio || []).length;
  await pg.click('#propInvia');
  controlla('finestra vuota: non parte niente', (reg.rpc.proponi_scambio || []).length === prima && /Scegli almeno un oggetto/.test(await testo('#propErrore') || ''));
  await pg.keyboard.press('Escape');
  controlla('Esc chiude la finestra', !(await pg.$('#propostaScambio')));

  // 6. Match: scheda Scambi con lo scambio suggerito
  await pg.evaluate(() => apriDettaglioWidget('match'));
  await pg.waitForSelector('#match .match-sugg', { timeout: 5000 });
  const tabMatch = await pg.$$eval('#match .match-tabbtn', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  uguale('Match: schede', tabMatch, ['Scambi · 1', 'Lo cerchi · 2', 'Lo hai tu · 1']);
  const sugg = await testo('#match .match-sugg');
  controlla('Match: Charmander per Pikachu, +1 €', /Charmander/.test(sugg) && /Pikachu/.test(sugg) && !/Squirtle/.test(sugg.split('Tu dai')[0].replace(/\+ 1 altro.*/, '')) && /Ricevi 1,00 € in più/.test(sugg), sugg);
  await scatto('4-match-scambi');
  await pg.click('#match .match-sugg .match-fondo');
  await pg.waitForSelector('#propostaScambio .prop-chip', { timeout: 4000 });
  uguale('Match: la proposta parte dallo scambio suggerito', await pg.$$eval('#propostaScambio .prop-chip', c => c.map(x => x.textContent.trim())), ['Charmander', 'Pikachu']);
  await pg.click('#propostaScambio .prop-chiudi');

  // 7. Chat
  await pg.evaluate(() => apriChat('u-altro', 'Marco'));
  await pg.waitForSelector('#chatScambio:not([hidden])', { timeout: 4000 });
  controlla('chat: striscia dello scambio aperto', /aspetta la tua risposta/.test(await testo('#chatScambio') || '') && /e altri 2/.test(await testo('#chatScambio') || ''), await testo('#chatScambio'));
  await pg.waitForSelector('#chatMessaggi .chat-richiesta-link', { timeout: 4000 });
  controlla('chat: etichetta del messaggio cliccabile', /Proposta del 18\/11/.test(await testo('#chatMessaggi .chat-richiesta-link') || ''));
  uguale('chat: frasi per lo scambio', await pg.$$eval('#chatFrasi button', b => b.map(x => x.textContent)), ['Ci penso e ti dico', 'Possiamo cambiare qualcosa?', 'Grazie!']);
  controlla('chat: bottone Proponi', !!(await pg.$('#chatProponiBtn')));
  await scatto('5-chat');
  await pg.evaluate(() => { chiudiChat(); return apriChatPerRichiesta('u-altro', 'Marco', 'p1', 'Proposta del 18/11'); });
  await pg.waitForSelector('#chatAllegato:not([hidden])', { timeout: 3000 });
  controlla('chat: proposta allegata visibile', /Proposta del 18\/11/.test(await testo('#chatAllegato') || ''));
  await pg.fill('#chatInput', 'Eccomi');
  await pg.click('#chatInviaBtn');
  await pg.waitForTimeout(400);
  uguale('chat: il messaggio porta la proposta', ultima('invia_messaggio') && ultima('invia_messaggio').p_richiesta_id, 'p1');
  controlla('chat: dopo l\'invio niente allegato', await pg.$eval('#chatAllegato', e => e.hidden));
  await pg.evaluate(() => { chiudiChat(); return apriChatPerRichiesta('u-altro', 'Marco', 'p1', 'Proposta del 18/11'); });
  await pg.waitForSelector('#chatAllegato:not([hidden]) button', { timeout: 3000 });
  await pg.click('#chatAllegato button');
  await pg.fill('#chatInput', 'Senza allegato');
  await pg.waitForTimeout(1100);
  await pg.click('#chatInviaBtn');
  await pg.waitForTimeout(400);
  uguale('chat: allegato tolto con la X', ultima('invia_messaggio') && (ultima('invia_messaggio').p_richiesta_id || null), null);
  await pg.click('#chatMessaggi .chat-richiesta-link');
  await pg.waitForTimeout(600);
  controlla('chat: l\'etichetta apre lo scambio', await pg.evaluate(() => document.getElementById('chatModal').style.display === 'none' && document.getElementById('richieste').classList.contains('active')
    && /'p1'/.test((document.querySelector('#richieste .ric-riga.sel') || {}).getAttribute && document.querySelector('#richieste .ric-riga.sel').getAttribute('onclick'))));

  // 8. Telefono: elenco e dettaglio uno alla volta, finestra a tutto schermo
  await pg.setViewportSize({ width: 390, height: 800 });
  await pg.evaluate(() => apriDettaglioWidget('richieste'));
  await pg.waitForTimeout(600);
  await pg.evaluate(() => _richiesteIndietro());
  await scatto('6-telefono-elenco');
  controlla('telefono: elenco senza dettaglio', await pg.evaluate(() => getComputedStyle(document.querySelector('#richieste .ric-dettaglio')).display === 'none'));
  await pg.evaluate(() => apriPropostaScambio({ altroId: 'u-altro', nomeAltro: 'Marco' }));
  await pg.waitForSelector('#propostaScambio .prop-voce', { timeout: 4000 });
  await scatto('7-telefono-proposta');
  controlla('telefono: una parte alla volta', await pg.evaluate(() => [...document.querySelectorAll('#propostaScambio .prop-lato')].filter(l => getComputedStyle(l).display !== 'none').length === 1));
  await pg.click('#propostaScambio .prop-schede button:last-child');
  controlla('telefono: scheda Tu dai', await pg.evaluate(() => getComputedStyle(document.querySelector('#propostaScambio .prop-lato[data-lato="mio"]')).display !== 'none'));
  controlla('telefono: la X della finestra non è coperta', await pg.evaluate(() => {
    const b = document.querySelector('#propostaScambio .prop-chiudi').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!el && !!el.closest('.prop-chiudi');
  }));
  await pg.click('#propostaScambio .prop-chiudi');
  await pg.evaluate(() => apriChat('u-altro', 'Marco'));
  await pg.waitForSelector('#chatScambio:not([hidden])', { timeout: 4000 });
  const copertiChat = await pg.evaluate(() => ['#chatProponiBtn', '.chat-menu-btn', '#chatModal .close-modal-btn, #chatModal [onclick*="chiudiChat"]'].map(sel => {
    const el = document.querySelector(sel);
    if (!el) return sel + ': manca';
    const b = el.getBoundingClientRect();
    const sopra = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return sopra && (sopra === el || el.contains(sopra)) ? 'ok' : sel + ': coperto da ' + (sopra ? (sopra.id || sopra.className) : 'niente');
  }));
  uguale('telefono: testata della chat non coperta', copertiChat, ['ok', 'ok', 'ok']);
  await scatto('8-telefono-chat');
  await pg.evaluate(() => chiudiChat());

  uguale('nessun errore JavaScript nella pagina', errori, []);
  uguale('nessun errore in console', consoleErrori, []);

  await browser.close();
  s.close();
  chiudi();
})().catch((e) => { console.error(e); process.exit(1); });
