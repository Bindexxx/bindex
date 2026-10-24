// Chrome e Supabase finti per caricare i file dell'estensione fuori da Chrome.
// Registrano le chiamate, non fanno rete.
function creaAmbiente(opts = {}) {
  const log = { alarms: [], errori: [], messaggi: [], tabs: [], rpc: [], from: [] };
  const store = opts.store || {};
  const listeners = { onMessage: [], onMessageExternal: [], onAlarm: [], onChanged: [] };
  let nextTab = 100;
  const tabs = new Map();
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
    alarms: {
      create: (name, info) => log.alarms.push({ name, info, t: Date.now() }),
      clear: () => Promise.resolve(true), get: () => Promise.resolve(null), getAll: () => Promise.resolve([]),
      onAlarm: ev(listeners.onAlarm),
    },
    tabs: {
      query: (q, cb) => cbOrPromise([...tabs.values()].filter(t => !q.url || t.url.startsWith(q.url.replace('*', ''))), cb),
      create: (p, cb) => { const t = { id: nextTab++, url: p.url, windowId: 1, status: 'complete' }; tabs.set(t.id, t); log.tabs.push(['create', p.url]); return cbOrPromise(t, cb); },
      update: (id, p, cb) => { const t = tabs.get(id); if (t && p.url) t.url = p.url; log.tabs.push(['update', id, p.url]); return cbOrPromise(t, cb); },
      remove: (id, cb) => { tabs.delete(id); log.tabs.push(['remove', id]); return cbOrPromise(undefined, cb); },
      get: (id, cb) => cbOrPromise(tabs.get(id), cb),
      getCurrent: (cb) => cbOrPromise(undefined, cb),
      sendMessage: () => Promise.resolve(),
      onUpdated: ev([]), onRemoved: ev([]),
    },
    windows: { update: (i, p, cb) => cbOrPromise({}, cb), getAll: () => Promise.resolve([{ id: 1, focused: true }]) },
    scripting: { executeScript: (o, cb) => cbOrPromise([{ result: undefined }], cb) },
    declarativeNetRequest: { updateDynamicRules: () => Promise.resolve() },
    offscreen: { createDocument: () => Promise.resolve() },
    action: { onClicked: ev([]) },
  };
  const qb = (tabella) => {
    const q = { _t: tabella };
    const chain = ['select', 'eq', 'neq', 'in', 'or', 'not', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range', 'update', 'insert', 'delete', 'is', 'maybeSingle', 'single', 'upsert'];
    chain.forEach(m => { q[m] = (...a) => { log.from.push(tabella + '.' + m); return q; }; });
    q.then = (res, rej) => Promise.resolve({ data: opts.dati && opts.dati[tabella] ? opts.dati[tabella] : [], error: null, count: 0 }).then(res, rej);
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
      rpc: (nome, args) => { log.rpc.push(nome); return Promise.resolve({ data: opts.rpc && opts.rpc[nome] !== undefined ? opts.rpc[nome] : null, error: null }); },
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (n) => ({ data: { publicUrl: 'https://x/' + n } }) }) },
    }),
  };
  return { chrome, supabase, log, store, listeners, tabs };
}
module.exports = { creaAmbiente };
