// ═══════════════════════════════════════════════════════════════════════
// WIDGET-ESTENSIONE.UI.JS — tessera "Estensione" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 9 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA C: nessuna pagina propria — il click porta l'estensione in
// primo piano (se rilevata) o apre il pannello Impostazioni già esistente
// (se non rilevata, per mostrare le istruzioni d'installazione). Per
// questo il file contiene SOLO la voce di catalogo, nessun'altra funzione:
// _chiediVersioneEstensione(), _chiediAiutaGruppoEstensione() e
// _mandaAperturaAppAEstensione() sono esterne (ui/extension.ui.js, non
// toccato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget('impostazioni', evt) (ui/paginainiziale.ui.js) —
//   motore home, dispatch generico, non toccato in questo step.
// - _ballCORPI.estensione / _ballASPETTO.estensione / _ballTITOLI_BREVI
//   .estensione (ui/widget-render-condiviso.ui.js) — motore visivo, non
//   toccato. Verificato anche il caso speciale in quel file (riga ~593,
//   modalità icona forzata quando anteprima.rilevata === false): legge lo
//   stesso campo 'rilevata' restituito dal preview() qui sotto, forma
//   confermata coerente.
// ───────────────────────────────────────────────────────────────────────

// Ultima versione pubblicata (releases/latest-version.txt), letta al
// massimo ogni 10 minuti: il render della home gira ogni 15s. È un file
// statico dello stesso sito, non Supabase.
let _widgetEstensioneUltima = { quando: 0, versione: null };
async function _widgetEstensioneUltimaVersione() {
    if (_widgetEstensioneUltima.versione && Date.now() - _widgetEstensioneUltima.quando < 10 * 60 * 1000) return _widgetEstensioneUltima.versione;
    try {
        const r = await fetch('releases/latest-version.txt?t=' + Date.now(), { cache: 'no-store' });
        const testo = r.ok ? (await r.text()).trim() : '';
        if (testo) _widgetEstensioneUltima = { quando: Date.now(), versione: testo };
    } catch (_) { /* rete assente: nessun avviso, meglio che uno falso */ }
    return _widgetEstensioneUltima.versione;
}

// "Aggiorna" / "Come installarla" dalla tessera: le STESSE istruzioni del
// pannello d'ingresso (comando che scarica releases/aggiorna_cardsync.bat,
// mostraIstruzioniInstallazione in ui/extension.ui.js), non un flusso nuovo.
// Su un dispositivo non Windows lo script non gira: lì si apre Impostazioni.
function _widgetEstensioneApriIstruzioni(aggiornamento) {
    if (typeof _editModeWidget !== 'undefined' && _editModeWidget) return;
    if (typeof _piattaformaNonWindows === 'function' && _piattaformaNonWindows()) { apriDettaglioWidget('impostazioni', null); return; }
    _versioneVecchiaRilevata = !!aggiornamento;
    if (_widgetEstensioneUltima.versione) _ultimaVersioneRichiesta = _widgetEstensioneUltima.versione;
    _apriPannelloCardsync();
    mostraIstruzioniInstallazione();
}

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // Sbloccato (Claudio, 2026-08-27): extension.ui.js letto per intero in
    // questa sessione. _chiediVersioneEstensione()/_chiediAiutaGruppoEstensione()
    // già esistenti lì, stessa tolleranza timeout (1.2s, mai blocca il
    // render della home) delle altre chiamate verso l'estensione — zero
    // query nuove, stessa filosofia degli altri widget.
CATALOGO_WIDGET.estensione = {
        titolo: 'Estensione', icona: 'fa-link',
        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Estensione"): confronto
        // con releases/latest-version.txt per "Aggiornamento disponibile",
        // stessa regola di controlloIngressoCardsync (ui/extension.ui.js).
        // La versione "su questo computer" è quella che l'estensione stessa
        // risponde (CARDSYNC_GET_VERSION): il sito la riceve davvero.
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
        // Click: porta l'estensione in primo piano (stessa funzione già
        // usata dal bottone "Apri l'app" in sidebar — vedi
        // _mandaAperturaAppAEstensione in extension.ui.js). Se non
        // rilevata, apre Impostazioni invece: lì ci sono le istruzioni
        // d'installazione, non ha senso provare ad "aprire" qualcosa che
        // non c'è.
        azione: async (dati, evt) => {
            if (dati && dati.rilevata) {
                await _mandaAperturaAppAEstensione();
            } else {
                apriDettaglioWidget('impostazioni', evt);
            }
        },
};
