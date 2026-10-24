// Service worker (background.js) in un Chrome finto:
// 1) avvio senza errori;
// 2) turno Cardmarket comune: 3 flussi in parallelo non si sovrappongono mai;
// 3) riconoscimento pagine e lettura del nome dall'h1.
const vm = require('vm');
const { caricaBackground } = require('./lib/carica-background');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';

(async () => {
  // 1) avvio
  const { ctx, env, EXT } = caricaBackground({ store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderPausaOgni: 4 } });
  console.log('Estensione provata:', EXT, '\n');
  controlla('avvio del service worker senza errori', env.log.errori.length === 0, env.log.errori);
  await new Promise(r => setTimeout(r, 50)); // dalla 5.40 le sveglie si creano dopo chrome.alarms.get
  controlla('sveglie create all\'avvio', env.log.alarms.length > 0, env.log.alarms.map(a => a.name));
  const versione = JSON.parse(require('fs').readFileSync(require('path').join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj > 5 || (maj === 5 && min >= 40)) {
    // 5.40 (Fase 4.6): mai sotto i 30 s, e un riavvio del service worker non le ricrea.
    controlla('sveglie: nessuna sotto i 30 s', env.log.alarms.every(a => a.info && a.info.periodInMinutes >= 0.5), env.log.alarms.map(a => a.name + '=' + (a.info && a.info.periodInMinutes)));
    const create = env.log.alarms.length;
    await ctx._creaSvegliaSeManca('ordini-poll', 0.5);
    await ctx._creaSvegliaSeManca('worker-coda-carte-autonomo', 1);
    controlla('sveglie: già esistenti, non ricreate', env.log.alarms.length === create, env.log.alarms.slice(create).map(a => a.name));
    await ctx._creaSvegliaSeManca('ordini-poll', 1);
    controlla('sveglie: periodo cambiato → ricreata', env.log.alarms.length === create + 1);
    // 5.40: VERSIONE_MOTORE in background.js uguale a manifest.json (si cambia a mano a ogni rilascio).
    uguale('VERSIONE_MOTORE = versione del manifest', vm.runInContext('VERSIONE_MOTORE', ctx), versione);
  }

  // 2) turno Cardmarket: controllo prezzi, coda della pagina e worker chiedono 4 carte ciascuno
  const inizi = [];
  const lavoro = () => async () => { inizi.push(Date.now()); await new Promise(r => setTimeout(r, 150)); };
  const flusso = async () => { for (let i = 0; i < 4; i++) await ctx._conTurnoCardmarket({}, lavoro()); };
  await Promise.all([flusso(), flusso(), flusso()]);
  inizi.sort((a, b) => a - b);
  const distanze = inizi.slice(1).map((t, i) => t - inizi[i]);
  controlla('turno comune: 12 carte lavorate', inizi.length === 12, inizi.length);
  controlla('turno comune: mai due carte a meno di 1 s (slider 1 s)', Math.min(...distanze) >= 1000, Math.min(...distanze) + ' ms');

  // 3) riconoscimento
  uguale('lista espansione da URL', ctx._ePaginaListaSingles(B + 'Unleashed', 'Singole Forze Scatenate'), true);
  uguale('pagina carta non è una lista', ctx._ePaginaListaSingles(B + '151/Mew-MEW151', 'Mew ex (MEW 151)'), false);
  uguale('lista espansione da h1 "Singles"', ctx._ePaginaListaSingles(B + '151/Mew-MEW151', 'Singles'), true);

  const h1 = (html) => { const r = ctx._estraiNomeDaHtml(html); return [r.nome, r.codice]; };
  uguale('h1 "Unown (V) (MEW 186)"', h1('<h1>Unown (V) <span>x</span>(MEW 186)</h1>'), ['Unown (V)', 'MEW 186']);
  uguale('h1 promo "(SVP EN 011) Arcanine"', h1('<h1>(SVP EN 011) Arcanine</h1>'), ['Arcanine', 'SVP EN 011']);
  uguale('h1 senza codice', h1('<h1>Pikachu</h1>'), ['Pikachu', null]);

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
