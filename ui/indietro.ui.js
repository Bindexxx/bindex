// Tasto indietro del browser e di Android: chiude un livello alla volta invece di uscire dal sito.
// Finché qualcosa è aperto (pagina di un widget o una finestra) c'è un passo in più nella
// cronologia; "indietro" chiude il livello più in alto e, se resta altro aperto, rimette il passo.
// Quando tutto è chiuso il passo viene tolto: dalla home "indietro" esce dal sito come prima.

let _indPassoMesso = false;
let _indPopDaIgnorare = 0;
let _indControlloInCoda = false;

function _indVisibile(el) {
    return !!el && el.isConnected && getComputedStyle(el).display !== 'none';
}

function _indEsc() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

function _indLivelloInCima() {
    const avviso = [...document.querySelectorAll('.avviso-fondo')].filter(e => !e.classList.contains('avviso-esce')).pop();
    if (avviso) return _indEsc;

    if (document.getElementById('ftSessione') && typeof fotoChiudiSessione === 'function') return fotoChiudiSessione;

    const velo = document.getElementById('ogVelo');
    if (_indVisibile(velo) && typeof chiudiFoglioOspite === 'function') return chiudiFoglioOspite;

    const finestra = [...document.querySelectorAll('.modal-overlay')].filter(_indVisibile).pop();
    if (finestra) {
        return () => {
            const x = finestra.querySelector('.close-modal-btn') || finestra.querySelector('[data-azione="annulla"]');
            if (x) x.click();
            else _indEsc();
            if (_indVisibile(finestra) && finestra.id) finestra.style.display = 'none';
        };
    }

    if (document.querySelector('.csb-backdrop.is-active')) return _indEsc;

    if (document.body.classList.contains('phone-detail-open') && typeof chiudiDettaglioWidget === 'function') {
        return chiudiDettaglioWidget;
    }
    return null;
}

function _indSincronizza() {
    _indControlloInCoda = false;
    const aperto = !!_indLivelloInCima();
    if (aperto && !_indPassoMesso) {
        history.pushState({ bindexIndietro: true }, '');
        _indPassoMesso = true;
    } else if (!aperto && _indPassoMesso) {
        _indPassoMesso = false;
        _indPopDaIgnorare++;
        history.back();
    }
}

function _indProgramma() {
    if (_indControlloInCoda) return;
    _indControlloInCoda = true;
    requestAnimationFrame(_indSincronizza);
}

window.addEventListener('popstate', () => {
    if (_indPopDaIgnorare > 0) { _indPopDaIgnorare--; return; }
    _indPassoMesso = false;
    const chiudi = _indLivelloInCima();
    if (chiudi) {
        try { chiudi(); } catch (e) { console.error('[indietro] chiusura non riuscita:', e); }
    }
    setTimeout(_indProgramma, 60);
});

new MutationObserver(_indProgramma).observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'],
});
