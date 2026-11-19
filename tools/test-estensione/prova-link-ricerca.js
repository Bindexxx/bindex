// Ricerca delle carte più leggera (dalla 5.80):
// - controllo prezzi, carta con link di ricerca: il link della carta trovato si salva e resta
//   (prima, a fine carta, si riscriveva il link di ricerca: 178 carte di francesco cercate di nuovo
//   a ogni controllo, viste nei log del 19/11); le carte col link della carta senza filtri si
//   riscrivono coi filtri come prima;
// - quando Cardmarket respinge la lettura diretta, per mezz'ora la ricerca di carte e sealed va
//   dritta alla scheda (un 429 resta un rallentamento, non fa saltare niente).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
const RICERCA = 'https://www.cardmarket.com/it/Pokemon/Products/Search?category=-1&searchString=svi143&categoryid=-1';
const attendi = (ms) => new Promise(r => setTimeout(r, ms));

function caricaPagina(file, env) {
  const html = fs.readFileSync(path.join(EXT, file), 'utf8');
  const errori = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errori.push('jsdom: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'chrome-extension://fake/' + file + '?modo=tab', runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
  });
  const w = dom.window;
  w.chrome = env.chrome; w.supabase = env.supabase;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => '0.0', json: async () => ({}), headers: { get: () => null } });
  w.confirm = () => false; w.alert = () => {};
  w.addEventListener('error', (e) => errori.push('error: ' + e.message));
  for (const s of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
    if (s === 'supabase.bundle.js' || /^https?:/.test(s)) continue;
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(EXT, s), 'utf8') + '\n//# sourceURL=' + s;
    w.document.body.appendChild(el);
  }
  return { w, errori };
}
const senzaRumore = (errori) => errori.filter(e => !/Not implemented: (navigation|HTMLMediaElement)/.test(e));

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 80) { console.log(`Versione ${versione}: prova dalla 5.80, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // ── 1. Controllo prezzi: il link trovato resta ─────────────────────────────────────────────
  {
    const sw = caricaBackground({ version: versione,
      store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const ricerche = [];
    sw.ctx._leggiNomeDaCardmarket = async (urlNome) => { ricerche.push(urlNome); return { urlSingles: B + 'Scarlet-Violet/Solrock-SVI143', nome: 'Solrock', codice: 'SVI 143', prezzo: 0.3 }; };
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(900);
    const aperte = [];
    w.apriTabEAspettaPrezzo = async (url) => { aperte.push(url); await attendi(20); return { prezzo: 0.35, nomePagina: 'Carta', codicePagina: 'SVI 143', immagine: null }; };
    const chiamate = [];
    let daLeggere = true;
    w.chiamaSupabase = async (azione, payload) => {
      chiamate.push([azione, payload]);
      if (azione === 'leggi') {
        if (payload.soloConta) return { ok: true, totale: 2 };
        if (!daLeggere) return { ok: true, carte: [] };
        daLeggere = false;
        return { ok: true, carte: [
          { rigaSheet: 'r1', urlBase: RICERCA, lingua: 'IT', condizione: 'NM', codice: 'SVI 143', nome: 'SOLCOFERREO EX', prezzoPrecedente: 0.3, ownerId: 'u-me' },
          { rigaSheet: 's1', urlBase: B + 'Test/Carta-Senza-Filtri', lingua: 'IT', condizione: 'NM', codice: 'TST 1', nome: 'Carta', prezzoPrecedente: 1.0, ownerId: 'u-me' },
        ] };
      }
      return { ok: true };
    };
    await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-link', tipo: 'controlla_prezzi', parametri: {}, creatoDa: 'u-me', messoIl: Date.now() } });
    await w._avviaAutorunSeRichiesto();
    await attendi(300);
    const LINK_TROVATO = B + 'Scarlet-Violet/Solrock-SVI143?language=5&minCondition=2';
    const scritteUrl = chiamate.filter(c => c[0] === 'aggiornaUrlRiga').map(c => [c[1].riga, c[1].url]);
    uguale('carta con link di ricerca: cercata una volta', ricerche, [RICERCA]);
    uguale('… prezzo letto sulla pagina della carta trovata', aperte[0], LINK_TROVATO);
    uguale('… salvato il link della carta e MAI riscritto quello di ricerca', scritteUrl.filter(x => x[0] === 'r1'), [['r1', LINK_TROVATO]]);
    uguale('carta col link senza filtri: riscritto coi filtri come prima', scritteUrl.filter(x => x[0] === 's1'), [['s1', B + 'Test/Carta-Senza-Filtri?language=5&minCondition=2']]);
    uguale('prezzi scritti per tutte e due', chiamate.filter(c => c[0] === 'aggiornaPrezzoRiga').map(c => [c[1].riga, c[1].prezzo]), [['r1', 0.35], ['s1', 0.35]]);
    controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── 2. Lettura diretta respinta: per mezz'ora dritti alla scheda ───────────────────────────
  {
    const letture = [];
    let risposta = () => rispostaFinta('', 403, { 'cf-mitigated': 'challenge' });
    const { ctx, env } = caricaBackground({ version: versione,
      fetch: async (url) => { if (url.startsWith('https://www.cardmarket.com/')) { letture.push(url); return risposta(url); } return null; } });
    const schede = [];
    ctx._risolviNomeEPrezzoUnicaTab = async (url) => { schede.push(url); return { urlSingles: B + 'Scarlet-Violet/Solrock-SVI143', nome: 'Solrock', codice: 'SVI 143', prezzo: 0.3 }; };
    const R1 = 'https://www.cardmarket.com/it/Pokemon/Products/Search?searchMode=v2&searchString=svi143';
    const R2 = 'https://www.cardmarket.com/it/Pokemon/Products/Search?searchMode=v2&searchString=jtg177';
    const r1 = await ctx._leggiNomeDaCardmarketInterno(R1, 'IT', 'NM');
    uguale('prima ricerca: lettura diretta respinta → scheda', [letture, schede, r1.urlSingles], [[R1], [R1], B + 'Scarlet-Violet/Solrock-SVI143']);
    await ctx._leggiNomeDaCardmarketInterno(R2, 'IT', 'NM');
    uguale('ricerca dopo: niente lettura diretta, dritto alla scheda', [letture.length, schede], [1, [R1, R2]]);

    const sealedTab = [];
    ctx._risolviProdottoSealedTab = async (url) => { sealedTab.push(url); return { urlProdotto: null, nome: null }; };
    await ctx._leggiNomeSealedDaCardmarket('https://www.cardmarket.com/it/Pokemon/Products/Search?searchMode=v2&searchString=etb', 'IT');
    // (senza prodotto trovato la ricerca sealed riprova da sola: più schede, mai la lettura diretta)
    uguale('ricerca sealed nella stessa mezz\'ora: dritta alla scheda', [letture.length, sealedTab.length > 0], [1, true]);
    controlla('nessun errore', env.log.errori.length === 0, env.log.errori);
  }
  {
    const letture = [];
    const { ctx } = caricaBackground({ version: versione,
      fetch: async (url) => { if (url.startsWith('https://www.cardmarket.com/')) { letture.push(url); return rispostaFinta('', 429, { 'retry-after': '60' }); } return null; } });
    ctx._risolviNomeEPrezzoUnicaTab = async () => ({ urlSingles: null });
    const R1 = 'https://www.cardmarket.com/it/Pokemon/Products/Search?searchMode=v2&searchString=svi143';
    const r = await ctx._leggiNomeDaCardmarketInterno(R1, 'IT', 'NM');
    uguale('429 (troppe richieste): rallentamento come prima', r.rateLimited, true);
    uguale('… e non fa saltare la lettura diretta dopo', ctx._letturaDirettaDaSaltare(), false);
  }
  {
    const letture = [];
    const ZUBAT = B + 'Silver-Tempest/Zubat-SIT103';
    const { ctx } = caricaBackground({ version: versione,
      fetch: async (url) => {
        if (!url.startsWith('https://www.cardmarket.com/')) return null;
        letture.push(url);
        return rispostaFinta(`<html><head><meta property="og:url" content="${ZUBAT}"><title>Zubat | Cardmarket</title></head><body><h1>Zubat (SIT 103)<span> Silver Tempest - Singles</span></h1></body></html>`);
      } });
    let schede = 0;
    ctx._risolviNomeEPrezzoUnicaTab = async () => { schede++; return { urlSingles: null }; };
    const R = 'https://www.cardmarket.com/it/Pokemon/Products/Search?searchMode=v2&searchString=SIT103';
    await ctx._leggiNomeDaCardmarketInterno(R, 'IT', 'NM').catch(() => null);
    uguale('lettura diretta che funziona: nessuna scheda per la ricerca e niente da saltare', [schede, ctx._letturaDirettaDaSaltare()], [0, false]);
  }

  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
