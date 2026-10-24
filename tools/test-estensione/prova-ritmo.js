// Ritmo del controllo prezzi (dalla 5.38): la sessione vera di popup.js (eseguiSessione,
// dominio wishlist) gira in jsdom contro il turno Cardmarket vero di background.js.
// Slider a 1 s: tra due pagine deve passare UN'attesa (1 s + 1,2 s di margine), non due,
// e ogni carta deve contare UN turno (la pausa lunga "ogni N carte" conta i turni).
// Bug fino alla 5.37: un secondo turno a fine carta → ritmo dimezzato, pausa lunga ogni N/2.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const ATTESA_MS = 1000 + 1200; // slider 1 s + margine fisso del turno
const LAVORO_MS = 300;         // lettura finta della pagina

(async () => {
  const { ctx, env, EXT } = caricaBackground({ store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderPausaOgni: 4, aiutaGruppo: true } });
  console.log('Estensione provata:', EXT, '\n');

  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/popup.html?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = env.chrome; // stesso Chrome finto del background: TURNO_CARDMARKET arriva al turno vero
  w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '0.0', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    w.document.body.appendChild(el);
  }
  await new Promise(r => setTimeout(r, 800));

  // 4 carte: un lotto da 3 e uno da 1 (prova anche il passaggio tra lotti).
  const lotti = [
    [1, 2, 3].map(i => ({ id: 'w' + i, owner_id: 'u-altro', nome: 'Carta ' + i, codice: 'TST ' + i, url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Test/Carta-' + i, lingua: 'IT', condizione: 'NM', prezzo: 1 })),
  ];
  lotti.push([{ id: 'w4', owner_id: 'u-altro', nome: 'Carta 4', codice: 'TST 4', url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Test/Carta-4', lingua: 'IT', condizione: 'NM', prezzo: 1 }]);
  const azioni = [];
  w.chiamaSupabase = async (azione, payload) => {
    azioni.push(azione);
    if (azione === 'leggiWishlistGruppo') {
      if (payload.soloConta) return { ok: true, totale: 4 };
      const lotto = lotti.shift() || [];
      return { ok: true, carte: lotto.map(r => ({ rigaSheet: r.id, urlBase: r.url, lingua: r.lingua, condizione: r.condizione, codice: r.codice, nome: r.nome, prezzoPrecedente: r.prezzo, ownerId: r.owner_id })) };
    }
    return { ok: true };
  };
  const pagine = [];
  w.apriTabEAspettaPrezzo = async (url) => {
    pagine.push(Date.now());
    await new Promise(r => setTimeout(r, LAVORO_MS));
    const n = (url.match(/Carta-(\d)/) || [])[1];
    return { prezzo: 1.5, nomePagina: 'Carta ' + n, codicePagina: 'TST ' + n, immagine: null };
  };
  const d = w.document;
  d.getElementById('sliderDelayMin').value = '1';
  d.getElementById('sliderDelayMax').value = '1';
  d.getElementById('sliderPausaOgni').value = '4';

  const { turnoCardmarketConta: contaPrima = 0 } = await env.chrome.storage.local.get('turnoCardmarketConta');
  const t0 = Date.now();
  await w.eseguiSessione(false, { dominio: 'wishlist', ordineId: 'o1', aiutaGruppo: true });
  const durata = Date.now() - t0;
  const { turnoCardmarketConta: contaDopo = 0 } = await env.chrome.storage.local.get('turnoCardmarketConta');

  uguale('4 pagine lette (2 lotti)', pagine.length, 4);
  const distanze = pagine.slice(1).map((t, i) => t - pagine[i]);
  // Il conto alla rovescia di popup.js va a secondi interi: 2,2 s diventano 3 s.
  const attesa = Math.ceil(ATTESA_MS / 1000) * 1000 + LAVORO_MS;
  controlla(`tra due pagine UN'attesa (~${(attesa / 1000).toFixed(1)} s; con due ~${((attesa + Math.ceil(ATTESA_MS / 1000) * 1000) / 1000).toFixed(1)} s)`,
    distanze.length === 3 && distanze.every(x => x >= ATTESA_MS - 100 && x < attesa + 1000),
    distanze.map(x => (x / 1000).toFixed(1) + ' s').join(', '));
  uguale('un turno Cardmarket per pagina', contaDopo - contaPrima, 4);
  controlla('prezzi scritti con le azioni wishlist', azioni.filter(a => a === 'aggiornaPrezzoRigaWishlistGruppo').length === 4, azioni);
  controlla('contributi registrati (righe di un altro)', env.log.rpc.filter(n => n === 'registra_aiuto_gruppo').length === 4, env.log.rpc);
  const stato = (d.getElementById('status') || {}).textContent || '';
  controlla('sessione finita senza errori', /Fatto/.test(stato) && errori.length === 0, { stato, errori, durata });

  // ── Stessa prova per il controllo prezzi dei sealed (eseguiSessioneSealed) ──
  const lottiSealed = [[1, 2, 3], [4]].map(g => g.map(i => ({ rigaSheet: 's' + i, urlBase: 'https://www.cardmarket.com/it/Pokemon/Products/Elite-Trainer-Boxes/Prodotto-' + i, codice: null, nome: 'Prodotto ' + i, prezzoPrecedente: 10, ownerId: 'u-altro' })));
  const azioniSealed = [];
  w.chiamaSupabase = async (azione, payload) => {
    azioniSealed.push(azione);
    if (azione === 'leggiSealed') return payload.soloConta ? { ok: true, totale: 4 } : { ok: true, carte: lottiSealed.shift() || [] };
    return { ok: true };
  };
  const pagineSealed = [];
  w.apriTabELeggiPrezzoSealed = async () => {
    pagineSealed.push(Date.now());
    await new Promise(r => setTimeout(r, LAVORO_MS));
    return { prezzo: 12.5, immagine: null };
  };
  const { turnoCardmarketConta: c0 = 0 } = await env.chrome.storage.local.get('turnoCardmarketConta');
  await w.eseguiSessioneSealed({ aiutaGruppo: true });
  const { turnoCardmarketConta: c1 = 0 } = await env.chrome.storage.local.get('turnoCardmarketConta');
  uguale('sealed: 4 pagine lette (2 lotti)', pagineSealed.length, 4);
  const distSealed = pagineSealed.slice(1).map((t, i) => t - pagineSealed[i]);
  controlla('sealed: tra due pagine UN\'attesa', distSealed.length === 3 && distSealed.every(x => x >= ATTESA_MS - 100 && x < attesa + 1000),
    distSealed.map(x => (x / 1000).toFixed(1) + ' s').join(', '));
  uguale('sealed: un turno Cardmarket per pagina', c1 - c0, 4);
  controlla('sealed: prezzi scritti', azioniSealed.filter(a => a === 'aggiornaPrezzoRigaSealed').length === 4, azioniSealed);
  w.close();
  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
