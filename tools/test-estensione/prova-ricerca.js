// Scelta della carta giusta tra i risultati di una ricerca su Cardmarket
// (_trovaMatchCartaSingola in background.js). Link reali, presi da Cardmarket.
// Esito atteso per ogni caso:
//   'Slug-Della-Carta'  → presa da sola
//   ['A', 'B']          → scelta manuale tra esattamente questi link
//   'VERIFICA'          → un solo link, da verificare sulla pagina
//   null                → nessuna carta
const { caricaBackground } = require('./lib/carica-background');
const { uguale, chiudi } = require('./lib/verifica');

const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const L = (...slug) => slug.map(s => B + s);

const CASI = [
  // [query, link trovati dalla ricerca, esito atteso]
  ['MEW 8', L('151/Wartortle-MEW008', '151/Mew-MEW151'), ['Wartortle-MEW008', 'Mew-MEW151']],
  ['MEW008', L('151/Wartortle-MEW008', '151/Mew-MEW151'), 'Wartortle-MEW008'],
  ['Mew 151', L('151/Wartortle-MEW008', '151/Mew-MEW151'), 'Mew-MEW151'],
  ['BST18', L('Battle-Styles/Flapple-V-V1-BST18'), 'Flapple-V-V1-BST18'],
  ['MAGIKARP HS 72', L('HeartGold-SoulSilver/Magikarp-V1-HS72', 'HeartGold-SoulSilver/Magikarp-V2-HS72'), ['Magikarp-V1-HS72', 'Magikarp-V2-HS72']],
];

// Casi del formato "NOME SET NUMERO" (B16): con la 5.35 falliscono, vanno a posto in 5.36.
const CASI_536 = [
  ['ZUBAT SIT 103', L('Silver-Tempest/Zubat-SIT103', 'Trainer-Gallery/Zubat-BOO23SIT-103'), 'Zubat-SIT103'],
  ['Charizard ex OBF 125', L('Obsidian-Flames/Charizard-ex-OBF125', 'Obsidian-Flames/Charizard-ex-OBF223'), 'Charizard-ex-OBF125'],
  ['Charizard ex OBF 125', L('Obsidian-Flames/Charizard-ex-OBF125'), 'Charizard-ex-OBF125'],
  ['BST 18', L('Battle-Styles/Flapple-V-V1-BST18'), 'Flapple-V-V1-BST18'],
  ['FLAPPLE V BST 18', L('Battle-Styles/Flapple-V-V1-BST18'), 'Flapple-V-V1-BST18'],
  ['MAGIKARP HS 72', L('HeartGold-SoulSilver/Magikarp-V1-HS72', 'HeartGold-SoulSilver/Magikarp-V2-HS72', 'HeartGold-SoulSilver/Magikarp-HS35'), ['Magikarp-V1-HS72', 'Magikarp-V2-HS72']],
  ['Tynamo FST 95', L('Fusion-Strike/Tynamo'), 'VERIFICA'],
  ['FST095', L('Fusion-Strike/Tynamo'), 'VERIFICA'],
];

// Verifica sulla pagina della carta (_paginaCombaciaConQuery): query, nome e codice letti
// dall'h1, slug dell'URL → la pagina è quella cercata?
const PAGINE_536 = [
  ['ZUBAT SIT 103', 'Zubat', 'SIT 103', 'Zubat-SIT103', true],
  ['Charizard ex OBF 125', 'Charizard ex', 'OBF 223', 'Charizard-ex-OBF223', false],
  ['Charizard ex OBF 125', 'Charizard ex', 'OBF 125', 'Charizard-ex-OBF125', true],
  ['Tynamo FST 95', 'Tynamo', 'FST 095', 'Tynamo', true],
  ['FST095', 'Tynamo', 'FST 095', 'Tynamo', true],
  ['FST095', 'Tynamo', 'FST 096', 'Tynamo', false],
  ['Mew 151', 'Mew ex', 'MEW 151', 'Mew-ex-MEW151', true],
  ['Eevee 55', 'Eevee', 'JU 55', 'Eevee-JU55', true],
  ['Eevee 55', 'Pikachu', 'JU 55', 'Pikachu-JU55', false],
  ['MAGIKARP HS 72', 'Singole HeartGold & SoulSilver', '', 'HeartGold-SoulSilver', false],
];

function esito(r) {
  if (!r) return null;
  const slug = (u) => u.split('/').pop();
  if (r.match) return slug(r.match);
  if (r.disambiguation) return (r.opzioni || []).map(slug);
  if (r.verificaCandidato) return 'VERIFICA';
  return null;
}

(async () => {
  const { ctx } = caricaBackground();
  const versione = JSON.parse(require('fs').readFileSync(require('path').join(require('./lib/cartella-estensione').cartellaEstensione(), 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  const casi = (maj > 5 || (maj === 5 && min >= 36)) ? CASI.concat(CASI_536) : CASI;
  console.log(`Versione ${versione}: ${casi.length} casi\n`);
  for (const [q, links, atteso] of casi) {
    uguale(`"${q}" con ${links.length} link`, esito(ctx._trovaMatchCartaSingola(links, q)), atteso);
  }
  if (typeof ctx._paginaCombaciaConQuery === 'function') {
    console.log('');
    for (const [q, nome, codice, slug, atteso] of PAGINE_536) {
      uguale(`pagina "${nome} (${codice || '—'})" per "${q}"`, ctx._paginaCombaciaConQuery(q, nome, codice, slug), atteso);
    }
  }
  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
