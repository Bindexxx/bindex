// Prove del selettore carte (ui/selettore-carte.ui.js) senza browser: come legge quello che scrivi
// nell'Inserimento ("jigglypuff 8", "svi 054", "PAL054", "zubat trainer kit 11") e che ricerca
// manda al catalogo. La funzione SQL catalogo_cerca (sql/132) è provata a parte in PGlite.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { RADICE } = require('./lib/pagine');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const chiamate = [];
let risposta = { data: [], error: null };
const sandbox = {
  console: { error() {}, log() {} },
  document: { addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null },
  setTimeout, clearTimeout,
  escapeHtml: (s) => String(s == null ? '' : s),
  catalogoCerca: async (p) => { chiamate.push(p); return typeof risposta === 'function' ? risposta(p) : risposta; },
  setEspansioniLeggiTutte: async () => [
    { sigla: 'PAL', lingua: 'INT' }, { sigla: 'SVI', lingua: 'INT' }, { sigla: 'MEW', lingua: 'INT' }, { sigla: 'HS', lingua: 'INT' },
    { sigla: 'MCD16', lingua: 'INT' }, { sigla: 'MCD22', lingua: 'INT' }, { sigla: 'TK2P', lingua: 'INT' }, { sigla: 'TK10A', lingua: 'INT' },
    { sigla: 'SV2A@JP', lingua: 'JP' }, { sigla: 'SV2A@KOR', lingua: 'KOR' }, { sigla: '30C', lingua: 'INT' }, { sigla: 'BASEP', lingua: 'INT' },
  ],
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(RADICE, 'ui/selettore-carte.ui.js'), 'utf8') +
  '\n;this._prova = { _selLeggiTesto, _selCaricaSigle, _selEsegui, _selCarta, _selCodiceVisibile, _selTestoCoda, _selUnicaPrecisa, _selEtichettaVariante, spento: () => _selSpento };', sandbox);
const S = sandbox._prova;

(async () => {
  const indice = await S._selCaricaSigle();
  const leggi = (t) => { const q = S._selLeggiTesto(t, indice); return { nome: q.nome, numero: q.numero, totale: q.totale, codici: q.codici, famiglia: q.famiglia, preciso: q.preciso, alternativa: q.alternativa }; };
  const atteso = (o) => ({ nome: null, numero: null, totale: null, codici: [], famiglia: null, preciso: false, alternativa: null, ...o });

  uguale('"jigglypuff 8": nome + numero', leggi('jigglypuff 8'), atteso({ nome: 'jigglypuff', numero: 8 }));
  uguale('"svi 054": codice preciso', leggi('svi 054'), atteso({ numero: 54, codici: ['SVI'], preciso: true, alternativa: 'svi' }));
  uguale('"Quaquaval SVI 054": nome + codice', leggi('Quaquaval SVI 054'), atteso({ nome: 'quaquaval', numero: 54, codici: ['SVI'], preciso: true, alternativa: 'quaquaval svi' }));
  uguale('"PAL054" attaccato', leggi('PAL054'), atteso({ numero: 54, codici: ['PAL'], preciso: true }));
  uguale('"sv2a151" attaccato, set giapponese', leggi('sv2a151'), atteso({ numero: 151, codici: ['SV2A'], preciso: true }));
  uguale('"mcd168": McDonald 2016 n. 8, non MCD n. 168', leggi('mcd168'), atteso({ numero: 8, codici: ['MCD16'], preciso: true }));
  uguale('"30c 151": sigla che comincia con un numero', leggi('30c 151'), atteso({ numero: 151, codici: ['30C'], preciso: true }));
  uguale('"8/12": numero e totale', leggi('8/12'), atteso({ numero: 8, totale: 12 }));
  uguale('"mew": una sigla da sola è un nome', leggi('mew'), atteso({ nome: 'mew' }));
  uguale('"mew ex": nome, non il set MEW', leggi('mew ex'), atteso({ nome: 'mew ex' }));
  uguale('"pikachu pal": dopo un nome la sigla è il set', leggi('pikachu pal'), atteso({ nome: 'pikachu', codici: ['PAL'] }));
  uguale('"mew ex 151": col numero la sigla è il set', leggi('mew ex 151'), atteso({ nome: 'ex', numero: 151, codici: ['MEW'], preciso: true, alternativa: 'mew ex' }));
  uguale('"mew 8": set MEW n. 8, e in più il Mew n. 8', leggi('mew 8'), atteso({ numero: 8, codici: ['MEW'], preciso: true, alternativa: 'mew' }));
  uguale('"wartortle mew 8"', leggi('wartortle mew 8'), atteso({ nome: 'wartortle', numero: 8, codici: ['MEW'], preciso: true, alternativa: 'wartortle mew' }));
  uguale('"zubat tk 11": famiglia Trainer Kit', leggi('zubat tk 11'), atteso({ nome: 'zubat', numero: 11, famiglia: 'TK' }));
  uguale('"zubat trainer kit 11": scritto per esteso', leggi('zubat trainer kit 11'), atteso({ nome: 'zubat', numero: 11, famiglia: 'TK' }));
  uguale('"jigglypuff mcdonald\'s 8"', leggi("jigglypuff mcdonald's 8"), atteso({ nome: 'jigglypuff', numero: 8, famiglia: 'MCD' }));
  uguale('"mismagius boo 059"', leggi('mismagius boo 059'), atteso({ nome: 'mismagius', numero: 59, famiglia: 'BOO' }));
  uguale('"boo24 pal 050": famiglia BOO, PAL resta la serie', leggi('boo24 pal 050'), atteso({ numero: 50, codici: ['PAL'], famiglia: 'BOO', preciso: true }));
  uguale('"pumpkaboo": non è una BOO', leggi('pumpkaboo'), atteso({ nome: 'pumpkaboo' }));
  uguale('"fuecoco ba a42": Battle Academy', (() => { const q = S._selLeggiTesto('fuecoco ba a42', indice); return [q.nome, q.famiglia, q.icona]; })(), ['fuecoco', 'BA', 'A42']);
  uguale('"basep 4": BASEP non è Battle Academy', leggi('basep 4'), atteso({ numero: 4, codici: ['BASEP'], preciso: true, alternativa: 'basep' }));
  uguale('caratteri jolly tolti dal nome', leggi('pika%_chu').nome, 'pika chu');
  uguale('"000": lo zero non è un numero di carta', leggi('pikachu 000'), atteso({ nome: 'pikachu' }));

  // che ricerca parte
  const esegui = async (testo, lingua) => { chiamate.length = 0; const e = await S._selEsegui(S._selLeggiTesto(testo, indice), lingua, indice); return { e, c: chiamate.slice() }; };
  let r = await esegui('jigglypuff 8', 'IT');
  uguale('ricerca per nome: lingua INT, nessuna sigla', r.c, [{ nome: 'jigglypuff', numero: 8, sigle: null, lingue: ['INT'], totale: null, limite: 12, serie: null }]);
  r = await esegui('jigglypuff', 'JP');
  uguale('riga in giapponese: set JP', r.c[0].lingue, ['JP']);
  r = await esegui('sv2a 151', 'KOR');
  uguale('codice in più lingue: quello della lingua della riga', r.c[0].sigle, ['SV2A@KOR']);
  r = await esegui('sv2a 151', 'IT');
  uguale('codice che esiste solo in altre lingue: tutti', r.c[0].sigle, ['SV2A@JP', 'SV2A@KOR']);
  r = await esegui('zubat tk 11', 'IT');
  uguale('famiglia TK: tutti i Trainer Kit del catalogo', r.c[0].sigle, ['TK2P', 'TK10A']);
  r = await esegui('mcd16 8', 'IT');
  uguale('"mcd16 8": solo quel McDonald', r.c[0].sigle, ['MCD16']);
  r = await esegui('jigglypuff mcd 8', 'IT');
  uguale('"mcd 8": tutti i McDonald', r.c[0].sigle, ['MCD16', 'MCD22']);
  r = await esegui('mismagius boo 059', 'EN');
  controlla('BOO non in catalogo: nessuna ricerca, avviso', r.c.length === 0 && r.e.fuoriCatalogo === 'BOO', r);
  r = await esegui('8', 'IT');
  controlla('solo un numero: troppo poco, nessuna ricerca', r.c.length === 0 && r.e.poco === true, r);
  r = await esegui('p', 'IT');
  controlla('una lettera sola: nessuna ricerca', r.c.length === 0 && r.e.poco === true, r);
  r = await esegui('mew 8', 'IT');
  uguale('"mew 8": due ricerche (set MEW, poi nome mew)', r.c.map(c => [c.nome, c.sigle]), [[null, ['MEW']], ['mew', null]]);
  r = await esegui('mew ex 232', 'IT');
  uguale('"mew ex 232": nel set MEW niente → riprova come nome', r.c.map(c => [c.nome, c.sigle]), [['ex', ['MEW']], ['mew ex', null]]);
  risposta = (p) => ({ data: p.sigle ? [{ sigla: 'SVI', numero: 54, variante: 'normale', nome: 'Quaquaval', base: true, trovate: 1 }] : [], error: null });
  r = await esegui('quaquaval svi 054', 'IT');
  uguale('"quaquaval svi 054": trovata nel set → una ricerca sola', r.c.length, 1);
  risposta = { data: [], error: null };

  // carte del catalogo → testi
  const carta = (o) => S._selCarta({ sigla: 'SVI', numero: 54, variante: 'normale', nome: 'Quaquaval', immagine: null, cardmarket_id: null, cardmarket_url: null, set_nome: 'Scarlatto e Violetto', lingua: 'INT', data_uscita: '2023-03-31', carte_base: 198, base: true, versioni: 2, ...o });
  uguale('set dal 2021: numero a tre cifre', [S._selCodiceVisibile(carta({})), S._selTestoCoda(carta({}))], ['SVI · 054/198', 'Quaquaval SVI 054']);
  uguale('set vecchio: numero com\'è', S._selTestoCoda(carta({ sigla: 'HS', numero: 72, nome: 'Magikarp', data_uscita: '2010-02-10' })), 'Magikarp HS 72');
  uguale('versione dalla pagina Cardmarket (stessa carta in più mazzi)', [carta({ cardmarket_url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/WCD-2025/Prime-Catcher-V2-WCD25157', codice: '157', sigla: 'WCD25' }).versione, carta({ cardmarket_url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Scarlet-Violet/Quaquaval-SVI054' }).versione, carta({ variante: 'reverse-pokeball', cardmarket_url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/X/Sylveon-V1-xPRE040' }).versione], ['V2', '', 'Poké Ball']);
  uguale('McDonald: mai tre cifre', S._selTestoCoda(carta({ sigla: 'MCD22', numero: 8, nome: 'Chinchou', data_uscita: '2022-08-01' })), 'Chinchou MCD22 8');
  uguale('set in altra lingua: sigla senza @', S._selTestoCoda(carta({ sigla: 'SV2A@JP', numero: 25, nome: 'Pikachu', data_uscita: '2023-06-16', lingua: 'JP' })), 'Pikachu SV2A 025');
  uguale('link: pagina salvata', carta({ cardmarket_url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Scarlet-Violet/Quaquaval-V4-SVI054', cardmarket_id: 5 }).link, 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Scarlet-Violet/Quaquaval-V4-SVI054');
  uguale('link: dal numero di prodotto', carta({ cardmarket_id: 715524 }).link, 'https://www.cardmarket.com/it/Pokemon/Products?idProduct=715524');
  uguale('link: nessuno', carta({}).link, null);
  uguale('versioni', ['reverse-pokeball', 'reverse-masterball', 'normale-30th-pokeday', 'holo-cosmos', 'normale', 'reverse'].map(S._selEtichettaVariante), ['Poké Ball', 'Master Ball', '30th pokeday', 'holo cosmos', '', '']);

  // blocco da solo
  const esito = (q, carte, altro) => ({ q, carte, errore: false, sigle: q.codici.slice(), ...altro });
  const qSvi = S._selLeggiTesto('svi 054', indice);
  controlla('una sola carta di quel set: si blocca', S._selUnicaPrecisa(esito(qSvi, [carta({})])) !== null);
  controlla('base + versioni con pagina loro: si blocca la base', S._selUnicaPrecisa(esito(qSvi, [carta({}), carta({ variante: 'reverse-pokeball', base: false })]))?.variante === 'normale');
  controlla('carte trovate "per nome" non contano', S._selUnicaPrecisa(esito(S._selLeggiTesto('mew 8', indice), [carta({ sigla: 'MEW', numero: 8, nome: 'Wartortle' }), carta({ sigla: 'PAL', numero: 8, nome: 'Mew' })]))?.nome === 'Wartortle');
  controlla('nome + numero senza sigla: non si blocca da sola', S._selUnicaPrecisa(esito(S._selLeggiTesto('quaquaval 54', indice), [carta({})])) === null);
  controlla('due carte base: non si blocca', S._selUnicaPrecisa(esito(qSvi, [carta({}), carta({ variante: 'holo' })])) === null);

  // ── masterset promo (BOO, PPS, WCD, Battle Academy) quando il catalogo li ha ──
  const indicePromo = { codici: new Map(['PAL', 'PAR', 'SFA', 'BOO', 'BOO23', 'BOO24', 'PPS6', 'PPS7', 'WCD23', 'WCD25', 'BA22', 'BA24', 'MCD16'].map(c => [c, [{ sigla: c, lingua: 'INT' }]])),
    famiglie: { BOO: ['BOO', 'BOO23', 'BOO24'], PPS: ['PPS6', 'PPS7'], WCD: ['WCD23', 'WCD25'], BA: ['BA22', 'BA24'], MCD: ['MCD16'], TK: [], MFB: [] } };
  const leggiP = (t) => { const q = S._selLeggiTesto(t, indicePromo); return { nome: q.nome, numero: q.numero, codici: q.codici, famiglia: q.famiglia, serie: q.serie, icona: q.icona, preciso: q.preciso }; };
  uguale('"boo pal 050": senza anno, ma col set d\'origine è precisa', leggiP('boo pal 050'), { nome: null, numero: 50, codici: ['PAL'], famiglia: 'BOO', serie: 'PAL', icona: null, preciso: true });
  uguale('"boo24 pal 050"', leggiP('boo24 pal 050'), { nome: null, numero: 50, codici: ['BOO24', 'PAL'], famiglia: 'BOO', serie: 'PAL', icona: null, preciso: true });
  uguale('"boo pal054" attaccato', leggiP('boo pal054'), { nome: null, numero: 54, codici: ['PAL'], famiglia: 'BOO', serie: 'PAL', icona: null, preciso: true });
  uguale('"mismagius boo 059": famiglia + numero, non precisa', leggiP('mismagius boo 059'), { nome: 'mismagius', numero: 59, codici: [], famiglia: 'BOO', serie: null, icona: null, preciso: false });
  uguale('"pps sfa 063"', leggiP('pps sfa 063'), { nome: null, numero: 63, codici: ['SFA'], famiglia: 'PPS', serie: 'SFA', icona: null, preciso: true });
  uguale('"gardevoir wcd 086"', leggiP('gardevoir wcd 086'), { nome: 'gardevoir', numero: 86, codici: [], famiglia: 'WCD', serie: null, icona: null, preciso: false });
  uguale('"wcd25 086": anno scritto, precisa', leggiP('wcd25 086'), { nome: null, numero: 86, codici: ['WCD25'], famiglia: 'WCD', serie: null, icona: null, preciso: true });
  uguale('"fuecoco a42": Battle Academy dall\'icona, senza scrivere ba', leggiP('fuecoco a42'), { nome: 'fuecoco', numero: 42, codici: [], famiglia: 'BA', serie: null, icona: 'A42', preciso: true });
  uguale('"ba24 a42"', leggiP('ba24 a42'), { nome: null, numero: 42, codici: ['BA24'], famiglia: 'BA', serie: null, icona: 'A42', preciso: true });
  uguale('"mcd16 8": precisa come prima', leggiP('mcd16 8'), { nome: null, numero: 8, codici: ['MCD16'], famiglia: 'MCD', serie: null, icona: null, preciso: true });
  uguale('"pal 050" resta il set normale', leggiP('pal 050'), { nome: null, numero: 50, codici: ['PAL'], famiglia: null, serie: null, icona: null, preciso: true });
  const eseguiP = async (testo) => { chiamate.length = 0; const e = await S._selEsegui(S._selLeggiTesto(testo, indicePromo), 'IT', indicePromo); return { e, c: chiamate.slice() }; };
  const rigaP = (o) => ({ sigla: 'BOO24', numero: 2, variante: 'normale', nome: 'Quaxly', immagine: null, cardmarket_id: 901, cardmarket_url: null, set_nome: 'Trick or Trade 2024', lingua: 'INT', data_uscita: '2024-08-30', carte_base: null, base: true, versioni: 1, trovate: 1, codice: 'PAL 050', ...o });
  risposta = { data: [rigaP({})], error: null };
  r = await eseguiP('boo pal 050');
  uguale('"boo pal 050": tutti i BOO, serie PAL', [r.c[0].sigle, r.c[0].serie, r.c[0].numero], [['BOO', 'BOO23', 'BOO24'], 'PAL', 50]);
  controlla('"boo pal 050": una sola carta → si blocca da sola', S._selUnicaPrecisa({ ...r.e, q: S._selLeggiTesto('boo pal 050', indicePromo) })?.codice === 'PAL 050');
  r = await eseguiP('boo24 pal 050');
  uguale('"boo24 pal 050": solo BOO24', [r.c[0].sigle, r.c[0].serie], [['BOO24'], 'PAL']);
  uguale('carta promo: codice e testo per la coda', [S._selCodiceVisibile(r.e.carte[0]), S._selTestoCoda(r.e.carte[0])], ['BOO24 · PAL 050', 'Quaxly BOO24 PAL 050']);
  risposta = { data: [rigaP({ sigla: 'BA24', nome: 'Fuecoco', codice: 'A42' }), rigaP({ sigla: 'BA24', numero: 9, nome: 'Fuecoco', codice: 'B42' }), rigaP({ sigla: 'BA22', numero: 4, nome: 'Fuecoco', codice: 'A42' })], error: null };
  r = await eseguiP('fuecoco a42');
  uguale('"fuecoco a42": cerca il numero 42 nei BA e tiene la lettera A', [r.c[0].sigle, r.c[0].numero, r.e.carte.map(c => c.siglaVista + ' ' + c.codice)], [['BA22', 'BA24'], 42, ['BA24 A42', 'BA22 A42']]);
  risposta = { data: [], error: null };

  // lettura del codice delle tue carte (ui/set-libreria-sigle.ui.js)
  const sbSigle = { console };
  vm.createContext(sbSigle);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'ui/set-libreria-sigle.ui.js'), 'utf8') + '\n;this._p = { _ballLeggiCodice, _ballChiaveCodice };', sbSigle);
  const L = sbSigle._p;
  const promo = (c) => { const l = L._ballLeggiCodice(c); return l && l.promo ? l.promo.set + '|' + l.promo.codice : null; };
  uguale('carte promo: masterset e chiave', ['BOO24 PAL 012', 'BOO ASR 103', 'PPS6 SFA 063', 'PPS8 MEE 006', 'WCD16 BKP 39', 'WCD25 086', 'BA24 A19', 'BA20 C42'].map(promo),
    ['BOO24|PAL12', 'BOO|ASR103', 'PPS6|SFA63', 'PPS8|MEE6', 'WCD16|BKP39', 'WCD25|86', 'BA24|A19', 'BA20|C42']);
  uguale('non promo', ['PAL 050', 'BASEP 4', 'MCD22 8', 'xPRE 040', 'BA22 EVE', 'PUMPKABOO 5', 'MFB', 'PPS'].map(promo), [null, null, null, null, null, null, null, null]);
  uguale('carte promo senza numero (energie): solo il masterset', ['WCD25', 'BA22', 'PPS8', 'BOO', 'BOO24'].map(promo), ['WCD25|', 'BA22|', 'PPS8|', 'BOO|', 'BOO24|']);
  uguale('i campi di prima restano (rarità e missioni li usano)', L._ballLeggiCodice('BOO24 PAL 012'), { set: 'PAL', variante: 'halloween', numero: 12, promo: { set: 'BOO24', codice: 'PAL12' } });
  uguale('chiave del codice del catalogo', ['PAL 012', 'ASR 103', 'A42', '086', '8', 'BKP 039', 'SFA-063', '100'].map(L._ballChiaveCodice), ['PAL12', 'ASR103', 'A42', '86', '8', 'BKP39', 'SFA63', '100']);

  // catalogo dei set: se set_carte.codice non c'è ancora (sql/135 non eseguita) si legge senza
  const selezioni = [];
  const finto = (conColonna) => ({ from: () => ({ select: (colonne) => { selezioni.push(colonne); const catena = { in: () => catena, order: () => catena, range: async () => (/codice/.test(colonne) && !conColonna ? { data: null, error: { code: '42703', message: 'column set_carte.codice does not exist' } } : { data: [{ sigla: 'PAL', numero: 1 }], error: null }) }; return catena; } }) });
  const sbRepo = { console, supabaseClient: finto(false) };
  vm.createContext(sbRepo);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'data/sets.repository.js'), 'utf8') + '\n;this._r = { setCatalogoRigheLeggi };', sbRepo);
  let lette = await sbRepo._r.setCatalogoRigheLeggi(['PAL']);
  controlla('senza la colonna codice: riprova senza e legge', !lette.error && lette.data.length === 1 && /codice/.test(selezioni[0]) && !/codice/.test(selezioni[1]), selezioni);
  selezioni.length = 0; lette = await sbRepo._r.setCatalogoRigheLeggi(['PAL']);
  controlla('senza la colonna codice: dalla volta dopo non la chiede più', selezioni.length === 1 && !/codice/.test(selezioni[0]), selezioni);

  // ricerca non ancora sul DB: si spegne e non riprova
  risposta = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.catalogo_cerca' } };
  r = await esegui('jigglypuff 8', 'IT');
  controlla('funzione assente: errore e selettore spento', r.e.errore === true && S.spento() === true);
  r = await esegui('pikachu', 'IT');
  controlla('funzione assente: nessun\'altra chiamata', r.c.length === 0);

  chiudi();
})();
