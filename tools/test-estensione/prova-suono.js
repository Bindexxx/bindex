// Avviso sonoro Cloudflare (dalla 5.51): con "Avviso sonoro" spento non suona mai, né al primo
// avviso né alle ripetizioni della sveglia 'cloudflare-avviso'; acceso suona; spento durante un
// avviso già partito, le ripetizioni smettono di suonare (la scheda viene comunque in primo piano).
const { caricaBackground } = require('./lib/carica-background');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const attendi = (ms) => new Promise(r => setTimeout(r, ms));

function prepara(avvisoSonoro) {
  const store = { sliderCfTimeout: 3 };
  if (avvisoSonoro !== undefined) store.avvisoSonoro = avvisoSonoro;
  const sw = caricaBackground({ store });
  const tab = { id: 777, url: 'https://www.cardmarket.com/it/Pokemon', windowId: 1, status: 'complete' };
  sw.env.tabs.set(tab.id, tab);
  const conta = () => sw.env.log.messaggi.filter(t => t === 'SUONA').length;
  const avvia = (sonoroDallaPagina) => sw.env.listeners.onMessage.forEach(f =>
    f({ type: 'AVVIA_AVVISO_CLOUDFLARE', tabId: tab.id, avvisoSonoro: sonoroDallaPagina, timeoutMinuti: 3 }, { tab: null }, () => {}));
  const sveglia = () => sw.env.listeners.onAlarm.forEach(f => f({ name: 'cloudflare-avviso' }));
  return { sw, conta, avvia, sveglia };
}

(async () => {
  {
    const { sw, conta, avvia, sveglia } = prepara(false);
    await attendi(60);
    avvia(false);
    await attendi(60);
    sveglia(); await attendi(30); sveglia(); await attendi(30); sveglia();
    await attendi(60);
    uguale('suono spento: nessun suono, né al primo avviso né in 3 ripetizioni', conta(), 0);
    controlla('suono spento: la sveglia di ripetizione resta (la scheda viene in primo piano)', sw.env.sveglie.has('cloudflare-avviso'));
    controlla('suono spento: nessun errore', sw.env.log.errori.length === 0, sw.env.log.errori);
  }
  {
    const { conta, avvia, sveglia } = prepara(false);
    await attendi(60);
    avvia(true);
    await attendi(60);
    sveglia(); await attendi(60);
    uguale('impostazione salvata spenta vince anche se la pagina chiede il suono', conta(), 0);
  }
  {
    const { sw, conta, avvia, sveglia } = prepara(true);
    await attendi(60);
    avvia(true);
    await attendi(60);
    uguale('suono acceso: suona al primo avviso', conta(), 1);
    sveglia(); await attendi(60);
    uguale('suono acceso: suona alla ripetizione', conta(), 2);
    sw.env.store.avvisoSonoro = false;
    sveglia(); await attendi(30); sveglia(); await attendi(60);
    uguale('spento durante l\'avviso: le ripetizioni dopo non suonano', conta(), 2);
  }
  {
    const { conta, avvia } = prepara(undefined);
    await attendi(60);
    avvia(true);
    await attendi(60);
    uguale('impostazione mai toccata: suona come prima (predefinito acceso)', conta(), 1);
  }
  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
