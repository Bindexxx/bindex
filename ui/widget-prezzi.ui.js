// ═══════════════════════════════════════════════════════════════════════
// WIDGET-PREZZI.UI.JS — tessere "Prezzi" + "Prezzi aggiornati" (CardSync
// Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 16 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura del codice esistente:
// solo spostamento, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C per entrambe le tessere: nessuna pagina propria — 'prezzi'
// apre la tab "Prezzi" già esistente (una delle 5 fisse del sito, l'id
// coincide col nome della tab quindi non serve nemmeno il campo 'tab' nel
// catalogo), 'prezzi_recenti' pure ('tab': 'prezzi', stessa destinazione).
//
// CONSOLIDAMENTO FATTO IN QUESTO STEP (richiesto dalla roadmap, §6):
// l'alert "prezzo obiettivo raggiunto" (_alertPrezzoVisti,
// _segnaAlertPrezzoVisti, _cardeConAllertaPrezzo, _contaAlertPrezzoNonVisti)
// viveva dentro ui/queue.ui.js insieme al match automatico, ma è
// concettualmente del dominio Prezzi/Wishlist-prezzo, non "coda
// correzioni carte". Spostate qui le 4 funzioni (verificato: usate SOLO
// dentro queue.ui.js, nessun altro file le chiama). NON spostata la
// LOGICA che le usa (aggiornaBadgeMatch()/caricaMatch() restano in
// queue.ui.js: calcolano insieme match E alert prezzo per un unico badge
// combinato sulla tab Wishlist — separarle avrebbe richiesto riscrivere
// quella logica, fuori scope per un semplice spostamento file). Le
// chiamate da queue.ui.js a queste 4 funzioni ora sono cross-file: stesso
// meccanismo già usato ovunque in questa ristrutturazione (scope globale
// condiviso, invocate solo a runtime dopo che tutti gli script sono
// caricati — mai a tempo di parsing).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - aggiornaBadgeMatch(), caricaMatch(), tutto il resto di
//   ui/queue.ui.js — non toccato se non per la rimozione delle 4
//   funzioni spostate sopra.
// - _elencoPrezziScaduti, caricaAvvisiHome(), avviaPollingWidgetHome()
//   (ui/paginainiziale.ui.js) — motore home, non toccato.
// - _ultimiPrezziAggiornati (ui/home.ui.js): esterna, non toccata.
// - _ballCORPI.prezzi / _ballCORPI.prezzi_recenti / _ballASPETTO.* /
//   _ballTITOLI_BREVI.* (ui/widget-render-condiviso.ui.js) — motore
//   visivo, non toccato.
// ───────────────────────────────────────────────────────────────────────

// ── ALERT PREZZO OBIETTIVO — spostate da ui/queue.ui.js (STEP 16) ───────
// ── ALLERTA PREZZO WISHLIST — stesso sistema letto/non letto ──────────────
// Una carta in wishlist "scatta" quando il prezzo attuale scende al
// di sotto (o è uguale) al prezzo obiettivo che hai impostato —
// stesso calcolo già usato per il badge "🎯 obiettivo!" nelle righe.
function _alertPrezzoVisti() {
    return prefAlertPrezzoVistiGet();
}

function _segnaAlertPrezzoVisti(chiavi) {
    const visti = _alertPrezzoVisti();
    chiavi.forEach(c => visti.add(c));
    prefAlertPrezzoVistiSet(visti);
}

function _cardeConAllertaPrezzo() {
    return carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
}

function _contaAlertPrezzoNonVisti() {
    const visti = _alertPrezzoVisti();
    const conCard = _cardeConAllertaPrezzo();
    const nonVisti = conCard.filter(c => !visti.has(String(c.id)));
    // AGGIUNTO (2026-09-01): nonVistiCarte espone le carte vere, non
    // solo il conteggio — serve alle notifiche di sistema per dire
    // QUALE carta ha raggiunto il prezzo obiettivo. Additivo, non
    // rompe i due punti di chiamata esistenti (che leggono solo
    // count/chiavi).
    return { count: nonVisti.length, chiavi: conCard.map(c => String(c.id)), nonVistiCarte: nonVisti };
}

// ── VOCE DI CATALOGO "PREZZI" ────────────────────────────────────────
CATALOGO_WIDGET.prezzi = {
        // Restyle FASE 2 (2026-09-30): "Controllo prezzi" (id invariato);
        // le carte da aggiornare sono l'azione → badge rosso ('azioni').
        titolo: 'Controllo prezzi', icona: 'fa-chart-line',
        // _elencoPrezziScaduti è popolato da caricaAvvisiHome() (già
        // richiamata a intervalli da avviaPollingWidgetHome più sotto) —
        // qui lo leggiamo soltanto. Forma confermata in home.ui.js:
        // {name, code, ultimoTesto} — la prima riga come seconda riga del
        // widget, non un dato nuovo.
        preview: () => {
            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            // Totale su cui calcolare la quota di aggiornati: le carte in
            // collezione con un prezzo. Nessuna query nuova, solo carteReali.
            const inCollezione = carteReali.filter(c => c.stato === 'collezione');
            const conPrezzo = inCollezione.filter(c => c.price != null).length;
            // Valore complessivo: prezzo per quantità, dati già in memoria.
            const valore = inCollezione.reduce((tot, c) => tot + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const dati = {
                scaduti: lista.length,
                totale: Math.max(conPrezzo, lista.length),
                valore,
                // 'ultimoTesto' è la forma confermata di _elencoPrezziScaduti
                // (vedi apriModalePrezziScaduti in ui/prices.ui.js r.212).
                lista: lista.slice(0, 3).map(v => ({ nome: v.name || '—', quando: v.ultimoTesto || '' }))
            };
            if (lista.length === 0) return { righe: ['tutti aggiornati'], stato: 'ok', dati };
            return { righe: [`${lista.length} da aggiornare`, lista[0].name || ''], stato: 'allerta', azioni: lista.length, dati };
        },
};

// ── VOCE DI CATALOGO "PREZZI AGGIORNATI" ─────────────────────────────
CATALOGO_WIDGET.prezzi_recenti = {
        titolo: 'Prezzi aggiornati', icona: 'fa-clock-rotate-left',
        tagliaDefault: '6x5', // cinque righe di elenco, senza miniature
        // UNICO dei tre che costa una query (storico_prezzi, via
        // _ultimiPrezziAggiornati in ui/home.ui.js, a blocchi da 500 id).
        // renderWidgetHome gira anche dal polling: senza freno questa
        // query partirebbe a ogni giro. Da qui la cache a tempo qui
        // sotto — stessa lezione delle 47 query di valutaEAssegna.
        preview: async () => {
            const righeCache = await _prezziRecentiConCache();
            if (!righeCache.length) return { righe: ['Nessun controllo ancora'], dati: { lista: [] } };
            return {
                righe: righeCache.slice(0, 3).map(r => `${r.nome} · ${r.quando}`),
                badge: false, // sarebbe il giorno dell'ultimo controllo, non un conteggio
                dati: { lista: righeCache },
            };
        },
        tab: 'prezziagg', // RESTYLE FASE 3h: pagina propria "Prezzi aggiornati" (prima apriva Controllo prezzi)
};

const TTL_PREZZI_RECENTI_MS = 5 * 60 * 1000;
let _cachePrezziRecenti = { quando: 0, righe: [] };

async function _prezziRecentiConCache() {
    if (Date.now() - _cachePrezziRecenti.quando < TTL_PREZZI_RECENTI_MS) return _cachePrezziRecenti.righe;
    // Se la funzione non c'e' (ordine di caricamento, file non presente)
    // il widget mostra "nessun controllo" invece di rompere il render.
    if (typeof _ultimiPrezziAggiornati !== 'function' || typeof carteReali === 'undefined') return [];
    try {
        const collezione = carteReali.filter(c => c.stato === 'collezione');
        const eventi = await _ultimiPrezziAggiornati(collezione.map(c => c.id), 5);
        const righe = eventi
            .map(ev => ({ ev, card: collezione.find(c => String(c.id) === String(ev.carta_id)) }))
            .filter(x => x.card) // la carta potrebbe essere stata eliminata nel frattempo
            .map(({ ev, card }) => ({
                id: card.id,
                nome: card.name || '—',
                variante: card.variation || '',
                quando: new Date(ev.registrato_il).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
                immagine: card.immagine,
                rarita: card.rarita,
            }));
        // MAI mettere in cache un risultato vuoto. Il primo giro puo'
        // capitare prima che carteReali sia popolato, o mentre la rete e'
        // ancora giu': memorizzare quel vuoto significava mostrare "nessun
        // controllo ancora" per cinque minuti su un widget che i dati ce li
        // aveva. Difetto visto in uno screenshot di Claudio il 2026-09-03,
        // dopo che lo stesso widget aveva funzionato poco prima.
        if (righe.length) _cachePrezziRecenti = { quando: Date.now(), righe };
        return righe;
    } catch (e) {
        console.error('[widget prezzi_recenti]', e);
        return [];
    }
}


// ── PAGINA "PREZZI AGGIORNATI" ───────────────────────────────────────────
// RESTYLE BINDEX FASE 3h (2026-10-01, tavola "Prezzi aggiornati · cosa è
// cambiato"): pagina separata da "Controllo prezzi". Periodo Oggi / 7 / 30
// giorni; per ogni carta della collezione il cui prezzo è cambiato nel
// periodo, il confronto è col prezzo che aveva all'inizio (RPC
// leggi_variazioni_da, la stessa di "In primo piano" e "Variazione", solo
// lettura). Salite e Scese in due gruppi. Il tocco sulla carta apre la carta
// a tutto schermo.
// NON mostrato: il numero esatto di carte "controllate" (non è una lettura
// esistente): il riquadro conta le carte il cui prezzo è CAMBIATO.
let _pagPeriodo = 'oggi';     // 'oggi' | '7' | '30'
let _pagCache = {};           // periodo -> { righe } (mappa oggetto_id -> prezzo_base)
let _pagUltimoControllo = null;

function _pagDaISO(periodo) {
    const d = new Date();
    if (periodo === 'oggi') d.setHours(0, 0, 0, 0);
    else d.setDate(d.getDate() - Number(periodo));
    return d.toISOString();
}

async function renderPaginaPrezziAggiornati() {
    const c = document.getElementById('prezziaggContenuto');
    if (!c) return;
    _pagPeriodo = 'oggi';
    _pagCache = {};
    _pagSelId = null;
    _pagInvariateAperte = false;
    c.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    try {
        const userId = await authGetUserId();
        if (userId) {
            const { data } = await ordiniUltimoCompletato(userId);
            _pagUltimoControllo = data && data[0] ? data[0].completato_il : null;
        }
    } catch (e) { console.error('[prezzi aggiornati] ultimo controllo:', e); }
    await _pagCarica();
}

async function _pagCarica() {
    if (!_pagCache[_pagPeriodo]) {
        const { data, error } = await variazioniPrezziDa(_pagDaISO(_pagPeriodo));
        if (error) {
            console.error('[prezzi aggiornati] variazioni:', error.message);
            const c = document.getElementById('prezziaggContenuto');
            if (c) c.innerHTML = '<div class="stato-vuoto"><i class="fa-solid fa-triangle-exclamation"></i><br>Non riesco a leggere le variazioni. Riprova più tardi.</div>';
            return;
        }
        const mappa = new Map();
        (data || []).forEach(r => { if (r.tabella === 'carte') mappa.set(String(r.oggetto_id), Number(r.prezzo_base)); });
        _pagCache[_pagPeriodo] = mappa;
    }
    _pagDisegna();
}

function _pagImpostaPeriodo(p) {
    _pagPeriodo = p;
    _pagCarica();
}

function _pagQuando(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const oggi = new Date();
    if (d.toDateString() === oggi.toDateString()) return `oggi alle ${ora}`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ` alle ${ora}`;
}

// RESTYLE (tavole PC "Prezzi aggiornati"): riquadri controllate / salite /
// scese / invariate / effetto sul valore; su PC Salite e Scese con il
// "prima → ora" e, cliccando una carta, il suo prezzo nel tempo a destra
// (storico_prezzi, solo lettura). Sul telefono il tocco apre la carta.
// "Controllate" = carte della collezione con ultimo controllo nel periodo.
let _pagSelId = null;
let _pagInvariateAperte = false;

function _pagEPC() {
    const s = document.getElementById('prezziagg');
    return !!s && s.clientWidth >= 780;
}

function _pagTocca(id) {
    if (!_pagEPC()) { apriFlipCardHome(id); return; }
    _pagSelId = id;
    document.querySelectorAll('#prezziagg .pa-riga').forEach(r => r.classList.toggle('sel', r.dataset.id === String(id)));
    _pagDettaglio();
}

function _pagMostraInvariate() { _pagInvariateAperte = !_pagInvariateAperte; _pagDisegna(); }

function _pagLineaSvg(valori) {
    const W = 400, H = 150, pad = 6;
    let min = Math.min(...valori), max = Math.max(...valori);
    if (max === min) { max += 1; min -= 1; }
    const x = i => (i / (valori.length - 1)) * W;
    const y = v => pad + (1 - (v - min) / (max - min)) * (H - 2 * pad);
    const linea = 'M' + valori.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${linea} L${W},${H} L0,${H} Z" class="pa-g-area"/><path d="${linea}" class="pa-g-linea" vector-effect="non-scaling-stroke"/></svg>`;
}

async function _pagDettaglio() {
    const box = document.getElementById('pagDettaglio');
    if (!box) return;
    const r = carteReali.find(c => String(c.id) === String(_pagSelId));
    if (!r) {
        box.innerHTML = `<div class="pa-invito"><i class="fa-regular fa-hand-pointer"></i><b>Clicca una carta per vedere il suo prezzo nel tempo</b><span>Clicca la miniatura per aprire la carta intera</span></div>`;
        return;
    }
    const base = (_pagCache[_pagPeriodo] || new Map()).get(String(r.id));
    const delta = base != null ? (Number(r.price) || 0) - base : null;
    const src = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 240) || '') : '';
    const testa = `
        <div class="pa-det-testa">
            <span class="bx-lente pa-det-fig" onclick="apriFlipCardHome('${escapeJsAttr(String(r.id))}')">${src ? `<img src="${src}" alt="">` : '<i class="fa-solid fa-image"></i>'}</span>
            <div class="pa-det-testo">
                <div class="pa-det-nome">${escapeHtml(r.name || '—')}</div>
                <div class="pa-det-sotto">${escapeHtml([r.code, r.location].filter(Boolean).join(' · '))}</div>
                <div class="pa-det-prezzi">${base != null ? `<span>${formattaEuro(base)}</span> → ` : ''}<b>${formattaEuro(r.price)}</b>${delta ? ` <b class="${delta > 0 ? 'pa-su' : 'pa-giu'}">${delta > 0 ? '▲ +' : '▼ −'}${formattaEuro(Math.abs(delta))}</b>` : ''}</div>
            </div>
        </div>`;
    box.innerHTML = `<div class="pa-det">${testa}<div class="pa-det-titolo"><b>Prezzo nel tempo</b><span>ultimi 30 giorni</span></div><div class="pa-det-grafico pa-det-carico">Carico lo storico…</div></div>`;
    const idRichiesto = r.id;
    let righe = [];
    try {
        const { data } = await storicoPrezziGrafico(r.id, 'carte');
        righe = data || [];
    } catch (e) { console.error('[prezzi aggiornati] storico carta:', e); }
    if (String(_pagSelId) !== String(idRichiesto)) return; // nel frattempo è stata scelta un'altra carta
    const da = Date.now() - 30 * 86400000;
    const ultimi = righe.filter(x => new Date(x.registrato_il).getTime() >= da);
    const serie = ultimi.length >= 2 ? ultimi : righe.slice(-30);
    const g = box.querySelector('.pa-det-grafico');
    if (!g) return;
    if (serie.length < 2) {
        g.classList.add('pa-det-carico');
        g.textContent = 'Non ci sono ancora abbastanza controlli per un grafico: lo storico cresce a ogni controllo prezzi.';
        return;
    }
    const valori = serie.map(x => Number(x.prezzo) || 0);
    const giorno = iso => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '');
    g.classList.remove('pa-det-carico');
    g.innerHTML = _pagLineaSvg(valori);
    g.insertAdjacentHTML('afterend', `
        <div class="pa-det-assex"><span>${giorno(serie[0].registrato_il)} · ${formattaEuro(valori[0])}</span><span>oggi · ${formattaEuro(valori[valori.length - 1])}</span></div>
        <div class="pa-det-righe">
            <span>Controlli</span><b>${righe.length}</b>
            <span>Minimo / massimo</span><b>${formattaEuro(Math.min(...valori))} / ${formattaEuro(Math.max(...valori))}</b>
        </div>
        <div class="pa-det-nota">Clicca la carta per vederla a tutto schermo</div>`);
}

function _pagDisegna() {
    const c = document.getElementById('prezziaggContenuto');
    if (!c) return;
    const mappa = _pagCache[_pagPeriodo] || new Map();
    const eur = (v) => formattaEuro(v);
    const inizio = new Date(_pagDaISO(_pagPeriodo));
    const collezione = carteReali.filter(r => r.stato === 'collezione' && r.tabella === 'carte');
    const righe = [];
    collezione.forEach(r => {
        const base = mappa.get(String(r.id));
        if (base == null) return;
        const delta = (Number(r.price) || 0) - base;
        if (Math.abs(delta) < 0.005) return;
        righe.push({ r, delta, base });
    });
    const cambiate = new Set(righe.map(x => String(x.r.id)));
    const controllate = collezione.filter(r => r.ultimoControllo && new Date(r.ultimoControllo) >= inizio);
    const invariate = controllate.filter(r => !cambiate.has(String(r.id)));
    const nControllate = Math.max(controllate.length, righe.length);
    const effetto = righe.reduce((t, x) => t + x.delta * (Number(x.r.qty) || 1), 0);
    const salite = righe.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta);
    const scese = righe.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta);
    if (_pagSelId && !carteReali.some(r => String(r.id) === String(_pagSelId))) _pagSelId = null;

    const riga = ({ r, delta, base }) => {
        const src = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 120) || '') : '';
        const qty = Number(r.qty) || 1;
        const sotto = [r.code, r.lang, r.cond, qty > 1 ? `×${qty}` : null].filter(Boolean).join(' · ');
        const sottoPc = [r.location, qty > 1 ? `x${qty}` : null].filter(Boolean).join(' · ');
        const su = delta > 0;
        const perc = base ? delta / base * 100 : null;
        const percTxt = perc != null && isFinite(perc) ? `${su ? '+' : '−'}${Math.abs(perc).toFixed(1).replace('.', ',')}%` : '';
        const segno = su ? '+' : '−';
        return `
            <div class="pa-riga${String(r.id) === String(_pagSelId) ? ' sel' : ''}" data-id="${escapeHtml(String(r.id))}" onclick="_pagTocca('${escapeJsAttr(String(r.id))}')">
                <div class="pa-fig" onclick="if (_pagEPC()) { event.stopPropagation(); apriFlipCardHome('${escapeJsAttr(String(r.id))}'); }">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove();">` : '<i class="fa-solid fa-image"></i>'}</div>
                <div class="pa-testo"><b>${escapeHtml(r.name || '—')}</b><span class="pa-solo-tel">${escapeHtml(sotto)}</span><span class="pa-solo-pc">${escapeHtml(sottoPc)}</span></div>
                ${r.location ? `<span class="pa-loc pa-solo-tel">${escapeHtml(r.location)}</span>` : ''}
                <div class="pa-prima pa-solo-pc"><span>${eur(base).replace(' €', '')}</span> → <b>${eur(Number(r.price) || 0)}</b></div>
                <div class="pa-destra">
                    <b class="pa-solo-tel">${eur(Number(r.price) || 0)}</b><span class="pa-solo-tel ${su ? 'pa-su' : 'pa-giu'}">${su ? '▲ +' : '▼ −'}${eur(Math.abs(delta)).replace(' €', '')}</span>
                    <b class="pa-solo-pc ${su ? 'pa-su' : 'pa-giu'}">${segno}${eur(Math.abs(delta))}</b>
                    <span class="pa-solo-pc ${su ? 'pa-su' : 'pa-giu'}">${percTxt}${qty > 1 ? ` · x${qty} = ${segno}${eur(Math.abs(delta * qty)).replace(' €', '')}` : ''}</span>
                </div>
            </div>`;
    };
    const rigaInvariata = r => {
        const src = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 120) || '') : '';
        return `<div class="pa-riga pa-riga-inv${String(r.id) === String(_pagSelId) ? ' sel' : ''}" data-id="${escapeHtml(String(r.id))}" onclick="_pagTocca('${escapeJsAttr(String(r.id))}')">
            <div class="pa-fig">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove();">` : '<i class="fa-solid fa-image"></i>'}</div>
            <div class="pa-testo"><b>${escapeHtml(r.name || '—')}</b><span>${escapeHtml(r.location || '')}</span></div>
            <div class="pa-destra"><b>${eur(Number(r.price) || 0)}</b><span>invariata</span></div></div>`;
    };
    const blocco = (cls, titolo, elenco, extra) => `
        <div class="pa-blocco ${cls}">
            <div class="pa-gruppo"><span>${titolo}</span><small class="pa-solo-pc">prima → ora</small></div>
            ${elenco.length ? elenco.map(riga).join('') : '<div class="pa-nessuna">Nessuna carta.</div>'}
            ${extra || ''}
        </div>`;
    const invHtml = invariate.length ? `
        <div class="pa-invariate"><span>${invariate.length} invariat${invariate.length === 1 ? 'a' : 'e'}</span>
            <button type="button" onclick="_pagMostraInvariate()">${_pagInvariateAperte ? 'Nascondi ↑' : 'Mostra ↓'}</button></div>
        ${_pagInvariateAperte ? invariate.map(rigaInvariata).join('') : ''}` : '';
    const tab = (p, e) => `<span class="pa-tab${_pagPeriodo === p ? ' attivo' : ''}" onclick="_pagImpostaPeriodo('${p}')">${e}</span>`;
    const quando = _pagUltimoControllo ? _pagQuando(_pagUltimoControllo) : '';

    c.innerHTML = `
        <div class="pa-pagina">
            <div class="pa-testa">
                <div class="pa-testa-sx">
                    <span class="page-title">Prezzi aggiornati</span>
                    <span class="pa-quando pa-solo-pc">${quando ? `ultimo controllo ${quando}` : 'nessun controllo completato ancora'}${nControllate ? ` · ${nControllate} carte` : ''}</span>
                </div>
                ${quando ? `<span class="pa-quando pa-solo-tel">${quando}</span>` : ''}
                <div class="pa-tabs pa-solo-pc">${tab('oggi', 'Oggi')}${tab('7', '7 giorni')}${tab('30', '30 giorni')}</div>
                <button type="button" class="pa-btn pa-solo-pc" onclick="apriDettaglioWidget('prezzi', event)">Vai a Prezzi</button>
            </div>
            <div class="pa-stat">
                <div><b>${nControllate}</b><span>controllate</span></div>
                <div><b class="pa-su">${salite.length}</b><span>salite</span></div>
                <div><b class="pa-giu">${scese.length}</b><span>scese</span></div>
                <div class="pa-solo-pc-blocco"><b>${invariate.length}</b><span>invariate</span></div>
                <div class="pa-solo-pc-blocco"><b class="${effetto > 0 ? 'pa-su' : (effetto < 0 ? 'pa-giu' : '')}">${effetto ? formattaEuroVariazione(effetto) : eur(0)}</b><span>effetto sul valore</span></div>
            </div>
            <div class="pa-tabs pa-solo-tel">${tab('oggi', 'Oggi')}${tab('7', '7 giorni')}${tab('30', '30 giorni')}</div>
            ${righe.length === 0 && !invariate.length
                ? '<div class="stato-vuoto"><i class="fa-solid fa-clock-rotate-left"></i><br>Nessun prezzo è cambiato in questo periodo.</div>'
                : `<div class="pa-layout">
                    <div class="pa-colonne">
                        ${blocco('pa-blocco-su', '<i class="pa-solo-pc">▲ </i>Salite', salite)}
                        ${blocco('pa-blocco-giu', '<i class="pa-solo-pc">▼ </i>Scese', scese, invHtml)}
                    </div>
                    <div class="pa-dettaglio" id="pagDettaglio"></div>
                </div>`}
        </div>`;
    _pagDettaglio();
}


// ── CONTROLLO PREZZI: UN pulsante per i riquadri spuntati ────────────────
// RESTYLE FASE 3h: riusa i tre controlli esistenti (ui/prices.ui.js), che
// creano ciascuno il proprio ordine e mostrano l'avanzamento nel testo del
// riquadro. Nessuna logica di ordini nuova. Il riepilogo unico "controlli
// partiti insieme" e l'elenco degli ordini recenti richiedono una lettura
// in più (FASE 8e): non sono qui.
async function prezziAvviaSelezionati() {
    const coll = document.getElementById('pzCollezione')?.checked;
    const wish = document.getElementById('pzWishlist')?.checked;
    const seal = document.getElementById('pzSealed')?.checked;
    const esito = document.getElementById('pzEsito');
    if (!coll && !wish && !seal) {
        if (esito) esito.textContent = 'Spunta almeno un riquadro da controllare.';
        return;
    }
    if (esito) esito.textContent = '';
    const btn = document.getElementById('pzAvvia');
    if (btn) btn.disabled = true;
    try {
        const lavori = [];
        if (coll) lavori.push(triggerExtensionPriceCheck());
        if (wish) lavori.push(triggerExtensionPriceCheckWishlist());
        if (seal) lavori.push(triggerExtensionPriceCheckSealed());
        await Promise.all(lavori);
        const n = [coll, wish, seal].filter(Boolean).length;
        if (esito) esito.textContent = n === 1 ? 'Controllo avviato.' : `${n} controlli avviati insieme.`;
    } catch (e) {
        console.error('[prezzi] avvio controlli:', e);
        if (esito) esito.textContent = 'Errore nell\'avvio del controllo.';
    } finally {
        if (btn) btn.disabled = false;
        prezziCaricaControlli();
    }
}


// ═══════════════════════════════════════════════════════════════════════
// RESTYLE BINDEX FASE 8e — elenco "Controlli" (ultimi 7 giorni) con Riprova
// ═══════════════════════════════════════════════════════════════════════
const _PZ_TIPI_CONTROLLO = {
    controlla_prezzi: ['Collezione', 'fa-layer-group'],
    controlla_prezzi_wishlist: ['Wishlist', 'fa-bookmark'],
    controlla_prezzi_sealed: ['Sealed', 'fa-box'],
};
const _PZ_STATI_CONTROLLO = {
    completato: ['Completato', 'ok'],
    errore: ['Non riuscito', 'ko'],
    in_corso: ['In corso', 'att'],
};
let _pzControlliRighe = [];

// RESTYLE (tavole "Controlla prezzi"): righe con stato a icona, "Tipo · N"
// e orario a destra; prima i controlli in corso.
function _pzQuandoBreve(iso) {
    const d = new Date(iso);
    const oggi = new Date(); const ieri = new Date(); ieri.setDate(oggi.getDate() - 1);
    const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (Date.now() - d.getTime() < 15 * 60000) return 'ora';
    if (d.toDateString() === oggi.toDateString()) return ora;
    if (d.toDateString() === ieri.toDateString()) return `ieri ${ora}`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '') + ` ${ora}`;
}

async function prezziCaricaControlli() {
    prezziAggiornaScelta();
    prezziRiepilogo();
    const cont = document.getElementById('pzControlli');
    if (!cont) return;
    const userId = await authGetUserId();
    if (!userId) { cont.innerHTML = '<p class="pz-nota">Accedi per vedere i tuoi controlli.</p>'; return; }
    const { data, error } = await ordiniControlliRecentiUtente(userId, 7);
    if (error) { cont.innerHTML = `<p class="pz-nota">Non riesco a leggere i controlli: ${escapeHtml(error.message)}</p>`; return; }
    _pzControlliRighe = data || [];
    if (_pzControlliRighe.length === 0) { cont.innerHTML = '<p class="pz-nota">Nessun controllo negli ultimi 7 giorni.</p>'; return; }
    const sottoStato = {
        completato: () => 'completato',
        errore: o => o.errore_msg ? escapeHtml(o.errore_msg) : 'non riuscito',
        in_corso: () => 'in corso · un dispositivo sta leggendo Cardmarket',
    };
    const iconaStato = { completato: 'fa-check', errore: 'fa-xmark', in_corso: 'fa-spinner' };
    cont.innerHTML = _pzControlliRighe.map(o => {
        const [nome] = _PZ_TIPI_CONTROLLO[o.tipo] || [o.tipo];
        const [, classe] = _PZ_STATI_CONTROLLO[o.stato] || ['In attesa', 'att'];
        const sotto = (sottoStato[o.stato] || (() => 'in attesa che un dispositivo lo prenda'))(o);
        const ico = iconaStato[o.stato] || 'fa-hourglass-half';
        const riprova = o.stato === 'errore'
            ? `<button type="button" class="pz-riprova" onclick="prezziRiprovaControllo('${o.id}')">Riprova</button>` : `<span class="pz-quando">${_pzQuandoBreve(o.completato_il || o.creato_il)}</span>`;
        return `<div class="pz-controllo"><span class="pz-controllo-ico ${classe}"><i class="fa-solid ${ico}"></i></span><div class="pz-controllo-info"><b>${nome}</b><span>${sotto}</span></div>${riprova}</div>`;
    }).join('');
}

// ── Scelta: conteggi, chip, "Di chi", pulsante "Controlla N carte" ──────
function _pzCarteColl() { return carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione'); }

function prezziAggiornaScelta() {
    const coll = document.getElementById('pzCollezione');
    if (!coll) return;
    const wish = document.getElementById('pzWishlist'), seal = document.getElementById('pzSealed');
    const carte = _pzCarteColl();
    const nLoc = new Set(carte.map(c => c.location).filter(Boolean)).size;
    const wl = carteReali.filter(c => c.tabella === 'wishlist');
    const sealed = typeof prodottiSealedReali !== 'undefined' ? prodottiSealedReali : [];
    const nScaf = document.querySelectorAll('.checkboxScaffalePrezziSealed').length;
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    set('pzContaColl', `${carte.length} carte · ${nLoc} location`);
    set('pzContaWish', `${wl.length} carte`);
    set('pzContaSealed', `${sealed.length} prodott${sealed.length === 1 ? 'o' : 'i'}${nScaf ? ` · ${nScaf} scaffal${nScaf === 1 ? 'e' : 'i'}` : ''}`);
    document.querySelectorAll('#prezzi .pz-opz').forEach(l => l.classList.toggle('attivo', !!l.querySelector('input:checked')));
    const bc = document.getElementById('pzBloccoColl'), bs = document.getElementById('pzBloccoSealed');
    if (bc) bc.style.display = coll.checked ? '' : 'none';
    if (bs) bs.style.display = seal && seal.checked ? '' : 'none';
    const locSel = _locationSelezionate();
    const tl = document.getElementById('btnToggleTutteLocation'); if (tl) { tl.textContent = 'Tutte'; tl.classList.toggle('attivo', locSel.length === 0); }
    const ts = document.getElementById('btnToggleTutteScaffaliSealed'); if (ts) { ts.textContent = 'Tutti'; ts.classList.toggle('attivo', _scaffaliSelezionatiSealed().length === 0); }
    let n = 0;
    if (coll.checked) n += locSel.length ? carte.filter(c => locSel.includes(c.location)).length : carte.length;
    if (wish && wish.checked) n += wl.length;
    const nSealed = seal && seal.checked ? sealed.length : 0;
    const testo = document.getElementById('pzAvviaTesto');
    if (testo) {
        if (!n && !nSealed) testo.textContent = 'Scegli cosa controllare';
        else if (!nSealed) testo.textContent = `Controlla ${n} cart${n === 1 ? 'a' : 'e'}`;
        else if (!n) testo.textContent = `Controlla ${nSealed} prodott${nSealed === 1 ? 'o' : 'i'}`;
        else testo.textContent = `Controlla ${n + nSealed} oggetti`;
    }
}

function prezziLocationTutte() {
    document.querySelectorAll('.checkboxLocationPrezzi').forEach(cb => { cb.checked = false; });
    prezziAggiornaScelta();
}
function prezziScaffaliTutti() {
    document.querySelectorAll('.checkboxScaffalePrezziSealed').forEach(cb => { cb.checked = false; });
    prezziAggiornaScelta();
}
// Una sola scelta "Di chi" per Collezione e Sealed.
function prezziImpostaDiChi(ambito) {
    _impostaAmbitoControlloPrezzi(ambito);
    _impostaAmbitoControlloPrezziSealed(ambito);
    document.getElementById('btnAmbitoSoloMie')?.classList.toggle('attivo', ambito === 'soloMie');
    document.getElementById('btnAmbitoGruppo')?.classList.toggle('attivo', ambito === 'gruppo');
}

// Riquadri in alto: ultimo controllo (con salite/scese da allora), carte da
// aggiornare (mai controllate o più vecchie di 7 giorni) e se qualcuno del
// gruppo sta controllando adesso (solo presenza, mai un conteggio).
async function prezziRiepilogo() {
    const box = document.getElementById('pzStat');
    if (!box) return;
    const carte = _pzCarteColl();
    const soglia = Date.now() - SOGLIA_GIORNI_PREZZO_SCADUTO * 86400000;
    const scadute = carte.filter(c => !c.ultimoControllo || new Date(c.ultimoControllo).getTime() < soglia);
    _elencoPrezziScaduti = scadute.map(c => ({ name: c.name, code: c.code,
        ultimoTesto: c.ultimoControllo ? new Date(c.ultimoControllo).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : 'mai' }));
    const disegna = (ultimo, frecce, attivi) => {
        box.innerHTML = `
            <div class="pz-box"><span>Ultimo<em class="pz-solo-pc"> controllo</em></span><b>${ultimo || '—'}</b>${frecce || ''}</div>
            <div class="pz-box"><span>Da aggiornare</span><b class="${scadute.length ? 'pz-allerta' : ''}">${scadute.length} cart${scadute.length === 1 ? 'a' : 'e'}</b>
                ${scadute.length ? `<a class="pz-link-sotto" onclick="apriModalePrezziScaduti()"><em class="pz-solo-tel">vedi</em><em class="pz-solo-pc">mai controllate o più vecchie di ${SOGLIA_GIORNI_PREZZO_SCADUTO} giorni</em></a>` : '<small>tutte aggiornate</small>'}</div>
            <div class="pz-box"><span><em class="pz-solo-tel">Pronti</em><em class="pz-solo-pc">Chi sta controllando adesso</em></span>
                <b>${attivi == null ? '…' : (attivi ? '<i class="pz-pallino on"></i> al lavoro' : '<i class="pz-pallino"></i> nessuno')}</b>
                <small><em class="pz-solo-tel">${attivi ? 'del gruppo' : 'al momento'}</em><em class="pz-solo-pc">${attivi ? 'un dispositivo del gruppo' : 'parte con l’estensione aperta'}</em></small></div>`;
    };
    disegna(null, '', null);
    let ultimoTxt = null, frecce = '', attivi = null;
    try {
        const userId = await authGetUserId();
        const [{ data }, presenza] = await Promise.all([
            userId ? ordiniUltimoCompletato(userId) : Promise.resolve({ data: [] }),
            typeof _dispositiviAttiviOra === 'function' ? _dispositiviAttiviOra() : Promise.resolve(false),
        ]);
        attivi = !!presenza;
        const quando = data && data[0] ? data[0].completato_il : null;
        if (quando) {
            ultimoTxt = _pzQuandoBreve(quando).replace(/^ieri /, 'ieri, ');
            const { data: varz } = await variazioniPrezziDa(new Date(new Date(quando).getTime() - 60000).toISOString());
            const base = new Map((varz || []).filter(r => r.tabella === 'carte').map(r => [String(r.oggetto_id), Number(r.prezzo_base)]));
            let su = 0, giu = 0;
            carte.forEach(c => { const b = base.get(String(c.id)); if (b == null) return; const d = (Number(c.price) || 0) - b; if (d > 0.005) su++; else if (d < -0.005) giu++; });
            frecce = `<small><span class="pz-su">▲ ${su}</span> <span class="pz-giu">▼ ${giu}</span></small>`;
        }
    } catch (e) { console.error('[controllo prezzi] riepilogo:', e); }
    disegna(ultimoTxt, frecce, attivi);
}

// Riprova = nuovo ordine con lo stesso tipo e gli stessi parametri.
async function prezziRiprovaControllo(ordineId) {
    const o = _pzControlliRighe.find(x => String(x.id) === String(ordineId));
    if (!o) return;
    const userId = await authGetUserId();
    if (!userId) return;
    const payload = { tipo: o.tipo, creato_da: userId };
    if (o.parametri) payload.parametri = o.parametri;
    const { error } = await ordiniInsert(payload);
    const esito = document.getElementById('pzEsito');
    if (esito) esito.textContent = error ? ('Non sono riuscito a riprovare: ' + error.message) : 'Controllo rimesso in coda.';
    prezziCaricaControlli();
}
