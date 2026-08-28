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
// Aggiunta 26/08/2026: usata dal logout per non far ritrovare al prossimo
// che accede su questo dispositivo (condiviso tra il gruppo) la stessa
// schermata di chi ha appena fatto logout. Stesso idioma di
// prefEntryDraftClear() qui sotto.
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

// Layout della home a widget (cornice "smartphone", sessione 2026-08-23):
// ordine + visibilità dei widget, per-dispositivo come le altre preferenze
// qui sopra — NON sincronizzato tra dispositivi. Valore: JSON di
// [{id, visibile}]. Vedi ui/phone.ui.js per lettura/scrittura.
function prefWidgetLayoutGet() { return localStorage.getItem('cardsyncWidgetLayout'); }
function prefWidgetLayoutSet(layoutJson) { localStorage.setItem('cardsyncWidgetLayout', layoutJson); }

// Suoni retro leggeri della home a widget (apertura/chiusura dettaglio,
// notifiche push) — per-dispositivo come le altre, default attivi ma
// disattivabili con un tap (bottone altoparlante in home).
function prefSuoniWidgetGet() { const v = localStorage.getItem('cardsyncSuoniWidget'); return v === null ? true : v === 'true'; }
function prefSuoniWidgetSet(attivi) { localStorage.setItem('cardsyncSuoniWidget', attivi ? 'true' : 'false'); }

// ── GRAFICA POKÉ BALL DEI WIDGET (sessione 2026-08-27) ───────────────────
// Quattro preferenze per-dispositivo, chiavi letterali qui dentro come
// 'cardsyncWidgetLayout'/'cardsyncSuoniWidget' qui sopra — di proposito NON
// usano costanti da state/*.js, così questo file resta l'unico da toccare.
//
// NOTA: esiste già prefRiduciAnimazioni() qui sopra, ma governa un'altra
// cosa (il flash colorato sul prezzo quando lo modifichi — vedi il commento
// sul toggle in index.html, riga ~3353). Le due cose sono tenute separate
// apposta: chi vuole i prezzi senza flash non è detto voglia anche i widget
// immobili. Se un giorno le vorrai unificate, basta far leggere a queste
// la stessa chiave.

// Spegne TUTTE le animazioni dei widget: cattura, semaforo (scosse e punti
// esclamativi), cascata d'ingresso. Default: animazioni attive.
function prefAnimWidgetGet() { const v = localStorage.getItem('cardsyncAnimWidget'); return v === null ? true : v === 'true'; }
function prefAnimWidgetSet(attive) { localStorage.setItem('cardsyncAnimWidget', attive ? 'true' : 'false'); }

// Spegne SOLO l'animazione di cattura (~2,6s all'apertura di un widget),
// lasciando vivo il semaforo. Default: cattura attiva.
function prefAnimCatturaGet() { const v = localStorage.getItem('cardsyncAnimCattura'); return v === null ? true : v === 'true'; }
function prefAnimCatturaSet(attiva) { localStorage.setItem('cardsyncAnimCattura', attiva ? 'true' : 'false'); }

// Scritte incise sulla pancia della ball (solo widget 1x1). Spente, restano
// le ball nude: il titolo si legge comunque nella pagina che si apre.
function prefScritteBallGet() { const v = localStorage.getItem('cardsyncScritteBall'); return v === null ? true : v === 'true'; }
function prefScritteBallSet(attive) { localStorage.setItem('cardsyncScritteBall', attive ? 'true' : 'false'); }

// Badge numerico in alto a destra sulla tessera. Su 1x1 ripete il dato già
// inciso nella pancia, quindi qualcuno lo vorrà spento.
function prefBadgeWidgetGet() { const v = localStorage.getItem('cardsyncBadgeWidget'); return v === null ? true : v === 'true'; }
function prefBadgeWidgetSet(attivo) { localStorage.setItem('cardsyncBadgeWidget', attivo ? 'true' : 'false'); }
