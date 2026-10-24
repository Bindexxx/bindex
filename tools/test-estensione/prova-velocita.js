// Velocità (dalla 5.43, Fase 6 del piano):
//   6.1 un solo ritmo: il turno Cardmarket comune di background.js decide l'attesa,
//       compreso il rallentamento dopo Cloudflare (+3 s per gradino, al massimo 5,
//       un gradino in meno per ogni carta pulita); la pagina Aggiungi carte mostra
//       solo il conto alla rovescia del turno (fase 'quando', senza prenotare);
//       popup.js: la micro-pausa si somma al turno; "pausa lunga ogni" = 75 ovunque;
//   worker in background: le carte della coda di fila, con solo il turno tra una e
//       l'altra, e si ferma appena una condizione manca (scheda dell'app aperta);
//   6.2 meno richieste per carta: link diretto = solo la scheda del prezzo (nome e
//       codice dall'h1, link vecchio riconosciuto nella scheda); dalla ricerca niente
//       pagina della carta scaricata; secondo tentativo senza filtro RH/1ª solo con
//       0 offerte; una scheda che non legge niente non salva la carta.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const SLIDER = { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderPausaOgni: 4 };
const ATTESA_MS = 1000 + 1200; // slider 1 s + margine fisso del turno

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
  if (maj < 5 || (maj === 5 && min < 43)) { console.log(`Versione ${manifest.version}: prove dalla 5.43, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  // ── 6.1 Turno: rallentamento dopo Cloudflare ─────────────────────────────────
  {
    const { ctx, env } = caricaBackground({ version: manifest.version, store: { ...SLIDER } });
    const restaMs = async () => (await ctx._quandoTurnoCardmarket()).da - Date.now();
    await ctx._prenotaTurnoCardmarket();
    ctx._suonaEPortaInPrimoPiano(999, false, 'carte');   // Cloudflare in una scheda del service worker…
    ctx._suonaEPortaInPrimoPiano(999, false, 'carte');   // …e di nuovo nella stessa carta: conta una volta
    await ctx._chiudiTurnoCardmarket();
    const q1 = await ctx._quandoTurnoCardmarket();
    const r1 = q1.da - Date.now();
    controlla('Cloudflare nella carta: livello 1, attesa slider + 3 s', q1.livelloCf === 1 && r1 > ATTESA_MS + 3000 - 300 && r1 <= ATTESA_MS + 3000, { livello: q1.livelloCf, ms: r1 });
    uguale('livello salvato (sopravvive a un riavvio del service worker)', env.store.turnoCardmarketLivelloCf, 1);

    // Carta pulita: livello giù di uno, attesa normale.
    await ctx._prenotaTurnoCardmarket();
    await ctx._chiudiTurnoCardmarket();
    const q2 = await ctx._quandoTurnoCardmarket();
    const attesa2 = await ctx._attesaSliderCmMs(); // (il turno qui sopra non è stato aspettato: conta l'attesa)
    controlla('carta pulita dopo: livello 0, attesa normale', q2.livelloCf === 0 && attesa2 === ATTESA_MS, { livello: q2.livelloCf, ms: attesa2 });

    // Il controllo prezzi di popup.js segnala Cloudflare con AVVIA_AVVISO_CLOUDFLARE.
    await ctx._prenotaTurnoCardmarket();
    env.chrome.runtime.sendMessage({ type: 'AVVIA_AVVISO_CLOUDFLARE', tabId: 999, avvisoSonoro: false, timeoutMinuti: 1 });
    await attendi(20);
    await ctx._chiudiTurnoCardmarket();
    uguale('Cloudflare dal controllo prezzi (popup.js): livello 1', (await ctx._quandoTurnoCardmarket()).livelloCf, 1);

    // Al massimo 5 gradini.
    for (let i = 0; i < 8; i++) { await ctx._prenotaTurnoCardmarket(); ctx._suonaEPortaInPrimoPiano(999, false, 'sealed'); await ctx._chiudiTurnoCardmarket(); }
    const q3 = await ctx._quandoTurnoCardmarket();
    controlla('al massimo 5 gradini (+15 s)', q3.livelloCf === 5 && (q3.da - Date.now()) > ATTESA_MS + 15000 - 300, { livello: q3.livelloCf, ms: q3.da - Date.now() });

    // 'quando' non prenota: il contatore delle carte (pausa lunga) non cambia.
    const conta = env.store.turnoCardmarketConta;
    const risposta = await new Promise(r => env.chrome.runtime.sendMessage({ type: 'TURNO_CARDMARKET', fase: 'quando' }, r));
    controlla('TURNO_CARDMARKET "quando": da e livello, nessuna prenotazione', risposta.ok && risposta.da > Date.now() && risposta.livelloCf === 5 && env.store.turnoCardmarketConta === conta, { risposta, conta, dopo: env.store.turnoCardmarketConta });
  }

  // ── 6.1 Pagina Aggiungi carte: solo il conto alla rovescia del turno ──────────
  {
    const sw = caricaBackground({ version: manifest.version, store: { ...SLIDER } });
    // La pagina parla con il turno vero; gli altri messaggi hanno risposte semplici.
    const pag = creaAmbiente({
      store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderRicontrollo: 1, aiutaGruppo: true },
      inoltraA: [(msg, sender, sendResponse) => {
        if (msg && msg.type === 'TURNO_CARDMARKET') {
          let async = false;
          sw.env.listeners.onMessage.forEach(f => { if (f(msg, { tab: null }, sendResponse) === true) async = true; });
          return async;
        }
        if (msg && msg.type === 'VERIFICA_LOGIN_SILENZIOSA') { setTimeout(() => sendResponse({ loggato: true }), 10); return true; }
        if (msg && msg.type === 'PRECEDENZA_CODA_CARDMARKET') { setTimeout(() => sendResponse({ ok: true, attendi: false }), 10); return true; }
        return false;
      }],
    });
    const { w, errori } = caricaPagina('aggiungi_carta_popup.html', pag.chrome, pag.supabase);
    await attendi(800);
    const d = w.document;
    uguale('"Pausa lunga ogni" di default: 75 (come app e controllo prezzi)', [d.getElementById('sliderPausaOgni').value, d.getElementById('valPausaOgni').textContent], ['2', '75']);

    await sw.ctx._prenotaTurnoCardmarket();
    await sw.ctx._chiudiTurnoCardmarket();
    const conta = sw.env.store.turnoCardmarketConta;
    let t0 = Date.now();
    await w._attendiDelayCoda();
    let durata = Date.now() - t0;
    controlla(`attesa della pagina = quella del turno (~${(ATTESA_MS / 1000).toFixed(1)} s), non slider + turno`, durata > ATTESA_MS - 400 && durata < ATTESA_MS + 1200, (durata / 1000).toFixed(1) + ' s');
    uguale('la pagina non prenota il turno (lo prende il service worker con la carta)', sw.env.store.turnoCardmarketConta, conta);

    // Dopo un Cloudflare il conto alla rovescia dice "rallentato" e dura 3 s in più.
    await sw.ctx._prenotaTurnoCardmarket();
    sw.ctx._suonaEPortaInPrimoPiano(999, false, 'carte');
    await sw.ctx._chiudiTurnoCardmarket();
    t0 = Date.now();
    const attesaP = w._attendiDelayCoda();
    await attendi(1300);
    const etichetta = d.getElementById('timerCountdownAttiva').textContent;
    await attesaP;
    durata = Date.now() - t0;
    controlla('dopo Cloudflare: "Prossima tra (rallentato)", slider + 3 s', /rallentato/.test(etichetta) && durata > ATTESA_MS + 3000 - 400 && durata < ATTESA_MS + 3000 + 1200, { etichetta, s: (durata / 1000).toFixed(1) });
    controlla('pagina senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── 6.1 popup.js: la micro-pausa si somma al turno ───────────────────────────
  {
    const { env } = caricaBackground({ version: manifest.version, store: { ...SLIDER } });
    const { w, errori } = caricaPagina('popup.html', env.chrome, env.supabase);
    await attendi(800);
    const ritmo = w.creaRitmoCardmarket(1, 1);
    await ritmo.attendi();      // prima carta: subito
    ritmo.fissa();              // fine carta: turno chiuso, prossima tra ~2,2 s
    ritmo.allunga(1500);        // micro-pausa ogni 10 carte
    const t0 = Date.now();
    await ritmo.attendi();
    const durata = Date.now() - t0;
    controlla('popup.js: turno + micro-pausa sommati (~3,7 s)', durata > ATTESA_MS + 1500 - 400 && durata < ATTESA_MS + 1500 + 1200, (durata / 1000).toFixed(1) + ' s');
    controlla('popup.js senza errori', errori.length === 0, errori);
    w.close();
  }

  // ── Worker in background: carte di fila ──────────────────────────────────────
  {
    const righe = [1, 2, 3].map(i => ({ id: 'c' + i, owner_id: 'u-me', nome: 'Carta ' + i, stato: 'pending', creato_il: '2026-10-25T10:0' + i + ':00Z', tipo: 'carta' }));
    const dati = { get coda_carte() { return righe.length ? [righe[0]] : []; } };
    const { ctx, env } = caricaBackground({ version: manifest.version, store: { ...SLIDER, aiutaGruppo: true }, dati });
    const lavorate = [];
    ctx._risolviRigaCodaCarteAutonoma = async (r) => {
      lavorate.push({ id: r.id, t: Date.now(), occupato: !!env.store.workerAutonomoAttivo });
      await attendi(200);
      righe.shift();
    };
    const conta0 = env.store.turnoCardmarketConta || 0;
    await ctx._lavoraCodaCarteAutonomo();
    uguale('worker: 3 carte in un solo giro (prima una al minuto)', lavorate.map(l => l.id), ['c1', 'c2', 'c3']);
    const distanze = lavorate.slice(1).map((l, i) => l.t - lavorate[i].t);
    controlla(`worker: tra due carte solo il turno (~${((ATTESA_MS + 200) / 1000).toFixed(1)} s)`, distanze.length === 2 && distanze.every(x => x > ATTESA_MS - 300 && x < ATTESA_MS + 200 + 1200), distanze.map(x => (x / 1000).toFixed(1) + ' s'));
    uguale('worker: un turno Cardmarket per carta', (env.store.turnoCardmarketConta || 0) - conta0, 3);
    controlla('worker: "al lavoro" segnato durante ogni carta e tolto alla fine', lavorate.every(l => l.occupato) && !('workerAutonomoAttivo' in env.store), { lavorate, store: env.store.workerAutonomoAttivo });

    // La scheda dell'app si apre dopo la prima carta: il giro si ferma lì.
    righe.push(...[4, 5].map(i => ({ id: 'c' + i, owner_id: 'u-me', nome: 'Carta ' + i, stato: 'pending', creato_il: '2026-10-25T11:0' + i + ':00Z', tipo: 'carta' })));
    lavorate.length = 0;
    ctx._risolviRigaCodaCarteAutonoma = async (r) => {
      lavorate.push({ id: r.id });
      righe.shift();
      await env.chrome.tabs.create({ url: env.chrome.runtime.getURL('app.html') });
    };
    await ctx._lavoraCodaCarteAutonomo();
    uguale('worker: si ferma appena si apre la scheda dell\'app (la coda passa alla pagina)', lavorate.map(l => l.id), ['c4']);
  }

  // ── 6.2 Meno richieste per carta ─────────────────────────────────────────────
  {
    const ZUBAT = B + 'Silver-Tempest/Zubat-SIT103';
    const IMG = 'https://product-images.s3.cardmarket.com/51/SIT/680046/680046.jpg';
    const RIC = CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=ZUBAT+SIT+103';
    const link = (slug) => `<a href="/it/Pokemon/Products/Singles/${slug}">${slug}</a>`;
    const RH = B + 'Test/Carta-RH-TST1';
    const RH2 = B + 'Test/Carta-RH-TST2';
    const pagine = {
      [ZUBAT]: pagina('Zubat <span>Silver Tempest</span>(SIT 103)', riga('Inglese', '0,05') + riga('Italiano', '0,10'), IMG),
      [B + 'Test/Logo-TST3']: pagina('Logo (TST 3)', riga('Italiano', '1,00'), 'https://static.cardmarket.com/img/logos/cardmarket.png'),
      [B + 'HeartGold-SoulSilver']: pagina('Singole HeartGold &amp; SoulSilver', ''),
    };
    const richieste = [];
    const { ctx, env } = caricaBackground({
      version: manifest.version, accelera: 10, sharedJs: fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'), pagine,
      rimandi: { [B + 'HeartGold-SoulSilver/Magikarp-HS72']: B + 'HeartGold-SoulSilver' },
      fetch: async (url) => {
        richieste.push(url);
        if (url === RIC) return rispostaFinta(`<html><head><title>Risultati Di Ricerca | Cardmarket</title></head><body><h1>Risultati</h1>${link('Silver-Tempest/Zubat-SIT103')}${link('Trainer-Gallery/Zubat-BOO23SIT-103')}</body></html>`);
        return null;
      },
    });
    // Pagine con i filtri RH: la prima senza nessuna offerta, la seconda con offerte solo in inglese.
    const conRH = (u) => ctx._appendVariantParams(ctx.costruisciUrlFiltrato(u, 'IT', 'NM'), 'RH', false);
    pagine[conRH(RH)] = pagina('Carta RH (TST 1)', '');
    pagine[ctx.costruisciUrlFiltrato(RH, 'IT', 'NM')] = pagina('Carta RH (TST 1)', riga('Italiano', '0,50'));
    pagine[conRH(RH2)] = pagina('Carta RH due (TST 2)', riga('Inglese', '0,40'));
    pagine[ctx.costruisciUrlFiltrato(RH2, 'IT', 'NM')] = pagina('Carta RH due (TST 2)', riga('Italiano', '0,70'));
    const schede = () => env.log.tabs.filter(t => t[0] === 'create' || t[0] === 'update').length;
    const azzera = () => { richieste.length = 0; env.log.tabs.length = 0; };

    azzera();
    const r1 = await ctx._leggiNomeDaCardmarket(ZUBAT, 'IT', 'NM', '', false, 0, null, null, RIC);
    uguale('link diretto: nome, codice e prezzo dalla scheda', [r1.nome, r1.codice, r1.prezzo, r1.urlSingles], ['Zubat', 'SIT 103', 0.1, ZUBAT]);
    uguale('link diretto: 1 sola richiesta (la scheda), nessuna pagina scaricata', [schede(), richieste.length], [1, 0]);
    uguale('link diretto: immagine della scheda (la converte chi salva)', r1.immagine, IMG);

    azzera();
    const r2 = await ctx._leggiNomeDaCardmarket(RIC, 'IT', 'NM', '', false, 0, null, null, null);
    uguale('dalla ricerca: carta giusta, nome e codice dalla scheda', [r2.nome, r2.codice, r2.prezzo, (r2.urlSingles || '').split('/').pop()], ['Zubat', 'SIT 103', 0.1, 'Zubat-SIT103']);
    uguale('dalla ricerca: 2 richieste (ricerca + scheda), non 3', [richieste.length, schede()], [1, 1]);

    azzera();
    const r3 = await ctx._leggiNomeDaCardmarket(B + 'Test/Logo-TST3', 'IT', 'NM', '', false, 0, null, null, null);
    uguale('logo di Cardmarket al posto della foto: nessuna immagine', [r3.nome, r3.immagine], ['Logo', null]);

    azzera();
    const r4 = await ctx._leggiNomeDaCardmarket(B + 'HeartGold-SoulSilver', 'IT', 'NM', '', false, 0, null, null, null);
    controlla('link alla lista di un\'espansione: non valido senza nessuna richiesta', r4.linkNonValido === true && schede() === 0 && richieste.length === 0, r4);

    azzera();
    const r5 = await ctx._leggiPrezzoDaSingles(B + 'HeartGold-SoulSilver/Magikarp-HS72?language=5', null, null);
    controlla('scheda rimandata alla lista: linkNonValido, prezzo null (mai la stringa "LinkNonValido")', r5.linkNonValido === true && r5.prezzo === null, r5);

    azzera();
    const r6 = await ctx._leggiNomeDaCardmarket(RH, 'IT', 'NM', 'RH', false, 0, null, null, null);
    uguale('RH, pagina filtrata con 0 offerte: secondo tentativo senza filtro', [r6.prezzo, r6.nome, schede()], [0.5, 'Carta RH', 2]);

    azzera();
    const r7 = await ctx._leggiNomeDaCardmarket(RH2, 'IT', 'NM', 'RH', false, 0, null, null, null);
    uguale('RH, offerte ma nessuna in italiano: niente secondo tentativo (prima prezzo della stampa normale)', [r7.prezzo, r7.nome, schede()], [null, 'Carta RH due', 1]);

    azzera();
    const r8 = await ctx._leggiNomeDaCardmarket(B + 'Test/Mai-Caricata-TST9', 'IT', 'NM', '', false, 0, null, null, null);
    controlla('scheda che non legge niente: carta NON salvata col nome del link (ritentata 2 volte)', !r8.urlSingles && !r8.nome && schede() === 3, { r8, schede: schede() });
    controlla('nessun errore nel service worker', env.log.errori.length === 0, env.log.errori);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
