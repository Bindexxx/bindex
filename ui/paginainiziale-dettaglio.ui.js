// Home: apertura e chiusura del dettaglio di un widget.

const DURATA_ANIMAZIONE_DETTAGLIO_MS = 300;
let _chiusuraDettaglioTimeout = null;

function _impostaOrigineAnimazione(container, evt) {
    const rect = _rettangoloPaginaSottoBarra() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const x = (evt && evt.clientX ? evt.clientX : rect.left + rect.width / 2) - rect.left;
    const y = (evt && evt.clientY ? evt.clientY : rect.top + rect.height / 2) - rect.top;
    container.style.setProperty('--pokeball-x', x + 'px');
    container.style.setProperty('--pokeball-y', y + 'px');
}

function _csbSopraPagina(sopra) {
    const radice = document.querySelector('.csb-root:not(#csbHeadsFuori)');
    const pallina = document.getElementById('pallinaTendinaVisibile');
    const schermo = document.getElementById('phoneScreen');
    let strato = document.getElementById('csbHeadsFuori');
    if (sopra) {
        if (!schermo || !radice) return;
        if (!strato) {
            strato = document.createElement('div');
            strato.id = 'csbHeadsFuori';
            document.body.appendChild(strato);
        }
        const r = schermo.getBoundingClientRect();
        strato.style.left = r.left + 'px';
        strato.style.top = r.top + 'px';
        strato.style.width = r.width + 'px';
        strato.style.height = r.height + 'px';
        strato.style.borderRadius = getComputedStyle(schermo).borderRadius;
        strato.classList.toggle('csb-solo-supabase', schermo.classList.contains('csb-solo-supabase'));
        if (radice.parentElement !== strato) strato.appendChild(radice);
        if (pallina && pallina.parentElement !== strato) strato.appendChild(pallina);
    } else if (strato && schermo) {
        const eraFuori = radice && radice.parentElement === strato;
        if (eraFuori) schermo.appendChild(radice);
        if (pallina && pallina.parentElement === strato) schermo.appendChild(pallina);
    }
}
window.addEventListener('resize', () => {
    if (document.body.classList.contains('phone-detail-open')) _csbSopraPagina(true);
});

async function apriDettaglioWidget(tabId, evt) {
    clearTimeout(_chiusuraDettaglioTimeout);

    const wip = (typeof _wipVerifica === 'function') ? (_wipVerifica('widget', tabId) || _wipVerifica('pagina', tabId)) : null;
    if (wip) {
        const ehAdmin = (typeof _impostazioniControllaAdmin === 'function') ? await _impostazioniControllaAdmin() : false;
        const procedi = await _wipMostraBlocco(wip, ehAdmin);
        if (!procedi) return;
    }

    const container = document.querySelector('.container');
    if (tabId === 'dafare' || tabId === 'match' || tabId === 'chat' || tabId === 'condividi' || tabId === 'missioni' || tabId === 'valore' || tabId === 'variazione' || tabId === 'wishlist' || tabId === 'location' || tabId === 'doppioni' || tabId === 'sealed' || tabId === 'set' || tabId === 'bustina' || tabId === 'scaffali' || tabId === 'richieste' || tabId === 'achievement' || tabId === 'primopiano' || tabId === 'contributi' || tabId === 'prezziagg' || tabId === 'foto' || tabId === 'shop') {
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'dafare') renderPaginaDaFare();
        if (tabId === 'match') renderPaginaMatch();
        if (tabId === 'chat') renderPaginaChat();
        if (tabId === 'condividi') renderPaginaCondividi();
        if (tabId === 'missioni') renderPaginaMissioni();
        if (tabId === 'valore') renderPaginaValoreCollezione();
        if (tabId === 'variazione') renderPaginaVariazioneValore();
        if (tabId === 'achievement') renderPaginaAchievement();
        if (tabId === 'contributi') renderPaginaContributi();
        if (tabId === 'primopiano') renderPaginaPrimoPiano();
        if (tabId === 'wishlist') renderPaginaWishlist();
        if (tabId === 'location') renderPaginaLocation();
        if (tabId === 'doppioni') renderPaginaDoppioni();
        if (tabId === 'sealed') renderPaginaSealed();
        if (tabId === 'set') renderPaginaSet();
        if (tabId === 'bustina') renderPaginaBustina();
        if (tabId === 'scaffali') apriPaginaScaffali();
        if (tabId === 'richieste') apriPaginaRichieste();
        if (tabId === 'prezziagg') renderPaginaPrezziAggiornati();
        if (tabId === 'foto') renderPaginaFoto();
        if (tabId === 'shop') renderPaginaShop();
    } else {
        switchTab(tabId, null);
        if (tabId === 'visualizzazione' && typeof collRipristinaLocation === 'function' && collRipristinaLocation()) filterTable();
        if (tabId === 'impostazioni' && typeof _impostazioniTornaHub === 'function') _impostazioniTornaHub();
    }
    document.body.classList.add('phone-detail-open');
    _csbSopraPagina(true);

    const _btnFisico = document.getElementById('btnFisicoTelefono');
    if (_btnFisico && _btnFisico.parentElement !== document.body) {
        document.body.appendChild(_btnFisico);
        _btnFisico.classList.add('a-schermo-intero');
    }

    if (container) {
        _impostaOrigineAnimazione(container, evt);
        container.classList.add('container-visibile');
        _posizionaContainerNelloSchermo();
        if (tabId === 'visualizzazione' && typeof collezioneRiallinea === 'function') collezioneRiallinea();
        if (tabId === 'wishlist' && typeof _wishlistRenderElenco === 'function') _wishlistRenderElenco();
        if (tabId === 'set' && typeof _setUiRender === 'function') _setUiRender();
        if (tabId === 'impostazioni' && typeof _impostazioniTornaHub === 'function') _impostazioniTornaHub();
        requestAnimationFrame(() => container.classList.add('container-aperto'));
    }
    _beep(880, 70);
    _aggiornaTastoFisico();

    if (tabId === 'binder') {
        try {
            await apriWidgetBinders();
        } catch (e) {
            console.error('apriDettaglioWidget: errore caricando i binder:', e);
        }
    }
}

function toggleImpostazioniBarra(evt) {
    if (!evt) {
        const g = document.querySelector('[data-csb="settings"]');
        if (g) { const r = g.getBoundingClientRect(); evt = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; }
    }
    const impostazioniAperte = document.body.classList.contains('phone-detail-open')
        && document.getElementById('impostazioni')?.classList.contains('active');
    if (impostazioniAperte) {
        const container = document.querySelector('.container');
        if (container) _impostaOrigineAnimazione(container, evt);
        chiudiDettaglioWidget();
        return;
    }
    apriDettaglioWidget('impostazioni', evt);
}

function chiudiDettaglioWidget() {
    const container = document.querySelector('.container');
    if (container) container.classList.remove('container-aperto');
    _beep(440, 70);
    document.body.classList.remove('phone-detail-open');
    _aggiornaTastoFisico();

    clearTimeout(_chiusuraDettaglioTimeout);
    _chiusuraDettaglioTimeout = setTimeout(() => {
        if (container) container.classList.remove('container-visibile');
        const btnFisico = document.getElementById('btnFisicoTelefono');
        const frameBox = document.getElementById('phoneFrameBox');
        if (btnFisico && frameBox && btnFisico.parentElement !== frameBox) {
            frameBox.appendChild(btnFisico);
            btnFisico.classList.remove('a-schermo-intero');
        }
        _csbSopraPagina(false);
        renderWidgetHome();
    }, DURATA_ANIMAZIONE_DETTAGLIO_MS);
}
