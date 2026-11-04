// Avviso di missione o traguardo completato, senza aprire la pagina Missioni.

const INTERVALLO_WATCHER_MISSIONI_MS = 180000;
const RITARDO_PRIMO_GIRO_WATCHER_MS = 20000;

let _watcherMissioniInterval = null;
let _watcherMissioniTimeoutAvvio = null;
let _watcherMissioniInCorso = false;
let _watcherMissioniUltimoGiro = 0;

async function _watcherMissioniGiro() {
    if (_watcherMissioniInCorso) return;

    if (document.hidden) return;

    const sezioneMissioni = document.getElementById('missioni');
    if (sezioneMissioni && sezioneMissioni.classList.contains('active')) return;

    if (typeof MOTORE_MISSIONI === 'undefined' || typeof authGetUserId !== 'function') return;
    if (typeof CSBar === 'undefined') return;

    _watcherMissioniInCorso = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;

        _watcherMissioniUltimoGiro = Date.now();

        const risultato = await MOTORE_MISSIONI.valutaEAssegna(userId);
        const nuoveMissioni = (risultato && risultato.nuoveMissioni) || [];
        const nuoviTraguardi = (risultato && risultato.nuoviTraguardi) || [];

        if (!nuoveMissioni.length && !nuoviTraguardi.length) return;

        await _missioniNotificaCompletamenti(nuoveMissioni, nuoviTraguardi);
    } catch (e) {
        console.error('[missioni-watcher] giro di controllo fallito:', e);
    } finally {
        _watcherMissioniInCorso = false;
    }
}

function avviaWatcherMissioni() {
    fermaWatcherMissioni();

    _watcherMissioniTimeoutAvvio = setTimeout(() => {
        _watcherMissioniGiro();
        _watcherMissioniInterval = setInterval(_watcherMissioniGiro, INTERVALLO_WATCHER_MISSIONI_MS);
    }, RITARDO_PRIMO_GIRO_WATCHER_MS);
}

function fermaWatcherMissioni() {
    if (_watcherMissioniTimeoutAvvio) { clearTimeout(_watcherMissioniTimeoutAvvio); _watcherMissioniTimeoutAvvio = null; }
    if (_watcherMissioniInterval) { clearInterval(_watcherMissioniInterval); _watcherMissioniInterval = null; }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!_watcherMissioniInterval) return;
    if (Date.now() - _watcherMissioniUltimoGiro < INTERVALLO_WATCHER_MISSIONI_MS) return;
    _watcherMissioniGiro();
});

window.addEventListener('load', avviaWatcherMissioni);
