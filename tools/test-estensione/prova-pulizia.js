// Pulizia (dalla 5.47, Fase 9 del piano):
// 1) nessuna funzione o costante di primo livello mai usata (stessa analisi di codice-morto.js);
// 2) niente codice per pagine e ordini che non esistono più: azioni dell'adapter delle vecchie
//    pagine, APRI_URL_WORKER_TAB, ordini 'aggiungi_carte'/'aggiungi_wishlist', audio keep-alive,
//    prova "a secco", bulkSessione, User-Agent finto;
// 3) un solo controllo "Cloudflare ancora in pagina" per le attese, le frasi dell'errore 1015 da
//    RATE_LIMIT_MARKERS (shared.js), e AGGIUNGI_CARTA con un'azione qualsiasi = errore;
// 4) il controllo di attesa gira davvero in una pagina: Cloudflare sì/no.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const leggi = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');

(async () => {
  const manifest = JSON.parse(leggi('manifest.json'));
  const [maj, min] = manifest.version.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 47)) { console.log(`Versione ${manifest.version}: prove dalla 5.47, saltate.`); process.exit(0); }

  // ── 1) codice mai usato ──
  const files = fs.readdirSync(EXT).filter(f => f.endsWith('.js') && !['supabase.bundle.js', 'avviso_audio.js'].includes(f));
  const html = fs.readdirSync(EXT).filter(f => f.endsWith('.html')).map(leggi).join('\n');
  const dichiarate = []; const usi = {};
  for (const f of files) {
    const ast = acorn.parse(leggi(f), { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
    for (const n of ast.body) {
      if (n.type === 'FunctionDeclaration') dichiarate.push(`${f}:${n.id.name}`);
      if (n.type === 'VariableDeclaration') n.declarations.forEach(d => d.id.type === 'Identifier' && dichiarate.push(`${f}:${d.id.name}`));
    }
    walk.full(ast, (n) => {
      if (n.type === 'Identifier') usi[n.name] = (usi[n.name] || 0) + 1;
      if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') usi[n.property.name] = (usi[n.property.name] || 0) + 1;
    });
  }
  const morti = dichiarate.filter(d => { const nome = d.split(':')[1]; return (usi[nome] || 0) <= 1 && !html.includes(nome); });
  uguale('nessuna funzione o costante mai usata', morti, []);

  // ── 2) niente codice per cose che non esistono più ──
  const bg = leggi('background.js');
  const adapter = leggi('supabase_adapter.js');
  const tutto = files.map(leggi).join('\n');
  const azioniMorte = ['leggiWishlist', 'eliminaWishlistRiga', 'aggiornaPrezzoWishlistRiga', 'spostaWishlistInCollezione', 'svuotaRiga',
    'leggiAnteprima', 'aggiornaLocationRiga', 'aggiornaQty', 'cerca', 'cercaBulk', 'rinominaLocationTab', 'eliminaLocationTab', 'aggiornaUrlRigaSealed'];
  uguale('adapter: tolte le azioni delle vecchie pagine', azioniMorte.filter(a => adapter.includes(`case '${a}':`)), []);
  // Ogni azione rimasta ha almeno una chiamata fuori dall'adapter.
  const azioni = [...adapter.matchAll(/^\s*case '([^']+)':/gm)].map(m => m[1]);
  const altri = files.filter(f => f !== 'supabase_adapter.js').map(leggi).join('\n');
  uguale('adapter: ogni azione rimasta è chiamata', azioni.filter(a => !new RegExp(`['"\`]${a}['"\`]`).test(altri)), []);
  controlla('niente APRI_URL_WORKER_TAB', !bg.includes("message.type === 'APRI_URL_WORKER_TAB'"));
  controlla("niente rami per gli ordini 'aggiungi_carte'/'aggiungi_wishlist'", !/ordine\.tipo === 'aggiungi_(carte|wishlist)'/.test(bg));
  controlla('niente audio keep-alive', !/AudioKeepAlive\s*\(/.test(tutto));
  controlla('niente prova "a secco" nel controllo prezzi', !/isDry/.test(leggi('popup.js')));
  controlla('niente bulkSessione scritta e mai letta', !/['"]bulkSessione['"]|bulkSessione:/.test(tutto));
  controlla('niente User-Agent finto nelle letture senza scheda', !/'User-Agent'/.test(bg));

  // ── 3) una sola copia ──
  const usiCf = (bg.match(/func: _statoCloudflareNellaScheda/g) || []).length;
  uguale('attese della verifica Cloudflare: una sola funzione, usata 4 volte', usiCf, 4);
  controlla("errore 1015: frasi da RATE_LIMIT_MARKERS, mai scritte a mano", !/includes\('error 1015'\)/.test(bg));
  const { ctx } = caricaBackground({ version: manifest.version });
  // Le pagine mandano i messaggi ai listener del service worker (chrome finto).
  const risposta = await new Promise((res) => {
    ctx.chrome.runtime.sendMessage({ type: 'AGGIUNGI_CARTA', azione: 'cerca', codice: 'X' }, (r) => res(r));
    setTimeout(() => res('nessuna risposta'), 2000);
  });
  controlla("AGGIUNGI_CARTA con un'azione: errore, nessuna carta", risposta && risposta.ok === false && /non gestita/.test(risposta.errore || ''), risposta);

  // ── 4) il controllo di attesa in una pagina vera ──
  const statoCf = (htmlPagina) => {
    const dom = new JSDOM(htmlPagina, { runScripts: 'outside-only' });
    return dom.window.eval('(' + ctx._statoCloudflareNellaScheda.toString() + ')')(vm.runInContext('CF_TITLES', ctx));
  };
  uguale('pagina della verifica Cloudflare → "cf"', statoCf('<html><head><title>Just a moment...</title></head><body><div id="challenge-running"></div></body></html>'), 'cf');
  uguale('pagina della carta con offerte → "ok"', statoCf('<html><head><title>Pikachu | Cardmarket</title></head><body><h1>Pikachu (PAF 85)</h1><div class="article-row"></div></body></html>'), 'ok');
  uguale('Turnstile sulla pagina della carta (h1 con il codice) → "ok"', statoCf('<html><head><title>Carta | Cardmarket</title></head><body><h1>Pikachu (PAF 85)</h1><div class="cf-turnstile"></div></body></html>'), 'ok');

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
