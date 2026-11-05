// Le pagine del sito e i loro script, nell'ordine in cui il browser li carica.
const fs = require('fs');
const path = require('path');

const RADICE = process.env.BINDEX_SITO ? path.resolve(process.env.BINDEX_SITO) : path.resolve(__dirname, '..', '..', '..'); // BINDEX_SITO = un'altra copia del sito
const PAGINE = ['index.html', 'admin.html', 'binder-pubblico.html', 'scaffali-pubblico.html', 'sealed.html', 'wishlist.html'];

// [{ tipo: 'file'|'inline', nome, file?, testo }] — esclusi gli script esterni (https:) e vendor/.
function scriptDi(pagina) {
  const html = fs.readFileSync(path.join(RADICE, pagina), 'utf8');
  const out = [];
  let n = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (src) {
      if (/^https?:/.test(src)) continue;
      const file = src.split('?')[0];
      out.push({ tipo: 'file', nome: file, file, vendor: file.startsWith('vendor/'), esiste: fs.existsSync(path.join(RADICE, file)),
        testo: fs.existsSync(path.join(RADICE, file)) ? fs.readFileSync(path.join(RADICE, file), 'utf8') : '' });
    } else if (m[2].trim()) {
      out.push({ tipo: 'inline', nome: `${pagina} (script ${++n} nella pagina)`, testo: m[2] });
    }
  }
  return out;
}

module.exports = { RADICE, PAGINE, scriptDi };
