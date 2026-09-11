// ═══════════════════════════════════════════════════════════════════════
// WIDGET-WISHLIST.UI.JS — tessera + pagina "Wishlist" (id catalogo
// 'wishlist_obiettivi') (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 22 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria con ricerca + 4 filtri (Tutte/Raggiunte/In
// corso/Senza obiettivo), ordinamento fisso (raggiunte prima per sconto
// più grande, poi in corso per vicinanza, poi senza obiettivo alfabetico —
// deciso da Claudio). "Vai alla Wishlist" salta direttamente al binder di
// tipo wishlist.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaWishlist() per tabId === 'wishlist', e _vaiAlBinderWishlist
//   qui sotto continua a chiamare apriDettaglioWidget('binder', evt) —
//   motore home, dispatch generico, non toccato in questo step.
// - _ballCORPI.wishlist_obiettivi / _ballASPETTO.wishlist_obiettivi /
//   _ballTITOLI_BREVI.wishlist_obiettivi / _ballRigaBarra / _ballPill
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.raggiunte/d.totale/d.lista dal 'dati' restituito
//   dal preview() qui sotto — forma confermata coerente.
// - _bindersElenco, apriBinderDettaglio (ui/binder.ui.js), apriFlipCardHome,
//   _urlImmagineVisualizzabile, escapeHtml: esterne, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.wishlist_obiettivi = {
        titolo: 'Wishlist', icona: 'fa-heart',
        preview: () => {
            const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
            const conObiettivo = desiderate.filter(c => c.prezzoObiettivo != null && c.prezzoObiettivo > 0);
            const raggiunte = conObiettivo.filter(c => c.price > 0 && c.price <= c.prezzoObiettivo);
            if (desiderate.length === 0) return { righe: ['Wishlist vuota'], dati: { totale: 0, raggiunte: 0, conObiettivo: 0, lista: [] } };
            return {
                righe: [raggiunte.length > 0 ? `${raggiunte.length} sotto obiettivo` : `${desiderate.length} carte desiderate`],
                stato: raggiunte.length > 0 ? 'ok' : undefined,
                dati: {
                    totale: desiderate.length,
                    conObiettivo: conObiettivo.length,
                    raggiunte: raggiunte.length,
                    lista: (raggiunte.length ? raggiunte : conObiettivo).slice(0, 3).map(c => ({
                        nome: c.name || '—',
                        prezzo: Number(c.price) || 0,
                        obiettivo: Number(c.prezzoObiettivo) || 0,
                        id: c.id
                    }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente Binder
        // (tab:'binder') — ora ha una pagina propria dedicata (#wishlist
        // in index.html, renderPaginaWishlist() sotto). Nessun impatto sul
        // tracciamento missioni (registrano l'evento su w.id=
        // 'wishlist_obiettivi', non su def.tab).
        tab: 'wishlist',
};

// ── PAGINA "WISHLIST" (2026-08-30) ──────────────────────────────────────
// Secondo widget con pagina di dettaglio propria, stesso pattern di
// renderPaginaValoreCollezione() sopra. A differenza di quella, qui la
// pagina mostra TUTTA la wishlist (non solo il preview a 3 carte del
// widget) — letta direttamente da carteReali (stessa fonte del preview,
// senza il .slice(0,3)), zero query nuove.
//
// Ordinamento: raggiunte prima (le carte con prezzo attuale <= obiettivo,
// ordinate per sconto più grande), poi le altre con obiettivo impostato
// (ordinate per vicinanza — prezzo più vicino all'obiettivo prima), infine
// quelle senza obiettivo impostato in fondo (alfabetico) — deciso da
// Claudio.
let _wishlistCarteComputate = [];
let _wishlistFiltroAttivo = 'tutte';
let _wishlistRicercaTesto = '';

function _wishlistClassificaEOrdina() {
    const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
    const conPrezzo = (c) => Number(c.price) || 0;
    const conObiettivoVal = (c) => (c.prezzoObiettivo != null && Number(c.prezzoObiettivo) > 0) ? Number(c.prezzoObiettivo) : null;

    const righe = desiderate.map(c => {
        const obiettivo = conObiettivoVal(c);
        const prezzo = conPrezzo(c);
        const raggiunta = obiettivo != null && prezzo > 0 && prezzo <= obiettivo;
        return { id: c.id, nome: c.name || '—', immagine: c.immagine || null, prezzo, obiettivo, raggiunta };
    });

    const raggiunte = righe.filter(r => r.raggiunta)
        .sort((a, b) => (b.obiettivo - b.prezzo) - (a.obiettivo - a.prezzo)); // sconto più grande prima
    const inCorso = righe.filter(r => !r.raggiunta && r.obiettivo != null)
        .sort((a, b) => (a.prezzo - a.obiettivo) - (b.prezzo - b.obiettivo)); // più vicine prima
    const senzaObiettivo = righe.filter(r => r.obiettivo == null)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    _wishlistCarteComputate = [...raggiunte, ...inCorso, ...senzaObiettivo];
    return { totale: righe.length, conObiettivo: raggiunte.length + inCorso.length, raggiunte: raggiunte.length };
}

async function renderPaginaWishlist() {
    const container = document.getElementById('wishlistContenuto');
    if (!container) return;

    _wishlistFiltroAttivo = 'tutte';
    _wishlistRicercaTesto = '';
    const { totale, conObiettivo, raggiunte } = _wishlistClassificaEOrdina();

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Wishlist</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">La tua wishlist è vuota.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Wishlist</span>
            <span class="page-azione attiva" onclick="_vaiAlBinderWishlist(event)">Vai alla Wishlist</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${conObiettivo} con obiettivo di prezzo · ${raggiunte} già raggiunte</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Desiderate</span></div>
                <div><b>${conObiettivo}</b><span>Con obiettivo</span></div>
                <div><b>${raggiunte}</b><span>Raggiunte</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca nella wishlist..." oninput="_wishlistCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-filtro="tutte" onclick="_wishlistImpostaFiltro('tutte')">Tutte</span>
                <span class="pg-filtro" data-filtro="raggiunte" onclick="_wishlistImpostaFiltro('raggiunte')">Raggiunte</span>
                <span class="pg-filtro" data-filtro="in_corso" onclick="_wishlistImpostaFiltro('in_corso')">In corso</span>
                <span class="pg-filtro" data-filtro="senza_obiettivo" onclick="_wishlistImpostaFiltro('senza_obiettivo')">Senza obiettivo</span>
            </div>
            <div class="pg-elenco" id="wishlistElenco"></div>
        </div>
    `;
    _wishlistRenderElenco();
}

function _wishlistImpostaFiltro(filtro) {
    _wishlistFiltroAttivo = filtro;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.filtro === filtro);
    });
    _wishlistRenderElenco();
}

function _wishlistCercaInput(valore) {
    _wishlistRicercaTesto = (valore || '').toLowerCase();
    _wishlistRenderElenco();
}

function _wishlistRenderElenco() {
    const elenco = document.getElementById('wishlistElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = _wishlistCarteComputate;
    if (_wishlistFiltroAttivo === 'raggiunte') righe = righe.filter(r => r.raggiunta);
    else if (_wishlistFiltroAttivo === 'in_corso') righe = righe.filter(r => !r.raggiunta && r.obiettivo != null);
    else if (_wishlistFiltroAttivo === 'senza_obiettivo') righe = righe.filter(r => r.obiettivo == null);
    if (_wishlistRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_wishlistRicercaTesto));

    if (righe.length === 0) {
        // Messaggio diverso da quello a pagina intera (wishlist vuota):
        // qui la wishlist ha carte, solo il filtro/ricerca corrente non
        // trova corrispondenze.
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessuna carta corrisponde alla ricerca o al filtro.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        const badge = r.raggiunta ? '<span class="pg-badge-raggiunta">Raggiunto</span>' : '';
        const destra = r.obiettivo != null
            ? `<b>${eur(r.prezzo)}</b>obiettivo ${eur(r.obiettivo)}`
            : `<b>${eur(r.prezzo)}</b>nessun obiettivo`;
        return `
            <div class="pg-riga ${r.raggiunta ? 'pg-riga-raggiunta' : ''}" data-tocca onclick="apriFlipCardHome('${r.id}', { origine: 'wishlist_pagina' })">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}${badge}</b></div>
                <div class="pg-destra">${destra}</div>
            </div>`;
    }).join('');
}

// Salta direttamente al binder di tipo 'wishlist', invece di lasciare
// l'utente sulla griglia dei contenitori di Binder (2026-08-30). Usa SOLO
// funzioni reali già esistenti in ui/binder.ui.js, nessuna query nuova
// inventata:
//   1) apriDettaglioWidget('binder', evt) — mostra la view-section Binder
//      (switchTab interno, MAI toccato direttamente qui) E chiama già da
//      sola apriWidgetBinders() al suo interno, awaited (vedi
//      apriDettaglioWidget riga ~2733) — _bindersElenco è già garantita
//      popolata quando questa await finisce, nessuna seconda chiamata
//      necessaria.
//   2) apriBinderDettaglio(id) — cerca dentro _bindersElenco.
async function _vaiAlBinderWishlist(evt) {
    await apriDettaglioWidget('binder', evt);
    const binderWishlist = _bindersElenco.find(b => b.tipo === 'wishlist');
    if (binderWishlist) {
        await apriBinderDettaglio(binderWishlist.id);
    }
    // Se non trovato (caso limite — binderWishlistGarantisci() dovrebbe
    // impedirlo sempre, vedi _garantisciTuttiIBinder in ui/binder.ui.js):
    // resta sulla griglia dei contenitori invece di rompere la pagina.
}
