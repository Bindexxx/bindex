// Coda "Aggiungi carte" e dati delle carte (dalla 5.39, Fase 3 del piano):
// 1) pagina vera (aggiungi_carta_popup.html) con il service worker finto:
//    - niente pannello correzioni: una carta del sito con più versioni va SUBITO in
//      correzione (sposta_riga_in_correzione_manuale, senza "dopo 3 tentativi");
//    - una carta scritta a mano non risolta va tra le tue correzioni sul sito;
//    - prezzo mancante riletto PRIMA di salvare (una sola scrittura, col prezzo);
//    - location: quella del campo per le carte a mano (nome già esistente con
//      maiuscole diverse → si usa quello), mai per le carte del sito;
//    - Reset: le righe del sito tornano libere subito.
// 2) adapter: tipo 'carta', movimento per le carte a mano, location dalla tabella.
// 3) popup.js: lingue/condizioni con alias → l'URL non si riscrive a ogni controllo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const SINGLES = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

// Service worker finto: risponde ai messaggi della pagina come background.js.
function swFinto(registro) {
  return (msg, sender, sendResponse) => {
    if (!msg || !msg.type) return false;
    const rispondi = (r, ms = 30) => { setTimeout(() => sendResponse(r), ms); return true; };
    switch (msg.type) {
      case 'VERIFICA_LOGIN_SILENZIOSA': return rispondi({ loggato: true });
      case 'PRECEDENZA_CODA_CARDMARKET': return rispondi({ ok: true, attendi: false });
      case 'PING_RICHIESTA': return rispondi({ attiva: true });
      case 'CONVERTI_IMMAGINE': return rispondi({ immagine: null });
      case 'LEGGI_NOME_CARTA': {
        registro.letture.push(msg.urlNome);
        const q = decodeURIComponent((msg.urlNome.split('searchString=')[1] || '').replace(/\+/g, ' ')).toUpperCase();
        if (q.startsWith('AMBIGUA')) {
          return rispondi({ nome: null, codice: null, prezzo: null, urlSingles: null, disambiguation: true,
            opzioni: [{ label: 'Versione A', urlSingles: SINGLES + 'Set/Versione-A' }, { label: 'Versione B', urlSingles: SINGLES + 'Set/Versione-B' }] });
        }
        if (q.startsWith('SENZAPREZZO')) return rispondi({ nome: 'Senza Prezzo', codice: 'SNP 3', prezzo: null, urlSingles: SINGLES + 'Set/Senza-Prezzo-SNP3' });
        return rispondi({ nome: 'Carta ' + q, codice: q, prezzo: 1.23, urlSingles: SINGLES + 'Set/Carta-' + q.replace(/\s+/g, '-') });
      }
      case 'LEGGI_SOLO_PREZZO': registro.soloPrezzo.push(msg.urlConFiltri); return rispondi({ prezzo: 4.56, immagine: null, nome: null, codice: null });
      case 'AGGIUNGI_CARTA': registro.scritture.push(msg); return rispondi({ ok: true, riga: 'r' + registro.scritture.length });
      default: return false;
    }
  };
}

async function apriPagina({ dati, location }) {
  const registro = { letture: [], soloPrezzo: [], scritture: [], adapter: [] };
  const env = creaAmbiente({
    store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderPausaOgni: 4, sliderRicontrollo: 1, sliderCfTimeout: 1, aiutaGruppo: true },
    dati, inoltraA: [swFinto(registro)],
  });
  const html = fs.readFileSync(path.join(EXT, 'aggiungi_carta_popup.html'), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/aggiungi_carta_popup.html?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
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
  // Accesso sempre valido; location del sito finte (chiamaSupabase è dell'adapter).
  w.verificaAccessoValido = async () => true;
  const esistenti = location || [];
  const chiamaVero = w.chiamaSupabase;
  w.chiamaSupabase = async (azione, payload) => {
    registro.adapter.push({ azione, payload });
    if (azione === 'elencaLocationTab') return { ok: true, location: esistenti.slice() };
    if (azione === 'aggiungiLocationTab') {
      const uguale = esistenti.find(n => n.toLowerCase() === String(payload.nome).toLowerCase());
      if (uguale) return { ok: true, giaEsistente: true, nome: uguale };
      esistenti.push(payload.nome);
      return { ok: true, giaEsistente: false, nome: payload.nome };
    }
    return chiamaVero(azione, payload);
  };
  return { w, env, registro, errori };
}

function scriviRiga(w, testo, location) {
  const d = w.document;
  if (location !== undefined) d.getElementById('inputLocation').value = location;
  const inputs = d.querySelectorAll('#tbodyCarte tr.riga-nuova td input[type=text]');
  const input = inputs[0];
  input.value = testo;
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

async function finisce(registro, n, maxMs) {
  const t0 = Date.now();
  while (registro.letture.length + 0 < n && Date.now() - t0 < maxMs) await attendi(200);
  await attendi(3500); // ultima scrittura e attese della coda
}

(async () => {
  console.log('Estensione provata:', EXT, '\n');

  // ── 1a) Carte scritte a mano ──
  {
    const { w, env, registro, errori } = await apriPagina({ dati: {}, location: ['BULK'] });
    await attendi(600);
    const d = w.document;
    controlla('niente pannello correzioni nella pagina', !d.getElementById('pannelloCorrezione') && !d.getElementById('cardCorrezione'));
    controlla('avviso "carte da sistemare" presente', !!d.getElementById('cardCorrezioni') && !!d.getElementById('linkCorrezioniSito'));

    scriviRiga(w, 'OK 1', 'bulk');
    scriviRiga(w, 'AMBIGUA 2', 'Nuova Loc');
    scriviRiga(w, 'SENZAPREZZO 3', 'bulk');
    await finisce(registro, 3, 40000);
    await attendi(12000); // rilettura del prezzo dopo 10 s (slider minimo)

    const scrittaOk = registro.scritture.find(m => m.rigaDati && m.rigaDati.C === 'OK 1');
    uguale('a mano: location già esistente con maiuscole diverse → "BULK"', scrittaOk && scrittaOk.rigaDati.D, 'BULK');
    const locNuove = registro.adapter.filter(a => a.azione === 'aggiungiLocationTab').map(a => [a.payload.nome, a.payload.tipo]);
    controlla('a mano: location nuova creata sul sito con tipo carta', locNuove.some(([n, t]) => n === 'Nuova Loc' && t === 'carta'), locNuove);
    const correzione = env.log.chiamate.find(c => c.tabella === 'correzioni_manuali_carte' && c.metodo === 'insert');
    const riga = correzione && correzione.args[0];
    controlla('a mano: carta ambigua tra le tue correzioni, con le versioni e la location',
      !!riga && riga.nome === 'AMBIGUA 2' && riga.owner_id === 'u-me' && Array.isArray(riga.opzioni_disambiguazione) && riga.opzioni_disambiguazione.length === 2 && riga.location === 'Nuova Loc',
      riga || env.log.chiamate.filter(c => c.tabella === 'correzioni_manuali_carte'));
    const scritteSnp = registro.scritture.filter(m => m.rigaDati && /SNP/.test(m.rigaDati.C));
    uguale('prezzo mancante: una sola scrittura, col prezzo riletto', scritteSnp.map(m => m.rigaDati.I), [4.56]);
    controlla('prezzo mancante: riletto dalla pagina della carta con i filtri', registro.soloPrezzo.length === 1 && /Senza-Prezzo-SNP3\?language=5&minCondition=2/.test(registro.soloPrezzo[0]), registro.soloPrezzo);
    controlla('nessun ricontrollo dopo il salvataggio (azione aggiornaPrezzo tolta)', !registro.scritture.some(m => m.azione === 'aggiornaPrezzo'));
    controlla('pagina senza errori', errori.length === 0, errori);

    // Reset: le righe del sito ancora in coda tornano libere (solo se ancora mie).
    env.log.chiamate.length = 0;
    w._rilasciaRigheDb([501, 502]);
    await attendi(100);
    const upd = env.log.chiamate.filter(c => c.tabella === 'coda_carte');
    controlla('reset: righe del sito rimesse "pending" per gli altri PC',
      upd.some(c => c.metodo === 'update' && c.args[0].stato === 'pending' && c.args[0].claimed_by === null)
      && upd.some(c => c.metodo === 'in' && JSON.stringify(c.args) === JSON.stringify(['id', [501, 502]]))
      && upd.some(c => c.metodo === 'eq' && c.args[0] === 'stato' && c.args[1] === 'in_corso'), upd.map(c => c.metodo));
    const codiceReset = fs.readFileSync(path.join(EXT, 'aggiungi_carta_popup.js'), 'utf8');
    controlla('reset: il bottone chiama il rilascio', /btnReset[\s\S]{0,1500}_rilasciaRigheDb\(/.test(codiceReset));
    w.close();
  }

  // ── 1b) Carte arrivate dal sito ──
  {
    let giri = 0;
    const rigaAmbigua = { id: 77, nome: 'AMBIGUA SITO', lingua: 'IT', condizione: 'NM', qty: 1, stato: 'pending', owner_id: 'u-altro', location: null, tentativi_falliti: 0, destinazione: 'collezione', creato_il: new Date().toISOString() };
    const rigaMia = { id: 78, nome: 'MIA 9', lingua: 'IT', condizione: 'NM', qty: 1, stato: 'pending', owner_id: 'u-me', location: null, tentativi_falliti: 0, destinazione: 'collezione', creato_il: new Date().toISOString() };
    const dati = { get coda_carte() { giri++; return giri <= 2 ? [rigaAmbigua] : (giri <= 4 ? [rigaMia] : []); } };
    const { w, env, registro, errori } = await apriPagina({ dati, location: ['BULK'] });
    w.document.getElementById('inputLocation').value = 'BULK';
    await finisce(registro, 2, 30000);
    const sposta = env.log.chiamate.find(c => c.rpc === 'sposta_riga_in_correzione_manuale');
    controlla('sito: carta con più versioni subito in correzione (al primo tentativo)',
      !!sposta && sposta.args.p_riga_id === 77 && Array.isArray(sposta.args.p_opzioni) && !/dopo/.test(sposta.args.p_errore_msg), sposta && sposta.args);
    const mia = registro.scritture.find(m => m.dbRigaId === 78);
    uguale('sito: la location del campo di questo PC non finisce sulla carta', mia && mia.rigaDati.D, '');
    controlla('pagina senza errori (righe del sito)', errori.length === 0, errori);
    w.close();
  }

  // ── 2) Adapter ──
  {
    const chiamate = [];
    const locTabella = [{ nome: 'BULK' }];
    const q = (tabella) => {
      const stato = { tabella, op: 'select', filtri: [] };
      const o = {};
      ['select', 'eq', 'order', 'not', 'in', 'limit'].forEach(m => { o[m] = (...a) => { stato.filtri.push([m, ...a]); return o; }; });
      o.insert = (r) => { stato.op = 'insert'; stato.riga = r; chiamate.push({ tabella, op: 'insert', riga: r }); return o; };
      o.single = () => o;
      o.then = (res, rej) => {
        if (stato.op === 'select') chiamate.push({ tabella, op: 'select', filtri: stato.filtri });
        const data = stato.op === 'insert' ? { id: 'nuova' } : (tabella === 'location' ? locTabella : []);
        return Promise.resolve({ data, error: null }).then(res, rej);
      };
      return o;
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u-io' } } } }) },
      rpc: async (nome, args) => { chiamate.push({ rpc: nome, args }); return { data: 'id-coda', error: null }; },
      from: q,
    };
    const ctx = { console, setTimeout, Promise, Date, JSON, Math, String, Number, Array, Object, Error, isNaN,
      supabase: { createClient: () => client },
      chrome: { runtime: { getManifest: () => ({ version: '9.99' }) }, storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => cb && cb(), remove: (k, cb) => cb && cb() } } },
      fetch: async () => ({ ok: true, text: async () => '0.0' }) };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(EXT, 'supabase_adapter.js'), 'utf8'), ctx);
    const rigaDati = { B: 'Mew', C: 'MEW 151', D: 'BULK', E: 1, F: 'IT', G: 'NM', H: SINGLES + 'Set/Mew', I: 2.5, K: '' };

    await ctx.chiamaSupabase('aggiungi', { rigaDati, dbRigaId: 5 });
    const comp = chiamate.find(c => c.rpc === 'completa_riga_coda_carte');
    uguale('adapter: carta dalla coda con tipo "carta" (non più null)', comp && comp.args.p_tipo, 'carta');

    chiamate.length = 0;
    await ctx.chiamaSupabase('aggiungi', { rigaDati });
    const insCarta = chiamate.find(c => c.tabella === 'carte' && c.op === 'insert');
    const mov = chiamate.find(c => c.tabella === 'movimenti_collezione' && c.op === 'insert');
    uguale('adapter: carta a mano con tipo "carta"', insCarta && insCarta.riga.tipo, 'carta');
    controlla('adapter: carta a mano con il suo movimento (Variazione valore)',
      !!mov && mov.riga.tipo_evento === 'aggiunta' && mov.riga.oggetto_id === 'nuova' && mov.riga.valore_delta === 2.5 && mov.riga.fonte === 'estensione', mov && mov.riga);

    chiamate.length = 0;
    const g = await ctx.chiamaSupabase('aggiungiLocationTab', { nome: 'bulk', tipo: 'carta' });
    controlla('adapter: location con maiuscole diverse → quella esistente, nessun doppione', g.ok && g.giaEsistente && g.nome === 'BULK' && !chiamate.some(c => c.op === 'insert'), g);
    const n = await ctx.chiamaSupabase('aggiungiLocationTab', { nome: 'Nuova', tipo: 'carta' });
    const insLoc = chiamate.find(c => c.tabella === 'location' && c.op === 'insert');
    controlla('adapter: location nuova creata con il tipo', n.ok && !n.giaEsistente && insLoc && insLoc.riga.tipo === 'carta' && insLoc.riga.nome === 'Nuova', insLoc);

    chiamate.length = 0;
    const el = await ctx.chiamaSupabase('elencaLocation', {});
    const sel = chiamate.find(c => c.op === 'select');
    controlla('adapter: la tendina di Prezzi legge la tabella location (tipo carta)',
      el.ok && sel && sel.tabella === 'location' && sel.filtri.some(f => f[0] === 'eq' && f[1] === 'tipo' && f[2] === 'carta'), sel);
    const r = await ctx.chiamaSupabase('aggiornaPrezzo', { riga: 'x', prezzo: 1 });
    controlla('adapter: azione aggiornaPrezzo tolta', r.ok === false);
  }

  // ── 3) Lingue e condizioni: una sola mappa ──
  {
    const ctx = { URL, URLSearchParams, console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'), ctx);
    const popup = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
    const estrai = (nome) => { const i = popup.indexOf('function ' + nome + '('); return popup.slice(i, popup.indexOf('\n}\n', i) + 2); };
    vm.runInContext(estrai('costruisciUrlFiltrato') + '\n' + estrai('urlHaTuttiParametri') + '\nthis.urlHaTuttiParametri = urlHaTuttiParametri; this.costruisci = costruisciUrlFiltrato;', ctx);
    const base = SINGLES + 'Set/Carta-1';
    const casi = [
      ['CIN', 'NM', base + '?language=6&minCondition=2', true],
      ['CIN', 'NM', base + '?minCondition=2', false],
      ['?', '?', base, true],
      ['', '', base, true],
      ['IT', 'EXC', base + '?language=5&minCondition=3', true],
      ['IT', 'POOR', base + '?language=5&minCondition=7', true],
      ['IT', 'NM', base + '?idLanguage=5&minCondition=2', false],
      ['EN', 'NM', base + '?language=10&minCondition=2', false],
    ];
    for (const [lingua, cond, url, atteso] of casi) {
      uguale(`URL ${lingua || '(vuota)'}/${cond || '(vuota)'} ${url.split('?')[1] || '(senza filtri)'} → ${atteso ? 'già giusto' : 'da riscrivere'}`, ctx.urlHaTuttiParametri(url, lingua, cond), atteso);
    }
    // Dopo una riscrittura l'URL risulta giusto: niente riscritture a ogni controllo.
    const riscritti = casi.map(([l, c, u]) => ctx.urlHaTuttiParametri(ctx.costruisci(u, l, c), l, c));
    controlla('URL riscritto una volta → poi sempre giusto (tutti i casi)', riscritti.every(Boolean), riscritti);
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
