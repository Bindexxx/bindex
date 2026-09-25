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

// _urlImmagineSicura, _urlImmagineVisualizzabile, formattaEuro, escapeHtml:
// SPOSTATE in utils/comuni.js il 2026-09-25 (prima erano copie di quelle
// di utils/formatters.js da tenere allineate a mano; ora una copia sola,
// caricata prima di questo file).

function toggleSelezione(id, checked) {
    selezioni[id] = checked ? 1 : 0;
    _refreshVistaCorrente();
    aggiornaTotale();
}

function modificaQty(id, delta) {
    const carta = carte.find(c => c.id === id);
    if (!carta) return;
    const attuale = selezioni[id] || 0;
    const nuova = Math.max(0, Math.min(carta.qtyDisponibile, attuale + delta));
    selezioni[id] = nuova;
    _refreshVistaCorrente();
    aggiornaTotale();
}

// Fix 26/08/2026: con l'introduzione della selezione anche dentro il libro
// sfogliabile (scambio.html/wishlist.html), un cambio di selezione deve
// aggiornare la vista ATTIVA — se è il libro, ridisegnare la pagina
// corrente (_libroDisegnaStatico), non la lista nascosta. Pagine senza
// libro (sealed.html, che usa questo stesso file) o senza selezione
// (binder-pubblico.html) non hanno _modalita/_libro definiti: i controlli
// typeof le lasciano sul vecchio comportamento (renderLista), nessuna
// regressione per loro.
function _refreshVistaCorrente() {
    if (typeof _modalita !== 'undefined' && _modalita === 'libro'
        && typeof _libro !== 'undefined' && _libro
        && typeof _libroDisegnaStatico === 'function') {
        _libroDisegnaStatico();
    } else {
        renderLista();
    }
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
    // Fase 4, Step 4 (2026-09-13): bottone "Richiedi" — presente solo su
    // binder-pubblico.html/scaffali-pubblico.html (tipo='scambio'), assente
    // su wishlist.html/sealed.html/scambio.html — guardia esplicita perché
    // questa funzione è condivisa da tutte.
    const btnRichiedi = document.getElementById('btnRichiediScambio');
    if (btnRichiedi) btnRichiedi.disabled = numCarte === 0;
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


// ── Richiesta di scambio — Fase 4, Step 4 (2026-09-13) ───────────────────
// Condivisa tra binder-pubblico.ui.js (tipo 'carta') e
// scaffali-pubblico.ui.js (tipo 'sealed') — la pagina imposta
// _tipoOggettoRichiesta prima di usare queste funzioni. Login minimo
// necessario: queste pagine sono ANONIME di default (nessuna sessione,
// vedi `persistSession: false` in ciascun HTML), ma invia_richiesta_scambio
// richiede auth.uid() non nullo — stesso schema di login di ui/auth.ui.js
// (username → username@cardsyncpro.local dietro le quinte), riscritto qui
// perché data/auth.repository.js non è caricato in queste pagine e non
// vale la pena aggiungerlo solo per una chiamata.
let _tipoOggettoRichiesta = 'carta';
let _proprietarioIdRichiestaPendente = null;

async function _sessionePubblicoAttiva() {
    return pubblicoSessioneUtente(); // data/pubblico.repository.js (audit 2026-09-25, B8)
}

function apriLoginPubblico() {
    const modal = document.getElementById('loginPubblicoModal');
    if (!modal) return;
    document.getElementById('loginPubblicoErrore').style.display = 'none';
    modal.style.display = 'flex';
}

function chiudiLoginPubblico() {
    const modal = document.getElementById('loginPubblicoModal');
    if (modal) modal.style.display = 'none';
}

async function tentaLoginPubblico() {
    const inputUtente = document.getElementById('loginPubblicoUtente').value.trim();
    const password = document.getElementById('loginPubblicoPassword').value;
    const errEl = document.getElementById('loginPubblicoErrore');
    const btn = document.getElementById('loginPubblicoSubmit');
    if (!inputUtente || !password) {
        errEl.textContent = 'Inserisci nome utente e password.';
        errEl.style.display = 'block';
        return;
    }
    const email = inputUtente.includes('@') ? inputUtente : `${inputUtente.toLowerCase()}@cardsyncpro.local`;
    btn.disabled = true;
    btn.textContent = 'Accesso in corso…';

    const { error } = await pubblicoLogin(email, password); // data/pubblico.repository.js

    btn.disabled = false;
    btn.textContent = 'Accedi';
    if (error) {
        errEl.textContent = '❌ ' + (error.message === 'Invalid login credentials' ? 'Nome utente o password errati.' : error.message);
        errEl.style.display = 'block';
        return;
    }
    chiudiLoginPubblico();
    await _richiediScambioDopoLogin();
}

// Punto di ingresso chiamato dal bottone "Richiedi" di entrambe le pagine —
// se non c'è sessione attiva apre il login e riprende da sola dopo,
// altrimenti procede subito.
async function avviaRichiestaScambio(proprietarioId) {
    _proprietarioIdRichiestaPendente = proprietarioId;
    const utente = await _sessionePubblicoAttiva();
    if (!utente) { apriLoginPubblico(); return; }
    await _richiediScambioDopoLogin();
}

async function _richiediScambioDopoLogin() {
    const proprietarioId = _proprietarioIdRichiestaPendente;
    if (!proprietarioId) return;

    // `carte`/`selezioni` sono le stesse variabili globali già usate da
    // toggleSelezione/modificaQty/aggiornaTotale sopra — qualunque sia il
    // dominio reale (carte o prodotti sealed), il nome resta quello per
    // riuso diretto di queste funzioni condivise.
    const righe = [];
    carte.forEach(p => {
        const q = selezioni[p.id] || 0;
        if (q > 0) righe.push({ tipo: _tipoOggettoRichiesta, oggetto_id: p.id, quantita: q });
    });
    if (righe.length === 0) { alert('Seleziona almeno un elemento prima di richiedere.'); return; }

    const btn = document.getElementById('btnRichiediScambio');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio...'; }

    const { error } = await pubblicoInviaRichiestaScambio(proprietarioId, righe); // data/pubblico.repository.js

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Richiedi'; }

    if (error) { alert('❌ ' + error.message); return; }

    alert('✅ Richiesta inviata! Il proprietario la vedrà nella sua pagina Richieste su CardSync Pro.');
    // Svuotata SUL POSTO invece di "selezioni = {}" (audit 2026-09-25, B3):
    // in sealed.html/wishlist.html/scambio.html selezioni è una const
    // (state/*.state.js), e riassegnarla lanciava un TypeError dopo
    // l'invio riuscito. Funziona identico anche dove è let.
    Object.keys(selezioni).forEach(k => { delete selezioni[k]; });
    if (typeof renderLista === 'function') renderLista();
    if (typeof aggiornaTotale === 'function') aggiornaTotale();
}

