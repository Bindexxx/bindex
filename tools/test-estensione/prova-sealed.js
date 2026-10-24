// Sealed (dalla 5.44, Fase 7 del piano):
//   7.1 ricerca con nomi italiani: oltre allo slug inglese si confronta il nome che la
//       ricerca mostra (testo del link, in italiano); vince il prodotto che contiene tutte
//       le parole cercate con meno parole in più; a pari merito scelta manuale. Stessa
//       scelta senza scheda (pagina scaricata) e con la scheda (dati grezzi dello script).
//   7.2 prezzo = prima offerta comprabile nella lingua della pagina (filtro di shared.js,
//       iniettato prima della lettura), non il primo prezzo della pagina.
// Pagine finte costruite come quelle viste su Cardmarket il 23/10 (D10 dell'audit).
const fs = require('fs');
const path = require('path');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const CM = 'https://www.cardmarket.com';
const P = CM + '/it/Pokemon/Products/';
const RIC = (q) => CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=' + encodeURIComponent(q).replace(/%20/g, '+') + '&language=5';
const slug = (u) => (u || '').split('?')[0].split('/').pop();

// Risultati della ricerca: per ogni prodotto un link-immagine senza testo e un link col nome.
const risultato = (perc, nome) => `<div class="row"><a href="/it/Pokemon/Products/${perc}"><img src="x.jpg"></a>
  <a href="/it/Pokemon/Products/${perc}">${nome}</a></div>`;
const ETB = [
  ['Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box', 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche'],
  ['Elite-Trainer-Boxes/Prismatic-Evolutions-Pokemon-Center-Elite-Trainer-Box', 'Set Allenatore Fuoriclasse Pok&eacute;mon Center di Evoluzioni Prismatiche'],
  ['Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box-10-Pack', 'Confezione da 10 Set Allenatore Fuoriclasse di Evoluzioni Prismatiche'],
  ['Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box-Empty', 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche: scatola vuota'],
];
const OBF = [
  ['Booster-Boxes/Obsidian-Flames-Booster-Box', 'Box di buste di espansione Ossidiana Infuocata'],
  ['Booster-Boxes/Obsidian-Flames-Booster-Box-Case', 'Cassa di box di buste di espansione Ossidiana Infuocata'],
];
const paginaRicerca = (righe) => `<html><head><title>Risultati Di Ricerca | Cardmarket</title></head><body><h1>Risultati Di Ricerca</h1>
  <a href="/it/Pokemon/Products/Elite-Trainer-Boxes">Set Allenatore Fuoriclasse</a>${righe.map(([p, n]) => risultato(p, n)).join('')}</body></html>`;

// Offerta di un prodotto sealed (bandiera = primo span[aria-label]; carrello comprabile o grigio).
const offerta = (lingua, prezzo, comprabile = true) => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span></div>
  <div class="price-container"><span class="fw-bold">${prezzo} €</span></div>
  <a class="btn btn-sm ${comprabile ? 'btn-primary' : 'btn-grey'}" role="button"><span class="fonticon-cart"></span></a></div>`;
const paginaProdotto = (h1, offerte) => `<html><head><title>${h1} | Cardmarket</title>
  <meta property="og:image" content="https://static.cardmarket.com/img/logos/cardmarket.png"></head><body><a id="account-dropdown">utente</a>
  <img src="https://product-images.s3.cardmarket.com/1/PRE/1/1.jpg">
  <div class="info-list-container"><dl><dt>Da</dt><dd><span class="price-container"><span class="fw-bold">60,00 €</span></span></dd></dl></div>
  <h1>${h1}<span>Elite Trainer Boxes</span></h1>${offerte}</body></html>`;

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const [maj, min] = manifest.version.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 44)) { console.log(`Versione ${manifest.version}: prove dalla 5.44, saltate.`); process.exit(0); }
  console.log('Estensione provata:', EXT, '\n');

  const IT_ETB = 'Set Allenatore Fuoriclasse Evoluzioni Prismatiche';
  const EN_ETB = 'Prismatic Evolutions Elite Trainer Box';
  const htmlEtb = paginaRicerca(ETB);
  const htmlObf = paginaRicerca(OBF);
  const ETB_URL = P + ETB[0][0];

  // ── 7.1 scelta sui link della ricerca ────────────────────────────────────────
  {
    const { ctx } = caricaBackground({ version: manifest.version });
    const links = ctx._estraiLinkSealed(htmlEtb);
    const testi = ctx._testiLinkSealed(htmlEtb);
    uguale('ricerca: 4 prodotti (la categoria esclusa)', links.length, 4);
    uguale('nome mostrato dalla ricerca (entità decodificate, link-immagine senza testo ignorato)',
      testi.get(P + ETB[1][0]), ['Set Allenatore Fuoriclasse Pokémon Center di Evoluzioni Prismatiche']);
    uguale('nome italiano → Elite Trainer Box (non Pokémon Center, non confezione da 10, non scatola vuota)', slug(ctx._trovaMatchSealed(links, IT_ETB, testi)), slug(ETB_URL));
    uguale('nome inglese → stesso prodotto', slug(ctx._trovaMatchSealed(links, EN_ETB, testi)), slug(ETB_URL));
    uguale('nome inglese senza i testi (prima della 5.44 funzionava già)', slug(ctx._trovaMatchSealed(links, EN_ETB)), slug(ETB_URL));
    uguale('nome italiano in un altro ordine e minuscolo', slug(ctx._trovaMatchSealed(links, 'evoluzioni prismatiche set allenatore fuoriclasse', testi)), slug(ETB_URL));
    uguale('"Pokemon Center" senza accento → quella del Pokémon Center', slug(ctx._trovaMatchSealed(links, 'Set Allenatore Fuoriclasse Pokemon Center Evoluzioni Prismatiche', testi)), slug(P + ETB[1][0]));
    const dueEtb = [P + 'Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box', P + 'Elite-Trainer-Boxes/Surging-Sparks-Elite-Trainer-Box'];
    uguale('parole che non distinguono ("Elite Trainer Box", due espansioni): pari merito → scelta manuale', ctx._trovaMatchSealed(dueEtb, 'Elite Trainer Box'), null);
    const lObf = ctx._estraiLinkSealed(htmlObf);
    uguale('"Booster Box Obsidian Flames" (esempio del sito, parole in altro ordine) → il box', slug(ctx._trovaMatchSealed(lObf, 'Booster Box Obsidian Flames', ctx._testiLinkSealed(htmlObf))), 'Obsidian-Flames-Booster-Box');
    const opz = ctx._opzioniSealed(links, testi);
    uguale('scelta manuale con i nomi italiani', opz.map(o => o.label)[0], 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche');
  }

  // ── 7.1 + 7.2 dall'inizio alla fine: ricerca scaricata, scheda del prezzo ─────
  const offerte = offerta('Inglese', '70,00') + offerta('Italiano', '75,00', false) + offerta('Italiano', '80,90') + offerta('Italiano', '79,00');
  const pagine = {
    [ETB_URL]: paginaProdotto('Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', offerte),
    [P + 'Elite-Trainer-Boxes/Solo-Inglese-ETB']: paginaProdotto('Solo Inglese ETB', offerta('Inglese', '50,00')),
    [RIC(IT_ETB)]: htmlEtb,
  };
  const richieste = [];
  const { ctx, env } = caricaBackground({
    version: manifest.version, pagine, sharedJs: fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'), accelera: 10,
    fetch: async (url) => {
      richieste.push(url);
      if (url.startsWith(CM + '/it/Pokemon/Products/Search')) return rispostaFinta(htmlEtb);
      if (url.split('?')[0] === ETB_URL) return rispostaFinta(pagine[ETB_URL]);
      return null;
    },
  });
  for (const [etichetta, q] of [['italiano', IT_ETB], ['inglese', EN_ETB]]) {
    const r = await ctx._leggiNomeSealedDaCardmarket(ctx._urlRicercaSealedAutonoma(q, 'IT'), 'IT', 0, null, null);
    uguale(`nome ${etichetta}: prodotto, lingua, nome dall'h1`, [slug(r.urlProdotto), (r.urlProdotto || '').split('?')[1], r.nome], [slug(ETB_URL), 'language=5', 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche']);
    uguale(`nome ${etichetta}: prezzo = prima offerta comprabile in italiano (non la riga "Da" né l'inglese né quella col carrello grigio)`, r.prezzo, 80.9);
  }
  // Pagina senza shared.js (come su Cardmarket dalla 5.42): va iniettato prima di leggere,
  // altrimenti il filtro manca e si prende la prima offerta (inglese, 70 €).
  const senzaShared = caricaBackground({ version: manifest.version, pagine, accelera: 10 });
  const rs = await senzaShared.ctx._leggiPrezzoSealed(ETB_URL + '?language=5', null, null);
  const iniettati = (senzaShared.env.log.fileEseguiti || []).filter(f => f.file === 'shared.js').length;
  uguale('shared.js iniettato nella scheda del prezzo prima della lettura (prezzo filtrato)', [iniettati, rs.prezzo], [1, 80.9]);

  // Stessa scelta quando la ricerca si legge nella scheda (fetch bloccato).
  const viaScheda = await ctx._risolviProdottoSealedTab(RIC(IT_ETB), 'IT', null, null);
  uguale('scheda della ricerca, nome italiano → Elite Trainer Box con ?language=5', [slug(viaScheda.urlProdotto), (viaScheda.urlProdotto || '').split('?')[1]], [slug(ETB_URL), 'language=5']);

  // Nessuna offerta comprabile nella lingua: niente prezzo (prima: il primo della pagina).
  const soloEn = await ctx._leggiPrezzoSealed(P + 'Elite-Trainer-Boxes/Solo-Inglese-ETB?language=5', null, null);
  uguale('solo offerte inglesi con ?language=5: nessun prezzo, nome letto', [soloEn.prezzo, soloEn.nome], [null, 'Solo Inglese ETB']);
  controlla('nessun errore nel service worker', env.log.errori.length === 0, env.log.errori);

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
