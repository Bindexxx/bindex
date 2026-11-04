// Preferenze di questo dispositivo, in localStorage (quelle dell'account sono in
// user-settings.repository.js).

function prefMantieniAccessoGet() { return localStorage.getItem('cardsyncMantieniAccesso'); }
function prefMantieniAccessoSet(valore) { localStorage.setItem('cardsyncMantieniAccesso', valore); }

function prefSiteThemeGet() { return localStorage.getItem('siteTheme'); }
function prefSiteThemeSet(nome) { localStorage.setItem('siteTheme', nome); }

function prefColorePrincipaleGet() { return localStorage.getItem('cardsyncColorePrincipale'); }
function prefColorePrincipaleSet(hex) { localStorage.setItem('cardsyncColorePrincipale', hex); }
function prefColoreSecondarioGet() { return localStorage.getItem('cardsyncColoreSecondario'); }
function prefColoreSecondarioSet(hex) { localStorage.setItem('cardsyncColoreSecondario', hex); }

function prefDiametroWidgetGet() { const v = parseInt(localStorage.getItem('cardsyncDiametroWidget'), 10); return Number.isFinite(v) ? v : null; }
function prefDiametroWidgetSet(px) { localStorage.setItem('cardsyncDiametroWidget', String(px)); }

function prefDarkModeGet() { return localStorage.getItem('darkMode') === 'true'; }
function prefDarkModeSet(isDark) { localStorage.setItem('darkMode', isDark); }

function prefActiveTabGet() { return localStorage.getItem('activeTab'); }
function prefActiveTabSet(tabId) { localStorage.setItem('activeTab', tabId); }
function prefActiveTabClear() { localStorage.removeItem('activeTab'); }

function prefEntryDraftGet() { return localStorage.getItem('cardsync_entry_draft'); }
function prefEntryDraftSet(draftJson) { localStorage.setItem('cardsync_entry_draft', draftJson); }
function prefEntryDraftClear() { localStorage.removeItem('cardsync_entry_draft'); }

function prefMatchVistiGet() {
    try { return new Set(JSON.parse(localStorage.getItem('matchVisti') || '[]')); } catch (_) { return new Set(); }
}
function prefMatchVistiSet(visti) { localStorage.setItem('matchVisti', JSON.stringify([...visti])); }

function prefAlertPrezzoVistiGet() {
    try { return new Set(JSON.parse(localStorage.getItem('alertPrezzoVisti') || '[]')); } catch (_) { return new Set(); }
}
function prefAlertPrezzoVistiSet(visti) { localStorage.setItem('alertPrezzoVisti', JSON.stringify([...visti])); }

function prefBinderLayoutGet() { return localStorage.getItem(CHIAVE_BINDER_LAYOUT); }
function prefBinderLayoutSet(layout) { localStorage.setItem(CHIAVE_BINDER_LAYOUT, layout); }

function prefAmbitoPrezziGet() { return localStorage.getItem('cardsyncAmbitoPrezzi') === 'gruppo' ? 'gruppo' : 'soloMie'; }
function prefAmbitoPrezziSet(ambito) { localStorage.setItem('cardsyncAmbitoPrezzi', ambito === 'gruppo' ? 'gruppo' : 'soloMie'); }

function prefApriSempreAppGet() { return localStorage.getItem(CHIAVE_APRI_SEMPRE_APP) === 'true'; }
function prefApriSempreAppSet(attivo) { localStorage.setItem(CHIAVE_APRI_SEMPRE_APP, attivo ? 'true' : 'false'); }

function prefSidebarCompressaGet() { return localStorage.getItem(CHIAVE_SIDEBAR_COMPRESSA) === 'true'; }
function prefSidebarCompressaSet(compressa) { localStorage.setItem(CHIAVE_SIDEBAR_COMPRESSA, compressa ? 'true' : 'false'); }

function prefRiduciAnimazioniGet() { return localStorage.getItem(CHIAVE_RIDUCI_ANIMAZIONI) === 'true'; }
function prefRiduciAnimazioniSet(ridotte) { localStorage.setItem(CHIAVE_RIDUCI_ANIMAZIONI, ridotte ? 'true' : 'false'); }

function prefWidgetLayoutGet(userId) { return localStorage.getItem('cardsyncWidgetLayout_' + userId); }
function prefWidgetLayoutSet(userId, layoutJson) { localStorage.setItem('cardsyncWidgetLayout_' + userId, layoutJson); }
function prefWidgetLayoutRemove(userId) { localStorage.removeItem('cardsyncWidgetLayout_' + userId); }

function prefSuoniWidgetGet() { const v = localStorage.getItem('cardsyncSuoniWidget'); return v === null ? true : v === 'true'; }
function prefSuoniWidgetSet(attivi) { localStorage.setItem('cardsyncSuoniWidget', attivi ? 'true' : 'false'); }

function prefAnimWidgetGet() { const v = localStorage.getItem('cardsyncAnimWidget'); return v === null ? true : v === 'true'; }
function prefAnimWidgetSet(attive) { localStorage.setItem('cardsyncAnimWidget', attive ? 'true' : 'false'); }

function prefAnimCatturaGet() { const v = localStorage.getItem('cardsyncAnimCattura'); return v === null ? true : v === 'true'; }
function prefAnimCatturaSet(attiva) { localStorage.setItem('cardsyncAnimCattura', attiva ? 'true' : 'false'); }

function prefScritteBallGet() { const v = localStorage.getItem('cardsyncScritteBall'); return v === null ? true : v === 'true'; }
function prefScritteBallSet(attive) { localStorage.setItem('cardsyncScritteBall', attive ? 'true' : 'false'); }

function prefBadgeWidgetGet() { const v = localStorage.getItem('cardsyncBadgeWidget'); return v === null ? true : v === 'true'; }
function prefBadgeWidgetSet(attivo) { localStorage.setItem('cardsyncBadgeWidget', attivo ? 'true' : 'false'); }

function prefBadgeStileGet() { return localStorage.getItem('cardsyncBadgeStile') === 'pallino' ? 'pallino' : 'numero'; }
function prefBadgeStileSet(stile) { localStorage.setItem('cardsyncBadgeStile', stile === 'pallino' ? 'pallino' : 'numero'); }

const _PREF_SCORCIATOIE_DEFAULT = ['suoni', 'modifica-home'];
function prefScorciatoieGet() {
    try {
        const v = JSON.parse(localStorage.getItem('cardsyncScorciatoie') || 'null');
        return Array.isArray(v) ? v.filter(x => typeof x === 'string') : _PREF_SCORCIATOIE_DEFAULT.slice();
    } catch (_) { return _PREF_SCORCIATOIE_DEFAULT.slice(); }
}
function prefScorciatoieSet(ids) { localStorage.setItem('cardsyncScorciatoie', JSON.stringify(ids || [])); }

function prefBannerGet() { const v = localStorage.getItem('cardsyncBanner'); return ['tutti', 'azioni', 'nessuno'].includes(v) ? v : 'azioni'; }
function prefBannerSet(modo) { localStorage.setItem('cardsyncBanner', modo); }

function prefBannerPosGet() { return localStorage.getItem('cardsyncBannerPos') === 'basso' ? 'basso' : 'alto'; }
function prefBannerPosSet(pos) { localStorage.setItem('cardsyncBannerPos', pos === 'basso' ? 'basso' : 'alto'); }

const CHIAVE_FILTRI_PAGINE = 'bindexFiltriPagine';
function prefFiltroPaginaGet(pagina, chiave) {
    try {
        const tutti = JSON.parse(localStorage.getItem(CHIAVE_FILTRI_PAGINE) || '{}');
        const v = tutti && tutti[pagina] ? tutti[pagina][chiave] : undefined;
        return v === undefined ? null : v;
    } catch (_) { return null; }
}
function prefFiltroPaginaSet(pagina, chiave, valore) {
    try {
        const tutti = JSON.parse(localStorage.getItem(CHIAVE_FILTRI_PAGINE) || '{}') || {};
        if (!tutti[pagina] || typeof tutti[pagina] !== 'object') tutti[pagina] = {};
        tutti[pagina][chiave] = valore;
        localStorage.setItem(CHIAVE_FILTRI_PAGINE, JSON.stringify(tutti));
    } catch (_) {   }
}
function prefFiltroPaginaScegli(pagina, chiave, ammessi, predefinito) {
    const v = prefFiltroPaginaGet(pagina, chiave);
    return ammessi.includes(v) ? v : predefinito;
}

const CHIAVE_RARITA_CARTE = 'bindexRaritaCarte';
function prefRaritaCacheGet() {
    try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_RARITA_CARTE) || '{}');
        return v && typeof v === 'object' ? v : {};
    } catch (_) { return {}; }
}
function prefRaritaCacheSet(obj) {
    try { localStorage.setItem(CHIAVE_RARITA_CARTE, JSON.stringify(obj)); }
    catch (_) {   }
}
