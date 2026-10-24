// Chrome e Supabase finti per caricare i file dell'estensione fuori da Chrome.
// Registrano le chiamate, non fanno rete.
function creaAmbiente(opts = {}) {
  const log = { alarms: [], errori: [], messaggi: [], tabs: [], rpc: [], from: [], chiamate: [] };
  const store = opts.store || {};
  const listeners = { onMessage: [], onMessageExternal: [], onAlarm: [], onChanged: [], onUpdated: [] };
  let nextTab = 100;
  const tabs = new Map();
  const sveglie = new Map(opts.sveglie ? opts.sveglie.map(a => [a.name, a]) : []);
  const ev = (arr) => ({ addListener: (f) => arr.push(f), removeListener: (f) => { const i = arr.indexOf(f); if (i >= 0) arr.splice(i, 1); } });
  const cbOrPromise = (val, cb) => { if (typeof cb === 'function') { setTimeout(() => cb(val), 0); return undefined; } return Promise.resolve(val); };
  const storage = {
    local: {
      get: (keys, cb) => {
        let out = {};
        if (keys == null) out = { ...store };
        else if (typeof keys === 'string') { if (keys in store) out[keys] = store[keys]; }
        else if (Array.isArray(keys)) keys.forEach(k => { if (k in store) out[k] = store[k]; });
        else Object.keys(keys).forEach(k => { out[k] = k in store ? store[k] : keys[k]; });
        return cbOrPromise(JSON.parse(JSON.stringify(out)), cb);
      },
      set: (obj, cb) => {
        const changes = {};
        Object.entries(obj).forEach(([k, v]) => { changes[k] = { oldValue: store[k], newValue: v }; store[k] = v; });
        listeners.onChanged.forEach(f => { try { f(changes, 'local'); } catch (e) { log.errori.push('onChanged: ' + e.message); } });
        return cbOrPromise(undefined, cb);
      },
      remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete store[k]); return cbOrPromise(undefined, cb); },
    },
    session: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
    onChanged: ev(listeners.onChanged),
  };
  // ── schede su pagine finte (opts.pagine, opts.rimandi) ──
  const finestre = new Map(); // url → window jsdom
  function urlFinale(url) { let u = url; for (let i = 0; i < 5 && opts.rimandi && opts.rimandi[u]; i++) u = opts.rimandi[u]; return u; }
  function htmlPer(url) {
    if (!opts.pagine) return null;
    return opts.pagine[url] ?? opts.pagine[url.split('?')[0]] ?? null;
  }
  function finestraPer(url) {
    if (finestre.has(url)) return finestre.get(url);
    const html = htmlPer(url);
    if (html == null) return null;
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const w = dom.window;
    Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; } });
    w.scrollTo = () => {};
    if (opts.sharedJs) w.eval(opts.sharedJs);
    finestre.set(url, w);
    return w;
  }
  function naviga(t, url) {
    const finale = urlFinale(url);
    t.url = finale; t.status = 'loading';
    if (!opts.pagine) { t.status = 'complete'; return; }
    setTimeout(() => {
      t.status = 'complete';
      listeners.onUpdated.forEach(f => { try { f(t.id, { status: 'complete' }, t); } catch (e) { log.errori.push('onUpdated: ' + e.message); } });
    }, 30);
  }
  const chrome = {
    runtime: {
      id: 'fake',
      lastError: undefined,
      getURL: (p) => 'chrome-extension://fake/' + p,
      getManifest: () => ({ version: opts.version || '5.35' }),
      getPlatformInfo: () => Promise.resolve({ os: 'win' }),
      getContexts: () => Promise.resolve([]),
      reload: () => log.messaggi.push('RELOAD'),
      onMessage: ev(listeners.onMessage),
      onMessageExternal: ev(listeners.onMessageExternal),
      onStartup: ev([]), onSuspend: ev([]), onInstalled: ev([]),
      sendMessage: (...args) => {
        const msg = typeof args[0] === 'string' ? args[1] : args[0];
        const cb = args.find((a, i) => i > 0 && typeof a === 'function');
        log.messaggi.push(msg && msg.type);
        let risposto = false; let async = false;
        const sendResponse = (r) => { if (risposto) return; risposto = true; if (cb) setTimeout(() => cb(r), 0); };
        (opts.inoltraA || listeners.onMessage).forEach(f => { try { if (f(msg, { tab: null }, sendResponse) === true) async = true; } catch (e) { log.errori.push('onMessage: ' + e.message); } });
        if (!async && !risposto && cb) setTimeout(() => cb(undefined), 0);
        return cb ? undefined : Promise.resolve();
      },
    },
    storage,
    // Sveglie: registro come in Chrome (dalla 5.40 l'estensione le crea solo se mancano).
    alarms: {
      create: (name, info) => { log.alarms.push({ name, info, t: Date.now() }); sveglie.set(name, { name, ...(info || {}) }); },
      clear: (name) => Promise.resolve(sveglie.delete(name)),
      get: (name) => Promise.resolve(sveglie.get(name)),
      getAll: () => Promise.resolve([...sveglie.values()]),
      onAlarm: ev(listeners.onAlarm),
    },
    tabs: {
      query: (q, cb) => cbOrPromise([...tabs.values()].filter(t => !q.url || t.url.startsWith(q.url.replace('*', ''))), cb),
      create: (p, cb) => { const t = { id: nextTab++, url: p.url, windowId: 1, status: 'complete' }; tabs.set(t.id, t); log.tabs.push(['create', p.url]); naviga(t, p.url); return cbOrPromise(t, cb); },
      update: (id, p, cb) => { const t = tabs.get(id); if (t && p.url) naviga(t, p.url); log.tabs.push(['update', id, p.url]); return cbOrPromise(t, cb); },
      remove: (id, cb) => { tabs.delete(id); log.tabs.push(['remove', id]); return cbOrPromise(undefined, cb); },
      get: (id, cb) => cbOrPromise(tabs.get(id), cb),
      getCurrent: (cb) => cbOrPromise(undefined, cb),
      sendMessage: () => Promise.resolve(),
      onUpdated: ev(listeners.onUpdated), onRemoved: ev([]),
    },
    windows: { update: (i, p, cb) => cbOrPromise({}, cb), getAll: () => Promise.resolve([{ id: 1, focused: true }]) },
    // Con opts.pagine (url → html) gli script iniettati girano davvero su una pagina finta
    // (jsdom), con shared.js caricato come su Cardmarket. Senza: risultato vuoto.
    scripting: {
      executeScript: (o, cb) => {
        const esegui = async () => {
          const t = tabs.get(o.target && o.target.tabId);
          if (!opts.pagine || !t || !o.func) return [{ result: undefined }];
          const w = finestraPer(t.url);
          if (!w) return [{ result: undefined }];
          const fn = w.eval('(' + o.func.toString() + ')');
          const result = await fn.apply(null, o.args || []);
          return [{ result: result === undefined ? undefined : JSON.parse(JSON.stringify(result)) }];
        };
        const p = esegui().catch(e => { log.errori.push('executeScript: ' + e.message); return [{ result: undefined }]; });
        if (typeof cb === 'function') { p.then(r => cb(r)); return undefined; }
        return p;
      },
    },
    declarativeNetRequest: { updateDynamicRules: () => Promise.resolve() },
    offscreen: { createDocument: () => Promise.resolve() },
    action: { onClicked: ev([]) },
  };
  const qb = (tabella) => {
    const q = { _t: tabella };
    const chain = ['select', 'eq', 'neq', 'in', 'or', 'not', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range', 'update', 'insert', 'delete', 'is', 'maybeSingle', 'single', 'upsert'];
    chain.forEach(m => { q[m] = (...a) => { log.from.push(tabella + '.' + m); log.chiamate.push({ tabella, metodo: m, args: a }); return q; }; });
    q.then = (res, rej) => {
      const righe = opts.dati ? opts.dati[tabella] : undefined; // letto una volta sola (opts.dati può avere getter)
      return Promise.resolve({ data: righe || [], error: null, count: opts.conta && opts.conta[tabella] !== undefined ? opts.conta[tabella] : 0 }).then(res, rej);
    };
    return q;
  };
  const sessione = opts.loggato === false ? null : { access_token: 't', user: { id: 'u-me', email: 'utente@test.local' } };
  const supabase = {
    createClient: () => ({
      auth: {
        getSession: () => Promise.resolve({ data: { session: sessione }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: () => Promise.resolve({}), signInWithPassword: () => Promise.resolve({ data: { session: sessione }, error: null }),
      },
      from: qb,
      rpc: (nome, args) => { log.rpc.push(nome); log.chiamate.push({ rpc: nome, args }); return Promise.resolve({ data: opts.rpc && opts.rpc[nome] !== undefined ? opts.rpc[nome] : null, error: null }); },
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (n) => ({ data: { publicUrl: 'https://x/' + n } }) }) },
    }),
  };
  return { chrome, supabase, log, store, listeners, tabs, sveglie };
}
module.exports = { creaAmbiente };
