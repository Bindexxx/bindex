// Elenco delle funzioni e costanti dichiarate a livello di file e mai usate da nessuna parte
// dell'estensione (analisi della sintassi: i commenti non contano). Solo un elenco, non un
// controllo che fallisce: serve per la Fase 9 del piano (pulizia).
const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { cartellaEstensione } = require('./lib/cartella-estensione');

const EXT = cartellaEstensione();
const files = fs.readdirSync(EXT).filter(f => f.endsWith('.js') && !['supabase.bundle.js', 'avviso_audio.js'].includes(f));
const html = fs.readdirSync(EXT).filter(f => f.endsWith('.html')).map(f => fs.readFileSync(EXT + '/' + f, 'utf8')).join('\n');
const dichiarate = []; const usi = {};
for (const f of files) {
  const src = fs.readFileSync(EXT + '/' + f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') dichiarate.push({ f, nome: n.id.name, riga: n.loc.start.line, tipo: 'function' });
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => d.id.type === 'Identifier' && dichiarate.push({ f, nome: d.id.name, riga: d.loc.start.line, tipo: n.kind }));
  }
  walk.full(ast, (n) => {
    if (n.type === 'Identifier') usi[n.name] = (usi[n.name] || 0) + 1;
    if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') usi[n.property.name] = (usi[n.property.name] || 0) + 1;
  });
}
const morti = dichiarate.filter(d => (usi[d.nome] || 0) <= 1 && !html.includes(d.nome));
console.log('Dichiarazioni di primo livello:', dichiarate.length, '— mai usate:', morti.length);
morti.forEach(d => console.log(`${d.f}:${d.riga}  ${d.tipo} ${d.nome}`));
