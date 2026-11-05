// Lavori in corso: un solo controllo, in apriDettaglioWidget().

let _wipAttiviMap = new Map();
let _wipResolveFn = null;

async function _wipCaricaCache() {
    try {
        const { data, error } = await wipListaAttivi();
        if (error) { console.error('[WIP] errore caricamento:', error.message); return; }
        _wipAttiviMap = new Map((data || []).map(r => [`${r.target_tipo}:${r.target_id}`, r]));
    } catch (e) {
        console.error('[WIP] errore caricamento:', e);
    }
}

function _wipVerifica(targetTipo, targetId) {
    return _wipAttiviMap.get(`${targetTipo}:${targetId}`) || null;
}

function _wipMostraBlocco(wip, ehAdmin) {
    return new Promise((resolve) => {
        _wipResolveFn = resolve;
        const testo = document.getElementById('wipModalTesto');
        if (testo) testo.textContent = wip.messaggio;
        const bypassBtn = document.getElementById('wipModalBypassBtn');
        if (bypassBtn) bypassBtn.style.display = ehAdmin ? '' : 'none';
        const modale = document.getElementById('wipModal');
        if (modale) modale.style.display = 'flex';
    });
}

function _wipChiudiModale(procedi) {
    const modale = document.getElementById('wipModal');
    if (modale) modale.style.display = 'none';
    if (_wipResolveFn) { _wipResolveFn(!!procedi); _wipResolveFn = null; }
}
