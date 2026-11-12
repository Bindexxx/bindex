// Link col numero di prodotto (dalla 5.66). Le righe scelte dal catalogo del sito, quando il catalogo
// non ha la pagina della carta, arrivano come …/Products?idProduct=N. Il numero viene da TCGdex e a
// volte è di un'altra carta: il 12/11/2026 "Blissey PGO 052" (669498) ha aperto Snorlax PGO 055, che
// è stata aggiunta al suo posto. Ora la pagina letta deve avere il numero di carta chiesto, altrimenti
// si cerca per nome come per un link non più valido. Casi presi dalle righe vere del 12/11.
const fs = require('fs');
const path = require('path');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';
const prodotto = (id) => CM + '/it/Pokemon/Products?idProduct=' + id;
const slug = (u) => String(u || '').split('?')[0].split('/').pop();
const prezzoRiga = `<div class="article-row"><div class="product-attributes"><span aria-label="Italiano"></span></div><div class="price-container"><span class="fw-bold">1,00 €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
const paginaCarta = (nome, codice, url) => `<html><head><meta property="og:url" content="${url}">
  <meta property="og:image" content="https://product-images.s3.cardmarket.com/51/X/1/1.jpg">
  <title>${nome} | Cardmarket</title></head><body><h1>${nome}  (${codice})<span class="h4 text-muted"> Espansione - Singles</span></h1>
  ${prezzoRiga}<a id="account-dropdown">u</a></body></html>`;
const lista = (links) => `<html><head><meta property="og:url" content="${CM}/it/Pokemon/Products/Search"><title>Risultati</title></head><body><h1>Risultati Di Ricerca</h1>${links.map(x => `<a href="${x.replace(CM, '')}">x</a>`).join('')}</body></html>`;

(async () => {
  const EXT = cartellaEstensione();
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (!(maj > 5 || (maj === 5 && min >= 66))) { console.log(`Versione ${versione}: prova dalla 5.66, saltata`); chiudi(); return; }
  const sharedJs = fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8');
  const { ctx } = caricaBackground({ version: versione });

  // --- la regola da sola: testo della riga (come lo scrive il sito) e codice letto sulla pagina ---
  const CASI = [
    // [testo della riga, codice sulla pagina, porta altrove?]
    ['Blissey PGO 052', 'PGO 055', true],                 // il caso del 12/11: Snorlax al posto di Blissey
    ['Blissey PGO 052', 'PGO 052', false],
    ['Gengar AR 17', 'AR 16', true],                      // 278888 nel catalogo era AR 17, su Cardmarket è AR 16
    ['Jolteon JU 20', 'JU 4', true],                      // non olografica col numero dell'olografica
    // righe vere aggiunte bene il 12/11: la sigla di Cardmarket non è sempre quella del catalogo
    ['Zamazenta V BRS 163', 'BRS 163', false],
    ['Zekrom-ex BLK 034', 'XBLK 034', false],
    ['Applin PRE 009', 'XPRE 009', false],
    ['Dubwool di Hop JTG 136', 'XJTG 136', false],
    ['Bulbasaur RG 55', 'FL 55', false],
    ['Charmeleon TK2M 3', 'TK2 M3', false],
    ['Cyclizar-ex SVP 018', 'SVP 018', false],
    ['Calyrex Cavaliere Spettrale VMAX CRE 075', 'CRE 075', false],
    ['Blissey HS 36', 'HS 36', false],
    ['Mega Clefable-ex POR 031', 'POR 031', false],
    ['Porygon2 DRI 100', 'DRI 100', false],
    // senza numero da una delle due parti non si decide
    ['Appletun V FST 026', null, false],
    ['Appletun V FST 026', '', false],
    ['Pikachu', 'PGO 028', false],
  ];
  for (const [testo, codice, atteso] of CASI)
    uguale(`"${testo}" → pagina (${codice}): ${atteso ? 'altra carta' : 'va bene'}`, ctx._linkProdottoPortaAltrove(prodotto(1), ctx._urlRicercaAutonoma(testo), codice), atteso);
  // l'indirizzo di ricerca come lo scrive la pagina "Aggiungi carte" (spazi come +)
  uguale('ricerca scritta dalla pagina Aggiungi carte: stesso controllo',
    [ctx._linkProdottoPortaAltrove(prodotto(669498), CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=Blissey+PGO+052', 'PGO 055'),
     ctx._linkProdottoPortaAltrove(prodotto(669498), CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=Blissey+PGO+052', 'PGO 052')], [true, false]);
  uguale('link alla pagina della carta (non col numero di prodotto): mai controllato (i masterset promo hanno un numero progressivo)',
    ctx._linkProdottoPortaAltrove(B + 'Battle-Academy-2020/Switch-V3-SUM132', ctx._urlRicercaAutonoma('Switch BA20 48'), 'SUM 132'), false);
  uguale('senza ricerca di riserva: niente controllo', ctx._linkProdottoPortaAltrove(prodotto(669498), null, 'PGO 055'), false);

  // --- giro completo, il caso del 12/11: il numero di prodotto apre Snorlax, si cerca "Blissey PGO 052" ---
  {
    const SNORLAX = B + 'Pokemon-GO/Snorlax-V2-PGO055';
    const ricerca = ctx._urlRicercaAutonoma('Blissey PGO 052');
    const mappa = {
      [prodotto(669498)]: paginaCarta('Snorlax', 'PGO 055', SNORLAX),
      [ricerca]: lista([B + 'Pokemon-GO/Blissey-V1-PGO052', B + 'Pokemon-GO/Blissey-V2-PGO052']),
    };
    const chiesti = [];
    const { ctx: c, env } = caricaBackground({ version: versione, accelera: 20, sharedJs, pagine: { [SNORLAX]: paginaCarta('Snorlax', 'PGO 055', SNORLAX) },
      fetch: async (url) => { chiesti.push(url); return mappa[url] ? rispostaFinta(mappa[url]) : null; } });
    const r = await c._leggiNomeDaCardmarket(prodotto(669498), 'IT', 'NM', '', false, 0, null, null, ricerca);
    controlla('Blissey chiesta, Snorlax aperta: Snorlax non viene data come carta trovata', !r.urlSingles && r.nome == null, r);
    uguale('…si cerca per nome e si fa scegliere tra le due Blissey', [r.linkNonValido, r.disambiguation, (r.opzioni || []).map(o => slug(o.urlSingles || o))], [true, true, ['Blissey-V1-PGO052', 'Blissey-V2-PGO052']]);
    uguale('…su Cardmarket una lettura del numero di prodotto e una ricerca, niente altro',
      chiesti.filter(u => u.startsWith(CM)).map(u => u.includes('idProduct') ? 'prodotto' : u.includes('/Search?') ? 'ricerca' : u), ['prodotto', 'ricerca']);
    controlla('…nessun errore nel service worker', env.log.errori.length === 0, env.log.errori);
  }

  // --- il numero di prodotto giusto: la carta viene letta come prima, senza ricerche ---
  {
    const BLISSEY = B + 'Pokemon-GO/Blissey-V2-PGO052';
    const ricerca = ctx._urlRicercaAutonoma('Blissey PGO 052');
    const chiesti = [];
    const { ctx: c } = caricaBackground({ version: versione, accelera: 20, sharedJs, pagine: { [BLISSEY]: paginaCarta('Blissey', 'PGO 052', BLISSEY) },
      fetch: async (url) => { chiesti.push(url); return url === prodotto(669497) ? rispostaFinta(paginaCarta('Blissey', 'PGO 052', BLISSEY)) : null; } });
    const r = await c._leggiNomeDaCardmarket(prodotto(669497), 'IT', 'NM', '', false, 0, null, null, ricerca);
    uguale('numero di prodotto giusto: carta, codice e prezzo dalla sua pagina', [slug(r.urlSingles), r.nome, r.codice, r.prezzo, !!r.linkNonValido], ['Blissey-V2-PGO052', 'Blissey', 'PGO 052', 1, false]);
    uguale('…nessuna ricerca per nome', chiesti.filter(u => u.includes('/Search?')).length, 0);
  }

  // --- la ricerca per nome trova una carta sola: viene presa quella (link sostituito) ---
  {
    const AR16 = B + 'Arceus/Gengar-Lv44-AR16', AR17 = B + 'Arceus/Gengar-Lv46-AR17';
    const ricerca = ctx._urlRicercaAutonoma('Gengar AR 17');
    const mappa = { [prodotto(278888)]: paginaCarta('Gengar Lv.44', 'AR 16', AR16), [ricerca]: lista([AR17, AR16]), [AR17]: paginaCarta('Gengar Lv.46', 'AR 17', AR17) };
    const { ctx: c } = caricaBackground({ version: versione, accelera: 20, sharedJs,
      pagine: { [AR16]: paginaCarta('Gengar Lv.44', 'AR 16', AR16), [AR17]: paginaCarta('Gengar Lv.46', 'AR 17', AR17) },
      fetch: async (url) => (mappa[url] ? rispostaFinta(mappa[url]) : null) });
    const r = await c._leggiNomeDaCardmarket(prodotto(278888), 'IT', 'NM', '', false, 0, null, null, ricerca);
    uguale('"Gengar AR 17" col numero di AR 16: presa la AR 17 trovata per nome', [slug(r.urlSingles), r.codice, !!r.linkSostituito], ['Gengar-Lv46-AR17', 'AR 17', true]);
  }
  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
