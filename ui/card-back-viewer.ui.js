// Retro carta personalizzato visto da chi non è il proprietario (pagine pubbliche).

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
