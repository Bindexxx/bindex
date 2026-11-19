// Un solo accesso con il sito (dalla 5.83):
// - service worker: CARDSYNC_STATO_ACCESSO, CARDSYNC_ACCEDI_CON_BIGLIETTO, CARDSYNC_DAMMI_BIGLIETTO e
//   CARDSYNC_ESCI solo dalle pagine di /bindex/; con il biglietto si entra solo da fuori (mai sopra un
//   account, neanche lo stesso: niente verifyOtp), con una sessione propria (verifyOtp con token_hash),
//   ora dell'accesso salvata e pagine avvisate; il biglietto per il sito solo da dentro e solo per
//   l'account di qui; "Esci" dal sito fa uscire solo lo stesso account; interruttore spento = niente;
//   due richieste insieme = un solo accesso; l'ultimo account entrato resta (PC usati da più persone);
// - pagine (auth_ui.js): accesso a mano → ora dell'accesso; "Esci" → uscita ricordata (non con
//   l'interruttore spento); avviso del background → la pagina si ricarica, un iframe no;
// - app: interruttore "Un solo accesso con il sito" nel menu Impostazioni, acceso di serie.
// Sulla 5.82 fallisce (i messaggi nuovi sono sconosciuti).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { creaAmbiente } = require('./lib/chrome-finto');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const attendi = (ms) => new Promise(r => setTimeout(r, ms));
const PAGINA_SITO = 'https://bindexxx.github.io/bindex/index.html';
const IO = { id: 'u-io', email: 'io@test.local' };
const ALTRO = { id: 'u-altro', email: 'altro@test.local' };
const TIPI_NUOVI = ['CARDSYNC_STATO_ACCESSO', 'CARDSYNC_ACCEDI_CON_BIGLIETTO', 'CARDSYNC_DAMMI_BIGLIETTO', 'CARDSYNC_ESCI'];

// Auth finta con uno stato: sessione di adesso, biglietti buoni una volta, chiamate registrate.
function authFinta(utenteIniziale) {
  const st = { sessione: null, biglietti: new Map(), chiamate: [], prossimoUtenteBiglietto: null };
  const entra = (u) => { st.sessione = { access_token: 'at-' + u.id, refresh_token: 'rt-' + st.chiamate.length, user: { id: u.id, email: u.email } }; };
  if (utenteIniziale) entra(utenteIniziale);
  const bigliettoPer = (u) => {
    const b = String(st.biglietti.size + 1).padStart(56, 'a');
    st.biglietti.set(b, u);
    return b;
  };
  const auth = {
    getSession: async () => ({ data: { session: st.sessione }, error: null }),
    verifyOtp: async (p) => {
      st.chiamate.push(['verifyOtp', p]);
      const u = st.biglietti.get(p.token_hash);
      if (!u) return { data: { session: null, user: null }, error: { message: 'Token has expired or is invalid' } };
      st.biglietti.delete(p.token_hash);
      entra(u);
      return { data: { session: st.sessione, user: st.sessione.user }, error: null };
    },
    signOut: async (o) => { st.chiamate.push(['signOut', o]); st.sessione = null; return { error: null }; },
    signInWithPassword: async ({ email }) => {
      st.chiamate.push(['signInWithPassword', email]);
      entra({ id: 'u-' + email.split('@')[0], email });
      return { data: { session: st.sessione, user: st.sessione.user }, error: null };
    },
  };
  const functions = {
    invoke: async (nome) => {
      st.chiamate.push(['invoke', nome]);
      if (!st.sessione) return { data: null, error: { message: 'Edge Function returned a non-2xx status code' } };
      const u = st.prossimoUtenteBiglietto || st.sessione.user;
      return { data: { ok: true, biglietto: bigliettoPer(u), tipo: 'magiclink', userId: u.id }, error: null };
    },
  };
  return { st, auth, functions, bigliettoPer };
}

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log('Estensione provata:', EXT, '(' + versione + ')\n');

  const sw = (store, utente) => {
    const finta = authFinta(utente);
    const b = caricaBackground({ version: versione, store: { nomeDispositivo: 'PC-PROVA', ...store }, auth: finta.auth, functions: finta.functions });
    const esterno = (msg, url = PAGINA_SITO) => new Promise((res) => {
      let risposta = 'nessuna risposta';
      // url null: mittente senza indirizzo
      b.env.listeners.onMessageExternal.forEach(f => f(msg, url ? { url, origin: new URL(url).origin } : {}, (r) => { risposta = r; }));
      setTimeout(() => res(risposta), 150);
    });
    const chiamate = (tipo) => finta.st.chiamate.filter(c => c[0] === tipo);
    const avvisi = () => b.env.log.messaggi.filter(m => m === 'CARDSYNC_ACCESSO_CAMBIATO').length;
    return { ...b, finta, esterno, chiamate, avvisi };
  };
  const tutti = [];
  const nuovo = (store, utente) => { const x = sw(store, utente); tutti.push(x); return x; };

  // ── stato per il sito ──
  {
    const a = nuovo({ cardsyncAccessoDal: { userId: IO.id, quando: 1000 } }, IO);
    uguale('stato: dentro, con l\'ora dell\'accesso', await a.esterno({ type: 'CARDSYNC_STATO_ACCESSO' }),
      { ok: true, attivo: true, userId: IO.id, nome: 'io', accessoDal: 1000, uscita: null, ultimoUtente: IO.id });
    uguale('stato: l\'account di adesso resta come ultimo entrato', a.env.store.cardsyncUltimoUtente, IO.id);
    const b = nuovo({ cardsyncAccessoDal: { userId: ALTRO.id, quando: 1000 }, cardsyncUscitaVolontaria: { userId: ALTRO.id, quando: 2000 } }, IO);
    uguale('stato: l\'ora di un altro account non conta, l\'uscita si dice', await b.esterno({ type: 'CARDSYNC_STATO_ACCESSO' }),
      { ok: true, attivo: true, userId: IO.id, nome: 'io', accessoDal: 0, uscita: { userId: ALTRO.id, quando: 2000 }, ultimoUtente: IO.id });
    const c = nuovo({}, null);
    uguale('stato: fuori, mai entrato nessuno', await c.esterno({ type: 'CARDSYNC_STATO_ACCESSO' }),
      { ok: true, attivo: true, userId: null, nome: null, accessoDal: 0, uscita: null, ultimoUtente: null });
    const c2 = nuovo({ cardsyncUltimoUtente: ALTRO.id }, null);
    uguale('stato: fuori, l\'ultimo account entrato qui si dice (il sito non fa entrare un altro)', await c2.esterno({ type: 'CARDSYNC_STATO_ACCESSO' }),
      { ok: true, attivo: true, userId: null, nome: null, accessoDal: 0, uscita: null, ultimoUtente: ALTRO.id });
    const d = nuovo({ accessoUnicoSito: false }, IO);
    uguale('stato: interruttore spento (il sito non fa niente)', await d.esterno({ type: 'CARDSYNC_STATO_ACCESSO' }), { ok: true, attivo: false });
  }

  // ── solo dalle pagine di /bindex/ ──
  {
    const a = nuovo({}, null);
    const b = a.finta.bigliettoPer(IO);
    const risposte = [];
    for (const url of ['https://evil.example/bindex/', 'https://bindexxx.github.io/altro/', 'https://bindexxx.github.io/bindexfalso/', 'https://www.cardmarket.com/it/Pokemon', null]) {
      for (const type of TIPI_NUOVI) risposte.push(await a.esterno({ type, biglietto: b, tipo: 'magiclink', userId: IO.id }, url));
    }
    controlla('altri mittenti: tutti respinti', risposte.every(r => r && r.ok === false && r.errore === 'mittente non ammesso'), risposte);
    controlla('altri mittenti: niente accesso, biglietti o uscite',
      a.chiamate('verifyOtp').length + a.chiamate('invoke').length + a.chiamate('signOut').length === 0 && !a.finta.st.sessione);
  }

  // ── entrare con il biglietto del sito ──
  {
    const a = nuovo({ cardsyncUscitaVolontaria: { userId: IO.id, quando: 5 } }, null);
    const b = a.finta.bigliettoPer(IO);
    const prima = Date.now();
    uguale('biglietto dal sito: dentro', await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b, tipo: 'magiclink', userId: IO.id }),
      { ok: true, userId: IO.id, nome: 'io' });
    uguale('biglietto: verifyOtp con token_hash e tipo, una volta', a.chiamate('verifyOtp').map(c => c[1]), [{ token_hash: b, type: 'magiclink' }]);
    controlla('biglietto: sessione dell\'estensione', a.finta.st.sessione && a.finta.st.sessione.user.id === IO.id);
    const dal = a.env.store.cardsyncAccessoDal;
    controlla('biglietto: ora dell\'accesso salvata', dal && dal.userId === IO.id && dal.quando >= prima, dal);
    controlla('biglietto: la vecchia uscita non vale più', !('cardsyncUscitaVolontaria' in a.env.store));
    uguale('biglietto: ultimo account entrato', a.env.store.cardsyncUltimoUtente, IO.id);
    uguale('biglietto: pagine dell\'estensione avvisate una volta', a.avvisi(), 1);
    const b2 = a.finta.bigliettoPer(IO);
    uguale('di nuovo con lo stesso account: niente, senza verifyOtp',
      [await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b2, tipo: 'magiclink', userId: IO.id }), a.chiamate('verifyOtp').length, a.avvisi()],
      [{ ok: false, errore: 'già dentro' }, 1, 1]);
  }
  {
    const a = nuovo({}, ALTRO);
    const b = a.finta.bigliettoPer(IO);
    uguale('dentro con un altro account: niente sopra, resta quello',
      [await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b, tipo: 'magiclink', userId: IO.id }), a.chiamate('verifyOtp').length, a.finta.st.sessione.user.id, a.avvisi()],
      [{ ok: false, errore: 'altro account' }, 0, ALTRO.id, 0]);
  }
  {
    const a = nuovo({}, null);
    uguale('biglietto storto: respinto senza verifyOtp',
      [await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: 'x"; drop', userId: IO.id }), a.chiamate('verifyOtp').length],
      [{ ok: false, errore: 'biglietto non valido' }, 0]);
    const r = await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: 'c'.repeat(56), tipo: 'magiclink', userId: IO.id });
    controlla('biglietto già usato o scaduto: resta fuori, nessun avviso', r && r.ok === false && !a.finta.st.sessione && a.avvisi() === 0, r);
    const altro = a.finta.bigliettoPer(ALTRO);
    uguale('biglietto di un altro account: fuori subito',
      [await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: altro, tipo: 'magiclink', userId: IO.id }), a.finta.st.sessione, a.chiamate('signOut').length, 'cardsyncAccessoDal' in a.env.store],
      [{ ok: false, errore: 'account diverso' }, null, 1, false]);
  }
  {
    const a = nuovo({ accessoUnicoSito: false }, null);
    const b = a.finta.bigliettoPer(IO);
    uguale('interruttore spento: il biglietto non entra',
      [await a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b, tipo: 'magiclink', userId: IO.id }), a.chiamate('verifyOtp').length, a.finta.st.sessione],
      [{ ok: false, errore: 'spento' }, 0, null]);
  }
  {
    const a = nuovo({}, null);
    const b1 = a.finta.bigliettoPer(IO), b2 = a.finta.bigliettoPer(IO);
    const [r1, r2] = await Promise.all([
      a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b1, tipo: 'magiclink', userId: IO.id }),
      a.esterno({ type: 'CARDSYNC_ACCEDI_CON_BIGLIETTO', biglietto: b2, tipo: 'magiclink', userId: IO.id }),
    ]);
    uguale('due schede del sito insieme: un solo accesso', [r1 && r1.ok, r2 && r2.errore, a.chiamate('verifyOtp').length, a.avvisi()], [true, 'già dentro', 1, 1]);
  }

  // ── biglietto per il sito ──
  {
    const a = nuovo({}, IO);
    const r = await a.esterno({ type: 'CARDSYNC_DAMMI_BIGLIETTO' });
    controlla('biglietto per il sito: dalla funzione biglietto-accesso, con l\'account di qui',
      r && r.ok === true && typeof r.biglietto === 'string' && r.userId === IO.id && r.nome === 'io' && r.tipo === 'magiclink'
        && a.chiamate('invoke').map(c => c[1]).join() === 'biglietto-accesso', r);
    controlla('biglietto per il sito: è un biglietto buono per il sito', r && a.finta.st.biglietti.has(r.biglietto));
    controlla('biglietto per il sito: l\'estensione resta dentro', a.finta.st.sessione && a.finta.st.sessione.user.id === IO.id && a.chiamate('signOut').length === 0);
    const fuori = nuovo({}, null);
    uguale('biglietto da fuori: no, la funzione non si chiama', [await fuori.esterno({ type: 'CARDSYNC_DAMMI_BIGLIETTO' }), fuori.chiamate('invoke').length], [{ ok: false, errore: 'fuori' }, 0]);
    const spento = nuovo({ accessoUnicoSito: false }, IO);
    uguale('biglietto con l\'interruttore spento: no', [await spento.esterno({ type: 'CARDSYNC_DAMMI_BIGLIETTO' }), spento.chiamate('invoke').length], [{ ok: false, errore: 'spento' }, 0]);
    const strano = nuovo({}, IO);
    strano.finta.st.prossimoUtenteBiglietto = ALTRO;
    const r2 = await strano.esterno({ type: 'CARDSYNC_DAMMI_BIGLIETTO' });
    controlla('biglietto di un altro account dalla funzione: al sito non arriva', r2 && r2.ok === false && !r2.biglietto, r2);
  }

  // ── "Esci" premuto sul sito ──
  {
    const a = nuovo({ cardsyncAccessoDal: { userId: IO.id, quando: 1 } }, IO);
    const prima = Date.now();
    uguale('Esci dal sito, stesso account: esce anche l\'estensione',
      [await a.esterno({ type: 'CARDSYNC_ESCI', userId: IO.id }), a.finta.st.sessione, a.chiamate('signOut').map(c => c[1])],
      [{ ok: true, uscito: true }, null, [{ scope: 'local' }]]);
    const u = a.env.store.cardsyncUscitaVolontaria;
    controlla('Esci dal sito: uscita ricordata', u && u.userId === IO.id && u.quando >= prima, u);
    uguale('Esci dal sito: pagine dell\'estensione avvisate', a.avvisi(), 1);
    const b = nuovo({}, ALTRO);
    uguale('Esci dal sito, account diverso: l\'estensione resta',
      [await b.esterno({ type: 'CARDSYNC_ESCI', userId: IO.id }), b.finta.st.sessione.user.id, b.chiamate('signOut').length, 'cardsyncUscitaVolontaria' in b.env.store],
      [{ ok: true, uscito: false }, ALTRO.id, 0, false]);
    const c = nuovo({}, null);
    uguale('Esci dal sito, estensione già fuori: niente', [await c.esterno({ type: 'CARDSYNC_ESCI', userId: IO.id }), c.chiamate('signOut').length], [{ ok: true, uscito: false }, 0]);
    const d = nuovo({ accessoUnicoSito: false }, IO);
    uguale('Esci dal sito, interruttore spento: l\'estensione resta',
      [await d.esterno({ type: 'CARDSYNC_ESCI', userId: IO.id }), d.finta.st.sessione && d.finta.st.sessione.user.id], [{ ok: false, errore: 'spento' }, IO.id]);
    const e = nuovo({}, IO);
    uguale('Esci senza dire l\'account: niente', [await e.esterno({ type: 'CARDSYNC_ESCI' }), e.chiamate('signOut').length], [{ ok: true, uscito: false }, 0]);
  }

  // ── messaggi di prima ──
  {
    const a = nuovo({}, IO);
    uguale('tipo sconosciuto come prima', await a.esterno({ type: 'CARDSYNC_QUALCOSA' }), { ok: false, errore: 'tipo sconosciuto' });
    uguale('i nomi di Object non sono messaggi', [await a.esterno({ type: 'constructor' }), await a.esterno({ type: '__proto__' }), await a.esterno({ type: 'hasOwnProperty' })],
      [{ ok: false, errore: 'tipo sconosciuto' }, { ok: false, errore: 'tipo sconosciuto' }, { ok: false, errore: 'tipo sconosciuto' }]);
    uguale('GET_UTENTE come prima', await a.esterno({ type: 'CARDSYNC_GET_UTENTE' }), { ok: true, userId: IO.id, nome: 'io' });
  }
  await attendi(1200);
  const erroriSw = tutti.flatMap(x => x.env.log.errori);
  controlla('service worker: nessun errore', erroriSw.length === 0, erroriSw.slice(0, 5));

  // ── pagine: auth_ui.js ──
  const pagina = (store, utente, { iframe = false } = {}) => {
    const finta = authFinta(utente);
    const env = creaAmbiente({ version: versione, store, auth: finta.auth, functions: finta.functions, dati: { profiles: [] } });
    const ricariche = [], errori = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => {
      const m = String(e.message || e);
      if (/Not implemented: navigation/.test(m)) ricariche.push(m); else errori.push(m.slice(0, 200));
    });
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'chrome-extension://fake/app.html', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
    });
    let w = dom.window;
    if (iframe) {
      const f = w.document.createElement('iframe');
      w.document.body.appendChild(f);
      w = f.contentWindow;
    }
    w.chrome = env.chrome; w.supabase = env.supabase;
    w.fetch = async () => ({ ok: true, status: 200, text: async () => versione, json: async () => ({}), headers: { get: () => null } });
    w.confirm = () => true; w.alert = () => {};
    w.addEventListener('error', (e) => errori.push('error: ' + e.message));
    for (const s of ['supabase_adapter.js', 'auth_ui.js']) {
      const el = w.document.createElement('script');
      el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
      w.document.body.appendChild(el);
    }
    const avvisa = (type) => env.listeners.onMessage.forEach(f => f({ type }, {}, () => {}));
    return { w, env, finta, ricariche, errori, avvisa, chiamate: (tipo) => finta.st.chiamate.filter(c => c[0] === tipo) };
  };
  {
    const p = pagina({ cardsyncAccessoDal: { userId: IO.id, quando: 1 } }, IO);
    const prima = Date.now();
    await p.w.logoutSupabase();
    await attendi(20);
    const u = p.env.store.cardsyncUscitaVolontaria;
    controlla('"Esci" nell\'estensione: uscita ricordata per il sito', u && u.userId === IO.id && u.quando >= prima, u);
    uguale('"Esci" nell\'estensione: solo questa sessione, poi la pagina si ricarica', [p.chiamate('signOut').map(c => c[1]), p.ricariche.length], [[{ scope: 'local' }], 1]);
    const spento = pagina({ accessoUnicoSito: false }, IO);
    await spento.w.logoutSupabase();
    await attendi(20);
    uguale('"Esci" con l\'interruttore spento: esce, ma niente uscita per il sito',
      [spento.chiamate('signOut').length, 'cardsyncUscitaVolontaria' in spento.env.store, spento.ricariche.length], [1, false, 1]);
  }
  {
    const p = pagina({ cardsyncUscitaVolontaria: { userId: IO.id, quando: 5 } }, null);
    p.w.assicuraLoginSupabase();
    await attendi(100);
    const d = p.w.document;
    const campo = d.getElementById('cardsync-auth-email');
    controlla('fuori: c\'è il riquadro di accesso', !!campo);
    if (campo) {
      campo.value = 'io';
      d.getElementById('cardsync-auth-password').value = 'segreta';
      const prima = Date.now();
      d.getElementById('cardsync-auth-submit').click();
      await attendi(100);
      const dal = p.env.store.cardsyncAccessoDal;
      controlla('accesso a mano nell\'estensione: ora dell\'accesso salvata', dal && dal.userId === IO.id && dal.quando >= prima, dal);
      controlla('accesso a mano: la vecchia uscita non vale più', !('cardsyncUscitaVolontaria' in p.env.store));
      uguale('accesso a mano: ultimo account entrato', p.env.store.cardsyncUltimoUtente, IO.id);
    }
  }
  {
    const p = pagina({}, IO);
    p.avvisa('CARDSYNC_QUALCOSA');
    await attendi(20);
    uguale('pagina: un altro messaggio non la ricarica', p.ricariche.length, 0);
    p.avvisa('CARDSYNC_ACCESSO_CAMBIATO');
    await attendi(20);
    uguale('pagina: accesso cambiato dal background → si ricarica', p.ricariche.length, 1);
    const f = pagina({}, IO, { iframe: true });
    f.avvisa('CARDSYNC_ACCESSO_CAMBIATO');
    await attendi(20);
    uguale('iframe dell\'app: non si ricarica da solo (riparte con l\'app)', f.ricariche.length, 0);
    const erroriPagine = [p, f].flatMap(x => x.errori);
    controlla('pagine: nessun errore', erroriPagine.length === 0, erroriPagine);
  }

  // ── app: interruttore nel menu Impostazioni ──
  {
    const carica = (store) => {
      const env = creaAmbiente({ version: versione, store: { selectedTheme: 'default', statoLoginCardmarket: { loggato: true, quando: Date.now() }, ...store } });
      env.listeners.onMessage.push((msg, sender, sendResponse) => {
        if (msg && msg.type === 'CARDSYNC_VERSIONE_MOTORE') { sendResponse({ motore: versione }); return false; }
        if (msg && msg.type === 'CM_ACCESSO_CONTROLLA') { sendResponse({ stato: 'ok' }); return false; }
        return false;
      });
      const html = fs.readFileSync(path.join(EXT, 'app.html'), 'utf8');
      const vc = new VirtualConsole();
      const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
        url: 'chrome-extension://fake/app.html?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
      });
      const w = dom.window;
      w.chrome = env.chrome; w.supabase = env.supabase;
      w.fetch = async () => ({ ok: true, status: 200, text: async () => versione, json: async () => ({}), headers: { get: () => null } });
      w.confirm = () => false; w.alert = () => {};
      for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
        if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
        const el = w.document.createElement('script');
        el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
        w.document.body.appendChild(el);
      }
      return { w, env };
    };
    const a = carica({});
    await attendi(300);
    const el = a.w.document.getElementById('hubAccessoUnico');
    const riga = el && el.closest('.options-row');
    controlla('menu Impostazioni: "Un solo accesso con il sito" tra le impostazioni di questo PC',
      !!riga && /Un solo accesso con il sito/.test(riga.textContent) && !!a.w.document.getElementById('hubApriConIlSito'));
    uguale('interruttore acceso di serie', el && el.checked, true);
    if (el) {
      el.checked = false;
      el.dispatchEvent(new a.w.Event('change'));
      await attendi(20);
      uguale('spento dal menu: salvato su questo PC', a.env.store.accessoUnicoSito, false);
    }
    const b = carica({ accessoUnicoSito: false });
    await attendi(300);
    const el2 = b.w.document.getElementById('hubAccessoUnico');
    uguale('spento prima: il menu lo mostra spento', el2 && el2.checked, false);
    a.w.close(); b.w.close();
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
