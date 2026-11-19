// Meno lavoro inutile (dalla 5.82):
// - foto delle carte: il nome del file nello storage è sha256(indirizzo della foto); se il file
//   c'è già (HEAD sul file pubblico) si usa quello, senza riscaricare la foto né ricaricarla
//   (il 19/11 si riscrivevano identiche ~1.400 foto al giorno); se manca, o la HEAD non risponde,
//   si fa come prima; le foto data: non fanno la HEAD;
// - Home dell'app (coda_pendente.js): con la finestra nascosta i numeri non si aggiornano; appena
//   torna visibile si aggiornano subito (prima 10 richieste al DB ogni 15 s anche senza nessuno).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const FOTO = 'https://product-images.s3.cardmarket.com/51/SVI/700001/700001.jpg';

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 82) { console.log(`Versione ${versione}: prova dalla 5.82, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // ── 1. Foto già nello storage ──────────────────────────────────────────────────────────────
  function motore(rispostaHead) {
    const chiamate = [];
    const { ctx, env } = caricaBackground({ version: versione,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.startsWith('https://x/')) { chiamate.push(['HEAD', url]); return rispostaHead(); }
        if (url.startsWith('https://product-images.s3.cardmarket.com/')) {
          chiamate.push([metodo, url]);
          return { ok: true, status: 200, headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'image/jpeg' : null) }, arrayBuffer: async () => new ArrayBuffer(8) };
        }
        return null;
      } });
    const upload = () => env.log.chiamate.filter(c => c.upload).map(c => [c.storage, c.upload]);
    return { ctx, env, chiamate, upload };
  }
  {
    const m = motore(() => rispostaFinta('', 200));
    const nome = (await m.ctx._hashUrl(FOTO)) + '.jpg';
    const r = await m.ctx._immagineAUrlDati(FOTO);
    uguale('foto già nello storage: si usa quella', r, 'https://x/' + nome);
    uguale('… una sola HEAD sul file nostro, niente download da Cardmarket', m.chiamate, [['HEAD', 'https://x/' + nome]]);
    uguale('… niente upload', m.upload(), []);
  }
  {
    const m = motore(() => rispostaFinta('', 404));
    const nome = (await m.ctx._hashUrl(FOTO)) + '.jpg';
    const r = await m.ctx._immagineAUrlDati(FOTO);
    uguale('foto nuova: scaricata e caricata come prima', [r, m.upload()], ['https://x/' + nome, [['immagini-carte', nome]]]);
    uguale('… prima la HEAD, poi il download', m.chiamate.map(c => c[0]), ['HEAD', 'GET']);
  }
  {
    const m = motore(() => { throw new Error('rete'); });
    const nome = (await m.ctx._hashUrl(FOTO)) + '.jpg';
    const r = await m.ctx._immagineAUrlDati(FOTO);
    uguale('HEAD che non risponde: si fa come prima', [r, m.upload()], ['https://x/' + nome, [['immagini-carte', nome]]]);
  }
  {
    const m = motore(() => rispostaFinta('', 200));
    await m.ctx._immagineAUrlDati('data:image/jpeg;base64,AAAA');
    uguale('foto data: nessuna HEAD (resta come prima)', m.chiamate.filter(c => c[0] === 'HEAD'), []);
  }
  {
    const m = motore(() => rispostaFinta('', 200));
    const risposta = await new Promise((ok) => {
      const f = m.env.listeners.onMessage.find(Boolean);
      let res = null;
      for (const l of m.env.listeners.onMessage) { if (l({ type: 'CONVERTI_IMMAGINE', url: FOTO }, {}, (x) => ok(x)) === true) { res = true; break; } }
      if (!res) ok(null);
    });
    controlla('messaggio CONVERTI_IMMAGINE del controllo prezzi: risponde col file già nostro', risposta && /^https:\/\/x\/[0-9a-f]{24}\.jpg$/.test(risposta.immagine), risposta);
    uguale('… senza download né upload', [m.chiamate.filter(c => c[0] === 'GET').length, m.upload().length], [0, 0]);
  }

  // ── 2. Home dell'app: numeri solo con la finestra visibile ──────────────────────────────────
  {
    const env = creaAmbiente({ version: versione, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
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
    let nascosta = true;
    Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => nascosta });
    const intervalli = [];
    const setIntervalVero = w.setInterval.bind(w);
    w.setInterval = (f, ms, ...a) => { intervalli.push({ f, ms }); return f && f.name === 'aggiornaSeVisibile' ? 0 : setIntervalVero(f, Math.max(ms, 60000), ...a); };
    for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
      if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
      const el = w.document.createElement('script');
      el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
      w.document.body.appendChild(el);
    }
    const giriHome = () => env.log.chiamate.filter(c => c.tabella === 'coda_carte' && c.metodo === 'select' && /dispositivo, creato_il, destinazione/.test(String(c.args[0]))).length;
    await attendi(400);
    uguale('app aperta in secondo piano: nessuna lettura dei numeri', giriHome(), 0);
    const giro = intervalli.find(i => i.f && i.f.name === 'aggiornaSeVisibile');
    controlla('aggiornamento della Home ogni 15 s, con il controllo della visibilità', giro && giro.ms === 15000, intervalli.map(i => [i.f && i.f.name, i.ms]));
    if (!giro) { w.close(); chiudi(); return; }
    await giro.f(); await attendi(100);
    uguale('ogni 15 s con la finestra nascosta: niente', giriHome(), 0);
    nascosta = false;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    await attendi(400);
    uguale('finestra di nuovo visibile: numeri letti subito', giriHome(), 1);
    await giro.f(); await attendi(200);
    uguale('ogni 15 s con la finestra visibile: si aggiorna', giriHome(), 2);
    nascosta = true;
    await giro.f(); await attendi(100);
    uguale('di nuovo nascosta: si ferma', giriHome(), 2);
    const senzaRumore = errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));
    controlla('app: nessun errore', senzaRumore.length === 0, senzaRumore);
    w.close();
  }

  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
