// Iniettato in ogni pagina/iframe prima degli script dell'estensione (solo per
// le schermate locali): chrome.* e supabase finti, utente loggato, dati di esempio.
(() => {
  const K = '__fake_store__';
  const leggi = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (_) { return {}; } };
  const scrivi = (s) => localStorage.setItem(K, JSON.stringify(s));
  if (!localStorage.getItem(K)) scrivi({ aiutaGruppo: true, sliderDelayMinSec: 10, sliderDelayMaxSec: 20, bulkLocation: 'BULK GIALLO', bulkUltimoUtilizzo: { ts: Date.now() - 3600e3, ok: 12 } });
  const ev = () => ({ addListener() {}, removeListener() {} });
  const cbp = (v, cb) => { if (typeof cb === 'function') { setTimeout(() => cb(v), 0); return; } return Promise.resolve(v); };
  window.chrome = {
    runtime: {
      id: 'fake', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.35' }),
      sendMessage: (...a) => { const cb = a.find(x => typeof x === 'function'); if (cb) setTimeout(() => cb({ ok: true, loggato: true, attendi: false }), 0); return cb ? undefined : Promise.resolve(); },
      onMessage: ev(), lastError: undefined,
    },
    storage: {
      local: {
        get: (keys, cb) => { const s = leggi(); let o = {}; if (keys == null) o = s; else (Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys)).forEach(k => { if (k in s) o[k] = s[k]; }); return cbp(o, cb); },
        set: (obj, cb) => { scrivi({ ...leggi(), ...obj }); return cbp(undefined, cb); },
        remove: (keys, cb) => { const s = leggi(); (Array.isArray(keys) ? keys : [keys]).forEach(k => delete s[k]); scrivi(s); return cbp(undefined, cb); },
      },
      onChanged: ev(),
    },
    alarms: { create() {}, clear() {}, onAlarm: ev() },
    tabs: { getCurrent: (cb) => cbp({ id: 1 }, cb), create() {}, query: (q, cb) => cbp([], cb), update() {} },
  };
  const ora = Date.now();
  const D = {
    coda_carte: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, nome: ['MEW 151', 'OBF 125', 'PAR 230', 'Eevee 55', 'SV01 006'][i % 5], tipo: i === 3 ? 'sealed' : null, qty: 1 + (i % 2), stato: i < 2 ? 'in_corso' : 'pending', dispositivo: 'PC-AB', creato_il: new Date(ora - (60 - i) * 60e3).toISOString(), owner_id: 'u-me' })),
    ordini: [{ id: 'o1', stato: 'pending', creato_il: new Date(ora - 5e5).toISOString(), preso_in_carico_il: null }],
    wishlist: [
      { id: 'w1', nome: 'Charizard ex', codice: 'OBF 125', qty: 1, lingua: 'IT', condizione: 'NM', url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/x/Charizard-ex-OBF125', prezzo: 41.9, prezzo_obiettivo: 45 },
      { id: 'w2', nome: 'Mew ex', codice: 'MEW 151', qty: 1, lingua: 'EN', condizione: 'NM', url: null, prezzo: 18.5, prezzo_obiettivo: 12 },
    ],
    location: ['BULK GIALLO', 'BINDER', 'SCAMBIO'].map(n => ({ nome: n })),
    carte: [{ location: 'BULK GIALLO' }, { location: 'BINDER' }],
    profiles: [{ banned_until: null, deleted_at: null }],
  };
  const qb = (t) => {
    const q = {}; let single = false;
    ['select', 'eq', 'neq', 'in', 'or', 'not', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range', 'update', 'insert', 'delete', 'is', 'upsert'].forEach(m => { q[m] = () => q; });
    q.single = q.maybeSingle = () => { single = true; return q; };
    q.then = (a, b) => Promise.resolve({ data: single ? (D[t] || [])[0] || null : (D[t] || []), error: null, count: (D[t] || []).length }).then(a, b);
    return q;
  };
  const sess = { access_token: 't', user: { id: 'u-me', email: 'utente@test.local' } };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: sess } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
    from: qb,
    rpc: async (n) => ({ data: n === 'leggi_stato_claim_gruppo' ? [{ dispositivo: 'PC-AB' }, { dispositivo: 'PC-AB' }, { dispositivo: 'PC-CD' }] : (n.startsWith('conta') ? 42 : null), error: null }),
    storage: { from: () => ({}) },
  }) };
  Object.defineProperty(window, 'supabase', { configurable: false, writable: false, value: window.supabase });
})();
