// Uscita da Cardmarket (dalla 5.68):
// service worker:
//   - "dentro" vale 5 minuti: più vecchio → controllo in una scheda nascosta (prima valeva 6 ore);
//   - una pagina "fuori" dopo una "dentro" si scrive subito (prima al massimo una volta al minuto);
//   - coda autonoma: con "dentro" vecchio controlla prima di prendere la carta; fuori durante la
//     lettura → la carta torna in coda senza essere salvata.
// content.js: su una pagina "fuori" non legge il prezzo, dice FUORI_DA_CARDMARKET.
// popup.js: scheda "fuori" → la sessione si ferma, la carta non si salva, l'ordine torna in attesa.
// aggiungi_carta_popup.js: fuori durante una carta → la carta resta in coda, niente scrittura;
//   di nuovo dentro → la coda riparte da sola.
// app.js: pallino "connesso" solo per 5 minuti, poi "da verificare".
// dalla 5.69: "Esci" premuto su Cardmarket in una scheda qualsiasi → fuori (webRequest, solo l'indirizzo).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const CM_HOME = CM + '/it/Pokemon';
const B = CM + '/it/Pokemon/Products/Singles/';
const SINGLES = B;
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const MIN = 60 * 1000;
const DENTRO = '<html><head><title>Cardmarket</title></head><body><div id="account-dropdown">io</div></body></html>';
const FUORI = '<html><head><title>Cardmarket</title></head><body><div id="login-signup">Accedi</div></body></html>';
const riga = (lingua, prezzo) => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span></div>
  <div class="price-container"><span class="fw-bold">${prezzo} €</span></div>
  <a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
const cartaCon = (testata) => `<html><head><title>Zubat | Cardmarket</title></head><body>${testata}
  <h1>Zubat <span>Silver Tempest</span>(SIT 103)</h1>${riga('Italiano', '0,10')}</body></html>`;
const CARTA_DENTRO = cartaCon('<a id="account-dropdown">utente</a>');
const CARTA_FUORI = cartaCon('<div id="login-signup"><div class="cf-turnstile"></div></div>');

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
  return { w, errori: errori };
}
const senzaRumore = (errori) => errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 68) { console.log(`Versione ${versione}: prova dalla 5.68, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  const interno = (env, msg) => new Promise((res) => {
    let fatto = false;
    env.listeners.onMessage.forEach(f => f(msg, { tab: null }, (r) => { if (!fatto) { fatto = true; res(r); } }));
    setTimeout(() => { if (!fatto) res('nessuna risposta'); }, 15000);
  });
  const schedeCm = (env) => env.log.tabs.filter(t => t[0] === 'create' && /cardmarket/.test(t[1])).length;

  // ── service worker: "dentro" vale 5 minuti ──
  {
    const { env } = caricaBackground({ version: versione, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() - 3 * MIN } } });
    const r = await interno(env, { type: 'CM_ACCESSO_CONTROLLA' });
    uguale('dentro da 3 minuti: ok senza aprire Cardmarket', [r && r.stato, schedeCm(env)], ['ok', 0]);
  }
  for (const [nome, msg] of [['app (CM_ACCESSO_CONTROLLA)', { type: 'CM_ACCESSO_CONTROLLA' }], ['partenza automatica (VERIFICA_LOGIN_AUTOMATICA)', { type: 'VERIFICA_LOGIN_AUTOMATICA' }], ['Avvia (VERIFICA_LOGIN_SILENZIOSA)', { type: 'VERIFICA_LOGIN_SILENZIOSA' }]]) {
    const { env } = caricaBackground({ version: versione, accelera: 10, pagine: { [CM_HOME]: FUORI }, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() - 10 * MIN } } });
    const r = await interno(env, msg);
    const esito = r && (r.stato || (r.loggato === true ? 'ok' : r.loggato === false ? 'ko' : r.loggato));
    uguale(`dentro da 10 minuti, ${nome}: si controlla in una scheda nascosta e risulta fuori`, [esito, schedeCm(env), env.store.statoLoginCardmarket.loggato], ['ko', 1, false]);
  }

  // ── dalla 5.69: "Esci" premuto su Cardmarket in una scheda qualsiasi ──
  if (maj > 5 || (maj === 5 && min >= 69)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
    controlla('manifest: permesso webRequest (solo per vedere "Esci")', manifest.permissions.includes('webRequest'), manifest.permissions);
    const { env } = caricaBackground({ version: versione, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const ascolti = env.listeners.webRequest;
    uguale('webRequest: ascolta rimando e risposta, solo l\'indirizzo di uscita di Cardmarket', ascolti.map(a => [a[0], a[2].urls]),
      [['onBeforeRedirect', ['https://www.cardmarket.com/*/PostGetAction/User_Logout*']], ['onCompleted', ['https://www.cardmarket.com/*/PostGetAction/User_Logout*']]]);
    const invia = (url) => ascolti.filter(a => a[0] === 'onBeforeRedirect').forEach(a => a[1]({ url, method: 'GET', type: 'main_frame', statusCode: 302 }));
    invia(CM + '/it/Pokemon/Products/Singles/Silver-Tempest/Zubat-SIT103');
    invia(CM + '/it/Pokemon/PostGetAction/User_Login');
    uguale('webRequest: altre pagine e "Accedi" non cambiano niente', env.store.statoLoginCardmarket.loggato, true);
    invia(CM + '/it/Pokemon/PostGetAction/User_Logout');
    uguale('webRequest: "Esci" (/it/Pokemon) → fuori', env.store.statoLoginCardmarket.loggato, false);
    await env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: true, quando: Date.now() } });
    invia(CM + '/en/Magic/PostGetAction/User_Logout');
    uguale('webRequest: "Esci" in un\'altra lingua e gioco (/en/Magic) → fuori', env.store.statoLoginCardmarket.loggato, false);
    controlla('webRequest: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── service worker: "fuori" dopo "dentro" si scrive subito ──
  {
    const U1 = B + 'Silver-Tempest/Zubat-SIT103?language=5';
    const U2 = B + 'Silver-Tempest/Zubat-SIT103?language=5&x=2';
    const { ctx, env } = caricaBackground({ version: versione, pagine: { [U1]: CARTA_DENTRO, [U2]: CARTA_FUORI } });
    await ctx._leggiPrezzoDaSingles(U1, null, null);
    uguale('pagina "dentro": stato dentro', env.store.statoLoginCardmarket && env.store.statoLoginCardmarket.loggato, true);
    await ctx._leggiPrezzoDaSingles(U2, null, null);
    uguale('pagina "fuori" pochi secondi dopo: stato fuori subito (non dopo un minuto)', env.store.statoLoginCardmarket && env.store.statoLoginCardmarket.loggato, false);
    controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── coda autonoma ──
  const rigaCoda = { id: 'c1', owner_id: 'u-me', nome: 'Zubat SIT 103', stato: 'pending', creato_il: '2026-11-18T10:00:00Z', tipo: 'carta', claimed_by: 'u-me' };
  {
    const { ctx, env } = caricaBackground({ version: versione, accelera: 10, pagine: { [CM_HOME]: FUORI }, dati: { coda_carte: [rigaCoda] },
      store: { aiutaGruppo: true, sliderDelayMinSec: 1, sliderDelayMaxSec: 1, statoLoginCardmarket: { loggato: true, quando: Date.now() - 10 * MIN } } });
    const esito = await ctx._lavoraUnaCartaAutonoma();
    const prese = env.log.chiamate.filter(c => c.tabella === 'coda_carte' && c.metodo === 'update');
    uguale('coda autonoma, dentro da 10 minuti e fuori: controlla, non prende la carta', [esito, schedeCm(env), prese.length], ['cardmarket-non-collegato', 1, 0]);
  }
  {
    const { ctx, env } = caricaBackground({ version: versione, dati: { coda_carte: [rigaCoda] },
      store: { aiutaGruppo: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    let scritte = 0;
    ctx._aggiungiConVerifica = async () => { scritte++; return { ok: true }; };
    ctx._leggiNomeDaCardmarket = async () => {
      // la pagina letta dice "fuori"
      await env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: false, quando: Date.now() } });
      return { urlSingles: B + 'Silver-Tempest/Zubat-SIT103', nome: 'Zubat', codice: 'SIT 103', prezzo: 0.1, immagine: null };
    };
    await ctx._risolviRigaCodaCarteAutonoma(rigaCoda);
    const aggiornamenti = env.log.chiamate.filter(c => c.tabella === 'coda_carte' && c.metodo === 'update').map(c => c.args[0]);
    uguale('coda autonoma, fuori durante la lettura: carta non salvata e rimessa in coda', [scritte, aggiornamenti.map(a => a.stato)], [0, ['pending']]);
    uguale('coda autonoma: dopo l\'uscita il giro non prende altre carte', await ctx._lavoraUnaCartaAutonoma(), 'cardmarket-non-collegato');
    controlla('coda autonoma: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── content.js su una pagina "fuori" ──
  {
    const codice = fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
    const leggi = async (html) => {
      const mandati = [];
      const dom = new JSDOM(html, { url: B + 'Silver-Tempest/Zubat-SIT103?language=5', runScripts: 'outside-only' });
      const w = dom.window;
      w.chrome = { runtime: { sendMessage: (m, cb) => { mandati.push(m); if (typeof cb === 'function') cb(); }, lastError: undefined } };
      Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; } });
      w.eval(codice);
      await attendi(500);
      w.close();
      return mandati.map(m => m.type + (m.prezzo !== undefined ? ':' + m.prezzo : '') + (m.loggato !== undefined ? ':' + m.loggato : ''));
    };
    uguale('content.js, pagina fuori: niente prezzo, FUORI_DA_CARDMARKET', await leggi(CARTA_FUORI), ['STATO_LOGIN_CARDMARKET:false', 'FUORI_DA_CARDMARKET']);
    uguale('content.js, pagina dentro: prezzo come prima', await leggi(CARTA_DENTRO), ['STATO_LOGIN_CARDMARKET:true', 'PREZZO_TROVATO:0.1']);
  }

  // ── popup.js: scheda vera del controllo prezzi su una pagina "fuori" ──
  {
    const URL_CARTA = B + 'Silver-Tempest/Zubat-SIT103?language=5&minCondition=2';
    const sw = caricaBackground({ version: versione, pagine: { [URL_CARTA]: CARTA_FUORI }, store: { statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(500);
    const esito = await w.apriTabEAspettaPrezzo(URL_CARTA, 1);
    uguale('popup.js, scheda fuori: lettura chiusa come "FuoriCardmarket", stato fuori', [esito, sw.env.store.statoLoginCardmarket.loggato], ['FuoriCardmarket', false]);
    controlla('popup.js, scheda fuori: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── popup.js: ordine dal sito, uscita alla seconda carta ──
  {
    const sw = caricaBackground({ version: versione, store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, aiutaGruppo: false, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(900);
    const d = w.document;
    // fino alla 5.72 le attese erano anche nella pagina; dalla 5.73 solo nel menu (store)
    if (d.getElementById('sliderDelayMin')) d.getElementById('sliderDelayMin').value = '1';
    if (d.getElementById('sliderDelayMax')) d.getElementById('sliderDelayMax').value = '1';
    const pagine = [];
    w.apriTabEAspettaPrezzo = async (url) => {
      pagine.push(url);
      await attendi(50);
      // alla seconda carta la pagina dice "fuori" (come content.js e il service worker)
      if (pagine.length === 2) await sw.env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: false, quando: Date.now() } });
      return { prezzo: 2.5, nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null };
    };
    const prezzi = [];
    w.chiamaSupabase = async (azione, payload) => {
      if (azione === 'leggi') return payload.soloConta ? { ok: true, totale: 3 } : { ok: true, carte: [1, 2, 3].map(i => ({ rigaSheet: 'c' + i, urlBase: B + 'Test/Carta-' + i, lingua: 'IT', condizione: 'NM', codice: 'TST ' + i, nome: 'Carta', prezzoPrecedente: 1.5, ownerId: 'u-me' })) };
      if (azione === 'aggiornaPrezzoRiga') prezzi.push(payload.riga);
      return { ok: true };
    };
    await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-1', tipo: 'controlla_prezzi', parametri: { locations: [] }, creatoDa: 'u-me', messoIl: Date.now() } });
    await w._avviaAutorunSeRichiesto();
    const ordini = sw.env.log.chiamate.filter(c => c.tabella === 'ordini' && c.metodo === 'update').map(c => c.args[0]);
    uguale('ordine, fuori alla seconda carta: si ferma (2 pagine), salvata solo la prima', [pagine.length, prezzi], [2, ['c1']]);
    uguale('ordine, fuori: torna in attesa per un altro PC, non completato', ordini.map(o => o.stato), ['pending']);
    controlla('ordine, fuori: il messaggio lo dice', /uscito da Cardmarket/.test(d.getElementById('status').textContent), d.getElementById('status').textContent);
    controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0 && sw.env.log.errori.length === 0, { e: senzaRumore(errori), sw: sw.env.log.errori });
    w.close();
  }

  // ── coda "Aggiungi carte": fuori durante una carta, poi di nuovo dentro ──
  // fino alla 5.71 la carta si scrive a mano; dalla 5.72 arriva dal sito (coda_carte)
  {
    const dalla572 = maj > 5 || (maj === 5 && min >= 72);
    const codaSito = dalla572 ? [{ id: 31, nome: 'ZUBAT SIT 103', lingua: 'IT', condizione: 'NM', qty: 1, stato: 'pending', owner_id: 'u-me', location: 'BULK', tentativi_falliti: 0, destinazione: 'collezione', creato_il: new Date().toISOString() }] : [];
    const registro = { letture: 0, scritture: 0 };
    let env = null;
    const sw = (msg, sender, sendResponse) => {
      if (!msg || !msg.type) return false;
      const rispondi = (r, ms = 30) => { setTimeout(() => sendResponse(r), ms); return true; };
      switch (msg.type) {
        case 'VERIFICA_LOGIN_SILENZIOSA': return rispondi({ loggato: true });
        case 'PRECEDENZA_CODA_CARDMARKET': return rispondi({ ok: true, attendi: false });
        case 'PING_RICHIESTA': return rispondi({ attiva: true });
        case 'CONVERTI_IMMAGINE': return rispondi({ immagine: null });
        case 'LEGGI_NOME_CARTA':
          registro.letture++;
          if (registro.letture === 1) env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: false, quando: Date.now() } });
          return rispondi({ nome: 'Zubat', codice: 'SIT 103', prezzo: 0.1, urlSingles: SINGLES + 'Silver-Tempest/Zubat-SIT103' });
        case 'AGGIUNGI_CARTA': {
          registro.scritture++;
          const i = codaSito.findIndex(r => r.id === msg.dbRigaId);
          if (i >= 0) codaSito.splice(i, 1);
          return rispondi({ ok: true, riga: 'r' + registro.scritture });
        }
        default: return false;
      }
    };
    env = creaAmbiente({ store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderRicontrollo: 0, aiutaGruppo: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } }, dati: { get coda_carte() { return codaSito.slice(); } }, inoltraA: [sw] });
    const { w, errori } = caricaPagina('aggiungi_carta_popup.html', env);
    w.verificaAccessoValido = async () => true;
    const chiamaVero = w.chiamaSupabase;
    w.chiamaSupabase = async (azione, payload) => (azione === 'elencaLocationTab' ? { ok: true, location: ['BULK'] } : azione === 'aggiungiLocationTab' ? { ok: true, giaEsistente: true, nome: 'BULK' } : chiamaVero(azione, payload));
    await attendi(600);
    const d = w.document;
    if (!dalla572) {
      d.getElementById('inputLocation').value = 'BULK';
      const input = d.querySelectorAll('#tbodyCarte tr.riga-nuova td input[type=text]')[0];
      input.value = 'zubat sit 103';
      input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    for (let i = 0; i < 60 && registro.letture < 1; i++) await attendi(100);
    await attendi(800);
    uguale('coda, fuori durante la carta: niente scrittura, la carta resta in coda', [registro.letture, registro.scritture, w.eval('_codaInvio.length')], [1, 0, 1]);
    controlla('coda, fuori: il messaggio lo dice', /uscito da Cardmarket/.test(d.getElementById('status').textContent), d.getElementById('status').textContent);
    // di nuovo dentro: la coda riparte da sola
    await env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: true, quando: Date.now() } });
    for (let i = 0; i < 80 && registro.scritture < 1; i++) await attendi(100);
    for (let i = 0; i < 60 && w.eval('_bulkAttivo'); i++) await attendi(100);
    uguale('coda, di nuovo dentro: riparte da sola e salva la carta', [registro.letture, registro.scritture, w.eval('_codaInvio.length')], [2, 1, 0]);
    controlla('pagina Coda: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── app.js: pallino ──
  for (const [nome, quando] of [['dentro da 1 minuto', Date.now() - 1 * MIN], ['dentro da 10 minuti', Date.now() - 10 * MIN]]) {
    const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando } } });
    let controlli = 0;
    env.listeners.onMessage.push((msg, sender, sendResponse) => {
      if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
      if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') {
        controlli++;
        // come il service worker: stato ricordato se recente, altrimenti scheda nascosta che dice "dentro"
        // (dalla 5.74 l'app chiede sempre il controllo forzato: scheda nascosta anche se recente)
        setTimeout(async () => {
          if (msg.forza || Date.now() - quando >= 5 * MIN) await env.chrome.storage.local.set({ statoLoginCardmarket: { loggato: true, quando: Date.now() } });
          sendResponse({ stato: 'ok' });
        }, 400);
        return true;
      }
      return false;
    });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(150);
    const pill = () => w.document.querySelector('#statoCardmarket span').textContent;
    const prima = pill();
    await attendi(900);
    if (quando > Date.now() - 5 * MIN) {
      uguale(`app, ${nome}: pallino "connesso" e nessuna finestra di blocco`, [prima, pill(), w.document.getElementById('cmBlocco').hidden], ['Cardmarket connesso', 'Cardmarket connesso', true]);
    } else {
      uguale(`app, ${nome}: all'apertura "da verificare", poi controllo vero e "connesso"`, [prima, controlli, pill(), w.document.getElementById('cmBlocco').hidden], ['Cardmarket da verificare', 1, 'Cardmarket connesso', true]);
    }
    uguale(`app, ${nome}: un "dentro" di 6 minuti fa vale "da verificare"`, w.eval('_cmStatoDaSalvato({ loggato: true, quando: Date.now() - 6 * 60 * 1000 })'), 'ignoto');
    controlla(`app, ${nome}: nessun errore`, senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
