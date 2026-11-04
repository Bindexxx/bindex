// Widget Inserimento.

let _widgetInserimentoCache = null;
async function _widgetInserimentoCoda() {
    if (_widgetInserimentoCache && Date.now() - _widgetInserimentoCache.quando < 30000) return _widgetInserimentoCache.dati;
    const userId = await authGetUserId();
    if (!userId) return null;
    const { data, error } = await codaCarteUltimeRighe(userId, 50);
    if (error) { console.error('[widget-inserimento] coda:', error.message); return null; }
    const righe = data || [];
    const conta = async (opz, daRighe) => {
        const { count, error: e } = await codaCarteConta(userId, opz);
        return e ? daRighe() : count;
    };
    const attive = ['pending', 'in_corso'];
    const inCoda = await conta({ stati: attive }, () => righe.filter(r => attive.includes(r.stato)).length);
    let ultimoInvio = null;
    if (righe.length) {
        const t0 = new Date(righe[0].creato_il).getTime();
        const da = new Date(t0 - 10 * 60 * 1000).toISOString();
        const invio = righe.filter(r => t0 - new Date(r.creato_il).getTime() <= 10 * 60 * 1000);
        const [quante, trovate, errori, inCorso] = await Promise.all([
            conta({ da }, () => invio.length),
            conta({ da, stati: ['completato'] }, () => invio.filter(r => r.stato === 'completato').length),
            conta({ da, stati: ['errore'] }, () => invio.filter(r => r.stato === 'errore').length),
            conta({ da, stati: attive }, () => invio.filter(r => attive.includes(r.stato)).length),
        ]);
        ultimoInvio = { quante, quando: righe[0].creato_il, trovate, errori, inCorso };
    }
    const dati = { inCoda, ultimoInvio };
    _widgetInserimentoCache = { quando: Date.now(), dati };
    return dati;
}

CATALOGO_WIDGET.inserimento = {
        titolo: 'Inserimento', icona: 'fa-id-card',
        preview: async () => {
            const n = await _contaCodaErrori();
            const coda = await _widgetInserimentoCoda();
            if (!coda && !n) return { righe: ['—'] };
            const inCoda = coda ? coda.inCoda : 0;
            let stato = n > 0 ? `${n} da correggere` : (inCoda > 0 ? `${inCoda} in coda` : 'tutto inviato');
            return {
                righe: [stato],
                stato: n > 0 ? 'allerta' : 'ok',
                azioni: n,
                dati: { daCorreggere: n, inCoda, ultimoInvio: coda ? coda.ultimoInvio : null },
            };
        },
};
