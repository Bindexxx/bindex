// Carica background.js (il service worker) in un contesto Node finto.
// opts passa a creaAmbiente (store, dati, rpc, loggato, version) più:
//   opts.fetch(url, init) → risposta finta { ok, status, headers:{get}, text() } per Cardmarket
//   opts.console          → true per vedere i log del service worker
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { creaAmbiente } = require('./chrome-finto');
const { cartellaEstensione } = require('./cartella-estensione');

function rispostaFinta(testo, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
    text: async () => testo, json: async () => JSON.parse(testo), arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function caricaBackground(opts = {}) {
  const EXT = cartellaEstensione();
  const env = creaAmbiente(opts);
  const muto = () => {};
  const ctx = {
    console: opts.console ? console : { log: muto, warn: muto, info: muto, error: (...a) => env.log.errori.push('console.error: ' + a.join(' ')) },
    chrome: env.chrome, supabase: env.supabase,
    // opts.accelera = N: i timer del service worker durano N volte meno (prove sui 15 s di lettura).
    setTimeout: opts.accelera ? (f, ms, ...a) => setTimeout(f, (ms || 0) / opts.accelera, ...a) : setTimeout,
    clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, URL, URLSearchParams,
    TextEncoder, crypto: require('crypto').webcrypto, Map, Set, Array, Object, String, Number, Error, RegExp,
    fetch: async (u, init) => {
      const url = String(u);
      if (opts.fetch) { const r = await opts.fetch(url, init); if (r) return r; }
      if (url.endsWith('manifest.json')) return rispostaFinta(JSON.stringify({ version: opts.version || '5.35' }));
      if (url.endsWith('latest-version.txt')) return rispostaFinta(opts.version || '5.35');
      return rispostaFinta('', 404);
    },
  };
  ctx.globalThis = ctx; ctx.self = ctx;
  ctx.importScripts = (...files) => files.forEach(f => {
    if (f === 'supabase.bundle.js') return; // sostituito dal Supabase finto
    vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), ctx, { filename: f });
  });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8'), ctx, { filename: 'background.js' });
  return { ctx, env, EXT };
}

module.exports = { caricaBackground, rispostaFinta };
