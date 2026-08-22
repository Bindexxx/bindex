// ── ui/card-back-viewer.ui.js ────────────────────────────────────────────
// Visualizzatore del retro carta personalizzato, ramo "non owner" —
// condiviso SOLO tra scambio.html e wishlist.html (sealed.html non ha il
// flip-modal: i prodotti sealed non hanno un "retro carta" da mostrare).
// Codice identico, byte per byte, tra le due pagine — prima duplicato.
//
// Questa pagina è sempre pubblica/anonima (nessuna sessione): non
// mostriamo MAI una sleeve pending o rejected, solo 'approved' — via RPC
// leggi_card_back_approvata() (06_rpc_leggi_card_back_approvata.sql), che
// filtra lato server. Fallback: nessuna riga approvata → default di
// sistema (default-assets/card_back/defaultcard.png) → se anche quello
// fallisce, .cbd-wrap resta nascosto e si vede il semplice sfondo
// var(--primary) di prima (nessuna regressione).
//
// L'UNICA differenza reale tra scambio.html e wishlist.html era il testo
// del campo "variazione" (scambio: "Disponibili: N", wishlist: "Obiettivo:
// €N") — estratta qui nella funzione _cbdTestoVariazione(card), che
// ciascuna pagina definisce nel proprio ui/*.ui.js (scambio.ui.js /
// wishlist.ui.js). Tutto il resto è identico.
//
// Dipende da: _ownerUserId (state della pagina), _cbdTestoVariazione
// (definita nel file ui/*.ui.js della pagina), e da
// data/card-back-viewer.repository.js (cardBackViewerLeggiApprovata,
// cardBackViewerDefaultPublicUrl, cardBackViewerImmaginiVisibiliPublicUrl).

const CARD_BACK_W = 900;
const DEFAULT_STATE_CARD_BACK = {
    pokemon:    { left: 13.48, top: 9.33,  scale: 1 },
    condition:  { left: 27.19, top: 31.82, scale: 1 },
    variazione: { left: 27.19, top: 55.25, scale: 1 },
    price:      { left: 66.44, top: 78.27, scale: 1 }
};

function toggleFlipCard() {
    document.getElementById('flipCardInner').classList.toggle('flipped');
}

async function renderRetroCartaViewer(card) {
    const wrap = document.getElementById('cbdWrap');
    try {
        let sleeveUrl = null;
        let fieldState = DEFAULT_STATE_CARD_BACK;

        if (_ownerUserId) {
            const media = await cardBackViewerLeggiApprovata(_ownerUserId);

            if (media) {
                // FASE 4-bis (20/08/2026): le sleeve 'upload' approvate hanno
                // una copia pubblica in 'immaginivisibili/carta/{ownerId}.png',
                // creata da admin.html al momento dell'approvazione
                // (07_schema_bucket_immaginivisibili.sql). Se la copia non
                // esiste ancora (approvazione fatta prima di questa modifica e
                // mai risincronizzata), l'immagine risulterà rotta e si cade
                // comunque sul default di sistema sotto.
                //
                // FASE 4-ter (20/08/2026): il path pubblico è sempre lo stesso
                // file — senza cache-buster il browser continua a servire la
                // versione vecchia dalla cache anche dopo una nuova
                // approvazione. Aggiungo "?v=reviewed_at" (cambia SOLO quando
                // viene davvero approvata una nuova versione).
                if (media.source === 'default') {
                    sleeveUrl = cardBackViewerDefaultPublicUrl(media.storage_path);
                } else {
                    const pubUrl = cardBackViewerImmaginiVisibiliPublicUrl(`carta/${_ownerUserId}.png`);
                    sleeveUrl = pubUrl ? (pubUrl + '?v=' + encodeURIComponent(media.reviewed_at || '')) : null;
                }
                fieldState = media.metadata || DEFAULT_STATE_CARD_BACK;
            }
        }

        if (!sleeveUrl) {
            sleeveUrl = cardBackViewerDefaultPublicUrl('card_back/defaultcard.png');
        }

        if (!sleeveUrl) { wrap.style.display = 'none'; return; }

        document.getElementById('cbdBgImg').src = sleeveUrl;
        _popolaCbdField('pokemon', card.name || '', fieldState.pokemon);
        _popolaCbdField('condition', card.cond || 'NM', fieldState.condition);
        _popolaCbdField('variazione', _cbdTestoVariazione(card), fieldState.variazione);
        _popolaCbdField('price', (card.price !== undefined && card.price !== null) ? formattaEuro(card.price) : '', fieldState.price);

        wrap.style.display = 'block';
        _cbdRescale();
    } catch (e) {
        console.error('renderRetroCartaViewer:', e);
        wrap.style.display = 'none';
    }
}

function _popolaCbdField(key, text, pos) {
    const fieldEl = document.getElementById('cbdField-' + key);
    const textEl = document.getElementById('cbdText-' + key);
    if (textEl) textEl.textContent = text;
    if (fieldEl && pos) {
        fieldEl.style.left = pos.left + '%';
        fieldEl.style.top = pos.top + '%';
        fieldEl.querySelector('.cbd-field-content').style.transform = `scale(${pos.scale || 1})`;
    }
}

function _cbdRescale() {
    const wrap = document.getElementById('cbdWrap');
    const stage = document.getElementById('cbdStage');
    if (!wrap || !stage || wrap.clientWidth === 0) return;
    const scale = wrap.clientWidth / CARD_BACK_W;
    stage.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', _cbdRescale);
