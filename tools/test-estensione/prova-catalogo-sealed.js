// Elenco dei prodotti sealed di Cardmarket (dalla 5.78, sql/151):
// - lo riempie solo l'account indicato nel DB (catalogo_sealed_e_mio), quando il PC è libero
//   (niente coda da fare, niente controllo prezzi, accesso a Cardmarket non perso);
// - legge col turno comune la pagina di una categoria (filtro "Espansione") o le pagine di una
//   categoria + espansione, sempre in vista galleria, e salva con le RPC di sql/151;
// - rallentamento, Cloudflare o pagina non scaricata: pausa di un'ora;
// - foto: scaricata da product-images, rimpicciolita a 400 px WebP, caricata in sealed-foto.
// Le pagine finte ricalcano quelle vere di Cardmarket del 19/11 (Boosters, Scintille Folgoranti).
const fs = require('fs');
const path = require('path');
const { caricaBackground, rispostaFinta } = require('./lib/carica-background');
const { cartellaEstensione } = require('./lib/cartella-estensione');
const { controlla, uguale, chiudi } = require('./lib/verifica');

const EXT = cartellaEstensione();
const P = 'https://www.cardmarket.com/it/Pokemon/Products/';

const PAGINA_CATEGORIA = `<html><head><title>Bustine Pokémon | Cardmarket</title></head><body>
<form id="SearchResultForm"><select id="idCategory6afed061f309e" class="form-select"><option value="0">All</option><option value="52">Boosters</option></select>
<select name="idExpansion" size="1" id="idExpansion6afed06f8edd0" class="form-select"><option value="0">Tutti</option><option value="5402">151</option><option value="4345">25th Anniversary Collection</option><option value="5879">Scintille Folgoranti</option><option value="1601">Pok&eacute;mon &amp; Friends</option><option value="5402">151</option></select></form>
<div class="col-auto d-none d-md-block">300 Risultati</div><div class="col-12 col-sm-6 ms-auto">Pagina 1 di 10</div></body></html>`;

const scheda = (cat, idCat, id, slug, nome) => `<div class="d-flex mb-4 col-12 col-sm-6 col-md-4 col-lg-3"><a href="/it/Pokemon/Products/${cat}/${slug}" class="card text-center w-100 galleryBox"><img src="https://www.cardmarket.com/img/transparent.gif" alt="${nome}" data-echo="https://product-images.s3.cardmarket.com/${idCat}/${id}/${id}.jpg" class="lazy card-img-top img-fluid"><div class="card-body d-flex flex-column"><h2 class="card-title h3"><span class="expansion-symbol is-pokemon icon is-24x24"><span></span></span>${nome}</h2><p class="card-text text-muted">Da <b>4,00 €</b></p></div></a></div>`;
const paginaCoppia = (schede, pagina, di, risultati) => `<html><head><title>Bustine Pokémon | Cardmarket</title></head><body><section>
<div class="col-auto d-none d-md-block">${risultati} Risultati</div><div class="col-12 col-sm-6 ms-auto">Pagina ${pagina} di ${di}</div>
<div class="row">${schede.join('')}</div>
<a href="/it/Pokemon/Products/Boosters?idExpansion=5879&site=${pagina + 1}" class="btn btn-primary btn-sm ms-3 pagination-control"></a></section></body></html>`;
const PAGINA_1 = paginaCoppia([
  scheda('Boosters', 52, 784945, 'Surging-Sparks-Booster', 'Busta di Scintille Folgoranti'),
  scheda('Boosters', 52, 784946, 'Surging-Sparks-Sleeved-Booster', 'Busta con protezione di Scintille Folgoranti'),
  scheda('Boosters', 52, 784945, 'Surging-Sparks-Booster', 'Busta di Scintille Folgoranti'),
  scheda('Booster-Boxes', 53, 784950, 'Surging-Sparks-Booster-Box', 'Display di Scintille Folgoranti'),
], 1, 2, 3);
const PAGINA_2 = paginaCoppia([
  scheda('Boosters', 52, 784947, 'Surging-Sparks-3-Pack-Blister', 'Blister da 3 di Scintille Folgoranti &#039;Pikachu&#039;'),
], 2, 2, 3);
const PAGINA_LISTA = `<html><body><div class="col-auto">4 Risultati</div><div class="table-body"><div class="row"><a href="/it/Pokemon/Products/Boosters/Surging-Sparks-Booster">Busta di Scintille Folgoranti</a></div></div></body></html>`;
const PAGINA_STRANA = `<html><head><title>Cardmarket</title></head><body><p>Manutenzione</p></body></html>`;
const PAGINA_CF = `<html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>`;
const URL_FOTO = 'https://product-images.s3.cardmarket.com/52/784945/784945.jpg';

(async () => {
  const versione = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const [maj, min] = versione.split('.').map(Number);
  if (maj === 5 && min < 78) { console.log(`Versione ${versione}: prova dalla 5.78, saltata`); chiudi(); return; }
  console.log('Estensione provata:', EXT, '\n');

  // ── 1. Lettura delle pagine ────────────────────────────────────────────────────────────────
  {
    const { ctx } = caricaBackground({ version: versione });
    uguale('filtro espansioni: id e nome, senza "Tutti" e doppioni, entità decodificate',
      ctx._espansioniSealedDaHtml(PAGINA_CATEGORIA),
      [{ id: 5402, nome: '151' }, { id: 4345, nome: '25th Anniversary Collection' }, { id: 5879, nome: 'Scintille Folgoranti' }, { id: 1601, nome: 'Pokémon & Friends' }]);
    uguale('pagina senza filtro espansioni → null', ctx._espansioniSealedDaHtml(PAGINA_STRANA), null);
    const prodotti = ctx._prodottiSealedDaHtml(PAGINA_1, 'Boosters');
    uguale('schede della galleria: solo la categoria letta, senza doppioni', prodotti.map(p => p.slug), ['Surging-Sparks-Booster', 'Surging-Sparks-Sleeved-Booster']);
    uguale('scheda: link italiano, nome dall\'h2, id prodotto e foto da product-images', prodotti[0], {
      url: P + 'Boosters/Surging-Sparks-Booster', slug: 'Surging-Sparks-Booster', nome: 'Busta di Scintille Folgoranti',
      id_prodotto: 784945, foto_cm: URL_FOTO });
    uguale('nome con apostrofi in entità', ctx._prodottiSealedDaHtml(PAGINA_2, 'Boosters')[0].nome, "Blister da 3 di Scintille Folgoranti 'Pikachu'");
    uguale('pagine di una coppia da "Pagina 1 di N"', [ctx._pagineElencoSealedDaHtml(PAGINA_1), ctx._pagineElencoSealedDaHtml(PAGINA_STRANA)], [2, 1]);
    uguale('vista lista: nessuna scheda (il motore chiede sempre la galleria)', ctx._prodottiSealedDaHtml(PAGINA_LISTA, 'Boosters'), []);
    uguale('indirizzi: sempre mode=gallery, idExpansion e site solo se servono', [
      ctx._urlElencoSealed('Boosters', 0, 1), ctx._urlElencoSealed('Boosters', 5879, 1), ctx._urlElencoSealed('Elite-Trainer-Boxes', 5879, 3)], [
      P + 'Boosters?mode=gallery', P + 'Boosters?idExpansion=5879&mode=gallery', P + 'Elite-Trainer-Boxes?idExpansion=5879&mode=gallery&site=3']);
  }

  // Ambiente per i giri: risposte di Cardmarket e del DB decise da ogni prova.
  function giro({ mio = true, lavori = [], pagine = {}, fotoMancanti = [], store = {}, dati = {}, fotoGrande = false } = {}) {
    const lettureCm = [];
    const fotoScaricate = [];
    const tele = [];
    const coda = lavori.slice();
    const daFare = (args) => (args.p_prodotti || []).filter(p => p.foto_cm).map(p => ({ url: p.url, id_prodotto: p.id_prodotto, foto_cm: p.foto_cm }));
    const { ctx, env } = caricaBackground({
      version: versione, store, dati,
      rpc: {
        catalogo_sealed_e_mio: mio,
        catalogo_sealed_prossimo: () => { const l = coda.shift(); return l ? [l] : []; },
        catalogo_sealed_salva_espansioni: (a) => a.p_espansioni.length,
        catalogo_sealed_salva_pagina: daFare,
        catalogo_sealed_foto_mancanti: fotoMancanti,
      },
      fetch: async (url) => {
        if (url.startsWith('https://product-images.s3.cardmarket.com/')) {
          fotoScaricate.push(url);
          return { ok: true, status: 200, headers: { get: () => null }, blob: async () => ({ size: 95000, type: 'image/jpeg' }) };
        }
        if (url.startsWith('https://www.cardmarket.com/')) {
          lettureCm.push(url);
          const p = pagine[url];
          if (p === 429) return rispostaFinta('', 429, { 'retry-after': '60' });
          return rispostaFinta(p !== undefined ? p : '', p !== undefined ? 200 : 404);
        }
        return null;
      },
    });
    let turni = 0;
    ctx._attendiTurnoCardmarket = async () => { turni++; };
    ctx._chiudiTurnoCardmarket = async () => {};
    ctx.createImageBitmap = async () => ({ width: 1000, height: 800, close() {} });
    ctx.OffscreenCanvas = class {
      constructor(w, h) { tele.push([w, h]); }
      getContext() { return { drawImage() {} }; }
      async convertToBlob(o) { return { type: o.type, size: fotoGrande ? 300 * 1024 : 21000 }; }
    };
    const rpcFatte = (nome) => env.log.chiamate.filter(c => c.rpc === nome);
    const upload = () => env.log.chiamate.filter(c => c.upload);
    return { ctx, env, lettureCm, fotoScaricate, tele, turni: () => turni, rpcFatte, upload };
  }

  // ── 2. Solo l'account del catalogo ─────────────────────────────────────────────────────────
  {
    const g = giro({ mio: false, lavori: [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 0 }] });
    uguale('account diverso da quello nel DB: non fa niente', await g.ctx._lavoraCatalogoSealed(), 'non-mio');
    uguale('… nessuna pagina di Cardmarket, nessun lavoro chiesto', [g.lettureCm.length, g.rpcFatte('catalogo_sealed_prossimo').length], [0, 0]);
  }

  // ── 3. Giro completo: categoria, coppia su due pagine, foto ────────────────────────────────
  {
    const g = giro({
      lavori: [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 0 }, { id_categoria: 52, categoria: 'Boosters', id_espansione: 5879 }],
      pagine: { [P + 'Boosters?mode=gallery']: PAGINA_CATEGORIA, [P + 'Boosters?idExpansion=5879&mode=gallery']: PAGINA_1, [P + 'Boosters?idExpansion=5879&mode=gallery&site=2']: PAGINA_2 },
    });
    uguale('giro finito quando il DB non ha altro', await g.ctx._lavoraCatalogoSealed(), 'finito');
    uguale('pagine lette nell\'ordine, sempre in galleria', g.lettureCm, [P + 'Boosters?mode=gallery', P + 'Boosters?idExpansion=5879&mode=gallery', P + 'Boosters?idExpansion=5879&mode=gallery&site=2']);
    uguale('una pagina = un turno comune di Cardmarket', g.turni(), 3);
    const esp = g.rpcFatte('catalogo_sealed_salva_espansioni');
    uguale('espansioni salvate per la categoria', esp.map(c => [c.args.p_id_categoria, c.args.p_espansioni.length]), [[52, 4]]);
    const pag = g.rpcFatte('catalogo_sealed_salva_pagina');
    uguale('pagine salvate: la prima non chiude il giro, l\'ultima sì col totale',
      pag.map(c => [c.args.p_id_espansione, c.args.p_prodotti.length, c.args.p_completa, c.args.p_totale]), [[5879, 2, false, null], [5879, 1, true, 3]]);
    uguale('foto scaricate da product-images (solo quelle senza foto nostra)', g.fotoScaricate.length, 3);
    uguale('foto rimpicciolite a 400 px sul lato lungo', g.tele[0], [400, 320]);
    const up = g.upload();
    uguale('foto caricate in sealed-foto come <id prodotto>.webp',
      up.map(u => [u.storage, u.upload, u.opzioni.contentType, u.opzioni.upsert]),
      [['sealed-foto', '784945.webp', 'image/webp', true], ['sealed-foto', '784946.webp', 'image/webp', true], ['sealed-foto', '784947.webp', 'image/webp', true]]);
    uguale('foto segnate nel DB', g.rpcFatte('catalogo_sealed_foto_salvata').map(c => c.args.p_foto), ['784945.webp', '784946.webp', '784947.webp']);
    uguale('a lavori finiti chiede le foto mancanti', g.rpcFatte('catalogo_sealed_foto_mancanti').length, 1);
  }

  // ── 4. PC occupato: la coda e i prezzi vengono prima ──────────────────────────────────────
  {
    const lavori = [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 0 }];
    const conCoda = giro({ lavori, dati: { coda_carte: [{ id: 1, stato: 'pending' }] } });
    uguale('coda da fare: l\'elenco aspetta', await conCoda.ctx._lavoraCatalogoSealed(), 'occupato');
    uguale('… senza chiedere lavori né leggere pagine', [conCoda.rpcFatte('catalogo_sealed_prossimo').length, conCoda.lettureCm.length], [0, 0]);
    const conPrezzi = giro({ lavori, store: { sessionePrezziAttiva_prezzi: { scadenza: Date.now() + 60000 } } });
    uguale('controllo prezzi in corso: aspetta', await conPrezzi.ctx._lavoraCatalogoSealed(), 'occupato');
    const fuori = giro({ lavori, store: { statoLoginCardmarket: { loggato: false, quando: Date.now() } } });
    uguale('fuori da Cardmarket: aspetta', await fuori.ctx._lavoraCatalogoSealed(), 'occupato');
    const chiusa = giro({ lavori, store: { lavoraAChiuso: false } });
    uguale('"Lavora anche a estensione chiusa" spento e app chiusa: aspetta', await chiusa.ctx._lavoraCatalogoSealed(), 'occupato');
  }

  // ── 5. Cardmarket rallenta o chiede la verifica: un'ora di pausa ───────────────────────────
  {
    const lavori = [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 5879 }, { id_categoria: 53, categoria: 'Booster-Boxes', id_espansione: 0 }];
    const g = giro({ lavori, pagine: { [P + 'Boosters?idExpansion=5879&mode=gallery']: 429 } });
    uguale('troppe richieste (429): pausa', await g.ctx._lavoraCatalogoSealed(), 'pausa');
    const pausa = g.env.store.catalogoSealedPausaFino;
    controlla('… di circa un\'ora', typeof pausa === 'number' && pausa - Date.now() > 59 * 60000 && pausa - Date.now() <= 60 * 60000, pausa);
    uguale('… e non passa al lavoro dopo', [g.lettureCm.length, g.rpcFatte('catalogo_sealed_salva_pagina').length], [1, 0]);
    uguale('… la coppia non conta come errore (riprende dopo la pausa)', g.rpcFatte('catalogo_sealed_errore').length, 0);
    uguale('durante la pausa non legge niente', [await g.ctx._lavoraCatalogoSealed(), g.lettureCm.length], ['pausa', 1]);

    const cf = giro({ lavori, pagine: { [P + 'Boosters?idExpansion=5879&mode=gallery']: PAGINA_CF } });
    let segnalato = 0;
    cf.ctx._segnalaCloudflareAlTurno = () => { segnalato++; };
    uguale('verifica Cloudflare: pausa', await cf.ctx._lavoraCatalogoSealed(), 'pausa');
    uguale('… e il turno comune rallenta', segnalato, 1);
  }

  // ── 6. Pagina che non sembra un elenco ─────────────────────────────────────────────────────
  {
    const g = giro({ lavori: [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 5879 }], pagine: { [P + 'Boosters?idExpansion=5879&mode=gallery']: PAGINA_STRANA } });
    await g.ctx._lavoraCatalogoSealed();
    uguale('pagina non riconosciuta: errore segnato sulla coppia, niente salvato',
      [g.rpcFatte('catalogo_sealed_errore').map(c => [c.args.p_id_espansione, c.args.p_esito]), g.rpcFatte('catalogo_sealed_salva_pagina').length], [[[5879, 'pagina-non-riconosciuta']], 0]);
    const vuota = giro({ lavori: [{ id_categoria: 52, categoria: 'Boosters', id_espansione: 1 }], pagine: { [P + 'Boosters?idExpansion=1&mode=gallery']: paginaCoppia([], 1, 1, 0) } });
    await vuota.ctx._lavoraCatalogoSealed();
    uguale('elenco vuoto ("0 Risultati"): salvato come letto', vuota.rpcFatte('catalogo_sealed_salva_pagina').map(c => [c.args.p_prodotti.length, c.args.p_completa, c.args.p_totale]), [[0, true, 0]]);
    const strano = giro({ lavori: [{ id_categoria: 52, categoria: 'Boosters/../x', id_espansione: 0 }] });
    await strano.ctx._lavoraCatalogoSealed();
    uguale('categoria non valida dal DB: nessuna pagina letta', strano.lettureCm.length, 0);
  }

  // ── 7. Foto troppo grande, foto mancanti ───────────────────────────────────────────────────
  {
    const g = giro({ fotoMancanti: [{ url: P + 'Boosters/Surging-Sparks-Booster', id_prodotto: 784945, foto_cm: URL_FOTO }, { url: P + 'Tins/x', id_prodotto: 5, foto_cm: 'https://altro.example/5.jpg' }], fotoGrande: true });
    uguale('niente da leggere: prova le foto mancanti', await g.ctx._lavoraCatalogoSealed(), 'finito');
    uguale('… solo da product-images', g.fotoScaricate, [URL_FOTO]);
    uguale('… oltre 200 KB non la carica', [g.upload().length, g.rpcFatte('catalogo_sealed_foto_salvata').length], [0, 0]);
  }

  // ── 8. Sveglia ─────────────────────────────────────────────────────────────────────────────
  {
    const { ctx, env } = caricaBackground({ version: versione });
    await new Promise(r => setTimeout(r, 50));
    const sveglia = env.sveglie.get('catalogo-sealed');
    controlla('sveglia catalogo-sealed ogni 2 minuti', sveglia && sveglia.periodInMinutes === 2, sveglia);
    let chiamato = 0;
    ctx._lavoraCatalogoSealed = async () => { chiamato++; };
    for (const f of env.listeners.onAlarm) f({ name: 'catalogo-sealed' });
    uguale('la sveglia avvia l\'elenco', chiamato, 1);
  }

  chiudi();
})().catch(e => { console.error(e); process.exit(1); });
