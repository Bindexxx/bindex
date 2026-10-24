// Cartella con i file dell'estensione da provare.
// - CARDSYNC_EXT=/percorso/cartella → usa quella cartella (per esempio una copia di lavoro);
// - altrimenti estrae releases/cardsync-extension.zip del repo in una cartella temporanea
//   (serve il comando "unzip"), così si prova esattamente quello che scaricano i PC.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let _cache = null;

function cartellaEstensione() {
  if (_cache) return _cache;
  if (process.env.CARDSYNC_EXT) {
    _cache = path.resolve(process.env.CARDSYNC_EXT);
  } else {
    const zip = path.resolve(__dirname, '../../../releases/cardsync-extension.zip');
    if (!fs.existsSync(zip)) throw new Error('zip non trovato: ' + zip + ' (oppure imposta CARDSYNC_EXT)');
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'cardsync-ext-'));
    execFileSync('unzip', ['-q', '-o', zip, '-d', dest]);
    _cache = dest;
  }
  if (!fs.existsSync(path.join(_cache, 'manifest.json'))) throw new Error('manifest.json non trovato in ' + _cache);
  return _cache;
}

module.exports = { cartellaEstensione };
