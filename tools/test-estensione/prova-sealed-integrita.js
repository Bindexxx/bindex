// Prezzo dei prodotti sealed secondo l'integrità della confezione (dalla 5.77, sql/150):
// - shared.js classifica il commento dell'offerta (commenti veri visti su Cardmarket il 19/11):
//   senza commento o senza danni = integro; strappi/buchi della pellicola = sigillo danneggiato;
//   ammaccature, angoli, graffi, strappi = confezione danneggiata; aperto/unsealed = aperto;
// - il prezzo è la prima offerta con l'integrità del prodotto (fino a 4 caricamenti in più),
//   minimo = prima offerta valida; senza offerte adatte resta il prezzo normale ("non-trovata");
// - controllo prezzi sealed, coda autonoma e pagina Coda passano l'integrità e salvano
//   minimo e origine con aggiornaIntegritaRigaSealed; senza integrità la lettura è come prima.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const P = 'https://www.cardmarket.com/it/Pokemon/Products/';
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



const riga = (lingua, prezzo, commento = '') => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span></div>${commento ? `<div class="product-comments me-1 col"><div class="d-none d-lg-block w-100"><span class="d-block text-truncate text-muted fst-italic small">${commento}</span></div></div>` : ''}<div class="price-container"><span class="fw-bold">${prezzo} €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
// Come il Set Allenatore Fuoriclasse di Scintille Folgoranti dal vivo (19/11)
const ETB = `<html><head><title>Set Allenatore Fuoriclasse di Scintille Folgoranti | Cardmarket</title><meta property="og:image" content="https://product-images.s3.cardmarket.com/1016/784963/784963.jpg"></head><body>
  <a id="account-dropdown">utente</a><h1>Set Allenatore Fuoriclasse di Scintille Folgoranti<span>Elite Trainer Boxes</span></h1>
  ${riga('Italiano', '95,00', 'sealed - piccolo strappo su un lato')}${riga('Francese', '100,00')}${riga('Italiano', '110,00', 'Pellicola danneggiata')}
  ${riga('Italiano', '117,90', 'Doppia pellicola - Esterna (Gedis) con buco')}${riga('Italiano', '119,99', 'perfect sealed - fast shipping')}${riga('Italiano', '121,00')}
</body></html>`;
const ETB_URL = P + 'Elite-Trainer-Boxes/Surging-Sparks-Elite-Trainer-Box';

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 77) { console.log(`Versione ${versione}: prova dalla 5.77, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');
  const shared = fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8');

  // ── commenti veri ──
  {
    const w = new JSDOM('<html><body></body></html>', { runScripts: 'outside-only' }).window;
    w.eval(shared);
    const casi = {
      '': 'sigillato_integro', 'good state, will be shipped fast!': 'sigillato_integro', 'MORE SEALED': 'sigillato_integro',
      'PERFECT SEALED, fast shipping': 'sigillato_integro', 'sigillato, foto allegata': 'sigillato_integro', 'Top Zustand': 'sigillato_integro',
      'OVP Mint Condition': 'sigillato_integro', 'sealed with shrink': 'sigillato_integro', 'No damage, fast shipping': 'sigillato_integro',
      'Other displays available. Sealed, perfect conditions. Ask for pics': 'sigillato_integro', 'Perfect condition incl pvc-case': 'sigillato_integro',
      'sealed - piccolo strappo su un lato': 'confezione_danneggiata', 'Little scratch in the back as you see into the picture': 'confezione_danneggiata',
      'Small tear on left side': 'confezione_danneggiata', 'seal fully intact, minor corner dents possible': 'confezione_danneggiata',
      'Pellicola danneggiata': 'sigillo_danneggiato', 'Doppia pellicola - Esterna (Gedis) con buco': 'sigillo_danneggiato', 'shrink wrap torn': 'sigillo_danneggiato', 'Folie beschädigt': 'sigillo_danneggiato',
      'opened, cards inside': 'aperto_non_sealed', 'Unsealed': 'aperto_non_sealed', 'Not sealed': 'aperto_non_sealed',
    };
    uguale('integrità dal commento (commenti veri di Cardmarket)', Object.entries(casi).filter(([t, a]) => w.integritaDaCommentoShared(t) !== a).map(([t]) => t), []);
  }

  // ── service worker: lettura del prezzo ──
  {
    const { ctx, env } = caricaBackground({ version: versione, pagine: { [ETB_URL]: ETB } });
    const u = ETB_URL + '?language=5';
    const normale = await ctx._leggiPrezzoSealed(u, null, null);
    uguale('sealed senza integrità: prima offerta in italiano, come prima (95,00 €)', [normale.prezzo, normale.integrita], [95, undefined]);
    const integro = await ctx._leggiPrezzoSealed(u, null, null, { integrita: 'sigillato_integro' });
    uguale('sigillato integro: salta strappo e pellicola danneggiata → 119,99 €, minimo 95,00 €', [integro.prezzo, integro.minimoCm, integro.integrita], [119.99, 95, 'trovata']);
    const sigillo = await ctx._leggiPrezzoSealed(u, null, null, { integrita: 'sigillo_danneggiato' });
    uguale('sigillo danneggiato: "Pellicola danneggiata" → 110,00 €', [sigillo.prezzo, sigillo.integrita], [110, 'trovata']);
    const confezione = await ctx._leggiPrezzoSealed(u, null, null, { integrita: 'confezione_danneggiata' });
    uguale('confezione danneggiata: "piccolo strappo" → 95,00 €', [confezione.prezzo, confezione.integrita], [95, 'trovata']);
    const aperto = await ctx._leggiPrezzoSealed(u, null, null, { integrita: 'aperto_non_sealed' });
    uguale('aperto, nessuna offerta aperta: prezzo normale e "non-trovata"', [aperto.prezzo, aperto.minimoCm, aperto.integrita], [95, 95, 'non-trovata']);
    const risposta = await new Promise((res) => {
      let fatto = false;
      env.listeners.onMessage.forEach(f => f({ type: 'LEGGI_PREZZO_SEALED_GRUPPO', urlProdotto: u, integrita: 'sigillato_integro' }, {}, (r) => { if (!fatto) { fatto = true; res(r); } }));
    });
    uguale('messaggio del controllo prezzi sealed: integrità passata, minimo nella risposta', [risposta.prezzo, risposta.minimoCm, risposta.integrita], [119.99, 95, 'trovata']);
    controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── controllo prezzi sealed (pagina Prezzi) ──
  {
    const sw = caricaBackground({ version: versione, store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(900);
    const lette = [], chiamate = [];
    w.apriTabELeggiPrezzoSealed = async (url, integrita) => {
      lette.push(integrita);
      await attendi(20);
      return { prezzo: 119.99, minimoCm: 95, integrita: integrita === 'aperto_non_sealed' ? 'non-trovata' : 'trovata', nome: 'ETB', immagine: null };
    };
    let daLeggere = true;
    w.chiamaSupabase = async (azione, payload) => {
      chiamate.push([azione, payload]);
      if (azione === 'leggiSealed') {
        if (payload.soloConta) return { ok: true, totale: 2 };
        if (!daLeggere) return { ok: true, carte: [] };
        daLeggere = false;
        return { ok: true, carte: [
          { rigaSheet: 's1', urlBase: ETB_URL + '?language=5', codice: '', nome: 'ETB', prezzoPrecedente: 100, ownerId: 'u-me', integrita: 'sigillato_integro' },
          { rigaSheet: 's2', urlBase: ETB_URL + '?language=5', codice: '', nome: 'ETB aperto', prezzoPrecedente: 100, ownerId: 'u-me', integrita: 'aperto_non_sealed' },
        ] };
      }
      return { ok: true };
    };
    await w.eseguiSessioneSealed({});
    await attendi(200);
    uguale('controllo prezzi sealed: ogni prodotto letto con la sua integrità', lette, ['sigillato_integro', 'aperto_non_sealed']);
    uguale('controllo prezzi sealed: minimo e origine salvati', chiamate.filter(c => c[0] === 'aggiornaIntegritaRigaSealed').map(c => c[1]),
      [{ riga: 's1', minimo: 95, daIntegrita: true }, { riga: 's2', minimo: 95, daIntegrita: false }]);
    await attendi(300);
    controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── coda autonoma ──
  {
    const rigaCoda = { id: 91, owner_id: 'u-altro', nome: 'set allenatore fuoriclasse scintille folgoranti', stato: 'pending', creato_il: '2026-11-19T09:00:00Z', tipo: 'sealed', claimed_by: 'u-me',
      lingua: 'IT', qty: 1, destinazione: 'collezione', integrita_packaging: 'sigillo_danneggiato' };
    const { ctx, env } = caricaBackground({ version: versione, dati: { coda_carte: [rigaCoda] }, store: { aiutaGruppo: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const opzioniLette = [], salvate = [];
    ctx._leggiNomeSealedDaCardmarket = async (url, lingua, t, tab, req, opz) => { opzioniLette.push(opz); return { nome: 'Set Allenatore Fuoriclasse di Scintille Folgoranti', urlProdotto: ETB_URL + '?language=5', prezzo: 110, immagine: null, minimoCm: 95, integrita: 'trovata' }; };
    ctx._aggiungiConVerifica = async () => ({ ok: true, riga: 'sealed-nuovo' });
    const chiamaVero = ctx.chiamaSupabase;
    ctx.chiamaSupabase = async (azione, payload) => { if (azione === 'aggiornaIntegritaRigaSealed') { salvate.push(payload); return { ok: true }; } return chiamaVero(azione, payload); };
    await ctx._risolviRigaCodaCarteAutonoma(rigaCoda);
    uguale('coda autonoma, sealed: letto con l\'integrità della riga', opzioniLette, [{ integrita: 'sigillo_danneggiato' }]);
    uguale('coda autonoma, sealed: minimo salvato sul prodotto nuovo con la riga della coda', salvate, [{ riga: 'sealed-nuovo', rigaCodaId: 91, minimo: 95, daIntegrita: true }]);
    opzioniLette.length = 0; salvate.length = 0;
    await ctx._risolviRigaCodaCarteAutonoma({ ...rigaCoda, id: 92, destinazione: 'wishlist' });
    uguale('coda autonoma, sealed in wishlist: niente integrità', [opzioniLette, salvate.length], [[{}], 0]);
    controlla('coda autonoma: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── pagina Coda "Aggiungi carte" ──
  {
    const codaSito = [{ id: 51, nome: 'SET ALLENATORE FUORICLASSE SCINTILLE FOLGORANTI', lingua: 'IT', qty: 1, stato: 'pending', owner_id: 'u-me', tentativi_falliti: 0, destinazione: 'collezione', tipo: 'sealed', integrita_packaging: 'confezione_danneggiata', creato_il: new Date().toISOString() }];
    const registro = { letture: [], scritture: [] };
    const sw = (msg, sender, sendResponse) => {
      if (!msg || !msg.type) return false;
      const rispondi = (r, ms = 30) => { setTimeout(() => sendResponse(r), ms); return true; };
      switch (msg.type) {
        case 'VERIFICA_LOGIN_SILENZIOSA': return rispondi({ loggato: true });
        case 'PRECEDENZA_CODA_CARDMARKET': return rispondi({ ok: true, attendi: false });
        case 'PING_RICHIESTA': return rispondi({ attiva: true });
        case 'CONVERTI_IMMAGINE': return rispondi({ immagine: null });
        case 'LEGGI_SEALED': registro.letture.push(msg); return rispondi({ nome: 'Set Allenatore Fuoriclasse di Scintille Folgoranti', urlProdotto: ETB_URL + '?language=5', prezzo: 95, minimoCm: 95, integrita: 'trovata' });
        case 'AGGIUNGI_CARTA': {
          registro.scritture.push(msg);
          const i = codaSito.findIndex(r => r.id === msg.dbRigaId);
          if (i >= 0) codaSito.splice(i, 1);
          return rispondi({ ok: true, riga: 'sealed-' + registro.scritture.length });
        }
        default: return false;
      }
    };
    const env = creaAmbiente({ version: versione, store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, sliderRicontrollo: 0, aiutaGruppo: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } },
      dati: { get coda_carte() { return codaSito.slice(); } }, inoltraA: [sw] });
    const { w, errori } = caricaPagina('aggiungi_carta_popup.html', env);
    w.verificaAccessoValido = async () => true;
    const salvate = [];
    const chiamaVero = w.chiamaSupabase;
    w.chiamaSupabase = async (azione, payload) => { if (azione === 'aggiornaIntegritaRigaSealed') { salvate.push(payload); return { ok: true }; } return chiamaVero(azione, payload); };
    for (let i = 0; i < 100 && registro.scritture.length < 1; i++) await attendi(100);
    await attendi(300);
    uguale('Coda, sealed: letto con l\'integrità della riga', registro.letture.map(m => m.integrita), ['confezione_danneggiata']);
    uguale('Coda, sealed: minimo salvato con la riga della coda', salvate, [{ riga: 'sealed-1', rigaCodaId: 51, minimo: 95, daIntegrita: true }]);
    controlla('pagina Coda: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  {
    const a = fs.readFileSync(path.join(EXT, 'supabase_adapter.js'), 'utf8');
    controlla('adapter: aggiornaIntegritaRigaSealed chiama aggiorna_integrita_controllo_sealed (sql/150)', /case 'aggiornaIntegritaRigaSealed'[\s\S]{0,400}rpc\('aggiorna_integrita_controllo_sealed'/.test(a));
    controlla('adapter: i prodotti prenotati portano l\'integrità', /integrita: r\.integrita_packaging \|\| 'sigillato_integro'/.test(a));
  }
  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
