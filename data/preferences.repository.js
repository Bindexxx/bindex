// ── data/preferences.repository.js ───────────────────────────────────────
// Preferenze locali PER-DISPOSITIVO, salvate in localStorage — non
// sincronizzano tra dispositivi (per quelle vedi data/user-settings.
// repository.js, tabella 'preferenze_utente'). Stesse identiche chiavi e
// stessi identici valori del codice originale: nessuna chiave rinominata,
// nessun valore cambiato, solo le ~28 chiamate sparse localStorage.getItem/
// setItem/removeItem raccolte in un solo punto con nomi leggibili.

function prefMantieniAccessoGet() { return localStorage.getItem('cardsyncMantieniAccesso'); }
function prefMantieniAccessoSet(valore) { localStorage.setItem('cardsyncMantieniAccesso', valore); }

function prefSiteThemeGet() { return localStorage.getItem('siteTheme'); }
function prefSiteThemeSet(nome) { localStorage.setItem('siteTheme', nome); }

function prefDarkModeGet() { return localStorage.getItem('darkMode') === 'true'; }
function prefDarkModeSet(isDark) { localStorage.setItem('darkMode', isDark); }

function prefActiveTabGet() { return localStorage.getItem('activeTab'); }
function prefActiveTabSet(tabId) { localStorage.setItem('activeTab', tabId); }

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

// Le chiavi qui sotto (CHIAVE_BINDER_LAYOUT, CHIAVE_APRI_SEMPRE_APP,
// CHIAVE_SIDEBAR_COMPRESSA, CHIAVE_RIDUCI_ANIMAZIONI) sono costanti definite
// negli state/*.js — usate qui solo dentro corpi di funzione, quindi
// l'ordine di caricamento tra questo file e gli state/*.js non è
// vincolante (risolte al momento della chiamata, non della definizione).
function prefBinderLayoutGet() { return localStorage.getItem(CHIAVE_BINDER_LAYOUT); }
function prefBinderLayoutSet(layout) { localStorage.setItem(CHIAVE_BINDER_LAYOUT, layout); }

function prefApriSempreAppGet() { return localStorage.getItem(CHIAVE_APRI_SEMPRE_APP) === 'true'; }
function prefApriSempreAppSet(attivo) { localStorage.setItem(CHIAVE_APRI_SEMPRE_APP, attivo ? 'true' : 'false'); }

function prefSidebarCompressaGet() { return localStorage.getItem(CHIAVE_SIDEBAR_COMPRESSA) === 'true'; }
function prefSidebarCompressaSet(compressa) { localStorage.setItem(CHIAVE_SIDEBAR_COMPRESSA, compressa ? 'true' : 'false'); }

function prefRiduciAnimazioniGet() { return localStorage.getItem(CHIAVE_RIDUCI_ANIMAZIONI) === 'true'; }
function prefRiduciAnimazioniSet(ridotte) { localStorage.setItem(CHIAVE_RIDUCI_ANIMAZIONI, ridotte ? 'true' : 'false'); }
