// Controllo prezzi wishlist di gruppo (estensione 5.37, sql/118):
// 1) le azioni nuove dell'adapter chiamano le funzioni giuste del database, con i nomi dei
//    parametri scritti in sql/118 (se uno dei due cambia senza l'altro, qui si vede);
// 2) la sessione del controllo prezzi (popup.js) passa SOLO dalle azioni del suo dominio
//    e la lettura tiene il proprietario della riga (senza, i contributi non si contano);
// 3) la home dell'app: niente sezione/scheda Wishlist, "di cui wishlist" contato da
//    coda_carte, errori recenti letti dalle correzioni manuali.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const SQL118 = path.resolve(__dirname, '../../sql/118_wishlist_controllo_gruppo.sql');

// Parametri di ogni funzione in sql/118: { nome_funzione: ['p_...', ...] }
function parametriSql() {
  const sql = fs.readFileSync(SQL118, 'utf8');
  const out = {};
  for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)) {
    out[m[1]] = m[2].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
  }
  return out;
}

function caricaAdapter(risposte) {
  const chiamate = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-io' } } } }) },
    rpc: async (nome, args) => {
      chiamate.push({ nome, args });
      return { data: risposte[nome] !== undefined ? risposte[nome] : null, error: null };
    },
    from: () => { throw new Error('from() non atteso nelle azioni wishlist'); },
  };
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, JSON, Math, String, Number, Array, Object, Error,
    supabase: { createClient: () => client },
    chrome: { runtime: { getManifest: () => ({ version: '5.37' }) }, storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => cb && cb(), remove: (k, cb) => cb && cb() } } },
    fetch: async () => ({ ok: true, text: async () => '5.37' }),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(EXT, 'supabase_adapter.js'), 'utf8'), ctx, { filename: 'supabase_adapter.js' });
  return { ctx, chiamate };
}

async function avviaApp(opts) {
  const html = fs.readFileSync(path.join(EXT, 'app.html'), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  vc.on('error', (...a) => errori.push('console.error: ' + a.map(String).join(' ').slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/app.html', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  const env = creaAmbiente(opts);
  w.chrome = env.chrome; w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '5.37', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  for (const s of scripts) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    try { w.document.body.appendChild(el); } catch (e) { errori.push(`${s}: ${e.message}`); }
  }
  await new Promise(r => setTimeout(r, 1500));
  return { w, env, errori };
}

(async () => {
  console.log('Estensione provata:', EXT, '\n');

  // ── 1) adapter ↔ sql/118 ──
  const firme = parametriSql();
  uguale('sql/118 definisce 7 funzioni', Object.keys(firme).length, 7);
  const righe = [{ id: 'w1', owner_id: 'u-francesco', nome: 'Mew', codice: 'MEW 151', url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/151/Mew', lingua: 'IT', condizione: 'NM', prezzo: 3.5, ultimo_controllo: null }];
  const { ctx, chiamate } = caricaAdapter({ conta_wishlist_da_controllare_gruppo: 637, reclama_wishlist_per_controllo_prezzi: righe });
  const casi = [
    ['leggiWishlistGruppo', { ordineId: 'o1', soloConta: true }, ['conta_wishlist_da_controllare_gruppo']],
    ['leggiWishlistGruppo', { ordineId: 'o1', lottoSize: 3, nomeDispositivo: 'PC-ire' }, ['reclama_wishlist_per_controllo_prezzi', 'tagga_dispositivo_claim_gruppo_wishlist']],
    ['aggiornaPrezzoRigaWishlistGruppo', { riga: 'w1', prezzo: 4.2 }, ['aggiorna_prezzo_controllo_gruppo_wishlist']],
    ['aggiornaUrlRigaWishlistGruppo', { riga: 'w1', url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/151/Mew' }, ['aggiorna_url_controllo_gruppo_wishlist']],
    ['segnaControllataWishlistGruppo', { riga: 'w1' }, ['segna_controllata_gruppo_wishlist']],
    ['rilasciaClaimWishlist', { nomeDispositivo: 'PC-ire' }, ['rilascia_claim_controllo_prezzi_wishlist']],
  ];
  const esiti = {};
  for (const [azione, payload, attese] of casi) {
    const prima = chiamate.length;
    const r = await ctx.chiamaSupabase(azione, payload);
    esiti[azione + (payload.soloConta ? ':conta' : '')] = r;
    const fatte = chiamate.slice(prima).filter(c => c.nome !== 'verifica_versione_minima');
    uguale(`${azione}${payload.soloConta ? ' (conta)' : ''}: funzioni chiamate`, fatte.map(c => c.nome), attese);
    for (const c of fatte) {
      const extra = Object.keys(c.args || {}).filter(k => !(firme[c.nome] || []).includes(k));
      controlla(`${c.nome}: parametri presenti in sql/118`, firme[c.nome] && extra.length === 0, { args: Object.keys(c.args || {}), sql: firme[c.nome] });
    }
  }
  uguale('conta: totale dal database', esiti['leggiWishlistGruppo:conta'].totale, 637);
  const lette = esiti['leggiWishlistGruppo'].carte || [];
  uguale('lotto: riga nella forma della sessione', [lette[0] && lette[0].rigaSheet, lette[0] && lette[0].codice], ['w1', 'MEW 151']);
  uguale('lotto: proprietario conservato (contributi)', lette[0] && lette[0].ownerId, 'u-francesco');
  const tag = chiamate.find(c => c.nome === 'tagga_dispositivo_claim_gruppo_wishlist');
  uguale('tagga: id e dispositivo', tag && [tag.args.p_ids, tag.args.p_dispositivo], [['w1'], 'PC-ire']);

  // ── 2) popup.js: la sessione usa solo le azioni del dominio ──
  const popup = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  const i0 = popup.indexOf('async function eseguiSessione(');
  const i1 = popup.indexOf('\n}\n', i0);
  const corpo = popup.slice(i0, i1).replace(/^\s*\/\/.*$/gm, ''); // senza commenti
  const dirette = [...corpo.matchAll(/chiamaSupabase\(\s*'(\w+)'/g)].map(m => m[1]);
  uguale('eseguiSessione: nessuna azione scritta a mano (tutte da AZ)', dirette, []);
  controlla('eseguiSessione: contributo col tipo del dominio', /registraAiutoGruppo\([^)]*AZ\.tipoAiuto\)/.test(corpo));
  controlla('eseguiSessione: dominio wishlist con le azioni sql/118', /dominio === 'wishlist'[\s\S]{0,40}\{ leggi: 'leggiWishlistGruppo'/.test(corpo));
  const leggiDati = popup.slice(popup.indexOf('async function leggiDatiSheet('), popup.indexOf('async function leggiDatiSheet(') + 3000);
  controlla('leggiDatiSheet: tiene ownerId', /ownerId:\s*c\.ownerId/.test(leggiDati));

  // ── 3) home dell'app ──
  controlla('file della sezione Wishlist tolti', !fs.existsSync(path.join(EXT, 'aggiungi_wishlist_popup.html')) && !fs.existsSync(path.join(EXT, 'aggiungi_wishlist_popup.js')));
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const risorse = (manifest.web_accessible_resources || []).flatMap(x => x.resources);
  controlla('manifest: ogni risorsa esiste', risorse.every(r => fs.existsSync(path.join(EXT, r))), risorse.filter(r => !fs.existsSync(path.join(EXT, r))));

  const adesso = new Date().toISOString();
  const vecchia = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const { w, env, errori } = await avviaApp({
    dati: {
      coda_carte: [
        { nome: 'Pikachu', tipo: null, qty: 1, stato: 'pending', dispositivo: null, creato_il: vecchia, destinazione: 'collezione' },
        { nome: 'Mewtwo', tipo: null, qty: 1, stato: 'pending', dispositivo: null, creato_il: adesso, destinazione: 'wishlist' },
        { nome: 'Lugia', tipo: null, qty: 1, stato: 'in_corso', dispositivo: 'PC', creato_il: adesso, destinazione: 'wishlist' },
      ],
      correzioni_manuali_carte: [
        { nome: 'Celebi errore nuovo', errore_msg: 'più carte possibili', creato_il: adesso },
        { nome: 'Vecchia correzione', errore_msg: 'non trovata', creato_il: vecchia },
      ],
    },
    // Il Supabase finto dà lo stesso conteggio a ogni conteggio di coda_carte (in attesa, in
    // corso, di cui wishlist): qui 1.
    conta: { coda_carte: 1 },
  });
  const d = w.document;
  controlla('app.html parte senza errori', errori.length === 0, errori);
  controlla('nessuna colonna wishlist', !d.querySelector('.column[data-sezione="wishlist"]'));
  controlla('nessun bottone verso #wishlist', !d.querySelector('[data-vai-a="wishlist"]'));
  // Dalla 5.46 la home è "Adesso" con tre tessere: i numeri di prima (barre,
  // "di cui wishlist", "Tue carte da sistemare") stanno solo in "Coda del gruppo".
  const [maj, min] = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version.split('.').map(Number);
  const dalla546 = maj > 5 || (maj === 5 && min >= 46);
  const dettaglio = ((d.getElementById('codaPendenteDettaglioBody') || {}).textContent || '').replace(/\s+/g, ' ');
  const piatto = dalla546 ? dettaglio : ((d.getElementById('codaPendentePrincipaleBody') || {}).textContent || '').replace(/\s+/g, ' ');
  controlla('home: riga "di cui wishlist" 1 in attesa · 1 in corso', /di cui wishlist 1 in attesa · 1 in corso/.test(piatto), piatto.slice(0, 400));
  controlla('home: "Tue carte da sistemare" 2', /Tue carte da sistemare 2 \(dal sito\)/.test(piatto), piatto.slice(0, 400));
  controlla('home: niente più riga "Wishlist" a parte', !/\bWishlist \d+ in attesa/.test(piatto));
  controlla('dettaglio: errore recente dalle correzioni', /Celebi errore nuovo/.test(dettaglio) && !/Vecchia correzione/.test(dettaglio), dettaglio.slice(0, 600));
  controlla('dettaglio: righe wishlist etichettate', /Mewtwo Carta · Wishlist|Mewtwo\s*In attesa\s*Carta · Wishlist/.test(dettaglio), dettaglio.slice(0, 600));
  // Errori recenti dalle correzioni, mai da coda_carte con stato 'errore'. Dalla 5.46
  // coda_carte si legge anche con .gte (carte fatte oggi da questo PC, stato 'completato').
  const statiLetti = env.log.chiamate.filter(c => c.tabella === 'coda_carte' && c.metodo === 'eq' && c.args[0] === 'stato').map(c => c.args[1]);
  controlla('hub: legge correzioni_manuali_carte, non coda_carte stato errore', env.log.from.includes('correzioni_manuali_carte.select') && !statiLetti.includes('errore') && (dalla546 || !env.log.from.includes('coda_carte.gte')), statiLetti);
  if (dalla546) {
    uguale('tessera "Da sistemare": 2 e badge 2', [d.getElementById('tileFixNum').textContent, d.getElementById('tileFixBadge').textContent, d.getElementById('tileFixBadge').hidden], ['2', '2', false]);
    controlla('tessera "Da sistemare": tipo di problema dal testo', /più versioni|non trovate/.test(d.getElementById('tileFixSotto').textContent), d.getElementById('tileFixSotto').textContent);
    // Il Supabase finto dà 1 a ogni conteggio: in attesa 1 + in corso 1 = 2, di cui 1 tue.
    uguale('tessera Coda e numero nella barra', [d.getElementById('tileCodaNum').textContent, d.getElementById('navContaCoda').textContent], ['2', '2']);
    controlla('tessera Coda: tue e del gruppo', /1 tua · 1 del gruppo/.test(d.getElementById('tileCodaSotto').textContent), d.getElementById('tileCodaSotto').textContent);
    controlla('barra in alto: Home attiva, Esci nel menu', d.querySelector('.nav-voce.attiva') && d.querySelector('.nav-voce.attiva').dataset.nav === 'coda' && !!d.getElementById('menuEsci'));
    const conLink = ['app.html', 'popup.html', 'aggiungi_carta_popup.html', 'changelog.html']
      .filter(f => /(href|src)="https:\/\/(fonts\.googleapis|fonts\.gstatic|cdnjs)/.test(fs.readFileSync(path.join(EXT, f), 'utf8')));
    uguale('niente Google Fonts né cdnjs nelle pagine (D13)', conLink, []);
  }
  w.close();

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
