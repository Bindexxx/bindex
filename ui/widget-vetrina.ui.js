// Widget Vetrina e ricerca della carta.

CATALOGO_WIDGET.ultima_carta = {
        titolo: 'Vetrina', icona: 'fa-star', multiIstanza: true,
        preview: (w) => {
            if (!w || w.cartaId == null) return { righe: ['Scegli una carta'], dati: { vuoto: true } };
            const carta = carteReali.find(c => String(c.id) === String(w.cartaId));
            if (!carta) return { righe: ['Carta non più disponibile'], dati: { vuoto: true } };
            return {
                righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id, rarita: carta.rarita,
                dati: {
                    nome: carta.name, codice: carta.code, prezzo: carta.price,
                    variazione: carta.variation, variazioneNumerica: carta.variazioneNumerica,
                    immagine: carta.immagine, id: carta.id,
                },
            };
        },
        azione: (dati, punto, w) => {
            if (dati && dati.vuoto) { if (w) _apriRicercaCartaVetrina(w.instanceId); return; }
            if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId);
        },
};

let _vetrinaRicercaInstanceId = null;

function _escapeHtmlVetrina(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _apriRicercaCartaVetrina(instanceId) {
    _vetrinaRicercaInstanceId = instanceId;
    const input = document.getElementById('vetrinaRicercaInput');
    if (input) input.value = '';
    _renderRicercaCartaVetrina('');
    document.getElementById('vetrinaRicercaModal').style.display = 'flex';
    if (input) setTimeout(() => input.focus(), 50);
}

function _chiudiRicercaCartaVetrina() {
    document.getElementById('vetrinaRicercaModal').style.display = 'none';
    _vetrinaRicercaInstanceId = null;
}

function _filtraRicercaCartaVetrina(valore) {
    _renderRicercaCartaVetrina(valore);
}

function _renderRicercaCartaVetrina(valore) {
    const container = document.getElementById('vetrinaRicercaLista');
    if (!container) return;
    const cerca = String(valore || '').toLowerCase().trim();

    if (!cerca) {
        const perPrezzo = (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0);
        const preziose = carteReali.filter(c => c.stato === 'collezione').slice().sort(perPrezzo).slice(0, 8);
        const wishlist = carteReali.filter(c => c.tabella === 'wishlist').slice().sort(perPrezzo).slice(0, 8);
        const griglia = (lista) => '<div class="vetrina-sugg">' + lista.map(c => {
            const idAttr = _escapeHtmlVetrina(c.id).replace(/'/g, "\\'");
            const url = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 128) || '') : '';
            return `<div class="vetrina-sugg-c" onclick="_selezionaCartaVetrina('${idAttr}')" title="${_escapeHtmlVetrina(c.name || '')}">` +
                (url ? `<img src="${url}" alt="" onerror="this.outerHTML='<span class=&quot;vuota&quot;></span>'">` : '<span class="vuota"></span>') +
                `<b>${_escapeHtmlVetrina(c.name || '')}</b><span>${c.price != null ? formattaEuro(c.price) : '—'}</span></div>`;
        }).join('') + '</div>';
        let html = '';
        if (preziose.length) html += '<div class="vetrina-sugg-tit">Le tue più preziose</div>' + griglia(preziose);
        if (wishlist.length) html += '<div class="vetrina-sugg-tit">Dalla Wishlist</div>' + griglia(wishlist);
        container.innerHTML = html || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Scrivi per cercare per nome o codice.</p>';
        return;
    }

    const risultati = carteReali
        .filter(c => (c.name || '').toLowerCase().includes(cerca) || (c.code || '').toLowerCase().includes(cerca))
        .slice(0, 30);

    if (risultati.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessuna carta trovata.</p>';
        return;
    }

    container.innerHTML = risultati.map(c => {
        const idAttr = _escapeHtmlVetrina(c.id).replace(/'/g, "\\'");
        const nomeAttr = _escapeHtmlVetrina(c.name || '');
        const url = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 64) || '') : '';
        const thumb = url
            ? `<img src="${url}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; flex-shrink:0;" onerror="this.style.display='none';">`
            : `<i class="fa-solid fa-image" style="width:32px; text-align:center; color:var(--text-muted); flex-shrink:0;"></i>`;
        return `
            <div class="widget-picker-riga" onclick="_selezionaCartaVetrina('${idAttr}')" title="${nomeAttr}">
                ${thumb}
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_escapeHtmlVetrina(c.name || '')}
                    <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">${c.code ? ' · ' + _escapeHtmlVetrina(c.code) : ''}</span>
                </span>
            </div>`;
    }).join('');
}

function _selezionaCartaVetrina(cardId) {
    if (!_vetrinaRicercaInstanceId) return;
    const w = _layoutWidget.find(x => x.instanceId === _vetrinaRicercaInstanceId);
    if (w) w.cartaId = cardId;
    _salvaLayoutWidget();
    _chiudiRicercaCartaVetrina();
    renderWidgetHome();
}
