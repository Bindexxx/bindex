// ═══════════════════════════════════════════════════════════════════════
// WIDGET-VETRINA.UI.JS — tessera "Vetrina" (id catalogo 'ultima_carta') +
// modale ricerca carta (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 20 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C: nessuna pagina propria — il tap apre il flip-modal della
// carta scelta (o la ricerca, se non ancora scelta). multiIstanza: true —
// unico widget del catalogo che può avere più copie in home (una per
// riga di layout, ognuna con il proprio 'cartaId'), lasciato
// deliberatamente da parte allo STEP 0/1 proprio per questo: qui contiene
// sia la voce di catalogo sia il modale di ricerca carta, entrambi
// specifici di questo widget.
//
// DIPENDENZA INVERSA GIÀ ESISTENTE (documentata dallo STEP 0):
// _aggiungiIstanzaWidget() (ui/paginainiziale.ui.js, caricato PRIMA di
// questo file) chiama _apriRicercaCartaVetrina() qui sotto quando si
// aggiunge una nuova copia — funziona perché _aggiungiIstanzaWidget viene
// chiamata solo a runtime (click sul picker "+"), quando tutti gli
// script, compreso questo, sono già caricati.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - _ballTITOLI_BREVI.ultima_carta / _ballASPETTO.ultima_carta
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Nessuna voce in _ballCORPI per questo widget: la preview restituisce
//   'immagine' a livello radice (non dentro 'dati'), quindi segue il ramo
//   con foto di renderWidgetHome invece del corpo grande generico —
//   comportamento pre-esistente, non toccato.
// - apriFlipCardHome, _urlImmagineVisualizzabile, carteReali: esterne/
//   globali, non toccate.
// - _layoutWidget, _salvaLayoutWidget, renderWidgetHome
//   (ui/paginainiziale.ui.js): cross-file, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.ultima_carta = {
        titolo: 'Vetrina', icona: 'fa-star', multiIstanza: true,
        // TRASFORMATO (Claudio, 2026-08-28): da "ultima carta entrata" a
        // vetrina di carte preferite scelte a mano — vedi ricerca carte più
        // sotto (_apriRicercaCartaVetrina). Copie multiple: ogni riga di
        // _layoutWidget con questo id ha il proprio 'cartaId', il widget
        // catalogo resta UNO SOLO — vedi 'multiIstanza' sopra.
        // Riceve la riga di layout (w) come parametro: è l'unico modo per
        // sapere QUALE carta mostrare, dato che più copie condividono lo
        // stesso 'id' di catalogo. Tutti gli altri 18 widget ignorano
        // questo parametro, nessuna modifica per loro.
        preview: (w) => {
            if (!w || w.cartaId == null) return { righe: ['Scegli una carta'], dati: { vuoto: true } };
            const carta = carteReali.find(c => String(c.id) === String(w.cartaId));
            if (!carta) return { righe: ['Carta non più disponibile'], dati: { vuoto: true } };
            return { righe: [carta.name || ''], immagine: carta.immagine, cardId: carta.id, rarita: carta.rarita };
        },
        // Stato vuoto (mai scelta, o cancellata nel frattempo): il tap
        // apre la ricerca invece del flip-modal. 'w' è il terzo parametro
        // che _eseguiAzioneWidget passa ora a TUTTE le azioni (gli altri
        // 18 widget lo ignorano, retrocompatibile).
        azione: (dati, punto, w) => {
            if (dati && dati.vuoto) { if (w) _apriRicercaCartaVetrina(w.instanceId); return; }
            if (dati && dati.cardId != null) apriFlipCardHome(dati.cardId);
        },
};

// ── RICERCA CARTE — per scegliere la carta di una Vetrina ────────────────
// Stessa identica logica di ricerca già in filterTable() (cards.ui.js):
// nome o codice, minuscolo, includes — non esiste un modale di selezione
// carta riutilizzabile nel sito (verificato leggendo cards.ui.js e
// home.ui.js per intero), quindi questo è un contenitore nuovo ma la
// LOGICA di ricerca è la stessa a cui sei abituato, non inventata.
//
// Ambito: TUTTA carteReali (collezione + wishlist), non solo la
// collezione — "una carta da tenere d'occhio" può ragionevolmente essere
// anche una che non possiedi ancora. Dimmi se preferisci restringerlo
// alla sola collezione.
let _vetrinaRicercaInstanceId = null;

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

    // Come filterTable(): senza testo digitato, nessun risultato — evita
    // di rendere subito una lista con centinaia di righe non richiesta.
    if (!cerca) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Scrivi per cercare per nome o codice.</p>';
        return;
    }

    const risultati = carteReali
        .filter(c => (c.name || '').toLowerCase().includes(cerca) || (c.code || '').toLowerCase().includes(cerca))
        .slice(0, 30); // stessa cautela di _apriPickerAggiungiWidget: lista corta, mai una scrollata infinita

    if (risultati.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessuna carta trovata.</p>';
        return;
    }

    container.innerHTML = risultati.map(c => {
        const idAttr = String(c.id).replace(/'/g, "\\'");
        const nomeAttr = (c.name || '').replace(/"/g, '&quot;');
        const url = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 64) || '') : '';
        const thumb = url
            ? `<img src="${url}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; flex-shrink:0;" onerror="this.style.display='none';">`
            : `<i class="fa-solid fa-image" style="width:32px; text-align:center; color:var(--text-muted); flex-shrink:0;"></i>`;
        return `
            <div class="widget-picker-riga" onclick="_selezionaCartaVetrina('${idAttr}')" title="${nomeAttr}">
                ${thumb}
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name || ''}
                    <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">${c.code ? ' · ' + c.code : ''}</span>
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
