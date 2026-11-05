// Home: aggiornamento periodico, presenza, avvio.

const INTERVALLO_WIDGET_VELOCE_MS = 15000;
const INTERVALLO_WIDGET_LENTO_MS = 60000;

let _pollingVisibilitaAgganciato = false;
let _giroLentoInCorso = false;

function avviaPollingWidgetHome() {
    if (_pollingWidgetInterval) clearInterval(_pollingWidgetInterval);
    if (_pollingWidgetIntervalLento) clearInterval(_pollingWidgetIntervalLento);

    _pollingWidgetInterval = setInterval(() => {
        if (document.hidden) return;
        if (!document.body.classList.contains('phone-detail-open') && !_editModeWidget) {
            renderWidgetHome();
        }
    }, INTERVALLO_WIDGET_VELOCE_MS);

    _pollingWidgetIntervalLento = setInterval(_giroPollingLento, INTERVALLO_WIDGET_LENTO_MS);

    if (!_pollingVisibilitaAgganciato) {
        _pollingVisibilitaAgganciato = true;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            _giroPollingLento();
        });
    }
}

async function _giroPollingLento() {
    if (document.hidden) return;
    if (document.body.classList.contains('phone-detail-open') || _editModeWidget) return;
    if (_giroLentoInCorso) return;
    _giroLentoInCorso = true;
    try {
        _impostaSyncAttivo(true);
        try {
            await caricaAvvisiHome();
            await aggiornaBadgeMatch();
            await _aggiornaBadgeChat();
            await _controllaNotifichePush();
            await _aggiornaPokeballStatoEstensione();
        } catch (e) { console.error('Errore polling avvisi (widget prezzi/inserimento/match):', e); }
        _impostaSyncAttivo(false);
        renderWidgetHome();
    } finally {
        _giroLentoInCorso = false;
    }
}

function _vaiAllaPaginaHome() {
    _vaiAllaPaginaWidget(0);
}

function _aggiornaMatitaBarraGlobale() {
    ['btnSuoniWidgetHome', 'btnDensitaWidgetHome'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('nascosto-in-home');
    });
}

function _aggiornaTastoFisico() {
    const btn = document.getElementById('btnFisicoTelefono');
    if (!btn) return;
    const icona = btn.querySelector('i');

    const btnImp = document.querySelector('[data-csb="settings"]');
    if (btnImp) {
        const impAperte = document.body.classList.contains('phone-detail-open')
            && !!document.getElementById('impostazioni')?.classList.contains('active');
        btnImp.classList.toggle('is-attivo', impAperte);
        btnImp.setAttribute('aria-label', impAperte ? 'Chiudi impostazioni' : 'Impostazioni');
    }

    if (document.body.classList.contains('phone-detail-open')) {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-arrow-left';
        btn.title = 'Indietro';
    } else if (_paginaWidgetCorrente > 0) {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-house';
        btn.title = 'Prima pagina';
    } else {
        btn.classList.remove('nascosto');
        if (icona) icona.className = 'fa-solid fa-lightbulb';
        btn.title = 'Centro operativo';
    }
}

function _clickTastoFisico() {
    if (document.body.classList.contains('phone-detail-open')) {
        chiudiDettaglioWidget();
        return;
    }
    if (_paginaWidgetCorrente > 0) {
        _vaiAllaPaginaHome();
        return;
    }
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    apriDettaglioWidget('dafare', null);
}

let _ultimoStatoPresenzaRealtime = null;

async function _avviaPresenzaLive() {
    if (typeof CSBar === 'undefined') return;
    try {
        const user = await authGetUserVerificato();
        if (!user) return;
        const canale = presenzaCreaCanale(user.id);
        canale
            .on('presence', { event: 'sync' }, () => {
                const stato = canale.presenceState();
                CSBar.setPresence({ count: Object.keys(stato).length, label: 'persone stanno usando CardSync' });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    _ultimoStatoPresenzaRealtime = 'ok';
                    await canale.track({ online: true });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    _ultimoStatoPresenzaRealtime = 'errore';
                    console.warn('[presenza] canale realtime non disponibile (status: ' + status + ') — controllare che Realtime sia attivo sul progetto Supabase.');
                }
            });
    } catch (e) { _ultimoStatoPresenzaRealtime = 'errore'; console.error('[presenza] errore avvio:', e); }
}

let _saldoEEffettiStatusBarCaricati = false;
async function _caricaSaldoEEffettiStatusBar() {
    try {
        if (typeof CSBar === 'undefined') return;
        const userId = await authGetUserId();
        if (!userId) return;
        _saldoEEffettiStatusBarCaricati = true;
        const { data: saldo, error } = await polvereSaldoLeggi();
        if (!error) CSBar.setCurrency({ value: saldo || 0, glyph: '✧', label: 'Polvere' });
        if (typeof shopCaricaEffetti === 'function') shopCaricaEffetti();
    } catch (e) { console.error('[statusbar] saldo polvere iniziale:', e); }
}

async function initPhoneShell() {

    await _caricaLayoutWidget();
    if (typeof _wipCaricaCache === 'function') _wipCaricaCache();
    await renderWidgetHome();

    const iconaSuoni = document.getElementById('iconaSuoniWidgetHome');
    if (iconaSuoni) iconaSuoni.className = prefSuoniWidgetGet() ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';

    if (typeof CSBar !== 'undefined') {
        CSBar.init({
            container: '#phoneScreen',
            persist: true,
            installPrompt: false,
            systemNotifications: false,
            watchNetwork: true,

            notificationTypes: {
                'missione-completata': {
                    icon: '\u2726', title: 'Missione completata', text: '',
                    target: '#missioni', group: 'missioni-oggi', groupLabel: 'missioni completate',
                },
                'traguardo-sbloccato': {
                    icon: '\u2b50', title: 'Traguardo sbloccato', text: '',
                    target: '#missioni', group: 'traguardi-oggi', groupLabel: 'traguardi sbloccati',
                    priority: 'high',
                },
                'match-trovato': {
                    icon: '\u21c4', title: 'Nuovo Match', text: '',
                    target: '#match', group: 'match-nuovi', groupLabel: 'nuovi Match',
                },
                'prezzo-obiettivo': {
                    icon: '\u2713', title: 'Prezzo obiettivo raggiunto', text: '',
                    target: '#wishlist', group: 'prezzo-obiettivo', groupLabel: 'obiettivi di prezzo raggiunti',
                    priority: 'high',
                },
                'chat-messaggio': {
                    icon: '\u{1F4AC}', title: 'Nuovo messaggio', text: '',
                    target: '#chat', group: 'chat-match-messaggio', groupLabel: 'messaggi chat',
                },
            },

            onNotificationClick: (n) => {
                if (!n || !n.target) return;
                const sezione = n.target.charAt(0) === '#' ? n.target.slice(1) : n.target;
                apriDettaglioWidget(sezione, null);
            },

            quickActions: _scorciatoieTendina(),
            onEditQuick: () => {
                if (typeof CSBar !== 'undefined') CSBar.close();
                apriDettaglioWidget('impostazioni');
                setTimeout(() => { if (typeof _impostazioniApri === 'function') _impostazioniApri('home'); }, 50);
            },
            bannerMode: () => (typeof prefBannerGet === 'function' ? prefBannerGet() : 'azioni'),

            onSettings: () => toggleImpostazioniBarra(),
            onProfile: () => { if (typeof toggleMenuProfilo === 'function') toggleMenuProfilo(); },
        });
        _scorciatoieAggiorna();
        if (typeof _impApplicaBadgeStile === 'function') _impApplicaBadgeStile();
        if (typeof _impApplicaBannerPos === 'function') _impApplicaBannerPos();

        function _avviaSincronizzaPallinaTendina() {
            const pallina = document.getElementById('pallinaTendinaVisibile');
            const shade = document.querySelector('.csb-shade');
            const schermo = document.getElementById('phoneScreen');
            if (!pallina || !shade || !schermo) return;

            function fotogramma() {
                const rectShade = shade.getBoundingClientRect();
                const rectSchermo = schermo.getBoundingClientRect();
                const fondoTendina = rectShade.bottom - rectSchermo.top;
                const piccoloStacco = 4;
                const offsetY = fondoTendina + piccoloStacco;
                pallina.style.transform = `translate(-50%, ${offsetY}px)`;
                requestAnimationFrame(fotogramma);
            }
            requestAnimationFrame(fotogramma);
        }

        const _schermoPerPallina = document.getElementById('phoneScreen');
        if (_schermoPerPallina && document.querySelector('.csb-bar')) {
            const pallinaTendina = document.createElement('div');
            pallinaTendina.id = 'pallinaTendinaVisibile';
            pallinaTendina.className = 'pokedex-ball pokedex-ball-tendina';
            _schermoPerPallina.appendChild(pallinaTendina);
            _avviaSincronizzaPallinaTendina();

            pallinaTendina.addEventListener('pointerdown', (ev) => {
                const maniglia = document.querySelector('.csb-handle');
                if (!maniglia) return;
                const inoltrato = new PointerEvent('pointerdown', {
                    bubbles: true,
                    cancelable: true,
                    pointerId: ev.pointerId,
                    pointerType: ev.pointerType,
                    isPrimary: ev.isPrimary,
                    button: 0,
                    buttons: ev.buttons,
                    clientX: ev.clientX,
                    clientY: ev.clientY,
                });
                maniglia.dispatchEvent(inoltrato);
            });
        }

        const profiloContainer = document.getElementById('profiloContainer');
        const csbRight = document.querySelector('#phoneScreen .csb-right');
        if (profiloContainer && csbRight) csbRight.appendChild(profiloContainer);

        _avviaPresenzaLive();
        _aggiornaPokeballStatoEstensione();

        _caricaSaldoEEffettiStatusBar();
    }

    avviaPollingWidgetHome();

    if (BALL_ATTIVA) {
        _ballApplicaClasseAnimazioni();
        _ballCaricaLibreriaDaDb();
        _ballAvviaSemaforo();
        _ballOsservaTema();
        _ballSincronizzaToggleImpostazioni();
    }

    window.addEventListener('resize', _gestisciResizeCorniceDebounced);
    window.addEventListener('orientationchange', _gestisciResizeCornice);

    const contPagineWidget = document.getElementById('phoneWidgetPagine');
    if (contPagineWidget) contPagineWidget.addEventListener('scroll', _gestisciScrollPaginePagineWidget, { passive: true });
    _aggiornaTastoFisico();
    _aggiornaMatitaBarraGlobale();

    const frameBox = document.getElementById('phoneFrameBox');
    if (frameBox) {
        frameBox.classList.add('phone-accensione');
        setTimeout(() => frameBox.classList.remove('phone-accensione'), 700);
    }
}

const _SCORCIATOIE_TENDINA = {
    'suoni': { label: 'Suoni', glyph: '\u266a', stato: () => prefSuoniWidgetGet(), onToggle: () => toggleSuoniWidgetHome() },
    'vibrazione': { label: 'Vibrazione', glyph: '\u224b', stato: () => (typeof CSBar !== 'undefined' ? CSBar.getSetting('vibrazione') : true), onToggle: () => { _impSincronizzaControlli(); } },
    'tema-scuro': { label: 'Tema scuro', glyph: '\u25d6', stato: () => document.body.classList.contains('dark-mode'), onToggle: (on) => { toggleDarkMode(on); _impSincronizzaControlli(); } },
    'animazioni': { label: 'Animazioni', glyph: '\u2726', stato: () => prefAnimWidgetGet(), onToggle: (on) => { toggleAnimWidget(on); _impSincronizzaControlli(); } },
    'aggiorna-prezzi': { label: 'Aggiorna prezzi', glyph: '\u27f3', type: 'action', onToggle: () => {
        if (typeof CSBar !== 'undefined') CSBar.close();
        apriDettaglioWidget('prezzi');
    } },
    'estensione': { label: 'Estensione', glyph: '\u29c9', type: 'action', onToggle: () => {
        if (typeof CSBar !== 'undefined') CSBar.close();
        if (typeof _versioneVecchiaRilevata !== 'undefined' && _versioneVecchiaRilevata && typeof _mandaAperturaAppAEstensione === 'function') {
            _mandaAperturaAppAEstensione();
        } else {
            apriDettaglioWidget('impostazioni');
            setTimeout(() => { if (typeof _impostazioniApri === 'function') _impostazioniApri('account'); }, 50);
        }
    } },
    'modifica-home': { label: 'Modifica home', glyph: '\u270e', type: 'action', onToggle: () => {
        if (typeof CSBar !== 'undefined') CSBar.close();
        if (document.body.classList.contains('phone-detail-open')) chiudiDettaglioWidget();
        toggleModificaWidgetHome();
    } },
    'badge-pallino': { label: 'Badge a pallino', glyph: '\u25cf', stato: () => prefBadgeStileGet() === 'pallino', onToggle: (on) => {
        prefBadgeStileSet(on ? 'pallino' : 'numero');
        if (on) prefBadgeWidgetSet(true);
        if (typeof _impApplicaBadgeStile === 'function') _impApplicaBadgeStile();
        _impSincronizzaControlli();
    } },
};

function _vibrazioneSupportata() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
function _scorciatoiaDisponibile(id) {
    return !!_SCORCIATOIE_TENDINA[id] && (id !== 'vibrazione' || _vibrazioneSupportata());
}

function _scorciatoieTendina() {
    return prefScorciatoieGet().filter(_scorciatoiaDisponibile).map(id => {
        const d = _SCORCIATOIE_TENDINA[id];
        return { id, label: d.label, glyph: d.glyph, type: d.type || 'toggle', active: d.stato ? !!d.stato() : undefined, onToggle: d.onToggle };
    });
}

function _scorciatoieAggiorna() {
    if (typeof CSBar !== 'undefined' && CSBar.setQuickActions) CSBar.setQuickActions(_scorciatoieTendina());
}

function _impSincronizzaControlli() {
    const imposta = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    imposta('darkModeToggle', document.body.classList.contains('dark-mode'));
    imposta('chkAnimWidget', prefAnimWidgetGet());
    imposta('suoniAppToggle', prefSuoniWidgetGet());
    if (typeof CSBar !== 'undefined' && CSBar.getSetting) imposta('impVibrazione', CSBar.getSetting('vibrazione'));
    const badge = document.getElementById('impBadgeStile');
    if (badge) badge.value = !prefBadgeWidgetGet() ? 'nascosto' : prefBadgeStileGet();
    if (typeof _impAnteprime === 'function') _impAnteprime();
    _scorciatoieAggiorna();
}
