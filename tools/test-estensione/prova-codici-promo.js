// Codici delle carte promo scritti come su Cardmarket, con gli spazi: "BOO EVS 076",
// "PPS6 MEW 132", "WCD22 BRS 123", "BA22 C31" (dalla versione 5.53). Risultati e pagine presi da
// Cardmarket il 09/11/2026: per PPS6/WCD22/BA22 la ricerca porta subito alla pagina della carta,
// per "BOO EVS 076" escono la Trick or Trade e la Evolving Skies.
const fs = require('fs');
const path = require('path');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { uguale, chiudi } = require('./lib/verifica');

const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const L = (...slug) => slug.map(s => (s.startsWith('http') ? s : B + s));
const slug = (u) => (u || '').split('/').pop();

function esito(r) {
  if (!r) return null;
  if (r.match) return slug(r.match);
  if (r.disambiguation) return (r.opzioni || []).map(slug);
  if (r.verificaCandidato) return 'VERIFICA';
  return null;
}

const CASI = [
  ['BOO EVS 076', L('Trick-or-Trade/Pumpkaboo-BOOEVS-076', 'Evolving-Skies/Pumpkaboo-EVS076'), 'Pumpkaboo-BOOEVS-076'],
  ['PUMPKABOO BOO EVS 076', L('Evolving-Skies/Pumpkaboo-EVS076', 'Trick-or-Trade/Pumpkaboo-BOOEVS-076'), 'Pumpkaboo-BOOEVS-076'],
  ['PUMPKABOO EVS 076', L('Evolving-Skies/Pumpkaboo-EVS076', 'Trick-or-Trade/Pumpkaboo-BOOEVS-076'), 'Pumpkaboo-EVS076'],
  ['BOO EVS 76', L('Trick-or-Trade/Pumpkaboo-BOOEVS-076', 'Evolving-Skies/Pumpkaboo-EVS076'), 'Pumpkaboo-BOOEVS-076'],
  ['BA22 C31', L('Battle-Academy-2022/Vulpix-V3-BA22C31', 'Battle-Academy-2022/Vulpix-V2-BA22C18'), 'Vulpix-V3-BA22C31'],
  // link della stessa carta in altre lingue: una carta sola, link in italiano
  ['DITTO PPS6 MEW 132', L(CM + '/en/Pokemon/Products/Singles/Play-Pokemon-Prize-Pack-Series-Six/Ditto-PPS6MEW-132', CM + '/fr/Pokemon/Products/Singles/Play-Pokemon-Prize-Pack-Series-Six/Ditto-PPS6MEW-132', 'Play-Pokemon-Prize-Pack-Series-Six/Crispin-PPS6SCR-133'), 'Ditto-PPS6MEW-132'],
  // due parole con un numero: può essere nome + numero, si sceglie come prima
  ['MEW 8', L('151/Wartortle-MEW008', '151/Mew-MEW151'), ['Wartortle-MEW008', 'Mew-MEW151']],
  // come prima
  ['ZUBAT SIT 103', L('Silver-Tempest/Zubat-SIT103', 'Trainer-Gallery/Zubat-BOO23SIT-103'), 'Zubat-SIT103'],
  ['MAGIKARP HS 72', L('HeartGold-SoulSilver/Magikarp-V1-HS72', 'HeartGold-SoulSilver/Magikarp-V2-HS72'), ['Magikarp-V1-HS72', 'Magikarp-V2-HS72']],
];

const PAGINE = [
  ['PPS6 MEW 132', 'Ditto', 'PPS6 MEW 132', 'Ditto-PPS6MEW-132', true],
  ['WCD22 BRS 123', 'Arceus V ASTRO', 'WCD22 BRS 123', 'Arceus-VSTAR-WCD22BRS-123', true],
  ['BA22 C31', 'Vulpix', 'BA22 C31', 'Vulpix-V3-BA22C31', true],
  ['BA22 C60', 'Cinderace V', 'BA22 C60', 'Cinderace-V-FST043', true],
  ['Arceus VSTAR WCD22BRS 123', 'Arceus V ASTRO', 'WCD22 BRS 123', 'Arceus-VSTAR-WCD22BRS-123', true],
  ['DITTO PPS6 MEW 132', 'Ditto', 'PPS6 MEW 132', 'Ditto-PPS6MEW-132', true],
  ['BA22 C31', 'Vulpix', 'BA22 C18', 'Vulpix-V2-BA22C18', false],
  ['PPS6 MEW 133', 'Ditto', 'PPS6 MEW 132', 'Ditto-PPS6MEW-132', false],
  ['Charizard ex OBF 125', 'Charizard ex', 'OBF 223', 'Charizard-ex-OBF223', false],
  // col prefisso promo serve il codice completo: Cardmarket a volte porta alla carta del set normale
  ['PUMPKABOO BOO EVS 076', 'Pumpkaboo', 'EVS 076', 'Pumpkaboo-EVS076', false],
  ['PUMPKABOO BOO EVS 076', 'Pumpkaboo', 'BOO EVS 076', 'Pumpkaboo-BOOEVS-076', true],
  ['BOOEVS076', 'Pumpkaboo', 'BOO EVS 076', 'Pumpkaboo-BOOEVS-076', true],
  ['PUMPKABOO EVS 076', 'Pumpkaboo', 'EVS 076', 'Pumpkaboo-EVS076', true],
];

// Testo cercato su Cardmarket: col prefisso promo solo il codice attaccato (porta dritto alla carta).
const RICERCHE = [
  ['BOO EVS 076', 'BOOEVS076'],
  ['PUMPKABOO BOO EVS 076', 'BOOEVS076'],
  ['Ditto PPS6 MEW 132', 'PPS6MEW132'],
  ['wcd22 brs 123', 'WCD22BRS123'],
  ['BA22 C31', 'BA22C31'],
  ['ZUBAT SIT 103', 'ZUBAT SIT 103'],
  ['Pikachu', 'Pikachu'],
];

const paginaCarta = (nome, codice, url) => `<html><head><meta property="og:url" content="${url}">
  <title>${nome} | Cardmarket</title></head><body><h1>${nome}  (${codice})<span class="h4 text-muted"> Play! Pokémon Buste Premio Sesta Serie - Singles</span></h1>
  <a href="/en/Pokemon/Products/Singles/${url.split('/Singles/')[1]}">en</a><a href="/it/Pokemon/Products/Singles/Play-Pokemon-Prize-Pack-Series-Six/Crispin-PPS6SCR-133">dopo</a>
  <a href="/it/Pokemon/Products/Singles/Play-Pokemon-Prize-Pack-Series-Six/Dragapult-ex-PPS6TWM-130">prima</a></body></html>`;

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(cartellaEstensione(), 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (!(maj > 5 || (maj === 5 && min >= 53))) { console.log(`Versione ${versione}: prova dalla 5.53, saltata`); chiudi(); return; }

  const { ctx } = caricaBackground();
  for (const [q, links, atteso] of CASI) {
    uguale(`"${q}" con ${links.length} link`, esito(ctx._trovaMatchCartaSingola(links, q)), atteso);
  }
  console.log('');
  for (const [q, nome, codice, s, atteso] of PAGINE) {
    uguale(`pagina "${nome} (${codice})" per "${q}"`, ctx._paginaCombaciaConQuery(q, nome, codice, s), atteso);
  }

  console.log('');
  for (const [testo, atteso] of RICERCHE) {
    uguale(`ricerca per "${testo}"`, new URL(ctx._urlRicercaAutonoma(testo)).searchParams.get('searchString'), atteso);
  }

  // Lettura leggera: la ricerca porta direttamente alla pagina della carta.
  console.log('');
  const RIC = (q) => ctx._urlRicercaAutonoma(q);
  const ditto = B + 'Play-Pokemon-Prize-Pack-Series-Six/Ditto-PPS6MEW-132';
  const pagine = {
    [RIC('PPS6 MEW 132')]: paginaCarta('Ditto', 'PPS6 MEW 132', ditto),
    [RIC('PPS6 MEW 133')]: paginaCarta('Ditto', 'PPS6 MEW 132', ditto),
  };
  const conFetch = caricaBackground({ fetch: async (url) => (pagine[url] ? rispostaFinta(pagine[url]) : null) }).ctx;
  const f1 = await conFetch._risolviSinglesENomeFetch(RIC('PPS6 MEW 132'), '');
  uguale('fetch "PPS6 MEW 132" rimandata alla carta: link, nome, codice', [f1.urlSingles, f1.nome, f1.codice], [ditto, 'Ditto', 'PPS6 MEW 132']);
  const f2 = await conFetch._risolviSinglesENomeFetch(RIC('PPS6 MEW 133'), '');
  uguale('fetch "PPS6 MEW 133" rimandata a un\'altra carta: non trovata', [f2.urlSingles, f2.nonTrovata], [null, true]);

  // Scheda (lettura leggera bloccata): pagina della carta dopo la ricerca (h1 senza gli <span>, come lo legge la scheda).
  const d1 = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: ditto, testoH1: 'Ditto (PPS6 MEW 132)', hrefs: [] }, 'PPS6 MEW 132', true, '');
  uguale('scheda "PPS6 MEW 132": carta accettata', [slug(d1.urlSingles), d1.codice], ['Ditto-PPS6MEW-132', 'PPS6 MEW 132']);
  const dIt = ctx._trovaMatchCartaSingola(L(CM + '/en/Pokemon/Products/Singles/Play-Pokemon-Prize-Pack-Series-Six/Ditto-PPS6MEW-132'), 'PPS6 MEW 132');
  uguale('link in inglese riportato in italiano', dIt.match, B + 'Play-Pokemon-Prize-Pack-Series-Six/Ditto-PPS6MEW-132');
  const d2 = ctx._decidiRisoluzioneDaScheda({ tipo: 'ricerca', hrefs: L('Trick-or-Trade/Pumpkaboo-BOOEVS-076', 'Evolving-Skies/Pumpkaboo-EVS076'), searchString: 'BOO EVS 076' }, 'BOO EVS 076', true, '');
  uguale('scheda "BOO EVS 076": la Trick or Trade', slug(d2.urlSingles), 'Pumpkaboo-BOOEVS-076');

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
