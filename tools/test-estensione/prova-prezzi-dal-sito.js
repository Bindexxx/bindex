// Prezzi solo dal sito (dalla 5.71, estensione più snella, rilascio 1):
// - pagina Prezzi senza Avvia, filtri (location, solo non controllate da N giorni, solo
//   variazioni e soglia), "Controlla connessione" e "Aiuta il gruppo": c'è solo "Ferma",
//   visibile durante un controllo;
// - la soglia di variazione arriva con l'ordine del sito (parametri.sogliaVariazione): il prezzo
//   si scrive solo se cambia almeno di tanto; senza soglia si scrive sempre;
// - i vecchi filtri salvati su un PC (soloVecchie, giorniMinimi, soloVariazioni, sliderSoglia)
//   non cambiano più gli ordini del sito;
// - service worker: l'ordine della wishlist porta con sé i parametri (la soglia).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

function caricaPagina(file, env) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = env.chrome; w.supabase = env.supabase;
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
const senzaRumore = (errori) => errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 71) { console.log(`Versione ${versione}: prova dalla 5.71, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // PC con i vecchi filtri salvati: non devono più contare
  const sw = caricaBackground({
    version: versione,
    store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, aiutaGruppo: false, soloVecchie: true, giorniMinimi: '1', soloVariazioni: true, sliderSoglia: 6,
      statoLoginCardmarket: { loggato: true, quando: Date.now() } },
  });
  const { w, errori } = caricaPagina('popup.html', sw.env);
  await attendi(900);
  const d = w.document;

  // ── la pagina ──
  uguale('Prezzi: niente Avvia, filtri, soglia, connessione, location, "Aiuta il gruppo"',
    ['soloVariazioni', 'sliderSoglia', 'soloVecchie', 'giorniMinimi', 'filtroLocation', 'btnControllaConnessione', 'aiutaGruppo', 'cardConnessione', 'cardFiltroLocation'].filter(id => d.getElementById(id)), []);
  const ferma = d.getElementById('btnAvvia');
  uguale('Prezzi: da fermo il bottone non si vede (c\'è solo "Ferma" durante un controllo)', [ferma.hidden, ferma.textContent.trim()], [true, 'Ferma']);
  controlla('Prezzi: la pagina dice che i controlli partono dal sito', /dal sito/.test(d.querySelector('.nota-ordini') ? d.querySelector('.nota-ordini').textContent : ''));

  // ── sessione da un ordine: soglia dall'ordine, filtri del PC ignorati ──
  // fino alla 5.72 le attese erano anche nella pagina; dalla 5.73 solo nel menu (store)
  if (d.getElementById('sliderDelayMin')) d.getElementById('sliderDelayMin').value = '1';
  if (d.getElementById('sliderDelayMax')) d.getElementById('sliderDelayMax').value = '1';
  const prezziNuovi = { c1: 1.10, c2: 3.00, c3: 1.00 }; // prima 1,00 € per tutte
  let visibileDurante = null;
  w.apriTabEAspettaPrezzo = async (url) => {
    if (visibileDurante === null) visibileDurante = !d.getElementById('btnAvvia').hidden;
    await attendi(30);
    const id = url.split('Carta-')[1].split('?')[0];
    return { prezzo: prezziNuovi[id], nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null };
  };
  let scritti = [];
  let letture = [];
  let daLeggere = true;
  w.chiamaSupabase = async (azione, payload) => {
    if (azione === 'leggi') {
      letture.push(payload);
      if (payload.soloConta) return { ok: true, totale: 3 };
      if (!daLeggere) return { ok: true, carte: [] };
      daLeggere = false;
      return { ok: true, carte: ['c1', 'c2', 'c3'].map(id => ({ rigaSheet: id, urlBase: B + 'Test/Carta-' + id, lingua: 'IT', condizione: 'NM', codice: 'TST', nome: 'Carta', prezzoPrecedente: 1.0, ownerId: 'u-me' })) };
    }
    if (azione === 'aggiornaPrezzoRiga') scritti.push(payload.riga);
    return { ok: true };
  };
  const ordineCon = async (id, parametri) => {
    scritti = []; letture = []; daLeggere = true; visibileDurante = null;
    await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id, tipo: 'controlla_prezzi', parametri, creatoDa: 'u-me', messoIl: Date.now() } });
    await w._avviaAutorunSeRichiesto();
  };

  await ordineCon('o-soglia', { aiutaGruppo: false, sogliaVariazione: 0.5 });
  uguale('ordine con soglia 0,50 €: scritte solo le carte cambiate di almeno 0,50 € (+2,00)', scritti, ['c2']);
  const primaLettura = letture.find(l => !l.soloConta) || {};
  uguale('ordine: i vecchi filtri del PC (solo non controllate da 1 giorno) non contano', [primaLettura.soloVecchie, primaLettura.filtroLocation], [false, []]);
  uguale('ordine: "Ferma" visibile durante, nascosto alla fine', [visibileDurante, d.getElementById('btnAvvia').hidden], [true, true]);

  await ordineCon('o-sempre', { aiutaGruppo: false });
  uguale('ordine senza soglia: prezzo scritto sempre (anche +0,10 € e uguale), anche se il PC aveva "solo variazioni" acceso', scritti, ['c1', 'c2', 'c3']);

  await ordineCon('o-strana', { sogliaVariazione: 'niente' });
  uguale('ordine con una soglia non valida: come senza soglia', scritti, ['c1', 'c2', 'c3']);

  // ── "Ferma" dall'app durante un controllo ──
  w.eval('isRunning = true; stopRequested = false;');
  w.eval('_mostraFerma(true)');
  d.getElementById('btnAvvia').click();
  uguale('"Ferma": il controllo si ferma', [w.eval('stopRequested'), d.getElementById('btnAvvia').textContent], [true, 'Arresto…']);
  w.eval('isRunning = false; stopRequested = false; _mostraFerma(false);');

  controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0 && sw.env.log.errori.length === 0, { e: senzaRumore(errori), sw: sw.env.log.errori });
  w.close();

  // ── service worker: l'ordine della wishlist porta i parametri ──
  {
    const ordine = { id: 'ow', tipo: 'controlla_prezzi_wishlist', parametri: { sogliaVariazione: 0.2 }, creato_da: 'u-me', creato_il: new Date().toISOString() };
    const { ctx, env } = caricaBackground({ version: versione, dati: { ordini: [ordine] },
      store: { lavoraAChiuso: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    ctx._verificaVersioneAggiornata = async () => true;
    ctx._lavoroPermessoSuQuestoPc = async () => true;
    await ctx._controllaOrdini();
    const salvato = env.store.ordinePendenteAutorunWishlist;
    uguale('service worker: ordine della wishlist passato alla pagina con la soglia', salvato && salvato.parametri, { sogliaVariazione: 0.2 });
    controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
