// ═══════════════════════════════════════════════════════════════════════
// WIDGET-VALORE-COLLEZIONE.UI.JS — tessere + pagina "Valore collezione"
// / "Variazione valore" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 19 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// "Valore collezione" — CATEGORIA A: pagina propria (Le più preziose,
// media, pezzi totali). "Variazione valore" — CATEGORIA C: nessuna pagina
// propria, condividono lo stesso file perché concettualmente imparentati
// (entrambi sul valore della collezione) e perché il secondo è piccolo.
//
// PUNTO APERTO §7.2 della roadmap — STESSA causa già trovata e confermata
// dal vivo per "Contributi al gruppo" (STEP 6): 'variazione_valore' non ha
// né 'azione' né 'tab' nel catalogo. Per lo stesso motivo già verificato
// leggendo navigation.ui.js (switchTab attiva SEMPRE #visualizzazione
// incondizionatamente, la sostituisce solo per le 5 tab fisse note — non
// per 'variazione_valore'), il click su questa tessera apre Visualizzazione
// come fallback silenzioso, non "nulla". Comportamento preesistente, non
// introdotto da questa ristrutturazione, NON corretto qui senza
// autorizzazione esplicita — stessa scelta che Claudio ha già fatto per
// Contributi (placeholder "work in progress") potrebbe applicarsi anche
// qui, ma NON l'ho applicata: aspetto conferma esplicita prima di
// aggiungere qualunque comportamento nuovo, invece di presumere che valga
// la stessa decisione.
//
// CONSOLIDAMENTO: il commento che introduceva la cache dello storico
// valore (TTL_STORICO_VALORE_MS/_cacheStoricoValore/_storicoValoreConCache)
// era condiviso con la cache di "Prezzi aggiornati" (già spostata in
// widget-prezzi.ui.js allo STEP 16) — qui sotto ho scritto un commento
// nuovo, mirato solo a questa cache, invece di portare quello vecchio
// ormai per metà riferito a codice non più qui.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaValoreCollezione() per tabId === 'valore' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballCORPI.valore_collezione / _ballCORPI.variazione_valore (e
//   ASPETTO/TITOLI_BREVI corrispondenti, ui/widget-render-condiviso.ui.js)
//   — motore visivo, non toccato. Verificato: leggono rispettivamente
//   d.valore/d.media/d.pezzi/d.top e d.variazione/d.valoreOggi/
//   d.carteAggiunte/d.soloUnGiorno — forme confermate coerenti coi due
//   preview() qui sotto.
// - storicoValoreConfronta, storicoValoreUltimiGiorni, authGetUserId,
//   apriFlipCardHome, _urlImmagineVisualizzabile, escapeHtml: esterne,
//   non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── CACHE STORICO VALORE (15 minuti) ─────────────────────────────────
// Lo storico del valore cambia una volta al giorno: interrogarlo a ogni
// giro di polling (renderWidgetHome gira anche da lì) sarebbe sprecato.
// 15 minuti sono generosi e restano molto sotto la frequenza con cui il
// dato si muove davvero.
const TTL_STORICO_VALORE_MS = 15 * 60 * 1000;
let _cacheStoricoValore = { quando: 0, righe: [] };

async function _storicoValoreConCache() {
    if (Date.now() - _cacheStoricoValore.quando < TTL_STORICO_VALORE_MS) return _cacheStoricoValore.righe;
    if (typeof storicoValoreUltimiGiorni !== 'function' || typeof authGetUserId !== 'function') return [];
    try {
        const userId = await authGetUserId();
        if (!userId) return [];
        const { data } = await storicoValoreUltimiGiorni(userId, 30);
        // Come per i prezzi recenti: MAI mettere in cache un risultato
        // vuoto. Il primo giro puo' capitare prima che la tabella abbia
        // righe o mentre la rete e' giu', e memorizzare quel vuoto
        // significherebbe mostrare "in raccolta" per un quarto d'ora a un
        // widget che i dati ce li ha.
        if (data && data.length) _cacheStoricoValore = { quando: Date.now(), righe: data };
        return data || [];
    } catch (e) {
        console.error('[widget variazione_valore]', e);
        return [];
    }
}

// ── VOCE DI CATALOGO "VALORE COLLEZIONE" ─────────────────────────────
CATALOGO_WIDGET.valore_collezione = {
        titolo: 'Valore collezione', icona: 'fa-sack-dollar',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione');
            const valore = coll.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const top = coll.slice()
                .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
                .slice(0, 3)
                .map(c => ({ nome: c.name || '—', valore: Number(c.price) || 0, id: c.id, immagine: c.immagine, rarita: c.rarita }));
            const media = coll.length ? valore / coll.length : 0;
            return {
                righe: [formattaEuroTondo(valore)], // restyle FASE 2: "1.520 €"
                dati: { valore, media, pezzi: coll.length, top }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente la sezione
        // Prezzi (tab:'prezzi') — ora ha una pagina propria dedicata
        // (#valore in index.html, renderPaginaValoreCollezione() sotto).
        // Nessun impatto sul tracciamento missioni m38/m39/m40/m80/m81
        // (registrano l'evento su w.id='valore_collezione', non su
        // 'def.tab' — vedi _eseguiAzioneWidget).
        tab: 'valore',
};

// Variazione su una finestra di N giorni (restyle FASE 2). righe = storico
// ordinato per giorno (almeno 2). Parte dall'ultimo giorno misurato che sta
// ALMENO N giorni prima di oggi, o dal primo disponibile se lo storico è
// più corto: 'giorni' dice quanti giorni copre davvero.
function _variazioneFinestra(righe, n) {
    const ultimo = righe[righe.length - 1];
    const limite = new Date(ultimo.giorno); limite.setDate(limite.getDate() - n);
    let iInizio = 0;
    for (let i = 0; i < righe.length - 1; i++) {
        if (new Date(righe[i].giorno) <= limite) iInizio = i;
    }
    const inizio = righe[iInizio];
    const dentro = righe.slice(iInizio + 1);
    const variazione = (Number(ultimo.valore_totale) || 0) - (Number(inizio.valore_totale) || 0);
    const aggiunte = dentro.reduce((t, r) => t + (Number(r.valore_aggiunte) || 0), 0);
    const carteAggiunte = dentro.reduce((t, r) => t + (Number(r.carte_aggiunte) || 0), 0);
    const pezziInMeno = (Number(inizio.pezzi_totali) || 0) - (Number(ultimo.pezzi_totali) || 0);
    const giorni = Math.max(1, Math.round((new Date(ultimo.giorno) - new Date(inizio.giorno)) / 86400000));
    return {
        variazione, aggiunte, carteAggiunte, giorni,
        mercato: pezziInMeno > 0 ? null : variazione - aggiunte,
        pezziInMeno: Math.max(0, pezziInMeno),
    };
}

// ── VOCE DI CATALOGO "VARIAZIONE VALORE" ─────────────────────────────
CATALOGO_WIDGET.variazione_valore = {
        titolo: 'Variazione valore', icona: 'fa-arrow-trend-up',
        tagliaDefault: '6x5', // il grafico e la scomposizione hanno bisogno di altezza
        // Fase 8, Step 3 (2026-09-13): pagina propria — prima cadeva su
        // Visualizzazione come fallback silenzioso (stesso bug già noto
        // di "Contributi al gruppo"), mai un vero 'tab' impostato qui.
        // renderPaginaVariazioneValore() sotto, usa movimenti_collezione
        // (sql/54) per il "perché", non più solo storico_valore_collezione
        // (che resta comunque la fonte dell'anteprima qui sotto, invariata
        // — il grafico rapido del widget Home non cambia).
        tab: 'variazione',
        // Sostituisce il segnaposto "arrivera' con lo storico del valore
        // totale" che stava nella home fissa da mesi. Ora lo storico c'e'
        // (tabella storico_valore_collezione, migration 36) e viene
        // riempito da ui/storico-valore.avvio.js a ogni apertura.
        preview: async () => {
            const righe = await _storicoValoreConCache();

            // UN SOLO GIORNO NON E' UNA VARIAZIONE. Va detto, non
            // mostrato come "zero": zero significherebbe "non e'
            // cambiato niente", che e' un'altra cosa e sarebbe una bugia
            // il primo giorno.
            if (!righe.length) return { righe: ['In raccolta', 'nessun dato ancora'], badge: false, dati: null };
            if (righe.length < 2) {
                return {
                    righe: ['In raccolta', 'serve un secondo giorno'],
                    badge: false,
                    dati: { soloUnGiorno: true, valore: Number(righe[0].valore_totale) || 0 },
                };
            }

            const c = storicoValoreConfronta(righe);
            // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Variazione = +X € in
            // 7 giorni + mercato/aggiunte"): finestra di 7 giorni invece del
            // solo confronto con il giorno prima. Stessa logica di
            // storicoValoreConfronta, estesa alla finestra: aggiunte = somma
            // di valore_aggiunte dei giorni nella finestra, mercato = il
            // resto; se nel frattempo sono usciti dei pezzi il resto NON è
            // attendibile come movimento dei prezzi e non si mostra (stesso
            // principio della migration 36). "Scambi" delle tavole richiede
            // movimenti_collezione (una query in più): resta alla pagina.
            const s7 = _variazioneFinestra(righe, 7);
            return {
                righe: [`${formattaEuroVariazione(s7.variazione)} in ${s7.giorni} giorn${s7.giorni === 1 ? 'o' : 'i'}`],
                // 'ok' o 'allerta' accendono il semaforo della sfera: qui
                // NON si usano. Un calo di valore non e' un problema da
                // risolvere e non deve far agitare la ball come fa un
                // errore in coda.
                dati: {
                    ...c,
                    settimana: s7,
                    serie: righe.map(r => Number(r.valore_totale) || 0),
                    valoreOggi: Number(righe[righe.length - 1].valore_totale) || 0,
                    giorniMisurati: righe.length,
                },
            };
        },
};

// ── PAGINA "VALORE COLLEZIONE" (2026-08-30) ─────────────────────────────
// Prima widget con pagina di dettaglio propria (struttura adottata da
// cardsync-tutto.html, vedi CSS pg-*/page-header in index.html) invece di
// aprire semplicemente la sezione Prezzi. Zero query nuove: riusa
// CATALOGO_WIDGET.valore_collezione.preview(), la stessa funzione già
// usata per l'anteprima del widget in Home.
// Le carte nella lista "Le più preziose" aprono il flip-viewer con
// origine:'top_valore' — STESSO meccanismo già usato per le missioni
// #39/#83 dal ball-peek in Home (vedi _ballMiniCarta/_ballAzioneRiga):
// cliccarle da qui deve contare allo stesso modo, è concettualmente la
// stessa lista.
// RESTYLE BINDEX (2026-10-01, tavole "Valore collezione"): valore grande con
// la variazione a 7 giorni, grafico Andamento (7 g / 30 g / Tutto) da
// storico_valore_collezione, valore Per location, Le più preziose con la
// variazione dell'ultimo prezzo e "Cosa l'ha mosso" (ultimi 7 giorni, da
// movimenti_collezione, stessi gruppi della pagina Variazione). Su PC
// grafico e location a sinistra, preziose e movimenti a destra.
// Solo letture: storico (fino a 400 giorni) e movimenti (ultimi 1000).
let _valPeriodo = '30';      // '7' | '30' | 'tutto'
let _valStorico = [];        // righe storico_valore_collezione, dalla più vecchia
let _valMovimenti = [];      // movimenti_collezione, più recenti prima

function _valImpostaPeriodo(p) { _valPeriodo = p; _valRender(); }

function _valSerie() {
    if (_valPeriodo === 'tutto') return _valStorico;
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - Number(_valPeriodo));
    return _valStorico.filter(r => new Date(r.giorno) >= limite);
}

function _valDataBreve(g) { return new Date(g).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', ''); }

// Grafico ad area in SVG (niente libreria): l'asse verticale parte poco
// sotto il minimo, come nelle tavole, così le oscillazioni si vedono.
function _valGraficoHtml(serie) {
    if (serie.length < 2) {
        return `<div class="val-grafico-vuoto">${serie.length ? 'Serve un secondo giorno per disegnare l’andamento.' : 'Lo storico del valore si riempie da solo, un punto al giorno.'}</div>`;
    }
    const W = 600, H = 200, pad = 6;
    const v = serie.map(r => Number(r.valore_totale) || 0);
    let min = Math.min(...v), max = Math.max(...v);
    if (max === min) { max += 1; min -= 1; }
    const marg = (max - min) * 0.15; min -= marg; max += marg;
    const x = i => (i / (v.length - 1)) * W;
    const y = val => pad + (1 - (val - min) / (max - min)) * (H - 2 * pad);
    const punti = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`);
    const linea = 'M' + punti.join(' L');
    const area = `${linea} L${W},${H} L0,${H} Z`;
    const griglia = [0.25, 0.5, 0.75].map(f => `<line x1="0" x2="${W}" y1="${(H * f).toFixed(1)}" y2="${(H * f).toFixed(1)}" class="val-g-griglia"/>`).join('');
    const etichette = [max - marg, (max + min) / 2, min + marg].map((val, i) =>
        `<span style="top:${[8, 46, 84][i]}%">${formattaEuroTondo(val).replace(' €', '')}</span>`).join('');
    const meta = Math.floor(serie.length / 2);
    return `
        <div class="val-grafico" data-n="${v.length}" onmousemove="_valGraficoPunta(event)" onmouseleave="_valGraficoVia()" ontouchstart="_valGraficoPunta(event)" ontouchmove="_valGraficoPunta(event)">
            <div class="val-g-assey">${etichette}</div>
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
                ${griglia}
                <path d="${area}" class="val-g-area"/>
                <path d="${linea}" class="val-g-linea" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="val-g-cursore" hidden><span class="val-g-punto"></span></div>
            <div class="val-g-tip" hidden></div>
        </div>
        <div class="val-g-assex"><span>${_valDataBreve(serie[0].giorno)}</span><span class="val-solo-pc">${_valDataBreve(serie[meta].giorno)}</span><span>oggi</span></div>`;
}

function _valGraficoPunta(evt) {
    const box = evt.currentTarget;
    const serie = _valSerie();
    if (serie.length < 2) return;
    const r = box.getBoundingClientRect();
    const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left;
    const i = Math.max(0, Math.min(serie.length - 1, Math.round(cx / r.width * (serie.length - 1))));
    const v = serie.map(s => Number(s.valore_totale) || 0);
    let min = Math.min(...v), max = Math.max(...v);
    if (max === min) { max += 1; min -= 1; }
    const marg = (max - min) * 0.15; min -= marg; max += marg;
    const px = i / (serie.length - 1) * r.width;
    const py = (6 / 200 + (1 - (v[i] - min) / (max - min)) * (188 / 200)) * r.height;
    const cur = box.querySelector('.val-g-cursore'), tip = box.querySelector('.val-g-tip');
    cur.hidden = false; tip.hidden = false;
    cur.style.left = px + 'px';
    cur.querySelector('.val-g-punto').style.top = py + 'px';
    const prima = i > 0 ? v[i] - v[i - 1] : null;
    const giorno = new Date(serie[i].giorno).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
    tip.innerHTML = `<b>${formattaEuro(v[i])}</b><span>${giorno}</span>` +
        (prima != null ? `<span class="${prima > 0 ? 'bx-su' : (prima < 0 ? 'bx-giu' : '')}">${prima > 0 ? '▲' : (prima < 0 ? '▼' : '')} ${formattaEuro(Math.abs(prima))} sul giorno prima</span>` : '');
    const sx = px > r.width * 0.6;
    tip.style.left = sx ? '' : (px + 12) + 'px';
    tip.style.right = sx ? (r.width - px + 12) + 'px' : '';
    tip.style.top = Math.max(0, py - 30) + 'px';
}
function _valGraficoVia() {
    document.querySelectorAll('#valore .val-g-cursore, #valore .val-g-tip').forEach(el => { el.hidden = true; });
}

function _valPerLocation() {
    const mappa = new Map();
    carteReali.filter(c => c.stato === 'collezione' && c.tabella === 'carte').forEach(c => {
        const k = c.location || '?';
        mappa.set(k, (mappa.get(k) || 0) + (Number(c.price) || 0) * (Number(c.qty) || 1));
    });
    const sealed = (typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [])
        .reduce((t, s) => t + (Number(s.price) || 0) * (Number(s.qty) || 1), 0);
    if (sealed > 0) mappa.set('Sealed', (mappa.get('Sealed') || 0) + sealed);
    return [...mappa.entries()].map(([nome, valore]) => ({ nome, valore })).sort((a, b) => b.valore - a.valore);
}

function _valMossoHtml() {
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - 7);
    const somme = {};
    _valMovimenti.filter(m => new Date(m.avvenuto_il) >= limite).forEach(m => {
        const g = _varGruppoDi(m);
        somme[g] = somme[g] || { somma: 0, n: 0 };
        somme[g].n += 1;
        if (m.valore_delta != null) somme[g].somma += Number(m.valore_delta);
    });
    const sotto = { mercato: n => `${n} variazion${n === 1 ? 'e' : 'i'}`, aggiunte: n => `${n} cart${n === 1 ? 'a' : 'e'}`,
        scambi: n => `${n} scambi${n === 1 ? 'o' : ''}`, rimozioni: n => `${n} rimozion${n === 1 ? 'e' : 'i'}`, manuali: n => `${n} modific${n === 1 ? 'a' : 'he'}` };
    const righe = _GRUPPI_MOVIMENTO.filter(g => somme[g.id]).map(g => `
        <div class="val-mosso-riga" onclick="apriDettaglioWidget('variazione', event)">
            <span class="val-mosso-ico"><i class="fa-solid ${g.icona}"></i></span>
            <div class="val-mosso-testo"><b>${g.label}</b><span>${sotto[g.id](somme[g.id].n)}</span></div>
            <b class="val-mosso-delta ${_varSegno(somme[g.id].somma)}">${formattaEuroVariazione(somme[g.id].somma)}</b>
        </div>`).join('');
    return righe || '<div class="val-vuoto">Nessun movimento negli ultimi 7 giorni.</div>';
}

function _valRender() {
    const container = document.getElementById('valoreContenuto');
    if (!container) return;
    const coll = carteReali.filter(c => c.stato === 'collezione' && c.tabella === 'carte');
    const valore = coll.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
    const media = coll.length ? valore / coll.length : 0;

    let pillola = '';
    if (_valStorico.length >= 2) {
        const s7 = _variazioneFinestra(_valStorico, 7);
        pillola = `<span class="val-pillola ${s7.variazione >= 0 ? 'su' : 'giu'}">${s7.variazione >= 0 ? '▲' : '▼'} ${formattaEuroTondo(Math.abs(s7.variazione))} in ${s7.giorni} giorn${s7.giorni === 1 ? 'o' : 'i'}</span>`;
    }

    const loc = _valPerLocation();
    const maxLoc = loc.length ? loc[0].valore : 0;
    const righeLoc = loc.map(l => `
        <div class="val-loc">
            <div class="val-loc-testa"><b>${escapeHtml(l.nome)}</b><span>${formattaEuro(l.valore)}</span></div>
            <div class="val-loc-pista"><div style="width:${maxLoc > 0 ? Math.max(1.5, l.valore / maxLoc * 100).toFixed(1) : 0}%"></div></div>
        </div>`).join('');

    const top = coll.slice().sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0)).slice(0, 4);
    const righeTop = top.map((c, i) => {
        const src = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 96) || '') : '';
        const v = c.variazioneNumerica;
        const sotto = [c.code, c.lang, c.cond].filter(Boolean).join(' · ');
        return `
            <div class="val-top${i === 3 ? ' val-solo-pc-flex' : ''}" onclick="apriFlipCardHome('${escapeJsAttr(String(c.id))}', { origine: 'top_valore' })">
                ${src ? `<img class="val-top-fig" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="val-top-fig"></span>'}
                <div class="val-top-testo"><b>${escapeHtml(c.name || '—')}</b><span>${escapeHtml(sotto)}<em class="val-solo-pc"> · ${escapeHtml(c.location || '')}${Number(c.qty) > 1 ? ' · ×' + c.qty : ''}</em></span></div>
                ${c.location ? `<span class="val-chip val-solo-tel">${escapeHtml(c.location)}</span>` : ''}
                <div class="val-top-destra"><b>${formattaEuro(c.price)}</b>${v ? `<span class="${v > 0 ? 'bx-su' : 'bx-giu'}">${v > 0 ? '▲ +' : '▼ −'}${formattaEuro(Math.abs(v)).replace(' €', '')}</span>` : ''}</div>
            </div>`;
    }).join('');

    const tab = (id, t) => `<button type="button" class="val-tab ${_valPeriodo === id ? 'attivo' : ''}" onclick="_valImpostaPeriodo('${id}')">${t}</button>`;

    container.innerHTML = `
        <div class="val-pagina">
            <div class="val-testa">
                <div class="val-testa-sx">
                    <span class="page-title">Valore collezione</span>
                    <div class="val-riga-valore">
                        <div class="val-grande">${formattaEuro(valore)}</div>
                        <div class="val-sotto">${pillola}<span>${coll.length} pezz${coll.length === 1 ? 'o' : 'i'} · media ${formattaEuro(media)}</span></div>
                    </div>
                </div>
                <button type="button" class="val-btn" onclick="apriDettaglioWidget('prezzi', event)">Vai a Prezzi</button>
            </div>
            <div class="val-layout">
                <div class="val-sinistra">
                    <div class="val-scheda">
                        <div class="val-scheda-testa"><b>Andamento</b><div class="val-tabs">${tab('7', '7 g')}${tab('30', '30 g')}${tab('tutto', 'Tutto')}</div></div>
                        ${_valGraficoHtml(_valSerie())}
                    </div>
                    ${loc.length ? `<div class="val-scheda"><div class="val-scheda-testa"><b>Per location</b></div><div class="val-loc-griglia">${righeLoc}</div></div>` : ''}
                </div>
                <div class="val-destra">
                    ${top.length ? `
                    <div class="val-blocco">
                        <div class="val-titoletto"><span>Le più preziose</span><small class="val-solo-pc">top ${top.length}</small></div>
                        <div class="val-scheda val-scheda-lista">${righeTop}
                            <div class="val-link" onclick="apriDettaglioWidget('visualizzazione', event)">Mostra tutte →</div></div>
                    </div>` : ''}
                    <div class="val-blocco">
                        <div class="val-titoletto"><span>Cosa l’ha mosso <small>· ultimi 7 giorni</small></span></div>
                        <div class="val-scheda val-scheda-lista">${_valMossoHtml()}
                            <div class="val-link" onclick="apriDettaglioWidget('variazione', event)">Tutti i movimenti →</div></div>
                    </div>
                </div>
            </div>
        </div>`;
}

async function renderPaginaValoreCollezione() {
    const container = document.getElementById('valoreContenuto');
    if (!container) return;
    _valRender(); // subito con quello che c'è già in memoria, poi storico e movimenti
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const [st, mv] = await Promise.all([
            storicoValoreUltimiGiorni(userId, 400),
            movimentiCollezioneListMie(userId, _VAR_LIMITE_MOVIMENTI),
        ]);
        _valStorico = st && st.data ? st.data.slice() : [];
        _valMovimenti = mv && mv.data ? mv.data : [];
    } catch (e) {
        console.error('renderPaginaValoreCollezione:', e);
    }
    _valRender();
}


// ── PAGINA "VARIAZIONE VALORE" (Fase 8, Step 3 — 2026-09-13) ────────────
// RESTYLE BINDEX FASE 3c (2026-10-01, tavole "Variazione"): la pagina è
// sempre legata a un PERIODO (7 g / 30 g / Tutto) "da X a Y", con la
// scomposizione a gradini "Da dove arriva la differenza" e i movimenti
// raggruppati per giorno (filtri per tipo). Su PC (pagina larga) a destra
// il dettaglio del movimento scelto.
// Fonte: movimenti_collezione (un log differenziale, una riga per evento
// reale). Verificato sul DB (2026-10-01, corpo delle funzioni):
//   - prezzo_automatico (carte): prezzo_unitario = prezzo NUOVO,
//     quantita_delta NULL, valore_delta = (nuovo − vecchio) × qty al momento.
//     Il prezzo di prima si ricava come prezzo_unitario − valore_delta / qty,
//     usando la qty ATTUALE della carta: se nel frattempo è cambiata il
//     "prima" è approssimato (limite noto, segnalato in chat); se la carta non
//     c'è più si mostra solo il prezzo nuovo.
//   - prezzo_automatico (sealed): valore_delta NULL → si mostra "—".
//   - vendita_scambio / aggiunta / rimozione: quantita_delta e prezzo_unitario
//     presenti. La controparte di uno scambio NON è nel log.
// Nessuna modifica al database: solo lettura.
const _ETICHETTE_TIPO_MOVIMENTO = {
    aggiunta:            { label: 'Aggiunte alla collezione',   icona: 'fa-plus',            gruppo: 'aggiunte' },
    rimozione:           { label: 'Rimozioni',                  icona: 'fa-minus',           gruppo: 'rimozioni' },
    vendita_scambio:     { label: 'Scambi conclusi',            icona: 'fa-right-left',      gruppo: 'scambi' },
    prezzo_automatico:   { label: 'Oscillazione di mercato',    icona: 'fa-chart-line',      gruppo: 'mercato' },
    prezzo_manuale:      { label: 'Modifiche a mano',           icona: 'fa-pen',             gruppo: 'manuali' },
    variazione_quantita: { label: 'Modifiche a mano',           icona: 'fa-layer-group',     gruppo: 'manuali' },
    correzione:          { label: 'Modifiche a mano',           icona: 'fa-wrench',          gruppo: 'manuali' },
};
// Ordine = ordine delle righe nella scomposizione e dei filtri.
const _GRUPPI_MOVIMENTO = [
    { id: 'mercato',   label: 'Oscillazione di mercato', chip: 'Mercato',          icona: 'fa-chart-line' },
    { id: 'aggiunte',  label: 'Aggiunte alla collezione', chip: 'Aggiunte',        icona: 'fa-plus' },
    { id: 'rimozioni', label: 'Rimozioni',               chip: 'Rimozioni',        icona: 'fa-minus' },
    { id: 'scambi',    label: 'Scambi conclusi',         chip: 'Scambi',           icona: 'fa-right-left' },
    { id: 'manuali',   label: 'Modifiche a mano',        chip: 'Modifiche a mano', icona: 'fa-pen' },
];
const _VAR_LIMITE_MOVIMENTI = 1000;

let _varEventi = [];          // tutti i movimenti caricati (più recenti prima)
let _varTroncato = false;     // true se il limite ha tagliato lo storico
let _varPeriodo = '7';        // '7' | '30' | 'tutto'
let _varFiltro = 'tutti';     // 'tutti' | id gruppo
let _varSelId = null;         // id del movimento mostrato nel dettaglio (PC)

function _varGruppoDi(m) { return (_ETICHETTE_TIPO_MOVIMENTO[m.tipo_evento] || {}).gruppo || 'manuali'; }

// L'oggetto (carta o sealed) a cui si riferisce il movimento, se esiste
// ancora. Per le carte serve perché la miniatura apre la carta a schermo
// intero (regola comune); se non c'è più, il movimento resta ma "rimossa".
function _varOggetto(m) {
    if (!m.oggetto_id) return null;
    if (m.oggetto_tipo === 'sealed') {
        const s = prodottiSealedReali.find(x => String(x.id) === String(m.oggetto_id));
        return s ? { tipo: 'sealed', o: s } : null;
    }
    const c = carteReali.find(x => String(x.id) === String(m.oggetto_id) && x.tabella === 'carte');
    return c ? { tipo: 'carta', o: c } : null;
}

function _varValoreOggi() {
    const carte = carteReali.filter(c => c.stato === 'collezione').reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
    const sealed = prodottiSealedReali.reduce((t, s) => t + (Number(s.price) || 0) * (Number(s.qty) || 1), 0);
    return carte + sealed;
}

// Eventi dentro il periodo scelto + data di partenza.
function _varPeriodoDati() {
    let inizio = null;
    if (_varPeriodo !== 'tutto') {
        inizio = new Date(); inizio.setHours(0, 0, 0, 0);
        inizio.setDate(inizio.getDate() - Number(_varPeriodo));
    }
    const eventi = inizio ? _varEventi.filter(m => new Date(m.avvenuto_il) >= inizio) : _varEventi.slice();
    if (!inizio && eventi.length) { inizio = new Date(eventi[eventi.length - 1].avvenuto_il); inizio.setHours(0, 0, 0, 0); }
    return { eventi, inizio };
}

// "prima → dopo" di un movimento di mercato su una carta (vedi nota in testa).
function _varPrezzoPrima(m) {
    if (m.tipo_evento !== 'prezzo_automatico' && m.tipo_evento !== 'prezzo_manuale') return null;
    if (m.valore_delta == null || m.prezzo_unitario == null) return null;
    const og = _varOggetto(m);
    const qty = og && og.tipo === 'carta' ? (Number(og.o.qty) || 1) : null;
    if (!qty) return null;
    return { prima: Number(m.prezzo_unitario) - Number(m.valore_delta) / qty, dopo: Number(m.prezzo_unitario), qty };
}

function _varOra(iso) { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function _varDataBreve(d) { return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', ''); }
function _varGiornoEtichetta(iso) {
    const d = new Date(iso); const oggi = new Date();
    const k = (x) => x.getFullYear() * 10000 + x.getMonth() * 100 + x.getDate();
    const ieri = new Date(); ieri.setDate(oggi.getDate() - 1);
    if (k(d) === k(oggi)) return 'Oggi';
    if (k(d) === k(ieri)) return 'Ieri';
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
}
function _varSegno(v) { return v > 0 ? 'bx-su' : (v < 0 ? 'bx-giu' : ''); }

function _varMeta(m) {
    const q = m.quantita_delta != null ? Math.abs(Number(m.quantita_delta)) : null;
    const pz = m.prezzo_unitario != null ? formattaEuro(m.prezzo_unitario) : null;
    const ora = _varOra(m.avvenuto_il);
    const og = _varOggetto(m);
    switch (m.tipo_evento) {
        case 'prezzo_automatico':
        case 'prezzo_manuale': {
            const pp = _varPrezzoPrima(m);
            const base = m.tipo_evento === 'prezzo_automatico' ? 'Mercato' : 'Prezzo a mano';
            if (pp) return `${base} · ${formattaEuro(pp.prima)} → ${formattaEuro(pp.dopo)}${pp.qty > 1 ? ` ×${pp.qty}` : ''} · ${ora}`;
            return `${base}${pz ? ' · ' + pz : ''} · ${ora}`;
        }
        case 'aggiunta': return `Aggiunta${q ? ` · ×${q}` : ''}${pz ? ' a ' + pz : ''} · ${ora}`;
        case 'rimozione': return `Rimossa${q ? ` · ×${q}` : ''}${pz ? ' a ' + pz : ''}${og ? '' : ' · non più in collezione'} · ${ora}`;
        case 'vendita_scambio': return `Scambio concluso${q ? ` · ×${q}` : ''}${pz ? ' a ' + pz : ''} · ${ora}`;
        case 'variazione_quantita': return `Quantità ${Number(m.quantita_delta) > 0 ? '+' : ''}${m.quantita_delta != null ? m.quantita_delta : ''} · ${ora}`;
        default: return `${(_ETICHETTE_TIPO_MOVIMENTO[m.tipo_evento] || {}).label || m.tipo_evento} · ${ora}`;
    }
}

function _varMiniatura(m, grande) {
    const info = _ETICHETTE_TIPO_MOVIMENTO[m.tipo_evento] || { icona: 'fa-circle-question' };
    const og = _varOggetto(m);
    const dim = grande ? 'var-mini-grande' : '';
    const src = og && og.o.immagine ? _urlImmagineVisualizzabile(og.o.immagine, grande ? 240 : 96) : '';
    if (!og || !src) {
        const cls = og ? '' : ' var-ico-rimossa';
        return `<span class="var-ico${cls} ${dim}" title="${og ? '' : 'Non più in collezione'}"><i class="fa-solid ${og && og.tipo === 'sealed' ? 'fa-box' : info.icona}"></i></span>`;
    }
    const img = `<img class="var-img ${dim}" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'var-ico',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`;
    if (og.tipo === 'carta') {
        return `<span class="bx-lente" onclick="event.stopPropagation(); apriFlipCardHome('${escapeJsAttr(String(og.o.id))}')" title="Apri la carta">${img}</span>`;
    }
    return img;
}

function _varImpostaPeriodo(p) { _varPeriodo = p; _varSelId = null; _varRender(); }
function _varImpostaFiltro(f) { _varFiltro = f; _varSelId = null; _varRender(); }
function _varSeleziona(id) {
    _varSelId = id;
    document.querySelectorAll('#variazione .var-riga').forEach(r => r.classList.toggle('sel', r.dataset.mid === String(id)));
    const det = document.getElementById('varDettaglio');
    const m = _varEventi.find(x => String(x.id) === String(id));
    if (det && m) det.innerHTML = _varDettaglioHtml(m);
}

function _varDettaglioHtml(m) {
    const info = _ETICHETTE_TIPO_MOVIMENTO[m.tipo_evento] || { label: m.tipo_evento, icona: 'fa-circle-question' };
    const og = _varOggetto(m);
    const pp = _varPrezzoPrima(m);
    const delta = m.valore_delta != null ? Number(m.valore_delta) : null;
    const sub = og && og.tipo === 'carta'
        ? [og.o.code, og.o.location, `×${og.o.qty}`].filter(Boolean).join(' · ')
        : (og ? `×${og.o.qty}` : 'Non più in collezione');
    let prezzi = '';
    if (pp) {
        const perc = pp.prima ? (pp.dopo - pp.prima) / pp.prima * 100 : null;
        prezzi = `<div class="var-det-prezzi"><s>${formattaEuro(pp.prima)}</s><i class="fa-solid fa-arrow-right"></i><b>${formattaEuro(pp.dopo)}</b></div>
            <div class="var-det-delta ${_varSegno(delta)}">${formattaEuroVariazione(delta)}${perc != null && isFinite(perc) ? ` · ${perc > 0 ? '+' : (perc < 0 ? '−' : '')}${Math.abs(perc).toFixed(1).replace('.', ',')}%` : ''}</div>`;
    } else {
        prezzi = `<div class="var-det-delta var-det-delta-solo ${_varSegno(delta)}">${delta != null ? formattaEuroVariazione(delta) : '—'}</div>`;
    }
    const righe = [];
    if (m.fonte === 'estensione') righe.push(`<div class="var-det-info"><i class="fa-solid fa-puzzle-piece"></i><div><b>Prezzo aggiornato dall'estensione</b><span>${_varGiornoEtichetta(m.avvenuto_il).toLowerCase()} alle ${_varOra(m.avvenuto_il)}</span></div></div>`);
    if (og && og.tipo === 'carta') {
        const tot = _varValoreOggi();
        const valoreRiga = (Number(og.o.price) || 0) * (Number(og.o.qty) || 1);
        if (tot > 0 && valoreRiga > 0) righe.push(`<div class="var-det-info"><i class="fa-solid fa-chart-simple"></i><div><b>Pesa il ${Math.round(valoreRiga / tot * 100)}% della collezione</b><span>valore attuale di questa carta: ${formattaEuro(valoreRiga)}</span></div></div>`);
    }
    const bottoni = (og && og.tipo === 'carta') ? `
        <div class="var-det-azioni">
            <button type="button" class="ric-btn ric-btn-pieno" onclick="apriFlipCardHome('${escapeJsAttr(String(og.o.id))}')"><i class="fa-solid fa-expand"></i> Tutto schermo</button>
            <button type="button" class="ric-btn" onclick="apriModificaCarta('${escapeJsAttr(String(og.o.id))}')"><i class="fa-solid fa-pen"></i> Modifica carta</button>
        </div>` : '';
    return `
        <div class="var-det-card">
            <div class="var-det-testa">
                ${_varMiniatura(m, true)}
                <div class="var-det-testo">
                    <div class="var-det-nome">${escapeHtml(m.nome_snapshot || '—')}</div>
                    <div class="pg-sotto">${escapeHtml(sub)}</div>
                    <span class="var-chip-tipo"><i class="fa-solid ${info.icona}"></i> ${info.label}</span>
                    ${prezzi}
                </div>
            </div>
            ${righe.join('')}
            ${bottoni}
        </div>`;
}

function _varRender() {
    const container = document.getElementById('variazioneContenuto');
    if (!container) return;
    const { eventi, inizio } = _varPeriodoDati();

    // Somme per gruppo (valore_delta NULL = non conta nel valore).
    const somme = {}; _GRUPPI_MOVIMENTO.forEach(g => { somme[g.id] = { somma: 0, n: 0 }; });
    let totale = 0;
    eventi.forEach(m => {
        const s = somme[_varGruppoDi(m)]; s.n += 1;
        if (m.valore_delta != null) { s.somma += Number(m.valore_delta); totale += Number(m.valore_delta); }
    });
    const oggi = _varValoreOggi();
    const partenza = oggi - totale;

    // Scomposizione a gradini. La scala NON parte da zero (le differenze
    // sarebbero invisibili): parte un po' sotto il livello più basso, e lo
    // dice in chiaro sotto il grafico.
    const gr = _GRUPPI_MOVIMENTO.filter(g => somme[g.id].n > 0);
    const livelli = [partenza]; let cum = partenza;
    gr.forEach(g => { cum += somme[g.id].somma; livelli.push(cum); });
    livelli.push(oggi);
    const minL = Math.min(...livelli), maxL = Math.max(...livelli);
    const span = (maxL - minL) || Math.max(1, Math.abs(maxL) * 0.05);
    let base = minL - span * 0.6;
    base = base >= 100 ? Math.floor(base / 10) * 10 : Math.floor(base);
    const dom = (maxL - base) || 1;
    const pos = (a, b) => {
        const l = (Math.min(a, b) - base) / dom * 100, w = Math.max(1.5, Math.abs(b - a) / dom * 100);
        return `left:${l.toFixed(2)}%; width:${w.toFixed(2)}%;`;
    };
    cum = partenza;
    const righeGradini = gr.map(g => {
        const s = somme[g.id]; const da = cum; cum += s.somma;
        return `<div class="var-gradino">
            <div class="var-gradino-testa"><span><i class="fa-solid ${g.icona}"></i> ${g.label} <small>· ${s.n}</small></span><b class="${_varSegno(s.somma)}">${formattaEuroVariazione(s.somma)}</b></div>
            <div class="var-pista"><div class="var-barra ${s.somma >= 0 ? 'var-barra-su' : 'var-barra-giu'}" style="${pos(da, cum)}"></div></div></div>`;
    }).join('');
    const etichettaInizio = _varPeriodo === 'tutto' ? 'Valore prima dei movimenti' : `Valore il ${inizio ? _varDataBreve(inizio) : ''}`;

    // Movimenti filtrati, raggruppati per giorno.
    const conteggio = { tutti: eventi.length };
    _GRUPPI_MOVIMENTO.forEach(g => { conteggio[g.id] = somme[g.id].n; });
    const filtriDisponibili = _GRUPPI_MOVIMENTO.filter(g => ['mercato', 'aggiunte', 'scambi', 'manuali'].includes(g.id) || somme[g.id].n > 0);
    if (_varFiltro !== 'tutti' && !filtriDisponibili.some(g => g.id === _varFiltro)) _varFiltro = 'tutti';
    const chips = [{ id: 'tutti', chip: 'Tutti' }, ...filtriDisponibili].map(g =>
        `<button type="button" class="ric-filtro ${_varFiltro === g.id ? 'attivo' : ''}" onclick="_varImpostaFiltro('${g.id}')">${g.chip} &middot; ${conteggio[g.id]}</button>`).join('');
    const lista = eventi.filter(m => _varFiltro === 'tutti' || _varGruppoDi(m) === _varFiltro);
    if (lista.length && !lista.some(m => String(m.id) === String(_varSelId))) _varSelId = lista[0].id;
    let html = '', ultimoGiorno = '';
    lista.forEach(m => {
        const g = _varGiornoEtichetta(m.avvenuto_il);
        if (g !== ultimoGiorno) { html += `<div class="var-giorno">${g}</div>`; ultimoGiorno = g; }
        const d = m.valore_delta != null ? Number(m.valore_delta) : null;
        html += `<div class="var-riga ${String(m.id) === String(_varSelId) ? 'sel' : ''}" data-mid="${m.id}" onclick="_varSeleziona('${m.id}')">
            ${_varMiniatura(m, false)}
            <div class="var-riga-testo"><div class="var-riga-nome">${escapeHtml(m.nome_snapshot || '—')}</div><div class="var-riga-meta">${_varMeta(m)}</div></div>
            <div class="var-riga-delta ${_varSegno(d)}">${d != null ? formattaEuroVariazione(d) : '—'}</div></div>`;
    });
    if (!lista.length) html = '<p class="match-vuoto" style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:1.5rem 0;">Nessun movimento in questo periodo.</p>';

    const selM = lista.find(m => String(m.id) === String(_varSelId));
    const nTxt = eventi.length;
    const giorni = inizio ? Math.max(1, Math.round((Date.now() - inizio.getTime()) / 86400000)) : 0;
    const periodoTxt = _varPeriodo === 'tutto' ? (giorni ? `da ${_varDataBreve(inizio)}` : 'da sempre') : `in ${_varPeriodo} giorni`;
    const tab = (id, t) => `<button type="button" class="match-tabbtn ${_varPeriodo === id ? 'attivo' : ''}" onclick="_varImpostaPeriodo('${id}')">${t}</button>`;
    const troncato = _varTroncato && (_varPeriodo === 'tutto' || (_varEventi.length && new Date(_varEventi[_varEventi.length - 1].avvenuto_il) > inizio))
        ? `<div class="pg-sotto" style="margin-top:4px;">Sono mostrati solo gli ultimi ${_VAR_LIMITE_MOVIMENTI} movimenti.</div>` : '';

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Variazione valore</span>
            <span class="page-azione attiva" onclick="apriDettaglioWidget('valore', event)">Vai a Valore</span>
        </div>
        <div class="var-pagina">
            <div class="var-testa">
                <div>
                    <div class="var-grande ${_varSegno(totale)}">${formattaEuroVariazione(totale)}</div>
                    <div class="pg-sotto">${periodoTxt} &middot; da ${formattaEuro(partenza)} a ${formattaEuro(oggi)} &middot; ${nTxt} moviment${nTxt === 1 ? 'o' : 'i'}</div>
                    ${troncato}
                </div>
                <div class="match-tabs var-periodi">${tab('7', '7 g')}${tab('30', '30 g')}${tab('tutto', 'Tutto')}</div>
            </div>
            <div class="var-layout">
                <div class="var-sinistra">
                    <div class="var-scheda">
                        <div class="var-titolo">Da dove arriva la differenza</div>
                        <div class="var-gradino var-gradino-estremo"><div class="var-gradino-testa"><b>${etichettaInizio}</b><b>${formattaEuro(partenza)}</b></div>
                            <div class="var-pista"><div class="var-barra var-barra-neutra" style="left:0; width:${Math.max(1.5, (partenza - base) / dom * 100).toFixed(2)}%;"></div></div></div>
                        ${righeGradini}
                        <div class="var-gradino var-gradino-estremo"><div class="var-gradino-testa"><b>Valore oggi</b><b>${formattaEuro(oggi)}</b></div>
                            <div class="var-pista"><div class="var-barra var-barra-oggi" style="left:0; width:${Math.max(1.5, (oggi - base) / dom * 100).toFixed(2)}%;"></div></div></div>
                        <div class="pg-sotto" style="margin-top:8px; font-size:0.74rem;">La barra parte da ${formattaEuroTondo(base)} per far vedere le differenze &middot; somma dei movimenti = variazione del valore</div>
                    </div>
                    <div class="var-scheda">
                        <div class="var-titolo">Movimenti &middot; ${eventi.length}</div>
                        <div class="ric-filtri var-filtri">${chips}</div>
                        <div class="var-elenco">${html}</div>
                    </div>
                </div>
                <div class="var-dettaglio" id="varDettaglio">${selM ? _varDettaglioHtml(selM) : ''}</div>
            </div>
        </div>`;
}

async function renderPaginaVariazioneValore() {
    const container = document.getElementById('variazioneContenuto');
    if (!container) return;

    const userId = await authGetUserId();
    if (!userId) return;

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</p>';

    const { data, error } = await movimentiCollezioneListMie(userId, _VAR_LIMITE_MOVIMENTI);
    if (error) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento: ${escapeHtml(error.message)}</p>`;
        return;
    }

    _varEventi = data || [];
    _varTroncato = _varEventi.length >= _VAR_LIMITE_MOVIMENTI;
    _varPeriodo = '7'; _varFiltro = 'tutti'; _varSelId = null;

    if (_varEventi.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Variazione valore</span>
                <span class="page-azione attiva" onclick="apriDettaglioWidget('valore', event)">Vai a Valore</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">
                Ancora nessun movimento registrato.<br>
                <small>Aggiunte, scambi e variazioni di prezzo da qui in poi compariranno qui.</small>
            </p>
        `;
        return;
    }
    _varRender();
}
