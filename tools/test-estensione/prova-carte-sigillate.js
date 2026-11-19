// Carte sigillate nella bustina (dalla 5.76, sql/148):
// - shared.js riconosce dal commento dell'offerta "sealed", "OVP", "sigillata", "nella busta
//   originale"… e scarta "No sealed", "Unsealed", "non sigillata" (commenti visti dal vivo);
// - per una carta con la spunta "Sigillata" il prezzo è la prima offerta sigillata (lingua e
//   condizione della carta), caricando fino a 4 pagine in più; minimo = prima offerta valida;
//   senza offerte sigillate resta il prezzo normale ("non-trovata");
// - content.js (controllo prezzi) lo fa solo se popup.js segna la carta come sigillata;
//   le carte normali leggono come prima;
// - service worker: _leggiPrezzoSigillata / LEGGI_PREZZO_SIGILLATA per la coda;
// - pagina Prezzi: apriTabEAspettaPrezzo con { sigillata } e, in sessione, aggiornaSigillataRiga.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { caricaBackground } = require('./lib/carica-background');
const { creaAmbiente } = require('./lib/chrome-finto');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const B = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/';
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


// Riga d'offerta come su Cardmarket: bandiera, condizione, commento, prezzo, carrello.
const riga = (lingua, prezzo, commento = '', cond = 'nm') => `<div class="article-row"><div class="product-attributes"><span aria-label="${lingua}"></span><a class="article-condition condition-${cond}"></a></div>${commento ? `<div class="product-comments me-1 col"><div class="d-none d-lg-block w-100"><span class="d-block text-truncate text-muted fst-italic small">${commento}</span></div></div>` : ''}<div class="price-container"><span class="fw-bold">${prezzo} €</span></div><a class="btn btn-sm btn-primary" role="button"><span class="fonticon-cart"></span></a></div>`;
const euro = (n) => n.toFixed(2).replace('.', ',');
// Pagina carta con "Mostra più risultati": ogni clic aggiunge il blocco successivo.
const pagina = (righe, blocchi = []) => `<html><head><title>Pecharunt | Cardmarket</title></head><body>
  <a id="account-dropdown">utente</a><h1>Pecharunt <span>SV Black Star Promos</span>(SVP 129)</h1>
  <div id="tabella">${righe.join('')}</div>
  ${blocchi.map((b, i) => `<template class="altre" data-n="${i}">${b.join('')}</template>`).join('')}
  ${blocchi.length ? '<button id="loadMoreButton" type="submit">Mostra più risultati</button>' : ''}
  <script>
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.parentNode; } });
    window.__clicCaricaAltri = 0;
    const b = document.getElementById('loadMoreButton');
    if (b) b.addEventListener('click', () => {
      window.__clicCaricaAltri++;
      const t = document.querySelector('template.altre');
      if (!t) return;
      setTimeout(() => { document.getElementById('tabella').insertAdjacentHTML('beforeend', t.innerHTML); t.remove(); if (!document.querySelector('template.altre')) b.remove(); }, 40);
    });
  </script></body></html>`;
const normali = (da, n, lingua = 'Italiano') => Array.from({ length: n }, (_, i) => riga(lingua, euro(da + i * 0.01), i % 7 === 3 ? 'Ask for pictures' : ''));
// P1 (come Pecharunt IT dal vivo): 0,45 normale, 0,50 "No sealed", 0,90 "sealed"
const P1 = pagina([riga('Inglese', '0,30', 'sealed'), riga('Italiano', '0,45'), riga('Italiano', '0,50', 'No sealed'), riga('Italiano', '0,70', 'sealed', 'ex'), ...normali(0.8, 6), riga('Italiano', '0,90', 'sealed'), ...normali(1, 40)]);
// P2 (come Mega Charizard X EN dal vivo): nessuna sigillata nelle prime 50, "[Sealed]" al terzo caricamento
const P2 = pagina(normali(27, 50, 'Inglese'), [normali(30, 50, 'Inglese'), normali(33, 50, 'Inglese'), [...normali(36, 10, 'Inglese'), riga('Inglese', '38,60', '[Sealed]'), ...normali(39, 39, 'Inglese')], normali(42, 50, 'Inglese')]);
// P3: niente sigillate, niente altre pagine
const P3 = pagina([riga('Italiano', '0,45'), riga('Italiano', '0,50', 'Unsealed'), riga('Italiano', '0,55', 'non sigillata')]);
// P4: sigillata solo dopo 6 caricamenti → oltre il limite di 4
const P4 = pagina(normali(1, 50), Array.from({ length: 6 }, (_, k) => k === 5 ? [riga('Italiano', '9,00', 'sealed')] : normali(2 + k, 50)));

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 76) { console.log(`Versione ${versione}: prova dalla 5.76, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');
  const shared = fs.readFileSync(path.join(EXT, 'shared.js'), 'utf8');
  const contentJs = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');

  // ── commenti (veri, da Cardmarket) ──
  {
    const w = new JSDOM('<html><body></body></html>', { runScripts: 'outside-only' }).window;
    w.eval(shared);
    const si = ['sealed', 'Sealed', 'SEALED', '[Sealed]', 'OVP', 'OVP Sealed / Bilder auf Anfrage', 'Orginalverpackt', 'nella busta originale', 'Sealed | S-01-01 | 24h Versand', 'sigillata', 'Carta sigillata', 'scellée', 'sellada', 'still sealed in original wrapper', '未開封', 'ungeöffnet'];
    const no = ['No sealed', 'Unsealed', 'non sigillata', 'nicht versiegelt', 'not sealed', 'From pack to sleeve ready to ship', 'in plastic in toploader', 'VET', 'Professional seller', 'Ask for pictures', 'Sleeved + Toploader', ''];
    uguale('commenti da sigillata riconosciuti', si.filter(t => !w.testoESigillataShared(t)), []);
    uguale('commenti normali o "non sigillata" scartati', no.filter(t => w.testoESigillataShared(t)), []);
  }

  // ── content.js nella scheda del controllo prezzi ──
  const conContent = async (html, url, sigillata) => {
    const mandati = [];
    const dom = new JSDOM(html, { url, runScripts: 'dangerously' });
    const w = dom.window;
    w.chrome = { runtime: { sendMessage: (m, cb) => { mandati.push(m); if (typeof cb === 'function') cb(); }, lastError: undefined } };
    Object.defineProperty(w.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
    if (sigillata !== undefined) w.__bindexSigillata = sigillata;
    w.eval(shared + '\n;\n' + contentJs);
    await attendi(1500);
    const prezzo = mandati.find(m => m.type === 'PREZZO_TROVATO');
    const clic = w.__clicCaricaAltri;
    w.close();
    return { prezzo, clic };
  };
  const U = B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129?language=5&minCondition=2';
  const UEN = B + 'MEP-Black-Star-Promos/Mega-Charizard-X-ex-V1-MEP023?language=1&minCondition=2';
  {
    const n = await conContent(P1, U);
    uguale('controllo prezzi, carta normale: prima offerta valida come prima (0,45 €), niente dati sigillata', [n.prezzo && n.prezzo.prezzo, n.prezzo && n.prezzo.sigillata, n.clic], [0.45, undefined, 0]);
    const s = await conContent(P1, U, true);
    uguale('controllo prezzi, sigillata: 0,90 € ("No sealed", inglese ed EX scartate), minimo 0,45 €', [s.prezzo && s.prezzo.prezzo, s.prezzo && s.prezzo.minimoCm, s.prezzo && s.prezzo.sigillata, s.clic], [0.9, 0.45, 'trovata', 0]);
    const s2 = await conContent(P2, UEN, true);
    uguale('controllo prezzi, sigillata oltre le prime 50: 3 caricamenti, 38,60 €, minimo 27,00 €', [s2.prezzo && s2.prezzo.prezzo, s2.prezzo && s2.prezzo.minimoCm, s2.prezzo && s2.prezzo.sigillata, s2.clic], [38.6, 27, 'trovata', 3]);
    const s3 = await conContent(P3, U, true);
    uguale('controllo prezzi, nessuna sigillata: prezzo normale e "non-trovata"', [s3.prezzo && s3.prezzo.prezzo, s3.prezzo && s3.prezzo.minimoCm, s3.prezzo && s3.prezzo.sigillata], [0.45, 0.45, 'non-trovata']);
    const s4 = await conContent(P4, U, true);
    uguale('controllo prezzi, sigillata troppo in fondo: al massimo 4 caricamenti, poi prezzo normale', [s4.prezzo && s4.prezzo.prezzo, s4.prezzo && s4.prezzo.sigillata, s4.clic], [1, 'non-trovata', 4]);
  }

  // ── service worker: lettura per la coda ──
  {
    const UP1 = B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129';
    const UP2 = B + 'MEP-Black-Star-Promos/Mega-Charizard-X-ex-V1-MEP023';
    const UP3 = B + 'Test/Nessuna-Sigillata';
    const { ctx, env } = caricaBackground({ version: versione, pagine: { [UP1]: P1, [UP2]: P2, [UP3]: P3 } });
    const normale = await ctx._leggiPrezzoDaSingles(UP1 + '?language=5&minCondition=2', null, null);
    uguale('coda, lettura normale: invariata (0,45 €, niente dati sigillata)', [normale.prezzo, normale.sigillata], [0.45, undefined]);
    const r1 = await ctx._leggiPrezzoSigillata({ urlSingles: UP1, lingua: 'IT', condizione: 'NM' });
    uguale('coda, sigillata: 0,90 €, minimo 0,45 €', [r1.prezzo, r1.minimoCm, r1.sigillata], [0.9, 0.45, 'trovata']);
    const r2 = await ctx._leggiPrezzoSigillata({ urlSingles: UP2, lingua: 'EN', condizione: 'NM' });
    uguale('coda, sigillata oltre le prime 50: 38,60 €, minimo 27,00 €', [r2.prezzo, r2.minimoCm, r2.sigillata], [38.6, 27, 'trovata']);
    const risposta = await new Promise((res) => {
      let fatto = false;
      env.listeners.onMessage.forEach(f => f({ type: 'LEGGI_PREZZO_SIGILLATA', urlSingles: UP3, lingua: 'IT', condizione: 'NM' }, {}, (r) => { if (!fatto) { fatto = true; res(r); } }));
    });
    uguale('coda, messaggio LEGGI_PREZZO_SIGILLATA senza sigillate: prezzo normale', [risposta.prezzo, risposta.minimoCm, risposta.sigillata], [0.45, 0.45, 'non-trovata']);
    controlla('service worker: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── pagina Prezzi ──
  {
    const URL_CARTA = U;
    const sw = caricaBackground({ version: versione, pagine: { [URL_CARTA]: P1 },
      store: { sliderDelayMinSec: 1, sliderDelayMaxSec: 1, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const { w, errori } = caricaPagina('popup.html', sw.env);
    await attendi(900);
    const letta = await w.apriTabEAspettaPrezzo(URL_CARTA, 1, { sigillata: true });
    uguale('Prezzi: scheda aperta per una sigillata → 0,90 €, minimo 0,45 €', [letta && letta.prezzo, letta && letta.minimoCm, letta && letta.sigillata], [0.9, 0.45, 'trovata']);

    // sessione: una carta sigillata e una normale
    const chiamate = [];
    const aperte = [];
    w.apriTabEAspettaPrezzo = async (url, cf, opz) => {
      aperte.push(!!(opz && opz.sigillata));
      await attendi(20);
      return url.includes('Sig') ? { prezzo: 0.9, minimoCm: 0.45, sigillata: 'trovata', nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null }
        : { prezzo: 1.1, nomePagina: 'Carta', codicePagina: 'TST 1', immagine: null };
    };
    let daLeggere = true;
    w.chiamaSupabase = async (azione, payload) => {
      chiamate.push([azione, payload]);
      if (azione === 'leggi') {
        if (payload.soloConta) return { ok: true, totale: 2 };
        if (!daLeggere) return { ok: true, carte: [] };
        daLeggere = false;
        return { ok: true, carte: [
          { rigaSheet: 's1', urlBase: B + 'Test/Carta-Sig', lingua: 'IT', condizione: 'NM', codice: 'TST', nome: 'Carta', prezzoPrecedente: 1.0, ownerId: 'u-me', sigillataOriginale: true },
          { rigaSheet: 'n1', urlBase: B + 'Test/Carta-Nor', lingua: 'IT', condizione: 'NM', codice: 'TST', nome: 'Carta', prezzoPrecedente: 1.0, ownerId: 'u-me' },
        ] };
      }
      return { ok: true };
    };
    await sw.env.chrome.storage.local.set({ ordinePendenteAutorun: { id: 'o-sig', tipo: 'controlla_prezzi', parametri: {}, creatoDa: 'u-me', messoIl: Date.now() } });
    await w._avviaAutorunSeRichiesto();
    await attendi(200);
    uguale('Prezzi, sessione: la carta sigillata si legge come sigillata, la normale no', aperte, [true, false]);
    uguale('Prezzi, sessione: prezzo della sigillata scritto (0,90 €)', chiamate.filter(c => c[0] === 'aggiornaPrezzoRiga').map(c => [c[1].riga, c[1].prezzo]), [['s1', 0.9], ['n1', 1.1]]);
    uguale('Prezzi, sessione: minimo e origine salvati solo per la sigillata', chiamate.filter(c => c[0] === 'aggiornaSigillataRiga').map(c => c[1]), [{ riga: 's1', minimo: 0.45, daSigillata: true }]);
    await attendi(300);
    controlla('pagina Prezzi: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── coda autonoma (service worker): riga con la spunta "Sigillata" ──
  {
    const rigaCoda = { id: 77, owner_id: 'u-altro', nome: 'Pecharunt SVP 129', stato: 'pending', creato_il: '2026-11-19T09:00:00Z', tipo: 'carta', claimed_by: 'u-me',
      lingua: 'IT', condizione: 'NM', qty: 1, destinazione: 'collezione', sigillata_originale: true };
    const { ctx, env } = caricaBackground({ version: versione, accelera: 10, dati: { coda_carte: [rigaCoda] },
      store: { aiutaGruppo: true, statoLoginCardmarket: { loggato: true, quando: Date.now() } } });
    const scritte = [], sigillate = [], letteSig = [];
    ctx._leggiNomeDaCardmarket = async () => ({ urlSingles: B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129', nome: 'Pecharunt', codice: 'SVP 129', prezzo: 0.45, immagine: null });
    ctx._leggiPrezzoSigillata = async (dati) => { letteSig.push(dati); return { prezzo: 0.9, minimoCm: 0.45, sigillata: 'trovata' }; };
    ctx._aggiungiConVerifica = async (...a) => { scritte.push(a); return { ok: true, riga: 'carta-nuova' }; };
    const chiamaVero = ctx.chiamaSupabase;
    ctx.chiamaSupabase = async (azione, payload) => { if (azione === 'aggiornaSigillataRiga') { sigillate.push(payload); return { ok: true }; } return chiamaVero(azione, payload); };
    await ctx._risolviRigaCodaCarteAutonoma(rigaCoda);
    const prezzoScritto = scritte.length ? JSON.stringify(scritte[0]).includes('0.9') : false;
    uguale('coda autonoma, sigillata: letta anche l\'offerta sigillata (link e lingua della carta)', letteSig.map(d => [d.urlSingles, d.lingua, d.condizione]), [[B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129', 'IT', 'NM']]);
    uguale('coda autonoma, sigillata: carta salvata col prezzo della sigillata (0,90 €)', [scritte.length, prezzoScritto], [1, true]);
    uguale('coda autonoma, sigillata: minimo salvato sulla carta nuova con la riga della coda', sigillate, [{ riga: 'carta-nuova', rigaCodaId: 77, minimo: 0.45, daSigillata: true }]);
    const normale = { ...rigaCoda, id: 78, sigillata_originale: false };
    letteSig.length = 0; sigillate.length = 0;
    await ctx._risolviRigaCodaCarteAutonoma(normale);
    uguale('coda autonoma, carta normale: nessuna lettura in più', [letteSig.length, sigillate.length], [0, 0]);
    controlla('coda autonoma: nessun errore', env.log.errori.length === 0, env.log.errori);
  }

  // ── pagina Coda "Aggiungi carte": riga del sito con la spunta "Sigillata" ──
  {
    const codaSito = [{ id: 41, nome: 'PECHARUNT SVP 129', lingua: 'IT', condizione: 'NM', qty: 1, stato: 'pending', owner_id: 'u-me', location: 'BULK', tentativi_falliti: 0, destinazione: 'collezione', sigillata_originale: true, creato_il: new Date().toISOString() }];
    const registro = { sigillate: [], scritture: [] };
    const sw = (msg, sender, sendResponse) => {
      if (!msg || !msg.type) return false;
      const rispondi = (r, ms = 30) => { setTimeout(() => sendResponse(r), ms); return true; };
      switch (msg.type) {
        case 'VERIFICA_LOGIN_SILENZIOSA': return rispondi({ loggato: true });
        case 'PRECEDENZA_CODA_CARDMARKET': return rispondi({ ok: true, attendi: false });
        case 'PING_RICHIESTA': return rispondi({ attiva: true });
        case 'CONVERTI_IMMAGINE': return rispondi({ immagine: null });
        case 'LEGGI_NOME_CARTA': return rispondi({ nome: 'Pecharunt', codice: 'SVP 129', prezzo: 0.45, urlSingles: B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129' });
        case 'LEGGI_PREZZO_SIGILLATA': registro.sigillate.push(msg); return rispondi({ prezzo: 0.9, minimoCm: 0.45, sigillata: 'trovata' });
        case 'AGGIUNGI_CARTA': {
          registro.scritture.push(msg);
          const i = codaSito.findIndex(r => r.id === msg.dbRigaId);
          if (i >= 0) codaSito.splice(i, 1);
          return rispondi({ ok: true, riga: 'carta-' + registro.scritture.length });
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
    w.chiamaSupabase = async (azione, payload) => { if (azione === 'aggiornaSigillataRiga') { salvate.push(payload); return { ok: true }; } return chiamaVero(azione, payload); };
    for (let i = 0; i < 100 && registro.scritture.length < 1; i++) await attendi(100);
    await attendi(300);
    const rd = registro.scritture[0] && registro.scritture[0].rigaDati;
    uguale('Coda, sigillata: chiesta l\'offerta sigillata con link, lingua e condizione', registro.sigillate.map(m => [m.urlSingles, m.lingua, m.condizione]), [[B + 'SV-Black-Star-Promos/Pecharunt-V1-SFA129', 'IT', 'NM']]);
    uguale('Coda, sigillata: carta scritta col prezzo della sigillata (0,90 €)', rd && rd.I, 0.9);
    uguale('Coda, sigillata: minimo salvato con la riga della coda', salvate, [{ riga: 'carta-1', rigaCodaId: 41, minimo: 0.45, daSigillata: true }]);
    controlla('pagina Coda: nessun errore', senzaRumore(errori).length === 0, senzaRumore(errori));
    w.close();
  }

  // ── adapter: la chiamata al DB ──
  {
    const a = fs.readFileSync(path.join(EXT, 'supabase_adapter.js'), 'utf8');
    controlla('adapter: aggiornaSigillataRiga chiama aggiorna_sigillata_controllo (sql/148)', /case 'aggiornaSigillataRiga'[\s\S]{0,400}rpc\('aggiorna_sigillata_controllo'/.test(a));
    controlla('adapter: le carte prenotate portano sigillataOriginale', /sigillataOriginale: !!r\.sigillata_originale/.test(a));
  }

  chiudi();
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
