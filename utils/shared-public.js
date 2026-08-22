// ── utils/shared-public.js ───────────────────────────────────────────────
// Funzioni identiche, byte per byte, tra scambio.html, sealed.html e
// wishlist.html (le 3 pagine pubbliche di condivisione) — prima triplicate,
// consolidate qui. Nessun accesso a Supabase, solo formattazione e la
// logica generica di selezione/totale che non dipende dalla RPC specifica
// di ciascuna pagina.
//
// Dipende da: le variabili globali `carte` e `selezioni` (definite nello
// state/*.state.js di ciascuna pagina) e dagli elementi DOM
// #conteggioSelezionate / #totaleSelezionate / #btnCopiaRiepilogo, comuni
// alle 3 pagine.

// Il campo 'immagine' può contenere tre formati diversi, a seconda di
// quando la carta è stata processata:
// 1. Link a Supabase Storage (nuovo, leggero — riconoscibile da
//    "supabase.co") → si usa direttamente.
// 2. Data URI base64 (vecchio formato, prima che passassimo a Storage) →
//    si usa direttamente, funziona comunque.
// 3. URL esterno grezzo di Cardmarket (carte processate PRIMA di qualunque
//    correzione) → Cardmarket lo blocca se richiesto da un altro dominio,
//    tentiamo il proxy come ripiego (funziona solo per alcune, meglio di
//    niente per lo storico).
function _urlImmagineVisualizzabile(immagine) {
    if (!immagine) return null;
    if (immagine.startsWith('data:') || immagine.includes('supabase.co')) return immagine;
    return `https://images.weserv.nl/?url=${encodeURIComponent(immagine)}&w=64`;
}

function formattaEuro(v) {
    return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function toggleSelezione(id, checked) {
    selezioni[id] = checked ? 1 : 0;
    renderLista();
    aggiornaTotale();
}

function modificaQty(id, delta) {
    const carta = carte.find(c => c.id === id);
    if (!carta) return;
    const attuale = selezioni[id] || 0;
    const nuova = Math.max(0, Math.min(carta.qtyDisponibile, attuale + delta));
    selezioni[id] = nuova;
    renderLista();
    aggiornaTotale();
}

function aggiornaTotale() {
    let totale = 0;
    let numCarte = 0;
    carte.forEach(c => {
        const q = selezioni[c.id] || 0;
        totale += q * c.price;
        numCarte += q;
    });
    document.getElementById('conteggioSelezionate').textContent =
        `${numCarte} cart${numCarte === 1 ? 'a selezionata' : 'e selezionate'}`;
    document.getElementById('totaleSelezionate').textContent = formattaEuro(totale);
    document.getElementById('btnCopiaRiepilogo').disabled = numCarte === 0;
}

// Applica lo stesso tema scelto dal proprietario sul proprio dispositivo —
// passato nell'URL (non c'è login qui, quindi niente localStorage da
// leggere). Ogni pagina la chiama esplicitamente subito prima di ogni
// altra cosa, per evitare un lampo del tema sbagliato (prima era una IIFE
// auto-eseguita in ciascun file, qui diventa una funzione nominata così è
// condivisibile — stesso identico comportamento, invocazione esplicita
// invece che implicita).
function applicaTemaCondiviso() {
    const params = new URLSearchParams(window.location.search);
    const tema = params.get('tema');
    if (tema === 'verde' || tema === 'pokemon') document.body.classList.add('theme-' + tema);
    if (params.get('scuro') === '1') document.body.classList.add('dark-mode');
}
