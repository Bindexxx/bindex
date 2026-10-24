// Lettura delle pagine di Cardmarket con pagine finte (nessuna rete):
// link vecchi che portano alla lista dell'espansione, ricerca di riserva per nome,
// "troppe richieste" (429), testo della ricerca con "&", decisione dalla scheda,
// content.js su una lista, offerte non comprabili. Casi presi da pagine vere viste
// il 23/10/2026. Dalla versione 5.36.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const CM = 'https://www.cardmarket.com';
const B = CM + '/it/Pokemon/Products/Singles/';

// shared.js + content.js come li carica Chrome (manifest, content_scripts): stesso
// ambito globale, quindi le costanti di shared.js (es. TEMPO_MAX_LETTURA_MS dalla
// 5.40) si vedono da content.js. Due eval separati non lo farebbero.
const scriptCardmarket = () => fs.readFileSync(path.join(cartellaEstensione(), 'shared.js'), 'utf8') + '\n;\n'
  + fs.readFileSync(path.join(cartellaEstensione(), 'content.js'), 'utf8');
const link = (slug) => `<a href="/it/Pokemon/Products/Singles/${slug}">${slug}</a>`;
const PAGINE = {
  // Link vecchio: Cardmarket rimanda alla lista dell'espansione (prima pagina, senza Magikarp).
  [B + 'HeartGold-SoulSilver/Magikarp-HS72']: `<html><head><title>Singole HeartGold &amp; SoulSilver | Cardmarket</title></head><body>
    <div class="alert">Prodotto sbagliato!</div><h1>Singole HeartGold &amp; SoulSilver</h1>
    ${['HeartGold-SoulSilver/Growlithe-V1-HS65', 'HeartGold-SoulSilver/Slowpoke-HS81', 'HeartGold-SoulSilver/Totodile-V1-HS86'].map(link).join('')}</body></html>`,
  // Ricerca per nome: due versioni vere.
  [CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=MAGIKARP+HS+72']: `<html><head><title>Risultati Di Ricerca | Cardmarket</title></head><body><h1>Risultati Di Ricerca</h1>
    ${['HeartGold-SoulSilver/Magikarp-V1-HS72', 'HeartGold-SoulSilver/Magikarp-V2-HS72'].map(link).join('')}</body></html>`,
  // Ricerca "NOME SET NUMERO" con due risultati, uno giusto.
  [CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=ZUBAT+SIT+103']: `<html><head><title>Risultati Di Ricerca | Cardmarket</title></head><body><h1>Risultati Di Ricerca</h1>
    ${['Silver-Tempest/Zubat-SIT103', 'Trainer-Gallery/Zubat-BOO23SIT-103'].map(link).join('')}</body></html>`,
  [B + 'Silver-Tempest/Zubat-SIT103']: `<html><head><title>Zubat | Cardmarket</title></head><body><h1>Zubat <span>Silver Tempest</span>(SIT 103)</h1></body></html>`,
};

(async () => {
  const EXT = cartellaEstensione();
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj < 5 || (maj === 5 && min < 36)) { console.log(`Versione ${versione}: prove dalla 5.36, saltate.`); process.exit(0); }
  // Dalla 5.43 (Fase 6.2) un link diretto non si scarica più prima: lo legge la scheda
  // del prezzo (pagine finte), e dalla ricerca non si scarica più la pagina della carta.
  const dalla543 = maj > 5 || (maj === 5 && min >= 43);

  const richieste = [];
  const { ctx } = caricaBackground({
    fetch: async (url) => {
      richieste.push(url);
      if (url.includes('searchString=TROPPE')) return rispostaFinta('Too Many Requests', 429, { 'retry-after': '60' });
      if (PAGINE[url]) return rispostaFinta(PAGINE[url]);
      return null;
    },
  });

  // 1.1 testo della ricerca con "&"
  const u = new URL(ctx._urlRicercaAutonoma('PIKACHU & ZEKROM GX TEU 33'));
  uguale('ricerca con "&": testo intero', u.searchParams.get('searchString'), 'PIKACHU & ZEKROM GX TEU 33');
  const us = new URL(ctx._urlRicercaSealedAutonoma('Scarlet & Violet Booster Box', 'IT'));
  uguale('ricerca sealed con "&": testo intero', us.searchParams.get('searchString'), 'Scarlet & Violet Booster Box');
  uguale('ricerca sealed: filtro lingua', us.searchParams.get('language'), '5');

  // 1.4 link vecchio → "link non valido" (non più le carte della lista)
  const r1 = await ctx._risolviSinglesENomeFetch(B + 'HeartGold-SoulSilver/Magikarp-HS72', '');
  controlla('link vecchio: riconosciuto come non valido', r1.linkNonValido === true && !r1.disambiguation, r1);

  // 1.4 ripiego: ricerca per nome → le 2 versioni vere, con il motivo
  richieste.length = 0;
  if (!dalla543) {
    const r2 = await ctx._leggiNomeDaCardmarket(B + 'HeartGold-SoulSilver/Magikarp-HS72', 'IT', 'NM', '', false, 0, null, null,
      ctx._urlRicercaAutonoma('MAGIKARP HS 72'));
    uguale('link vecchio + ricerca per nome: scelta tra le 2 versioni vere',
      (r2.opzioni || []).map(o => o.urlSingles.split('/').pop()), ['Magikarp-V1-HS72', 'Magikarp-V2-HS72']);
    controlla('link vecchio + ricerca per nome: motivo "link non valido"', r2.linkNonValido === true && r2.disambiguation === true, r2);
    uguale('link vecchio + ricerca: 2 richieste in tutto (nessun tentativo ripetuto)', richieste.length, 2);
  } else {
    // La scheda del prezzo apre il link vecchio, Cardmarket la rimanda alla lista
    // dell'espansione → link non valido → ricerca per nome (scaricata).
    const conScheda = caricaBackground({
      fetch: async (url) => { richieste.push(url); return PAGINE[url] ? rispostaFinta(PAGINE[url]) : null; },
      pagine: { [B + 'HeartGold-SoulSilver']: PAGINE[B + 'HeartGold-SoulSilver/Magikarp-HS72'] },
      rimandi: { [B + 'HeartGold-SoulSilver/Magikarp-HS72']: B + 'HeartGold-SoulSilver' },
      sharedJs: fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'),
    });
    const r2 = await conScheda.ctx._leggiNomeDaCardmarket(B + 'HeartGold-SoulSilver/Magikarp-HS72', 'IT', 'NM', '', false, 0, null, null,
      conScheda.ctx._urlRicercaAutonoma('MAGIKARP HS 72'));
    uguale('link vecchio + ricerca per nome: scelta tra le 2 versioni vere',
      (r2.opzioni || []).map(o => o.urlSingles.split('/').pop()), ['Magikarp-V1-HS72', 'Magikarp-V2-HS72']);
    controlla('link vecchio + ricerca per nome: motivo "link non valido"', r2.linkNonValido === true && r2.disambiguation === true, r2);
    const pagineAperte = conScheda.env.log.tabs.filter(t => t[0] === 'create' || t[0] === 'update').length;
    uguale('link vecchio + ricerca: 2 richieste in tutto (la scheda e la ricerca)', [pagineAperte, richieste.length], [1, 1]);
  }

  // 1.2 ricerca "NOME SET NUMERO" dal fetch: scelta giusta senza chiedere
  richieste.length = 0;
  const r3 = await ctx._risolviSinglesENomeFetch(ctx._urlRicercaAutonoma('ZUBAT SIT 103'), '');
  uguale('"ZUBAT SIT 103": presa Zubat-SIT103', (r3.urlSingles || '').split('/').pop(), 'Zubat-SIT103');
  if (!dalla543) uguale('"ZUBAT SIT 103": nome e codice dalla pagina', [r3.nome, r3.codice], ['Zubat', 'SIT 103']);
  else uguale('"ZUBAT SIT 103": una sola richiesta (nome e codice li legge poi la scheda)', [richieste.length, r3.nome, r3.codice], [1, null, null]);

  // 1.8 429
  const r4 = await ctx._risolviSinglesENomeFetch(ctx._urlRicercaAutonoma('TROPPE 1'), '');
  controlla('429: rate limit, nessuna scheda di riserva', r4.rateLimited === true && !r4.fetchFailed, r4);

  // 1.3 decisione dai dati della scheda
  const dLista = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: B + 'HeartGold-SoulSilver', testoH1: 'Singole HeartGold & SoulSilver', hrefs: [] }, '', false, B + 'HeartGold-SoulSilver/Magikarp-HS72');
  controlla('scheda: lista dopo un link diretto = link non valido', dLista.linkNonValido === true, dLista);
  const dRic = ctx._decidiRisoluzioneDaScheda({ tipo: 'ricerca', hrefs: [B + 'Silver-Tempest/Zubat-SIT103', B + 'Trainer-Gallery/Zubat-BOO23SIT-103'], searchString: 'ZUBAT SIT 103' }, 'ZUBAT SIT 103', true, '');
  uguale('scheda: ricerca "ZUBAT SIT 103"', (dRic.urlSingles || '').split('/').pop(), 'Zubat-SIT103');
  const dCarta = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: B + 'Silver-Tempest/Zubat-SIT103', testoH1: 'Zubat (SIT 103)', hrefs: [] }, 'ZUBAT SIT 103', true, '');
  uguale('scheda: ricerca rimandata alla carta giusta', [dCarta.nome, dCarta.codice], ['Zubat', 'SIT 103']);
  const dSbagliata = ctx._decidiRisoluzioneDaScheda({ tipo: 'singles', url: B + 'Obsidian-Flames/Charizard-ex-OBF223', testoH1: 'Charizard ex (OBF 223)', hrefs: [] }, 'Charizard ex OBF 125', true, '');
  controlla('scheda: ricerca rimandata alla carta sbagliata = scartata', !dSbagliata.urlSingles, dSbagliata);

  // 1.3 lettura con la scheda (quando il fetch è bloccato da Cloudflare): gli script
  // iniettati girano su pagine finte, la scelta la fa il service worker.
  const offerta = (prezzo) => `<div class="article-row"><div class="product-attributes"><span aria-label="Italiano"></span><a class="article-condition condition-nm"></a></div><div class="price-container"><span class="fw-bold">${prezzo} €</span></div><a class="btn btn-sm btn-primary"><span class="fonticon-cart"></span></a></div>`;
  const RIC = (q) => CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=' + q;
  const pagine = {
    [RIC('ZUBAT+SIT+103')]: PAGINE[CM + '/it/Pokemon/Products/Search?searchMode=v2&searchString=ZUBAT+SIT+103'],
    [B + 'Silver-Tempest/Zubat-SIT103']: `<html><body><h1>Zubat <span>x</span>(SIT 103)</h1>${offerta('0,25')}${offerta('0,30')}</body></html>`,
    [B + 'HeartGold-SoulSilver']: PAGINE[B + 'HeartGold-SoulSilver/Magikarp-HS72'],
    [RIC('Tynamo+FST+95')]: `<html><body><h1>Risultati</h1>${link('Fusion-Strike/Tynamo')}</body></html>`,
    [B + 'Fusion-Strike/Tynamo']: `<html><body><h1>Tynamo (FST 095)</h1>${offerta('0,05')}</body></html>`,
    [RIC('Charizard+ex+OBF+125')]: `<html><body><h1>Risultati</h1>${link('Obsidian-Flames/Charizard-ex')}</body></html>`,
    [B + 'Obsidian-Flames/Charizard-ex']: `<html><body><h1>Charizard ex (OBF 223)</h1>${offerta('20,00')}</body></html>`,
  };
  const scheda = caricaBackground({ pagine, rimandi: { [B + 'HeartGold-SoulSilver/Magikarp-HS72']: B + 'HeartGold-SoulSilver' }, sharedJs: fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8') }).ctx;
  const t1 = await scheda._risolviNomeEPrezzoUnicaTab(RIC('ZUBAT+SIT+103'), 'IT', 'NM');
  uguale('scheda, "ZUBAT SIT 103": carta, nome, codice, prezzo', [(t1.urlSingles || '').split('/').pop(), t1.nome, t1.codice, t1.prezzo], ['Zubat-SIT103', 'Zubat', 'SIT 103', 0.25]);
  const t2 = await scheda._risolviNomeEPrezzoUnicaTab(B + 'HeartGold-SoulSilver/Magikarp-HS72', 'IT', 'NM');
  controlla('scheda, link vecchio: link non valido', t2.linkNonValido === true && !t2.urlSingles, t2);
  const t3 = await scheda._risolviNomeEPrezzoUnicaTab(RIC('Tynamo+FST+95'), 'IT', 'NM');
  uguale('scheda, un solo risultato senza codice nello slug, h1 giusto: accettato', [(t3.urlSingles || '').split('/').pop(), t3.codice, t3.prezzo], ['Tynamo', 'FST 095', 0.05]);
  const t4 = await scheda._risolviNomeEPrezzoUnicaTab(RIC('Charizard+ex+OBF+125'), 'IT', 'NM');
  controlla('scheda, un solo risultato con h1 sbagliato (OBF 223): scartato', !t4.urlSingles && t4.nonTrovata === true, t4);

  // 1.5 content.js sulla lista dell'espansione → 'LinkNonValido' subito
  const mandati = [];
  const dom = new JSDOM(`<html><head><title>Singole HeartGold &amp; SoulSilver | Cardmarket</title></head><body><h1>Singole HeartGold &amp; SoulSilver</h1></body></html>`,
    { url: B + 'HeartGold-SoulSilver', runScripts: 'outside-only' });
  dom.window.chrome = { runtime: { sendMessage: (m, cb) => { mandati.push(m); if (cb) cb(); }, lastError: undefined } };
  dom.window.scrollTo = () => {}; // jsdom non li ha
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { get() { return this.textContent; } });
  dom.window.eval(scriptCardmarket());
  uguale('content.js su una lista: prezzo "LinkNonValido"', mandati.filter(m => m.type === 'PREZZO_TROVATO').map(m => m.prezzo), ['LinkNonValido']);
  dom.window.close();
  // ...e su una pagina carta normale no.
  const mandati2 = [];
  const dom2 = new JSDOM(`<html><head><title>Zubat | Cardmarket</title></head><body><h1>Zubat <span>x</span>(SIT 103)</h1></body></html>`,
    { url: B + 'Silver-Tempest/Zubat-SIT103?language=5&minCondition=2', runScripts: 'outside-only' });
  dom2.window.chrome = { runtime: { sendMessage: (m, cb) => { mandati2.push(m); if (cb) cb(); }, lastError: undefined } };
  dom2.window.scrollTo = () => {};
  Object.defineProperty(dom2.window.HTMLElement.prototype, 'innerText', { get() { return this.textContent; } });
  dom2.window.eval(scriptCardmarket());
  await new Promise(r => setTimeout(r, 300));
  uguale('content.js su una pagina carta: nessun "LinkNonValido"', mandati2.filter(m => m.prezzo === 'LinkNonValido').length, 0);
  dom2.window.close();

  // 1.7 offerte non comprabili
  const riga = (html) => { const d = new JSDOM(`<div class="article-row">${html}</div>`); return d.window.document.querySelector('.article-row'); };
  const sh = new JSDOM('', { runScripts: 'outside-only' });
  sh.window.eval(fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8'));
  const ok = (html) => sh.window.rigaCarrelloCliccabileShared(riga(html));
  uguale('carrello di oggi <a class="btn btn-primary">: comprabile', ok('<a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a>'), true);
  uguale('carrello grigio: non comprabile', ok('<a class="btn btn-grey" role="button"><span class="fonticon-cart"></span></a>'), false);
  uguale('carrello <button disabled>: non comprabile', ok('<button class="btn btn-primary" disabled><span class="fonticon-cart"></span></button>'), false);
  uguale('carrello aria-disabled: non comprabile', ok('<a class="btn btn-primary" aria-disabled="true"><span class="fonticon-cart"></span></a>'), false);

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
