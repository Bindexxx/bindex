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

// Carte senza numero (My First Battle: codice "MFB"), dalla 5.54. Risposte di Cardmarket del 09/11.
const CASI_SENZA_NUMERO = [
  ['electabuzz MFB', L('My-First-Battle/Electabuzz-MFB', 'My-First-Battle/Electrode-MFB'), 'Electabuzz-MFB'],
  ['Raichu MFB', L('My-First-Battle/Raichu-MFB'), 'Raichu-MFB'],
  ['Bulbasaur MFB', L('My-First-Battle/Bulbasaur-V1-MFB', 'My-First-Battle/Bulbasaur-V2-MFB'), ['Bulbasaur-V1-MFB', 'Bulbasaur-V2-MFB']],
  ['Switch MFB', L('My-First-Battle/Switch-V2-MFB', 'My-First-Battle/Switch-V4-MFB', 'My-First-Battle/Switch-V3-MFB', 'My-First-Battle/Switch-V1-MFB'), ['Switch-V2-MFB', 'Switch-V4-MFB', 'Switch-V3-MFB', 'Switch-V1-MFB']],
  ['Energia base Fuoco MFB', L('My-First-Battle/Basic-Fire-Energy-V2-MFB', 'My-First-Battle/Basic-Fire-Energy-V1-MFB'), ['Basic-Fire-Energy-V2-MFB', 'Basic-Fire-Energy-V1-MFB']],
  ['Pozione MFB', L('My-First-Battle/Potion-V1-MFB'), 'VERIFICA'],
];
const PAGINE_SENZA_NUMERO = [
  ['electabuzz MFB', 'Electabuzz', 'MFB', 'Electabuzz-MFB', true],
  ['ELECTABUZZ MFB', 'Electabuzz', 'MFB', 'Electabuzz-MFB', true],
  ['pikachu MFB', 'Electabuzz', 'MFB', 'Electabuzz-MFB', false],
  ['Energia base Fuoco MFB', 'Energia base Fuoco', 'MFB', 'Basic-Fire-Energy-V1-MFB', true],
  ['Basic Fire Energy MFB', 'Energia base Fuoco', 'MFB', 'Basic-Fire-Energy-V1-MFB', true],
  ['electabuzz MFB', 'Electabuzz', 'BS 20', 'Electabuzz-V1-BS20', false],
  ['Pikachu ex', 'Pikachu ex', 'SVI 063', 'Pikachu-ex-SVI063', false],
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

  if (maj > 5 || (maj === 5 && min >= 54)) {
    console.log('');
    for (const [q, links, atteso] of CASI_SENZA_NUMERO) {
      uguale(`senza numero: "${q}" con ${links.length} link`, esito(ctx._trovaMatchCartaSingola(links, q)), atteso);
    }
    for (const [q, nome, codice, s, atteso] of PAGINE_SENZA_NUMERO) {
      uguale(`senza numero: pagina "${nome} (${codice})" per "${q}"`, ctx._paginaCombaciaConQuery(q, nome, codice, s), atteso);
    }
    const electabuzz = B + 'My-First-Battle/Electabuzz-MFB';
    const pagineMfb = { [ctx._urlRicercaAutonoma('electabuzz MFB')]: paginaCarta('Electabuzz', 'MFB', electabuzz) };
    const fetchMfb = caricaBackground({ fetch: async (url) => (pagineMfb[url] ? rispostaFinta(pagineMfb[url]) : null) }).ctx;
    const fm = await fetchMfb._risolviSinglesENomeFetch(ctx._urlRicercaAutonoma('electabuzz MFB'), '');
    uguale('fetch "electabuzz MFB" rimandata alla carta', [fm.urlSingles, fm.nome, fm.codice], [electabuzz, 'Electabuzz', 'MFB']);
    const dm = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: electabuzz, testoH1: 'Electabuzz (MFB)', hrefs: [] }, 'electabuzz MFB', true, '');
    uguale('scheda "electabuzz MFB": carta accettata', [slug(dm.urlSingles), dm.codice], ['Electabuzz-MFB', 'MFB']);
  }

  if (maj > 5 || (maj === 5 && min >= 55)) {
    // Dalla 5.55: se il testo finisce con un codice, prima si cerca il codice attaccato ("DR60"),
    // che su Cardmarket porta dritto alla carta (controllato dal vivo il 09/11 su 15 codici);
    // se non trova niente si rifà la ricerca di prima.
    console.log('');
    const COMPATTI = [
      ['Magikarp DR 60', 'DR60'], ['CRE 059', 'CRE059'], ['SHF SV12', 'SHFSV12'], ['Falinks V SHF SV115', 'SHFSV115'],
      ['Jynx SIT TG04', 'SITTG04'], ['VENUSAUR CEL BS 15', 'CELBS15'], ['BA22 C31', 'BA22C31'], ['Luxio Lv.25 AR 43', 'AR43'],
      ['PIKACHU TK10 A29', 'TK10A29'], ['Eevee SV2A 133', 'SV2A133'], ['Ditto PPS6 MEW 132', 'PPS6MEW132'],
      ['Charizard ex 125', null], ['Pikachu V 43', null], ['Pikachu', null], ['electabuzz MFB', null], ['Ducklett TK9 S-24', null],
      // codice già attaccato dopo il nome (ultima parola con 3+ lettere, o 2 lettere senza sigla davanti)
      ['CUBONE CBB3C04', 'CBB3C04'], ['FALENAFERREA PAR028', 'PAR028'], ['FUECOCO SVI036', 'SVI036'], ['BLISSEY V S8B127', 'S8B127'],
      ['Gastly XASC123', 'XASC123'], ['Eevee sv2a133', 'SV2A133'], ['Lapras MCD19 5', 'MCD195'], ['EEVEE CSV9.5C 139', 'CSV95C139'],
      ['Pikachu 25', null], ['Zacian V 95', null],
    ];
    for (const [testo, atteso] of COMPATTI) uguale(`codice attaccato per "${testo}"`, ctx._codiceRicercaCompatto(testo), atteso);
    uguale('"DET 1" da solo: la sigla non è un pezzo di nome (niente Detective Pikachu)',
      esito(ctx._trovaMatchCartaSingola(L('Sun-Moon-Indonesian-Promos/Detective-Pikachu-SM-PID001', 'Ancient-Origins/Goodra-AOR1'), 'DET 1')),
      ['Detective-Pikachu-SM-PID001', 'Goodra-AOR1']);

    const ric = (t) => `${CM}/it/Pokemon/Products/Search?searchMode=v2&searchString=${encodeURIComponent(t).replace(/%20/g, '+')}`;
    const lista = (...sl) => `<html><head><meta property="og:url" content="${CM}/it/Pokemon/Products/Search"><title>Risultati</title></head><body><h1>Risultati Di Ricerca</h1>${sl.map(x => `<a href="/it/Pokemon/Products/Singles/${x}">x</a>`).join('')}</body></html>`;
    const vuota = lista();
    const prezzoRiga = `<div class="article-row"><div class="product-attributes"><span aria-label="Italiano"></span></div><div class="price-container"><span class="fw-bold">1,00 €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
    const conPrezzo = (nome, codice, url) => paginaCarta(nome, codice, url).replace('</body>', prezzoRiga + '<a id="account-dropdown">u</a></body>');
    const giro = async (testo, mappa) => {
      const chiesti = [];
      const pagine = {};
      for (const [u, h] of Object.entries(mappa)) if (u.includes('/Singles/')) pagine[u] = h;
      const { ctx: c } = caricaBackground({ version: versione, accelera: 10, pagine, fetch: async (url) => { chiesti.push(url); return mappa[url] ? rispostaFinta(mappa[url]) : null; } });
      const r = await c._leggiNomeDaCardmarket(c._urlRicercaAutonoma(testo), 'IT', 'NM', '', false, 0, null, null, null);
      return { r, chiesti: chiesti.filter(u => u.includes('/Search?')).map(u => new URL(u).searchParams.get('searchString')) };
    };

    const MAGIKARP = B + 'EX-Dragon/Magikarp-DR60';
    const g1 = await giro('Magikarp DR 60', {
      [ric('DR60')]: paginaCarta('Magikarp', 'DR 60', MAGIKARP),
      [ric('Magikarp DR 60')]: lista('Stellar-Crown/Drifloon-SCR060', 'Silver-Tempest/Drowzee-SIT060'),
      [MAGIKARP]: conPrezzo('Magikarp', 'DR 60', MAGIKARP),
    });
    uguale('"Magikarp DR 60": trovata col codice attaccato, una sola ricerca', [slug(g1.r.urlSingles), g1.chiesti], ['Magikarp-DR60', ['DR60']]);

    const ZUBAT = B + 'Silver-Tempest/Zubat-SIT053';
    const g2 = await giro('Zubat SIT 53', {
      [ric('SIT53')]: vuota,
      [ric('Zubat SIT 53')]: paginaCarta('Zubat', 'SIT 053', ZUBAT),
      [ZUBAT]: conPrezzo('Zubat', 'SIT 053', ZUBAT),
    });
    uguale('"Zubat SIT 53" (zeri mancanti): codice attaccato senza risultati, poi la ricerca di prima', [slug(g2.r.urlSingles), g2.chiesti], ['Zubat-SIT053', ['SIT53', 'Zubat SIT 53']]);

    const g3 = await giro('Zubat SIT 53', {
      [ric('SIT53')]: lista('Sword-Shield/Snom-SSH063', 'Lost-Origin/Gloom-LOR053'),
      [ric('Zubat SIT 53')]: paginaCarta('Zubat', 'SIT 053', ZUBAT),
      [ZUBAT]: conPrezzo('Zubat', 'SIT 053', ZUBAT),
    });
    uguale('codice attaccato con carte di altri codici: si scartano, poi la ricerca di prima', [slug(g3.r.urlSingles), g3.chiesti], ['Zubat-SIT053', ['SIT53', 'Zubat SIT 53']]);

    const g4 = await giro('Cubone CBB3C 04', {
      [ric('CBB3C04')]: lista('Gem-Pack-Vol-3/Cubone-V7-CBB3C04', 'Gem-Pack-Vol-3/Cubone-V1-CBB3C04', 'Gem-Pack-Vol-3/Cubone-V3-CBB3C04'),
    });
    uguale('"Cubone CBB3C 04": scelta tra le versioni di quel codice', [g4.r.disambiguation, (g4.r.opzioni || []).length, g4.chiesti], [true, 3, ['CBB3C04']]);

    const g5 = await giro('Charizard ex 125', {
      [ric('Charizard ex 125')]: paginaCarta('Charizard ex', 'OBF 125', B + 'Obsidian-Flames/Charizard-ex-OBF125'),
      [B + 'Obsidian-Flames/Charizard-ex-OBF125']: conPrezzo('Charizard ex', 'OBF 125', B + 'Obsidian-Flames/Charizard-ex-OBF125'),
    });
    uguale('"Charizard ex 125" (nome + numero): nessun codice attaccato, ricerca di prima', g5.chiesti, ['Charizard ex 125']);
  }

  if (maj > 5 || (maj === 5 && min >= 56)) {
    // Dalla 5.56: Battle Academy senza l'anno ("ba a42", "fuecoco a42", "cinderace v c60").
    // Risultati di Cardmarket del 09/11: "fuecoco a42" e "ba a42" portano dritto alla carta,
    // "ba c30"/"ba c60"/"ba p60" danno più carte (anni diversi; alcune BA20/BA22 hanno nello
    // slug il codice del set originale, es. Cinderace-V-FST043 = BA22 C60).
    console.log('');
    const BA_PAGINE = [
      ['fuecoco a42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', true],
      ['FUECOCO A42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', true],
      ['ba a42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', true],
      ['fuecoco ba a42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', true],
      ['ba24 a42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', true],
      ['cinderace v c60', 'Cinderace V', 'BA22 C60', 'Cinderace-V-FST043', true],
      ['charmeleon c30', 'Charmeleon', 'BA20 C30', 'Charmeleon-V2-BA20C30', true],
      ['pikachu a42', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', false],
      ['ba a41', 'Fuecoco', 'BA24 A42', 'Fuecoco-BA24A42', false],
      ['fuecoco a42', 'Fuecoco', 'SVI 036', 'Fuecoco-SVI036', false],
      ['ba c30', 'Centiskorch', 'BA22 C30', 'Centiskorch-V2-BA22C30', true],
    ];
    for (const [q, nome, codice, s, atteso] of BA_PAGINE) {
      uguale(`Battle Academy: pagina "${nome} (${codice})" per "${q}"`, ctx._paginaCombaciaConQuery(q, nome, codice, s), atteso);
    }
    const BA_CASI = [
      ['ba c30', L('Battle-Academy-2020/Charmeleon-V2-BA20C30', 'Battle-Academy-2022/Centiskorch-V2-BA22C30'), ['Charmeleon-V2-BA20C30', 'Centiskorch-V2-BA22C30']],
      ['centiskorch c30', L('Battle-Academy-2020/Charmeleon-V2-BA20C30', 'Battle-Academy-2022/Centiskorch-V2-BA22C30'), 'Centiskorch-V2-BA22C30'],
      ['ba c60', L('Battle-Academy-2020/Charizard-GX-HIF9', 'Battle-Academy-2022/Cinderace-V-FST043'), ['Charizard-GX-HIF9', 'Cinderace-V-FST043']],
      ['cinderace v c60', L('Battle-Academy-2020/Charizard-GX-HIF9', 'Battle-Academy-2022/Cinderace-V-FST043'), 'VERIFICA'],
      ['ba p60', L('Battle-Academy-2022/Pikachu-V-VIV43', 'Battle-Academy-2020/Raichu-GX-HIF20', 'Battle-Academy-2024/Pikachu-ex-BA24P60'), ['Pikachu-ex-BA24P60', 'Pikachu-V-VIV43', 'Raichu-GX-HIF20']],
      ['pikachu ex p60', L('Battle-Academy-2022/Pikachu-V-VIV43', 'Battle-Academy-2020/Raichu-GX-HIF20', 'Battle-Academy-2024/Pikachu-ex-BA24P60'), 'Pikachu-ex-BA24P60'],
      ['ba a14', L('Battle-Academy-2024/Fuecoco-BA24A14', 'Battle-Academy-2024/Fuecoco-BA24A17', 'Battle-Academy-2024/Crocalor-BA24A15', 'SM-Trainer-Kit-Lycanroc-Alolan-Raichu/Zubat-TK10A11'), 'Fuecoco-BA24A14'],
      // senza "ba" né nome resta tutto come prima; nome + numero normale non cambia
      ['Pikachu 25', L('Base-Set/Pikachu-V1-BS58', 'Battle-Academy-2024/Pikachu-ex-BA24P60'), ['Pikachu-V1-BS58', 'Pikachu-ex-BA24P60']],
    ];
    for (const [q, links, atteso] of BA_CASI) {
      uguale(`Battle Academy: "${q}" con ${links.length} link`, esito(ctx._trovaMatchCartaSingola(links, q)), atteso);
    }
    uguale('"ba a42": nessun codice attaccato (BAA42 su Cardmarket non trova niente)', ctx._codiceRicercaCompatto('ba a42'), null);
    uguale('"ba24 a42": codice attaccato', ctx._codiceRicercaCompatto('ba24 a42'), 'BA24A42');

    const FUECOCO = B + 'Battle-Academy-2024/Fuecoco-BA24A42';
    const fb = caricaBackground({ fetch: async (url) => (url === ctx._urlRicercaAutonoma('fuecoco a42') ? rispostaFinta(paginaCarta('Fuecoco', 'BA24 A42', FUECOCO)) : null) }).ctx;
    const ff = await fb._risolviSinglesENomeFetch(ctx._urlRicercaAutonoma('fuecoco a42'), '');
    uguale('fetch "fuecoco a42" rimandata alla carta', [ff.urlSingles, ff.codice], [FUECOCO, 'BA24 A42']);
    const db = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: FUECOCO, testoH1: 'Fuecoco (BA24 A42)', hrefs: [] }, 'ba a42', true, '');
    uguale('scheda "ba a42": carta accettata', [slug(db.urlSingles), db.codice], ['Fuecoco-BA24A42', 'BA24 A42']);
  }

  if (maj > 5 || (maj === 5 && min >= 57)) {
    // Dalla 5.57: WCD senza anno o senza set ("gardevoir wcd 061", "gardevoir wcd cre 061",
    // "gardevoir wcd23 061"). Su Cardmarket nome + "wcd" + numero non trova niente: si cerca
    // "gardevoir wcd" e si sceglie per numero. Risultati di Cardmarket del 09/11.
    console.log('');
    const GARDEVOIR = L('WCD-2025/Live-Code-Card-WCD-2025-Riley-McKay-Flutter-Devo-Gardevoir-WCD25', 'WCD-2025/Gardevoir-ex-WCD25086',
      'WCD-2023/Gardevoir-WCD23CRE-061', 'WCD-2023/Gardevoir-ex-WCD23SVI-086', 'WCD-2008/Gardevoir-LVX-WCD08SW-131',
      'WCD-2017/Gardevoir-GX-WCD17BUS-093', 'WCD-2004/Gardevoir-ex-WCD04SS-96', 'WCD-2004/Gardevoir-WCD04RS-7',
      'WCD-2008/Gardevoir-Lv55-WCD08SW-007', 'WCD-2010/Gardevoir-Lv55-WCD10SW-007', 'WCD-2010/Gardevoir-LVX-WCD10SW-131');
    const WCD_RICERCHE = [
      ['gardevoir wcd 061', 'gardevoir wcd'], ['Gardevoir ex WCD 086', 'Gardevoir ex wcd'], ['gardevoir wcd cre 061', 'gardevoir wcd CRE'],
      ['gardevoir wcd23 061', 'gardevoir wcd'], ['wcd 062', 'wcd 062'], ['WCD22 BRS 123', null], ['Gardevoir 061', null],
    ];
    for (const [q, atteso] of WCD_RICERCHE) { const w = ctx._wcdDaQuery(q); uguale(`WCD: testo cercato per "${q}"`, w ? w.testoRicerca : null, atteso); }
    uguale('WCD: "gardevoir wcd23 061" non si attacca (WCD23061 non esiste)', new URL(ctx._urlRicercaAutonoma('gardevoir wcd23 061')).searchParams.get('searchString'), 'gardevoir wcd23 061');
    uguale('WCD: "wcd22 brs 123" si attacca come prima', new URL(ctx._urlRicercaAutonoma('wcd22 brs 123')).searchParams.get('searchString'), 'WCD22BRS123');
    uguale('WCD: "gardevoir wcd 061" nessun codice attaccato', ctx._codiceRicercaCompatto('gardevoir wcd 061'), null);
    const WCD_CASI = [
      ['gardevoir wcd 061', GARDEVOIR, 'Gardevoir-WCD23CRE-061'],
      ['gardevoir wcd 61', GARDEVOIR, 'Gardevoir-WCD23CRE-061'],
      ['gardevoir wcd 086', GARDEVOIR, ['Gardevoir-ex-WCD25086', 'Gardevoir-ex-WCD23SVI-086']],
      ['gardevoir wcd25 086', GARDEVOIR, 'Gardevoir-ex-WCD25086'],
      ['gardevoir wcd svi 086', GARDEVOIR, 'Gardevoir-ex-WCD23SVI-086'],
      ['gardevoir wcd 7', GARDEVOIR, ['Gardevoir-WCD04RS-7', 'Gardevoir-Lv55-WCD08SW-007', 'Gardevoir-Lv55-WCD10SW-007']],
      ['gardevoir wcd 062', GARDEVOIR, null],
      ['wcd 062', L('WCD-2009/Gastly-Lv14-WCD09STF-062', 'WCD-2013/Sableye-WCD13DEX-062', 'WCD-2004/Magnemite-WCD04DR-62', 'WCD-2018/Evosoda-WCD18GEN-062'),
        ['Gastly-Lv14-WCD09STF-062', 'Sableye-WCD13DEX-062', 'Magnemite-WCD04DR-62', 'Evosoda-WCD18GEN-062']],
      ['charizard wcd 20', L('WCD-2019/Reshiram-Charizard-GX-V2-WCD19UNB-020', 'Unbroken-Bonds/Reshiram-Charizard-GX-V1-s8aUNB-020'), 'Reshiram-Charizard-GX-V2-WCD19UNB-020'],
    ];
    for (const [q, links, atteso] of WCD_CASI) uguale(`WCD: "${q}" con ${links.length} link`, esito(ctx._trovaMatchCartaSingola(links, q)), atteso);
    const WCD_PAGINE = [
      ['gardevoir wcd 061', 'Gardevoir', 'WCD23 CRE 061', 'Gardevoir-WCD23CRE-061', true],
      ['gardevoir wcd cre 061', 'Gardevoir', 'CRE 061', 'Gardevoir-CRE061', false],
      ['gardevoir wcd cre 061', 'Gardevoir', 'WCD23 CRE 061', 'Gardevoir-WCD23CRE-061', true],
      ['gardevoir wcd 086', 'Gardevoir ex', 'WCD25 086', 'Gardevoir-ex-WCD25086', true],
      ['gardevoir wcd23 086', 'Gardevoir ex', 'WCD25 086', 'Gardevoir-ex-WCD25086', false],
      ['zeraora gx wcd 86', 'Zeraora GX', 'WCD19 LOT 086', 'Zeraora-GX-WCD19LOT-086', true],
    ];
    for (const [q, nome, codice, sl, atteso] of WCD_PAGINE) uguale(`WCD: pagina "${nome} (${codice})" per "${q}"`, ctx._paginaCombaciaConQuery(q, nome, codice, sl), atteso);

    // giro completo: si cerca "gardevoir wcd", si prende la 061 e si legge la sua pagina
    const ric = (t) => `${CM}/it/Pokemon/Products/Search?searchMode=v2&searchString=${encodeURIComponent(t).replace(/%20/g, '+')}`;
    const lista = (links) => `<html><head><meta property="og:url" content="${CM}/it/Pokemon/Products/Search"><title>Risultati</title></head><body><h1>Risultati Di Ricerca</h1>${links.map(x => `<a href="${x.replace(CM, '')}">x</a>`).join('')}</body></html>`;
    const G061 = B + 'WCD-2023/Gardevoir-WCD23CRE-061';
    const prezzoRiga = `<div class="article-row"><div class="product-attributes"><span aria-label="Italiano"></span></div><div class="price-container"><span class="fw-bold">1,00 €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
    const pagG061 = paginaCarta('Gardevoir', 'WCD23 CRE 061', G061).replace('</body>', prezzoRiga + '<a id="account-dropdown">u</a></body>');
    const mappa = { [ric('gardevoir wcd')]: lista(GARDEVOIR), [G061]: pagG061 };
    const chiesti = [];
    const { ctx: c } = caricaBackground({ version: versione, accelera: 10, pagine: { [G061]: pagG061 }, fetch: async (url) => { chiesti.push(url); return mappa[url] ? rispostaFinta(mappa[url]) : null; } });
    const r = await c._leggiNomeDaCardmarket(c._urlRicercaAutonoma('gardevoir wcd 061'), 'IT', 'NM', '', false, 0, null, null, null);
    uguale('WCD: giro "gardevoir wcd 061" → la carta WCD23 CRE 061, una sola ricerca',
      [slug(r.urlSingles), chiesti.filter(u => u.includes('/Search?')).map(u => new URL(u).searchParams.get('searchString'))],
      ['Gardevoir-WCD23CRE-061', ['gardevoir wcd']]);
    const chiesti2 = [];
    const { ctx: c2 } = caricaBackground({ version: versione, accelera: 10, fetch: async (url) => { chiesti2.push(url); return mappa[url] ? rispostaFinta(mappa[url]) : null; } });
    const r2 = await c2._leggiNomeDaCardmarket(c2._urlRicercaAutonoma('gardevoir wcd 086'), 'IT', 'NM', '', false, 0, null, null, null);
    uguale('WCD: giro "gardevoir wcd 086" → scelta tra WCD25 e WCD23', [r2.disambiguation, (r2.opzioni || []).map(o => slug(o.urlSingles))], [true, ['Gardevoir-ex-WCD25086', 'Gardevoir-ex-WCD23SVI-086']]);
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
