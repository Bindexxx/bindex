// Sealed fase C (26/11/2026): scelta del prodotto sealed dal catalogo (sql/151).
// Prima in Node: come si legge quello che scrivi (utils/sealed-cerca.js) e che richiesta parte verso
// Supabase (data/sealed-catalogo.repository.js con un supabaseClient finto che registra la URL).
// Poi in Chromium con i file veri ui/entry.ui.js, ui/selettore-sealed.ui.js, ui/import-csv.ui.js,
// ui/queue-correzioni.ui.js, ui/widget-sealed.ui.js e un catalogo finto che filtra come il DB:
//   - Inserimento: pannello sotto la riga, filtri Tipo/Espansione, scelta → riga bloccata, salvataggio
//     con url_diretto e nome del catalogo; "Cambia" sblocca; nome libero resta testo; nome scritto
//     proprio come nel catalogo → link anche senza sceglierlo;
//   - Carte con problemi (riga sealed): "Scegli il prodotto" apre la finestra, la scelta rimette in
//     coda col link, "Riprova con il nome scritto" senza;
//   - Modifica sealed: "Cambia" sceglie dal catalogo, il salvataggio scrive url (con la lingua),
//     immagine, nome e espansione;
//   - Import CSV sealed: i nomi uguali al catalogo partono col link.
// Serve Playwright: PLAYWRIGHT_MODULE = modulo se non è installato qui, CHROME_PATH = Chrome.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const leggi = (f) => fs.readFileSync(path.join(RADICE, f), 'utf8');

// ───────────── Node: lettura del testo ─────────────
const ctx = {};
vm.createContext(ctx);
vm.runInContext(leggi('utils/sealed-cerca.js') + '\n;this.esporta = { SEALED_CATEGORIE, sealedNormalizza, sealedSlugDaNome, sealedParole, sealedLeggiTesto, sealedOrdina, sealedEspansioniDei, sealedAbbinaNomi, sealedUrlConLingua, sealedCategoriaDaUrl };', ctx);
const U = ctx.esporta;
const ESP = [{ id: 5001, nome: 'Evoluzioni Prismatiche' }, { id: 5002, nome: 'Scintille Folgoranti' }, { id: 5003, nome: 'Collect 151' }];

uguale('normalizza: accenti, apostrofi, punti', U.sealedNormalizza("Pokémon Ethan's CSV10.6C: Box"), 'pokemon ethans csv106c box');
uguale('slug come Cardmarket', U.sealedSlugDaNome('Zorua & Zoroark ex (18 Boosters)'), 'zorua-zoroark-ex-18-boosters');
uguale('parole utili (via "di", doppioni, "pokemon")', U.sealedParole('Box di buste di Pokémon box 151'), ['box', 'buste', '151']);
{
  const q = U.sealedLeggiTesto('etb evoluzioni', ESP);
  const g = JSON.parse(JSON.stringify(q.gruppi));
  uguale('ETB → testo o tipo Set Allenatore Fuoriclasse', g[0], { parola: 'etb', radice: 'etb', testi: ['etb', 'elite*trainer*box', 'allenatore*fuoriclasse'], categorie: ['Elite-Trainer-Boxes'], espansioni: [] });
  uguale('parola di un\'espansione → anche l\'espansione', g[1].espansioni, [5001]);
}
uguale('tin: solo il tipo (la parola è dentro troppe altre)', JSON.parse(JSON.stringify(U.sealedLeggiTesto('tin', []).gruppi[0])), { parola: 'tin', radice: 'tin', testi: [], categorie: ['Tins'], espansioni: [] });
uguale('bustina → "bust" o tipo Buste', JSON.parse(JSON.stringify(U.sealedLeggiTesto('bustina', []).gruppi[0])), { parola: 'bustina', radice: 'bustin', testi: ['bustin', 'bust'], categorie: ['Boosters'], espansioni: [] });
uguale('singolare e plurale: "prismatica" cerca "prismatic", anche nelle espansioni', [U.sealedLeggiTesto('prismatica', ESP).gruppi[0].testi, U.sealedLeggiTesto('prismatica', ESP).gruppi[0].espansioni], [['prismatic'], [5001]]);
uguale('una lettera sola non conta', U.sealedLeggiTesto('a x', []).gruppi.length, 0);
{
  const q = U.sealedLeggiTesto('etb prismatiche', ESP);
  const ordinati = U.sealedOrdina([
    { nome: 'Confezione di 10 Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-10-Elite-Trainer-Box-Case', categoria: 'Elite-Trainer-Boxes' },
    { nome: 'Set Allenatore Fuoriclasse Pokémon Center di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Pokemon-Center-Elite-Trainer-Box', categoria: 'Elite-Trainer-Boxes' },
    { nome: 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Elite-Trainer-Box', categoria: 'Elite-Trainer-Boxes' },
  ], q);
  uguale('ordine: il prodotto base prima delle versioni speciali e delle confezioni da 10', ordinati.map(p => p.slug)[0], 'Prismatic-Evolutions-Elite-Trainer-Box');
}
{
  const cat = [
    { nome: 'Busta di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Booster', url: 'u1' },
    { nome: 'Doppio', slug: 'Doppio-A', url: 'u2' }, { nome: 'Doppio', slug: 'Doppio-B', url: 'u3' },
  ];
  const m = U.sealedAbbinaNomi(['busta di evoluzioni prismatiche', 'Prismatic Evolutions Booster', 'Doppio', 'Altro'], cat);
  uguale('import: nome italiano (maiuscole/accenti a parte) e nome inglese dello slug', [m.get('busta di evoluzioni prismatiche')?.url, m.get('Prismatic Evolutions Booster')?.url], ['u1', 'u1']);
  controlla('import: due prodotti con lo stesso nome → nessuno', !m.has('Doppio') && !m.has('Altro'));
}
uguale('link con la lingua come l\'estensione', U.sealedUrlConLingua('https://www.cardmarket.com/it/Pokemon/Products/Boosters/X?language=1', 'IT'), 'https://www.cardmarket.com/it/Pokemon/Products/Boosters/X?language=5');
uguale('espansioni dei risultati, le più frequenti prima', U.sealedEspansioniDei([{ idEspansione: 2, espansione: 'B' }, { idEspansione: 1, espansione: 'A' }, { idEspansione: 2, espansione: 'B' }]).map(e => [e.id, e.quanti]), [[2, 2], [1, 1]]);

// ───────────── Node: richiesta a Supabase ─────────────
{
  const chiamate = [];
  const finto = {
    from(t) {
      const c = { tabella: t, filtri: [] };
      chiamate.push(c);
      const q = {
        select(col, o) { c.select = col; c.count = o && o.count; return q; },
        or(v) { c.filtri.push(['or', `(${v})`]); return q; },
        eq(k, v) { c.filtri.push([k, 'eq.' + v]); return q; },
        in(k, v) { c.filtri.push([k, 'in.' + v.join('|')]); return q; },
        order(k) { c.order = k; return q; },
        limit(n) { c.limit = n; return Promise.resolve({ data: [], error: null, count: 0 }); },
        then(r) { return Promise.resolve({ data: [], error: null }).then(r); },
      };
      return q;
    },
    storage: { from: (b) => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${b}/${p}` } }) }) },
  };
  const c2 = { supabaseClient: finto };
  vm.createContext(c2);
  vm.runInContext(leggi('data/sealed-catalogo.repository.js') + '\n;this.cerca = sealedCatalogoCerca; this.foto = sealedCatalogoFotoUrl; this.perNomi = sealedCatalogoPerNomi;', c2);
  (async () => {
    await c2.cerca([{ testi: ['etb', 'elite*trainer*box'], categorie: ['Elite-Trainer-Boxes'], espansioni: [] }, { testi: ['prismatiche'], categorie: [], espansioni: [5001] }], { categoria: 'Elite-Trainer-Boxes' }, 120);
    await c2.cerca([{ testi: ['box'], categorie: [], espansioni: [] }], {}, 120);
    await c2.cerca([{ testi: ["x'),evil"], categorie: ['Bad)Cat'], espansioni: ['1;'] }], {}, 10);
    const [a, b, c] = chiamate;
    uguale('più parole: un solo "or" con dentro "and" dei gruppi', a.filtri[0], ['or', '(and(or(nome.ilike.*etb*,slug.ilike.*etb*,nome.ilike.*elite*trainer*box*,slug.ilike.*elite*trainer*box*,categoria.in.(Elite-Trainer-Boxes)),or(nome.ilike.*prismatiche*,slug.ilike.*prismatiche*,id_espansione.in.(5001))))']);
    uguale('filtro Tipo come eq, conteggio esatto, limite', [a.filtri[1], a.count, a.limit, a.tabella], [['categoria', 'eq.Elite-Trainer-Boxes'], 'exact', 120, 'sealed_catalogo']);
    uguale('una parola: "or" semplice', b.filtri[0], ['or', '(nome.ilike.*box*,slug.ilike.*box*)']);
    uguale('caratteri strani tolti dalla richiesta', c.filtri[0], ['or', '(nome.ilike.*xevil*,slug.ilike.*xevil*)']);
    uguale('foto dal bucket pubblico sealed-foto', c2.foto('923873.webp'), 'https://x.supabase.co/storage/v1/object/public/sealed-foto/923873.webp');
    chiamate.length = 0;
    await c2.perNomi(['Busta X', 'Busta X'], ['busta-x', 'bad slug!']);
    uguale('import: nomi esatti con "in", slug senza badare alle maiuscole', chiamate.map(x => x.filtri[0]), [['nome', 'in.Busta X'], ['or', '(slug.ilike.busta-x)']]);
    await provaBrowser();
  })().catch(e => { console.error(e); process.exit(1); });
}

// ───────────── Chromium ─────────────
const B = 'https://www.cardmarket.com/it/Pokemon/Products/';
const STUB = `
  var CATALOGO_WIDGET = {};
  let _tipoInserimento = 'sealed';
  let _destinazioneInserimento = 'collezione';
  window.__coda = []; window.__avvisi = []; window.__ricerche = []; window.__eliminate = []; window.__aggiornati = [];
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function escapeJsAttr(s) { return String(s == null ? '' : s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'").replace(/"/g, '&quot;'); }
  function urlEsternoSicuro(u) { return /^https:/.test(u || '') ? u : null; }
  function _urlImmagineVisualizzabile(i) { return i; }
  async function authGetUserId() { return 'u-prova'; }
  async function assicuraLoginSupabase() {}
  async function queueInsertRighe(righe) { window.__coda.push(...[].concat(righe)); return { error: null }; }
  function mostraAvviso(t) { window.__avvisi.push(String(t)); }
  async function codaCarteUltimoInvio() { return { data: [], error: null }; }
  async function codaCarteConta() { return { count: 0, error: null }; }
  function _aggiornaPallinoMenu() {}
  async function correzioniManualiConta() { return { count: 0 }; }
  const CORR = [
    { id: 'c1', owner_id: 'u-prova', nome: 'etb prismatica', lingua: 'IT', tipo: 'sealed', destinazione: 'collezione', qty: 1, errore_msg: 'Non trovato', opzioni_disambiguazione: null, creato_il: '2026-11-26T10:00:00Z' },
    { id: 'c2', owner_id: 'u-prova', nome: 'box scintille', lingua: 'EN', tipo: 'sealed', destinazione: 'wishlist', qty: 2, errore_msg: 'Più risultati', creato_il: '2026-11-26T10:01:00Z',
      opzioni_disambiguazione: [{ urlSingles: '${B}Booster-Boxes/Surging-Sparks-Booster-Box', label: 'Box di buste di Scintille Folgoranti' }] },
  ];
  async function correzioniManualiLista() { return { data: CORR.filter(r => !window.__eliminate.includes(r.id)), error: null }; }
  async function correzioniManualiLeggiRiga(id) { return { data: CORR.find(r => r.id === id), error: null }; }
  async function correzioniManualiElimina(id) { window.__eliminate.push(id); return { error: null }; }
  async function sealedUpdate(id, agg) { window.__aggiornati.push({ id, agg }); return { error: null }; }
  async function movimentiCollezioneInsertRighe() { return { error: null }; }
  async function sealedListMie() { return { data: [{ id: 's1', nome: 'busta prismatiche', lingua: 'JP', qty: 1, prezzo: 5, url: 'https://www.cardmarket.com/x?language=7', immagine: null }], error: null }; }
  async function locationsList() { return { data: [], error: null }; }
  const CAT = [
    { url: '${B}Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box', id_prodotto: 1, categoria: 'Elite-Trainer-Boxes', id_espansione: 5001, nome: 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Elite-Trainer-Box', foto: '1.webp' },
    { url: '${B}Elite-Trainer-Boxes/Prismatic-Evolutions-Pokemon-Center-Elite-Trainer-Box', id_prodotto: 2, categoria: 'Elite-Trainer-Boxes', id_espansione: 5001, nome: 'Set Allenatore Fuoriclasse Pokémon Center di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Pokemon-Center-Elite-Trainer-Box', foto: null, foto_cm: 'https://product-images.s3.cardmarket.com/2.jpg' },
    { url: '${B}Boosters/Prismatic-Evolutions-Booster', id_prodotto: 3, categoria: 'Boosters', id_espansione: 5001, nome: 'Busta di Evoluzioni Prismatiche', slug: 'Prismatic-Evolutions-Booster', foto: '3.webp' },
    { url: '${B}Tins/Prismatic-Evolutions-Jolteon-Mini-Tin', id_prodotto: 4, categoria: 'Tins', id_espansione: 5001, nome: 'Evoluzioni Prismatiche: Jolteon Mini Tin', slug: 'Prismatic-Evolutions-Jolteon-Mini-Tin', foto: '4.webp' },
    { url: '${B}Booster-Boxes/Surging-Sparks-Booster-Box', id_prodotto: 5, categoria: 'Booster-Boxes', id_espansione: 5002, nome: 'Box di buste di Scintille Folgoranti', slug: 'Surging-Sparks-Booster-Box', foto: '5.webp' },
    { url: '${B}Elite-Trainer-Boxes/Surging-Sparks-Elite-Trainer-Box', id_prodotto: 6, categoria: 'Elite-Trainer-Boxes', id_espansione: 5002, nome: 'Set Allenatore Fuoriclasse di Scintille Folgoranti', slug: 'Surging-Sparks-Elite-Trainer-Box', foto: '6.webp' },
  ];
  async function sealedCatalogoEspansioni() { return { data: [{ id_espansione: 5001, nome: 'Evoluzioni Prismatiche' }, { id_espansione: 5002, nome: 'Scintille Folgoranti' }], error: null }; }
  // come il DB: ogni gruppo vale se nome/slug contengono un testo (* = qualunque cosa), o tipo/espansione combaciano
  async function sealedCatalogoCerca(gruppi, filtri, limite) {
    window.__ricerche.push({ gruppi: JSON.parse(JSON.stringify(gruppi)), filtri: { ...filtri } });
    const contiene = (v, t) => new RegExp(t.split('*').map(x => x.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*'), 'i').test(v.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''));
    let righe = CAT.filter(r => gruppi.every(g => g.testi.some(t => contiene(r.nome, t) || contiene(r.slug, t)) || g.categorie.includes(r.categoria) || g.espansioni.includes(r.id_espansione)));
    if (filtri.categoria) righe = righe.filter(r => r.categoria === filtri.categoria);
    if (filtri.espansione) righe = righe.filter(r => r.id_espansione === Number(filtri.espansione));
    return { data: righe.slice(0, limite), error: null, count: righe.length };
  }
  async function sealedCatalogoPerNomi(nomi, slugs) {
    return { data: CAT.filter(r => nomi.includes(r.nome) || slugs.includes(r.slug.toLowerCase())), error: null };
  }
  async function sealedCatalogoPerUrl(urls) { return { data: CAT.filter(r => urls.includes(r.url)), error: null }; }
  function sealedCatalogoFotoUrl(f) { return f ? 'https://x.supabase.co/storage/v1/object/public/sealed-foto/' + f : null; }
`;

async function provaBrowser() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const pg = await browser.newPage();
  const errori = [];
  pg.on('pageerror', (e) => errori.push(String(e.message || e).slice(0, 200)));
  const GIF = Buffer.from('R0lGODlhAQABAAAAACwAAAAAAQABAAA=', 'base64');
  await pg.route('**/*', r => r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/gif', body: GIF }) : r.abort());
  const modale = (leggi('index.html').match(/<div id="editSealedModal"[\s\S]*?\n    <\/div>\n/) || [''])[0];
  controlla('finestra Modifica sealed trovata in index.html, con la riga del prodotto', /id="editSealedProdotto"/.test(modale));
  await pg.setContent(`<!doctype html><html><head><style>${leggi('index.css').replace(/@import[^;]*;/g, '')}</style></head><body>
    <button id="btnSalvaCarte">Salva</button>
    <div id="inserimento" style="container-type:inline-size"><div class="ins-tabella-box"><table id="tabellaInserimentoSealed"><thead><tr><th>Nome</th><th>Lingua</th><th>Integrità</th><th>Qtà</th><th>Prezzo</th><th>Note</th><th></th></tr></thead><tbody id="entryTableBodySealed"></tbody></table></div></div>
    <div id="pannelloCarteProblemi" style="display:none"><div id="listaCarteProblemi"></div></div>
    <div id="impostazioni"><div id="importCsvVista"></div></div>
    ${modale}</body></html>`);
  await pg.addScriptTag({ content: STUB });
  for (const f of ['utils/sealed-cerca.js', 'ui/entry.ui.js', 'ui/selettore-sealed.ui.js', 'ui/queue-correzioni.ui.js', 'ui/import-csv.ui.js', 'ui/widget-sealed.ui.js']) {
    await pg.addScriptTag({ content: leggi(f) + '\n//# sourceURL=' + f });
  }
  const aspetta = (ms) => pg.waitForTimeout(ms);
  const scrivi = async (sel, testo) => { await pg.fill(sel, ''); await pg.type(sel, testo); await aspetta(420); };

  // ── Inserimento ──
  if (errori.length) console.log('errori al caricamento:', errori);
  await pg.evaluate(() => initEntryTableSealed());
  const campo1 = '#entryTableBodySealed tr:nth-child(1) td:nth-child(1) > input';
  await pg.focus(campo1);
  await scrivi(campo1, 'etb prismatiche');
  const scatto = async (nome) => { if (process.env.SCATTI) await pg.screenshot({ path: path.join(process.env.SCATTI, nome + '.png'), fullPage: true }); };
  await scatto('sealed-pannello-pc');
  let st = await pg.evaluate(() => ({
    pannello: !!document.querySelector('#entryTableBodySealed tr.ins-sugg-riga'),
    dopo: document.querySelector('#entryTableBodySealed tr.ins-sugg-riga')?.previousElementSibling === document.querySelector('#entryTableBodySealed tr'),
    tessere: [...document.querySelectorAll('.ss-pannello .ss-carta b')].map(b => b.textContent),
    chip: [...document.querySelectorAll('.ss-pannello .ss-chip')].map(c => c.textContent),
    esp: [...document.querySelectorAll('.ss-pannello .ss-esp option')].map(o => o.textContent),
    foto: [...document.querySelectorAll('.ss-pannello .ss-carta img')].map(i => i.getAttribute('src')),
  }));
  controlla('Inserimento: scrivendo si apre il pannello sotto la riga', st.pannello && st.dopo, st);
  uguale('i due ETB di Evoluzioni Prismatiche, il base prima', st.tessere, ['Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', 'Set Allenatore Fuoriclasse Pokémon Center di Evoluzioni Prismatiche']);
  uguale('filtri Tipo sempre tutti', st.chip, ['Tutti', 'Buste', 'Box', 'ETB', 'Blister', 'Tin', 'Collezioni', 'Mazzi', 'Kit']);
  uguale('filtro Espansione con quelle trovate', st.esp, ['Tutte le espansioni', 'Evoluzioni Prismatiche (2)']);
  controlla('foto dal bucket, o quella di Cardmarket se manca', st.foto[0].includes('/sealed-foto/1.webp') && st.foto[1].includes('product-images.s3.cardmarket.com'), st.foto);

  await scrivi(campo1, 'prismatiche');
  await pg.click('.ss-pannello .ss-chip:text-is("Tin")');
  await aspetta(150);
  st = await pg.evaluate(() => ({ tessere: [...document.querySelectorAll('.ss-pannello .ss-carta b')].map(b => b.textContent), ultima: window.__ricerche[window.__ricerche.length - 1].filtri, attivo: document.querySelector('.ss-pannello .ss-chip.attivo')?.textContent }));
  uguale('filtro Tipo: solo le Tin', [st.tessere, st.ultima.categoria, st.attivo], [['Evoluzioni Prismatiche: Jolteon Mini Tin'], 'Tins', 'Tin']);
  await pg.click('.ss-pannello .ss-chip:text-is("Tutti")');
  await aspetta(150);
  await pg.click('.ss-pannello .ss-carta:has-text("Busta di Evoluzioni Prismatiche")');
  await aspetta(100);
  await scatto('sealed-bloccata-pc');
  if (process.env.SCATTI) {
    const c2 = '#entryTableBodySealed tr:nth-of-type(2) td:nth-child(1) > input';
    await pg.setViewportSize({ width: 390, height: 800 });
    await pg.focus(c2); await scrivi(c2, 'prismatiche');
    await scatto('sealed-pannello-tel');
    await pg.evaluate((c) => { ssChiudiPannello(); document.querySelector(c).value = ''; insAggiornaBottone(); }, c2);
    await pg.setViewportSize({ width: 1280, height: 720 });
  }
  st = await pg.evaluate(() => {
    const tr = document.querySelector('#entryTableBodySealed tr');
    return { bloccata: tr.classList.contains('ss-bloccata'), pannello: !!document.querySelector('.ss-pannello'), blocco: tr.querySelector('.ss-blocco')?.textContent.replace(/\s+/g, ' ').trim(), righe: document.querySelectorAll('#entryTableBodySealed tr:not(.ins-sugg-riga)').length, bottone: document.getElementById('btnSalvaCarte').textContent.trim() };
  });
  controlla('scelta → riga bloccata col prodotto, pannello chiuso', st.bloccata && !st.pannello && /Busta di Evoluzioni Prismatiche/.test(st.blocco) && /Busta · Evoluzioni Prismatiche/.test(st.blocco), st);
  controlla('la riga vuota per il prossimo prodotto resta, il bottone conta 1 prodotto', st.righe >= 2 && /1 prodotto/.test(st.bottone), st);

  // riga 2: nome libero; riga 3: nome proprio come nel catalogo; riga 4: scelta poi "Cambia"
  const campo = (n) => `#entryTableBodySealed tr:not(.ins-sugg-riga):nth-of-type(${n}) td:nth-child(1) > input`;
  await pg.evaluate(() => { const r = [...document.querySelectorAll('#entryTableBodySealed tr:not(.ins-sugg-riga)')]; while (r.length < 4) { addNewEntryRowSealed(); r.push(1); } });
  await pg.focus(campo(2)); await scrivi(campo(2), 'mazzo inventato 2099');
  st = await pg.evaluate(() => document.querySelector('.ss-pannello')?.textContent.replace(/\s+/g, ' '));
  controlla('nessun prodotto: lo dice e si può salvare col nome', /Nessun prodotto nel catalogo/.test(st || '') && /lo cerca l'estensione per nome/.test(st || ''), st);
  await pg.evaluate(() => ssChiudiPannello());
  await pg.evaluate((s) => { const i = document.querySelector(s); i.value = 'Prismatic Evolutions Jolteon Mini Tin'; }, campo(3));
  await pg.focus(campo(4)); await scrivi(campo(4), 'scintille box');
  await pg.click('.ss-pannello .ss-carta:has-text("Box di buste di Scintille Folgoranti")');
  await aspetta(100);
  await pg.click('#entryTableBodySealed tr:nth-of-type(4) .ins-blocco-cambia').catch(() => {});
  await aspetta(450);
  st = await pg.evaluate(() => { const tr = [...document.querySelectorAll('#entryTableBodySealed tr:not(.ins-sugg-riga)')][3]; return { bloccata: tr.classList.contains('ss-bloccata'), testo: tr.querySelector('td:nth-child(1) > input').value, pannello: document.querySelector('#entryTableBodySealed tr.ins-sugg-riga')?.previousElementSibling === tr }; });
  uguale('"Cambia": sbloccata, torna il testo scritto, pannello di nuovo aperto', st, { bloccata: false, testo: 'scintille box', pannello: true });
  await pg.click('.ss-pannello .ss-carta:has-text("Set Allenatore Fuoriclasse di Scintille Folgoranti")');
  await pg.selectOption('#entryTableBodySealed tr:nth-of-type(1) td:nth-child(2) select', 'EN');
  await pg.evaluate(() => salvaSealedInCoda());
  st = await pg.evaluate(() => ({ coda: window.__coda.map(r => ({ nome: r.nome, url: r.url_diretto || null, lingua: r.lingua, tipo: r.tipo })), avviso: window.__avvisi.pop(), righe: document.querySelectorAll('#entryTableBodySealed tr').length }));
  uguale('salvataggio: 4 righe, scelte col link e il nome del catalogo, nome libero senza link, nome esatto collegato', st.coda, [
    { nome: 'Busta di Evoluzioni Prismatiche', url: B + 'Boosters/Prismatic-Evolutions-Booster', lingua: 'EN', tipo: 'sealed' },
    { nome: 'mazzo inventato 2099', url: null, lingua: 'IT', tipo: 'sealed' },
    { nome: 'Evoluzioni Prismatiche: Jolteon Mini Tin', url: B + 'Tins/Prismatic-Evolutions-Jolteon-Mini-Tin', lingua: 'IT', tipo: 'sealed' },
    { nome: 'Set Allenatore Fuoriclasse di Scintille Folgoranti', url: B + 'Elite-Trainer-Boxes/Surging-Sparks-Elite-Trainer-Box', lingua: 'IT', tipo: 'sealed' },
  ]);
  controlla('avviso: quanti dal catalogo (1 trovato dal nome) e quanti col nome', /3 dal catalogo \(1 trovato dal nome\), 1 col nome scritto/.test(st.avviso || ''), st.avviso);
  controlla('dopo il salvataggio la tabella riparte (2 righe vuote)', st.righe === 2, st.righe);

  // ── Carte con problemi ──
  await pg.evaluate(() => { window.__coda = []; return caricaCarteConProblemi(); });
  await aspetta(100);
  st = await pg.evaluate(() => ({ testo: document.getElementById('listaCarteProblemi').textContent.replace(/\s+/g, ' '), foto: document.querySelector('#listaCarteProblemi .prob-opzione img')?.getAttribute('src') }));
  controlla('Carte con problemi (sealed): "Scegli il prodotto" e "Nessuno di questi"', /Scegli il prodotto/.test(st.testo) && /Nessuno di questi/.test(st.testo) && /1 prodotto possibile: scegli quello giusto/.test(st.testo), st.testo.slice(0, 300));
  controlla('foto dell\'opzione dal catalogo sealed', (st.foto || '').includes('/sealed-foto/5.webp'), st.foto);
  await pg.click('#listaCarteProblemi button:has-text("Scegli il prodotto")');
  await aspetta(450);
  st = await pg.evaluate(() => ({ aperta: getComputedStyle(document.getElementById('ssScelta')).display, valore: document.getElementById('ssSceltaTesto').value, tessere: [...document.querySelectorAll('#ssScelta .ss-carta b')].map(b => b.textContent), ultima: document.body.lastElementChild.id }));
  await scatto('sealed-finestra-pc');
  if (process.env.SCATTI) { await pg.setViewportSize({ width: 390, height: 800 }); await scatto('sealed-finestra-tel'); await pg.setViewportSize({ width: 1280, height: 720 }); }
  controlla('si apre la finestra col nome della riga, ultima nel documento', st.aperta === 'flex' && st.valore === 'etb prismatica' && st.ultima === 'ssScelta', st);
  controlla('"prismatica" trova anche Prismatiche', st.tessere.includes('Set Allenatore Fuoriclasse di Evoluzioni Prismatiche'), st.tessere);
  await pg.click('#ssScelta .ss-carta:has-text("Set Allenatore Fuoriclasse di Evoluzioni Prismatiche")');
  await aspetta(150);
  st = await pg.evaluate(() => ({ coda: window.__coda.map(r => ({ nome: r.nome, url: r.url_diretto, tipo: r.tipo, dest: r.destinazione, stato: r.stato })), eliminate: window.__eliminate.slice(), aperta: getComputedStyle(document.getElementById('ssScelta')).display }));
  uguale('scelta: torna in coda col link e il nome del catalogo, tolta dalle carte con problemi', [st.coda, st.eliminate, st.aperta], [[{ nome: 'Set Allenatore Fuoriclasse di Evoluzioni Prismatiche', url: B + 'Elite-Trainer-Boxes/Prismatic-Evolutions-Elite-Trainer-Box', tipo: 'sealed', dest: 'collezione', stato: 'pending' }], ['c1'], 'none']);
  await pg.click('#listaCarteProblemi button:has-text("Nessuno di questi")');
  await aspetta(100);
  await pg.fill('#ssSceltaTesto', 'Box Scintille Folgoranti 18');
  await pg.click('#ssSceltaUsaTesto');
  await aspetta(150);
  st = await pg.evaluate(() => window.__coda.slice(1).map(r => ({ nome: r.nome, url: r.url_diretto, lingua: r.lingua, qty: r.qty })));
  uguale('"Riprova con il nome scritto": in coda col testo, senza link', st, [{ nome: 'Box Scintille Folgoranti 18', url: null, lingua: 'EN', qty: 2 }]);

  // ── Modifica sealed ──
  await pg.evaluate(() => {
    prodottiSealedReali = [{ id: 's1', name: 'busta prismatiche', codice: '', setEspansione: '', qty: 1, lingua: 'JP', integrita: 'sigillato_integro', price: 5, prezzoCardmarket: null, prezzoAcquisto: null, dataAcquisizione: null, note: '', immagine: null, url: null }];
    return apriModificaSealed('s1');
  });
  st = await pg.evaluate(() => document.getElementById('editSealedProdotto').textContent.replace(/\s+/g, ' ').trim());
  controlla('Modifica: riga del prodotto "Non ancora collegato" con Scegli', /Non ancora collegato/.test(st) && /Scegli/.test(st), st);
  await pg.click('#editSealedProdotto button');
  await aspetta(450);
  await pg.click('#ssScelta .ss-carta:has-text("Busta di Evoluzioni Prismatiche")');
  st = await pg.evaluate(() => ({ nome: document.getElementById('editSealedNome').value, set: document.getElementById('editSealedSet').value, riga: document.getElementById('editSealedProdotto').textContent.replace(/\s+/g, ' ') }));
  controlla('scelta: nome ed espansione nei campi, la riga mostra il prodotto scelto', st.nome === 'Busta di Evoluzioni Prismatiche' && st.set === 'Evoluzioni Prismatiche' && /si salva con "Salva Modifiche"/.test(st.riga), st);
  await pg.evaluate(() => salvaModificaSealed());
  st = await pg.evaluate(() => window.__aggiornati[0] && { nome: window.__aggiornati[0].agg.nome, set: window.__aggiornati[0].agg.set_espansione, url: window.__aggiornati[0].agg.url, img: window.__aggiornati[0].agg.immagine });
  uguale('salvataggio: url con la lingua del prodotto (JP), foto, nome, espansione', st, { nome: 'Busta di Evoluzioni Prismatiche', set: 'Evoluzioni Prismatiche', url: B + 'Boosters/Prismatic-Evolutions-Booster?language=7', img: 'https://x.supabase.co/storage/v1/object/public/sealed-foto/3.webp' });
  await pg.evaluate(() => { apriModificaSealed('s1'); return salvaModificaSealed(); });
  st = await pg.evaluate(() => ({ haUrl: 'url' in window.__aggiornati[1].agg, haImg: 'immagine' in window.__aggiornati[1].agg, mappa: prodottiSealedReali[0].url }));
  uguale('senza scegliere: url e foto non si toccano (e il prodotto letto dal DB porta il suo url)', st, { haUrl: false, haImg: false, mappa: 'https://www.cardmarket.com/x?language=7' });

  // ── Import CSV ──
  await pg.evaluate(async () => {
    window.__coda = [];
    importCsvApri();
    _impCsv.tipo = 'sealed';
    const file = new File(['nome;qty\nBusta di Evoluzioni Prismatiche;2\nsurging sparks booster box;1\nProdotto che non c\'è;1\n'], 'sealed.csv');
    await _importCsvLeggi(file);
  });
  await aspetta(200);
  st = await pg.evaluate(() => ({ righe: _impCsv.righe.map(r => ({ nome: r.db.nome, url: r.db.url_diretto || null, nota: r.nota })), bottone: [...document.querySelectorAll('#importCsvVista .btn-main')].map(b => b.textContent.trim()).join('|'), link: document.querySelectorAll('#importCsvVista .csv-nome .fa-link').length }));
  uguale('Import CSV sealed: nomi del catalogo (italiano o inglese) col link, gli altri senza', st.righe, [
    { nome: 'Busta di Evoluzioni Prismatiche', url: B + 'Boosters/Prismatic-Evolutions-Booster', nota: 'trovato nel catalogo sealed' },
    { nome: 'Box di buste di Scintille Folgoranti', url: B + 'Booster-Boxes/Surging-Sparks-Booster-Box', nota: 'trovato nel catalogo sealed' },
    { nome: "Prodotto che non c'è", url: null, nota: '' },
  ]);
  controlla('il controllo mostra il link e il bottone dice "prodotti"', st.link === 2 && /Metti in coda 3 prodotti/.test(st.bottone), st);
  await pg.evaluate(() => importCsvInvia());
  st = await pg.evaluate(() => window.__coda.map(r => [r.nome, r.url_diretto || null, r.tipo]));
  uguale('in coda come nel controllo', st, [
    ['Busta di Evoluzioni Prismatiche', B + 'Boosters/Prismatic-Evolutions-Booster', 'sealed'],
    ['Box di buste di Scintille Folgoranti', B + 'Booster-Boxes/Surging-Sparks-Booster-Box', 'sealed'],
    ["Prodotto che non c'è", null, 'sealed'],
  ]);

  controlla('nessun errore nella pagina', errori.length === 0, errori);
  await browser.close();
  chiudi();
}
