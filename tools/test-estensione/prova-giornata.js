// Giornata di lavoro osservata il 28/10 (dalla 5.48, Fase 10 del piano):
// 1) coda lavorata dalla pagina dell'app in secondo piano: l'attesa tra due carte
//    finisce in orario anche quando Chrome rallenta le catene di timer (scheda
//    nascosta da più di 5 minuti: una volta al minuto). Fino alla 5.47 era una
//    catena di setTimeout da 1 s: 20 s diventavano 60. Il tasto Ferma la chiude
//    subito come prima;
// 2) carta senza offerte nella sua lingua: salvata con la foto della pagina
//    (fino alla 5.47 senza immagine), il logo di Cardmarket resta escluso.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

const riga = (lingua, prezzo) => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span></div>
  <div class="price-container"><span class="fw-bold">${prezzo} €</span></div>
  <a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
const pagina = (h1, righe, img) => `<html><head><title>Carta | Cardmarket</title>
  ${img ? `<meta property="og:image" content="${img}">` : ''}</head><body><a id="account-dropdown">utente</a>
  <h1>${h1}</h1>${righe}</body></html>`;

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
  if (maj < 5 || (maj === 5 && min < 48)) { console.log(`Versione ${manifest.version}: prove dalla 5.48, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  // ── 1) Pagina Aggiungi carte nella scheda dell'app nascosta ──────────────────
  {
    const pag = creaAmbiente({
      store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, aiutaGruppo: true },
      inoltraA: [(msg, sender, sendResponse) => {
        if (msg && msg.type === 'VERIFICA_LOGIN_SILENZIOSA') { setTimeout(() => sendResponse({ loggato: true }), 10); return true; }
        if (msg && msg.type === 'PRECEDENZA_CODA_CARDMARKET') { setTimeout(() => sendResponse({ ok: true, attendi: false }), 10); return true; }
        return false;
      }],
    });
    const { w, errori } = caricaPagina('aggiungi_carta_popup.html', pag.chrome, pag.supabase);
    await attendi(800);

    // Timer di una scheda nascosta: un timer nato dentro un altro timer (catena,
    // compresi i passi di un await subito dopo) scatta dopo almeno 3 s; i timer
    // ripetuti ogni 3 s. In Chrome, dopo 5 minuti di scheda nascosta, una volta
    // al minuto (il 28/10: carte salvate tutte ai secondi :49-:52).
    const stVero = w.setTimeout, siVero = w.setInterval;
    let dentroUnTimer = 0;
    w.setTimeout = (fn, ms, ...a) => stVero.call(w, () => {
      dentroUnTimer++;
      try { fn(...a); } finally { setImmediate(() => { dentroUnTimer--; }); }
    }, dentroUnTimer > 0 ? Math.max(ms || 0, 3000) : ms);
    w.setInterval = (fn, ms, ...a) => siVero.call(w, fn, Math.max(ms, 3000), ...a);
    let t0 = Date.now();
    await w._attendiConCountdownCoda(2000, 'Prossima tra');
    const durata = Date.now() - t0;
    w.setTimeout = stVero; w.setInterval = siVero;
    controlla('coda, scheda nascosta: un\'attesa di 2 s finisce in orario (fino alla 5.47 almeno 4 s)', durata >= 1900 && durata < 2800, (durata / 1000).toFixed(1) + ' s');
    controlla('conto alla rovescia mostrato', /^Prossima tra \d+s$/.test(w.document.getElementById('timerCountdownAttiva').textContent), w.document.getElementById('timerCountdownAttiva').textContent);

    // Ferma durante l'attesa: si chiude entro un secondo, come prima.
    t0 = Date.now();
    const attesa = w._attendiConCountdownCoda(10000, 'Prossima tra');
    await attendi(300);
    w.eval('_stopRichiesto = true');
    await attesa;
    const durataStop = Date.now() - t0;
    w.eval('_stopRichiesto = false');
    controlla('Ferma durante l\'attesa: chiusa entro ~1 s', durataStop < 1600, (durataStop / 1000).toFixed(1) + ' s');

    // Attesa già scaduta: nessuna attesa.
    t0 = Date.now();
    await w._attendiConCountdownCoda(0, 'Prossima tra');
    controlla('attesa di 0 s: subito', Date.now() - t0 < 100, Date.now() - t0);
    controlla('pagina senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── 2) Carta senza offerte nella sua lingua: salvata con la foto ─────────────
  {
    const IMG = 'https://product-images.s3.cardmarket.com/1/SV2A/1/1.jpg';
    const EEVEE = B + 'Pokemon-Card-151/Eevee-sv2a133';
    const ZORO = B + 'Battle-Partners/Ns-Zoroark-ex-V1-sv9061';
    const LOGO = B + 'Test/Logo-TST5';
    const pagine = {
      [EEVEE]: pagina('Eevee (SV2a 133)', '', IMG),                                  // filtro IT: nessuna offerta
      [ZORO]: pagina('N\'s Zoroark ex (SV9 061)', riga('Giapponese', '3,00'), IMG),  // offerte solo in giapponese
      [LOGO]: pagina('Logo (TST 5)', '', 'https://static.cardmarket.com/img/logos/cardmarket.png'),
    };
    const { ctx, env } = caricaBackground({ version: manifest.version, accelera: 10, sharedJs: fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'), pagine, fetch: async () => null });

    const r1 = await ctx._leggiNomeDaCardmarket(EEVEE, 'IT', 'NM', '', false, 0, null, null, null);
    uguale('nessuna offerta con il filtro della lingua: nome e codice, nessun prezzo, foto della pagina', [r1.nome, r1.codice, r1.prezzo, r1.urlSingles, r1.immagine], ['Eevee', 'SV2A 133', null, EEVEE, IMG]);

    const r2 = await ctx._leggiNomeDaCardmarket(ZORO, 'IT', 'NM', '', false, 0, null, null, null);
    uguale('offerte solo in un\'altra lingua: nessun prezzo, foto della pagina', [r2.nome, r2.prezzo, r2.immagine], ['N\'s Zoroark ex', null, IMG]);

    const r3 = await ctx._leggiNomeDaCardmarket(LOGO, 'IT', 'NM', '', false, 0, null, null, null);
    uguale('senza offerte e con il logo di Cardmarket: nessuna immagine', [r3.nome, r3.immagine], ['Logo', null]);
    controlla('nessun errore nel service worker', env.log.errori.length === 0, env.log.errori);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
