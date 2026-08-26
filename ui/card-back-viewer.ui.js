// ── ui/card-back-viewer.ui.js ────────────────────────────────────────────
// Visualizzatore del retro carta personalizzato, ramo "non owner" —
// condiviso SOLO tra scambio.html e wishlist.html (sealed.html non ha il
// flip-modal: i prodotti sealed non hanno un "retro carta" da mostrare).
// Codice identico, byte per byte, tra le due pagine — prima duplicato.
//
// Questa pagina è sempre pubblica/anonima (nessuna sessione): non
// mostriamo MAI una sleeve pending o rejected, solo 'approved' — via RPC
// leggi_card_back_approvata(p_owner_id, p_binder_id) (24_card_back_binder_id.sql),
// che filtra lato server per owner E per binder specifico. Fallback:
// nessuna riga approvata per quel binder → default di sistema
// (default-assets/card_back/defaultcard.png) → se anche quello fallisce,
// .cbd-wrap resta nascosto e si vede il semplice sfondo var(--primary) di
// prima (nessuna regressione).
//
// Fix 26/08/2026: con Multi-Binder ogni binder ha la propria sleeve — non
// esiste più "la sleeve dell'owner", solo "la sleeve di questo binder
// dell'owner". Ogni pagina (scambio.ui.js/wishlist.ui.js) risolve il
// binder_id giusto (via leggi_binder_id_owner) in _ownerBinderId prima di
// aprire il flip-modal.
//
// L'UNICA differenza reale tra scambio.html e wishlist.html era il testo
// del campo "variazione" (scambio: "Disponibili: N", wishlist: "Obiettivo:
// €N") — estratta qui nella funzione _cbdTestoVariazione(card), che
// ciascuna pagina definisce nel proprio ui/*.ui.js (scambio.ui.js /
// wishlist.ui.js). Tutto il resto è identico.
//
// Dipende da: _ownerUserId e _ownerBinderId (state della pagina),
// _cbdTestoVariazione (definita nel file ui/*.ui.js della pagina), e da
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

        if (_ownerUserId && _ownerBinderId) {
            const media = await cardBackViewerLeggiApprovata(_ownerUserId, _ownerBinderId);

            if (media) {
                // Path pubblico per-binder (fix 26/08/2026): la copia in
                // 'immaginivisibili' viene scritta da admin.html come
                // carta/{ownerId}/{binderId}.png (vedi
                // _sincronizzaCopiaPubblica in admin-requests.ui.js).
                //
                // Cache-buster: il path pubblico è sempre lo stesso file per
                // quel binder — senza "?v=reviewed_at" il browser continua a
                // servire la versione vecchia dalla cache anche dopo una
                // nuova approvazione.
                if (media.source === 'default') {
                    sleeveUrl = cardBackViewerDefaultPublicUrl(media.storage_path);
                } else {
                    const pubUrl = cardBackViewerImmaginiVisibiliPublicUrl(`carta/${_ownerUserId}/${_ownerBinderId}.png`);
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
