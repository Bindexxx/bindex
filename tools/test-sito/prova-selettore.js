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
  uguale('"boo24 pal 050": famiglia BOO, PAL resta la serie', leggi('boo24 pal 050'), atteso({ numero: 50, codici: ['PAL'], famiglia: 'BOO' }));
  uguale('"pumpkaboo": non è una BOO', leggi('pumpkaboo'), atteso({ nome: 'pumpkaboo' }));
  uguale('"fuecoco ba a42": Battle Academy', (() => { const q = S._selLeggiTesto('fuecoco ba a42', indice); return [q.nome, q.famiglia, q.icona]; })(), ['fuecoco', 'BA', 'A42']);
  uguale('"basep 4": BASEP non è Battle Academy', leggi('basep 4'), atteso({ numero: 4, codici: ['BASEP'], preciso: true, alternativa: 'basep' }));
  uguale('caratteri jolly tolti dal nome', leggi('pika%_chu').nome, 'pika chu');
  uguale('"000": lo zero non è un numero di carta', leggi('pikachu 000'), atteso({ nome: 'pikachu' }));

  // che ricerca parte
  const esegui = async (testo, lingua) => { chiamate.length = 0; const e = await S._selEsegui(S._selLeggiTesto(testo, indice), lingua, indice); return { e, c: chiamate.slice() }; };
  let r = await esegui('jigglypuff 8', 'IT');
  uguale('ricerca per nome: lingua INT, nessuna sigla', r.c, [{ nome: 'jigglypuff', numero: 8, sigle: null, lingue: ['INT'], totale: null, limite: 12 }]);
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
  uguale('McDonald: mai tre cifre', S._selTestoCoda(carta({ sigla: 'MCD22', numero: 8, nome: 'Chinchou', data_uscita: '2022-08-01' })), 'Chinchou MCD22 8');
  uguale('set in altra lingua: sigla senza @', S._selTestoCoda(carta({ sigla: 'SV2A@JP', numero: 25, nome: 'Pikachu', data_uscita: '2023-06-16', lingua: 'JP' })), 'Pikachu SV2A 025');
  uguale('link: pagina salvata', carta({ cardmarket_url: 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Scarlet-Violet/Quaquaval-V4-SVI054', cardmarket_id: 5 }).link, 'https://www.cardmarket.com/it/Pokemon/Products/Singles/Scarlet-Violet/Quaquaval-V4-SVI054');
  uguale('link: dal numero di prodotto', carta({ cardmarket_id: 715524 }).link, 'https://www.cardmarket.com/it/Pokemon/Products?idProduct=715524');
  uguale('link: nessuno', carta({}).link, null);
  uguale('versioni', ['reverse-pokeball', 'reverse-masterball', 'normale-30th-pokeday', 'holo-cosmos', 'normale', 'reverse'].map(S._selEtichettaVariante), ['Poké Ball', 'Master Ball', '30th pokeday', 'holo cosmos', '', '']);

  // blocco da solo
  const esito = (q, carte, altro) => ({ q, carte, errore: false, ...altro });
  const qSvi = S._selLeggiTesto('svi 054', indice);
  controlla('una sola carta di quel set: si blocca', S._selUnicaPrecisa(esito(qSvi, [carta({})])) !== null);
  controlla('base + versioni con pagina loro: si blocca la base', S._selUnicaPrecisa(esito(qSvi, [carta({}), carta({ variante: 'reverse-pokeball', base: false })]))?.variante === 'normale');
  controlla('carte trovate "per nome" non contano', S._selUnicaPrecisa(esito(S._selLeggiTesto('mew 8', indice), [carta({ sigla: 'MEW', numero: 8, nome: 'Wartortle' }), carta({ sigla: 'PAL', numero: 8, nome: 'Mew' })]))?.nome === 'Wartortle');
  controlla('nome + numero senza sigla: non si blocca da sola', S._selUnicaPrecisa(esito(S._selLeggiTesto('quaquaval 54', indice), [carta({})])) === null);
  controlla('due carte base: non si blocca', S._selUnicaPrecisa(esito(qSvi, [carta({}), carta({ variante: 'holo' })])) === null);

  // ricerca non ancora sul DB: si spegne e non riprova
  risposta = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.catalogo_cerca' } };
  r = await esegui('jigglypuff 8', 'IT');
  controlla('funzione assente: errore e selettore spento', r.e.errore === true && S.spento() === true);
  r = await esegui('pikachu', 'IT');
  controlla('funzione assente: nessun\'altra chiamata', r.c.length === 0);

  chiudi();
})();
