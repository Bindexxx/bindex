// Widget Estensione.

let _widgetEstensioneUltima = { quando: 0, versione: null };
async function _widgetEstensioneUltimaVersione() {
    if (_widgetEstensioneUltima.versione && Date.now() - _widgetEstensioneUltima.quando < 10 * 60 * 1000) return _widgetEstensioneUltima.versione;
    try {
        const r = await fetch('releases/latest-version.txt?t=' + Date.now(), { cache: 'no-store' });
        const testo = r.ok ? (await r.text()).trim() : '';
        if (testo) _widgetEstensioneUltima = { quando: Date.now(), versione: testo };
    } catch (_) {   }
    return _widgetEstensioneUltima.versione;
}

function _widgetEstensioneApriIstruzioni(aggiornamento) {
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _piattaformaNonWindows === 'function' && _piattaformaNonWindows()) { apriDettaglioWidget('impostazioni', null); return; }
    _versioneVecchiaRilevata = !!aggiornamento;
    if (_widgetEstensioneUltima.versione) _ultimaVersioneRichiesta = _widgetEstensioneUltima.versione;
    _apriPannelloCardsync();
    mostraIstruzioniInstallazione();
}

CATALOGO_WIDGET.estensione = {
        titolo: 'Estensione', icona: 'fa-link',
        preview: async () => {
            const versione = await _chiediVersioneEstensione();
            if (!versione) return { righe: ['non rilevata'], rilevata: false, dati: { rilevata: false } };
            const [aiutaGruppo, ultima] = await Promise.all([_chiediAiutaGruppoEstensione(), _widgetEstensioneUltimaVersione()]);
            const aggiornamento = !!(ultima && typeof versioneMaggioreSito === 'function' && versioneMaggioreSito(ultima, versione));
            return {
                righe: [aggiornamento ? `aggiornamento disponibile: v${ultima}` : `attiva · v${versione}`],
                stato: aiutaGruppo ? 'ok' : undefined,
                rilevata: true,
                dati: { rilevata: true, versione, aiutaGruppo: !!aiutaGruppo, ultima, aggiornamento },
            };
        },
        azione: async (dati, evt) => {
            if (dati && dati.rilevata) {
                await _mandaAperturaAppAEstensione();
            } else {
                apriDettaglioWidget('impostazioni', evt);
            }
        },
};
