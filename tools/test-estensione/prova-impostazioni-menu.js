// Impostazioni solo nel menu dell'app (dalla 5.73, estensione più snella, rilascio 3):
// - Prezzi e Coda senza ingranaggio, "Altre opzioni", campi delle impostazioni, Novità e
//   "Segnala un caterpie" (sono nel menu dell'app);
// - menu dell'app: la voce si chiama "Impostazioni" e ha anche "Prezzi non letti di fila prima
//   di fermarsi" e "Mantienimi loggato"; il ripristino rimette anche i prezzi non letti a 5;
// - Prezzi usa le impostazioni salvate (attese, Cloudflare, prezzi non letti) e le aggiorna
//   quando cambiano nel menu.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
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
const TOLTI = ['gearBtn', 'settingsPanel', 'btnAltreOpzioni', 'changelogLink', 'bugReportLink', 'sliderDelayMin', 'sliderDelayMax',
  'sliderCfTimeout', 'sliderMaxNd', 'sliderPausaOgni', 'sliderRicontrollo', 'avvisoSonoro', 'mantieniAccessoEstensione', 'btnResetDefaults'];

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 73) { console.log(`Versione ${versione}: prova dalla 5.73, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // ── Prezzi e Coda: niente impostazioni nella pagina ──
  for (const file of ['popup.html', 'aggiungi_carta_popup.html']) {
    const html = fs.readFileSync(path.join(EXT, file), 'utf8');
    uguale(`${file}: niente ingranaggio, impostazioni, Novità e Segnala nella pagina`, TOLTI.filter(id => html.includes(`id="${id}"`)), []);
  }

  // ── menu dell'app ──
  {
    const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', sliderMaxNd: 3, cardsyncMantieniAccessoEstensione: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    env.listeners.onMessage.push((msg, sender, sendResponse) => {
      if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
      if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { sendResponse({ stato: 'ok' }); return false; }
      return false;
    });
    const { w, errori } = caricaPagina('app.html', env);
    await attendi(400);
    const d = w.document;
    uguale('menu: la voce si chiama "Impostazioni"', d.getElementById('navImpostazioniAvanzate').textContent.trim(), 'Impostazioni');
    uguale('menu: "Prezzi non letti di fila" letto dalle impostazioni salvate', [d.getElementById('hubSliderMaxNd').value, d.getElementById('hubValMaxNd').textContent], ['3', '3']);
    const maxNd = d.getElementById('hubSliderMaxNd');
    maxNd.value = '8';
    maxNd.dispatchEvent(new w.Event('input'));
    uguale('menu: cambiare "Prezzi non letti di fila" lo salva', [env.store.sliderMaxNd, d.getElementById('hubValMaxNd').textContent], [8, '8']);
    const mantieni = d.getElementById('hubMantieniAccesso');
    uguale('menu: "Mantienimi loggato" acceso come salvato', mantieni.checked, true);
    mantieni.checked = false;
    mantieni.dispatchEvent(new w.Event('change'));
    uguale('menu: spegnere "Mantienimi loggato" lo salva', env.store.cardsyncMantieniAccessoEstensione, false);
    d.getElementById('hubBtnResetComportamento').click();
    uguale('menu: "Ripristina" rimette anche i prezzi non letti a 5', [env.store.sliderMaxNd, d.getElementById('hubSliderMaxNd').value], [5, '5']);
    await env.chrome.storage.local.set({ sliderMaxNd: 6 });
    uguale('menu: si aggiorna se il valore cambia altrove', d.getElementById('hubSliderMaxNd').value, '6');
    await attendi(500); // letture delle impostazioni ancora in corso nella pagina
    controlla('menu: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── Prezzi usa le impostazioni salvate ──
  {
    const sw = caricaBackground({ version: versione, store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderCfTimeout: 7, sliderMaxNd: 4, aiutaGruppo: false, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(900);
    uguale('Prezzi: impostazioni lette da quelle salvate', [w.eval('_imp.sliderCfTimeout'), w.eval('_imp.sliderMaxNd'), w.eval('_imp.sliderDelayMinSec')], [7, 4, 1]);
    await sw.env.chrome.storage.local.set({ sliderMaxNd: 9, sliderCfTimeout: 2 });
    uguale('Prezzi: cambiate nel menu → aggiornate subito', [w.eval('_imp.sliderMaxNd'), w.eval('_imp.sliderCfTimeout')], [9, 2]);
    const cfUsati = [];
    w.apriTabEAspettaPrezzo = async (url, cf) => { cfUsati.push(cf); await attendi(30); return { prezzo: 2, nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null }; };
    let letta = false;
    w.chiamaSupabase = async (azione, payload) => {
      if (azione === 'leggi') {
        if (payload.soloConta) return { ok: true, totale: 1 };
        if (letta) return { ok: true, carte: [] };
        letta = true;
        return { ok: true, carte: [{ rigaSheet: 'c1', urlBase: B + 'Test/Carta-1', lingua: 'IT', condizione: 'NM', codice: 'TST', nome: 'Carta', prezzoPrecedente: 1, ownerId: 'u-me' }] };
      }
      return { ok: true };
    };
    await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-imp', tipo: 'controlla_prezzi', parametri: {}, creatoDa: 'u-me', messoIl: Date.now() } });
    await w._avviaAutorunSeRichiesto();
    uguale('Prezzi: un controllo usa l\'attesa su Cloudflare del menu', cfUsati, [2]);
    controlla('Prezzi: nessun errore', senzaRumore(errori).length === 0 && sw.env.log.errori.length === 0, { e: senzaRumore(errori), sw: sw.env.log.errori });
    w.close();
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
