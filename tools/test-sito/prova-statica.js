// Prove senza browser, pagina per pagina, sugli script nell'ordine di caricamento vero:
// 1) ogni <script src> locale esiste e si legge (sintassi);
// 2) nessun nome dichiarato due volte tra script della stessa pagina che bloccherebbe la pagina
//    (let/const/class con qualunque altro nome uguale di primo livello) e nessuna funzione
//    di primo livello ridefinita da un altro script (la seconda vincerebbe in silenzio);
// 3) supabaseClient usato solo in config/ e data/ (regola del progetto);
// 4) le funzioni chiamate negli attributi on…="…" (nell'HTML e nei testi generati dagli script)
//    esistono tra quelle di primo livello della pagina.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { RADICE, PAGINE, scriptDi } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const opz = { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true };
const BROWSER = new Set(['alert', 'confirm', 'prompt', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'parseInt', 'parseFloat', 'Number', 'String', 'Boolean', 'encodeURIComponent', 'decodeURIComponent', 'fetch', 'open',
  'requestAnimationFrame', 'event', 'history', 'location', 'print', 'scrollTo', 'close']);

function dichiarazioni(ast) {
  const lessicali = [], funzioni = [], variabili = [];
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' && n.id) funzioni.push(n.id.name);
    if (n.type === 'ClassDeclaration' && n.id) lessicali.push(n.id.name);
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) if (d.id.type === 'Identifier') (n.kind === 'var' ? variabili : lessicali).push(d.id.name);
    }
  }
  return { lessicali, funzioni, variabili };
}

// Assegnazioni window.nome = … (funzioni messe a disposizione degli attributi on…).
function suWindow(ast) {
  const nomi = [];
  walk.simple(ast, {
    AssignmentExpression(n) {
      const s = n.left;
      if (s.type === 'MemberExpression' && !s.computed && s.object.type === 'Identifier' && s.object.name === 'window') nomi.push(s.property.name);
    },
  });
  return nomi;
}

// Testi degli attributi on…="…" trovati in una stringa (HTML o template di uno script).
function gestori(testo) {
  return [...testo.matchAll(/\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)'|\\"([^"\\]*)\\")/g)].map(m => m[1] ?? m[2] ?? m[3]);
}

// Funzioni chiamate per nome in un gestore (le chiamate su oggetti, a.b(), non contano).
function chiamate(codice) {
  const pulito = codice.replace(/\$\{[^}]*\}/g, '0'); // pezzi ${…} dei template
  let ast;
  try { ast = acorn.parse(pulito, opz); } catch (_) { return null; }
  const nomi = [];
  walk.simple(ast, { CallExpression(n) { if (n.callee.type === 'Identifier') nomi.push(n.callee.name); } });
  return nomi;
}

for (const pagina of PAGINE) {
  const script = scriptDi(pagina);
  const mancanti = script.filter(s => s.tipo === 'file' && !s.esiste).map(s => s.nome);
  uguale(`${pagina}: tutti gli script esistono`, mancanti, []);

  const errori = [];
  const perNome = new Map(); // nome → [{ script, tipo }]
  const globali = new Set();
  const usiClient = [];
  const stringhe = [];
  for (const s of script) {
    if (!s.esiste && s.tipo === 'file') continue;
    let ast;
    try { ast = acorn.parse(s.testo, { ...opz, locations: true }); } catch (e) { errori.push(`${s.nome}: ${e.message}`); continue; }
    if (s.vendor) continue;
    const d = dichiarazioni(ast);
    for (const [tipo, lista] of [['lessicale', d.lessicali], ['funzione', d.funzioni], ['var', d.variabili]]) {
      for (const nome of lista) {
        if (!perNome.has(nome)) perNome.set(nome, []);
        perNome.get(nome).push({ script: s.nome, tipo });
        globali.add(nome);
      }
    }
    suWindow(ast).forEach(n => globali.add(n));
    const ammesso = s.tipo === 'file' && (s.file.startsWith('data/') || s.file.startsWith('config/'));
    if (!ammesso) {
      walk.full(ast, (n) => { if (n.type === 'Identifier' && n.name === 'supabaseClient') usiClient.push(`${s.nome}:${n.loc.start.line}`); });
    }
    walk.simple(ast, {
      Literal(n) { if (typeof n.value === 'string' && /\son[a-z]+\s*=/.test(n.value)) stringhe.push({ script: s.nome, testo: n.value }); },
      TemplateLiteral(n) { const t = n.quasis.map(q => q.value.raw).join('${0}'); if (/\son[a-z]+\s*=/.test(t)) stringhe.push({ script: s.nome, testo: t }); },
    });
  }
  uguale(`${pagina}: tutti gli script si leggono (sintassi)`, errori, []);

  const doppi = [];
  for (const [nome, dove] of perNome) {
    if (dove.length < 2) continue;
    const script = new Set(dove.map(d => d.script));
    if (script.size < 2) continue; // dentro lo stesso file ci pensa il controllo di sintassi
    if (dove.some(d => d.tipo === 'lessicale')) doppi.push(`${nome} (blocca la pagina): ${[...script].join(', ')}`);
    else if (dove.filter(d => d.tipo === 'funzione').length > 1) doppi.push(`${nome} (funzione ridefinita): ${[...script].join(', ')}`);
  }
  uguale(`${pagina}: nessun nome di primo livello dichiarato in due script`, doppi, []);
  uguale(`${pagina}: supabaseClient solo in config/ e data/`, usiClient, []);

  const html = fs.readFileSync(path.join(RADICE, pagina), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const fonti = [{ script: pagina, testi: gestori(html) }, ...stringhe.map(s => ({ script: s.script, testi: gestori(s.testo) }))];
  const sconosciute = new Set();
  let contati = 0;
  for (const f of fonti) {
    for (const g of f.testi) {
      const nomi = chiamate(g);
      if (!nomi) continue;
      contati++;
      for (const n of nomi) if (!globali.has(n) && !BROWSER.has(n)) sconosciute.add(`${n} (${f.script})`);
    }
  }
  controlla(`${pagina}: le funzioni dei ${contati} attributi on…= esistono`, sconosciute.size === 0, [...sconosciute]);
}

chiudi();
