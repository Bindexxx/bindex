// Istantanea giornaliera del valore della collezione, una volta per sessione.

const RITARDO_ISTANTANEA_VALORE_MS = 25000;
const RIPROVE_ISTANTANEA_VALORE = 6;
const PAUSA_RIPROVA_ISTANTANEA_MS = 15000;

let _istantaneaValoreFatta = false;
let _riproveIstantaneaValore = 0;

async function _provaIstantaneaValore() {
    if (_istantaneaValoreFatta) return;

    if (typeof storicoValoreRegistraOggi !== 'function') return;
    if (typeof authGetUserId !== 'function') return;

    const riprova = () => {
        if (_riproveIstantaneaValore++ < RIPROVE_ISTANTANEA_VALORE) {
            setTimeout(_provaIstantaneaValore, PAUSA_RIPROVA_ISTANTANEA_MS);
        }
    };

    try {
        const userId = await authGetUserId();
        if (!userId) return riprova();

        if (typeof carteReali === 'undefined' || !carteReali.length) return riprova();

        await storicoValoreRegistraOggi(userId);
        _istantaneaValoreFatta = true;
    } catch (e) {
        console.error('[storico valore] istantanea di avvio:', e);
        riprova();
    }
}

window.addEventListener('load', () => {
    setTimeout(_provaIstantaneaValore, RITARDO_ISTANTANEA_VALORE_MS);
});
