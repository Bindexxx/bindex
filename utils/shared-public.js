// Funzioni comuni alle pagine pubbliche (accesso minimo, richiesta di scambio).

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
    let numDistinte = 0;
    carte.forEach(c => {
        const q = selezioni[c.id] || 0;
        totale += q * c.price;
        numCarte += q;
        if (q > 0) numDistinte++;
    });
    document.getElementById('conteggioSelezionate').textContent =
        (typeof _testoConteggioSelezione === 'function')
            ? _testoConteggioSelezione(numDistinte, numCarte)
            : `${numCarte} cart${numCarte === 1 ? 'a selezionata' : 'e selezionate'}`;
    document.getElementById('totaleSelezionate').textContent = formattaEuro(totale);
    document.getElementById('btnCopiaRiepilogo').disabled = numCarte === 0;
    const btnRichiedi = document.getElementById('btnRichiediScambio');
    if (btnRichiedi) btnRichiedi.disabled = numCarte === 0;
}

function applicaTemaCondiviso() {
    const params = new URLSearchParams(window.location.search);
    const tema = params.get('tema');
    if (tema === 'verde' || tema === 'pokemon') document.body.classList.add('theme-' + tema);
    if (params.get('scuro') === '1') document.body.classList.add('dark-mode');
}

let _tipoOggettoRichiesta = 'carta';
let _proprietarioIdRichiestaPendente = null;

async function _sessionePubblicoAttiva() {
    return pubblicoSessioneUtente();
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
    // AMBIENTE DI TEST: il nome da solo si completa con @test.local. In produzione
    // '@cardsyncpro.local', insieme agli altri punti marcati così (sito ed estensione)
    // e a sql/110_..._ROLLBACK.sql.
    const email = inputUtente.includes('@') ? inputUtente : `${inputUtente.toLowerCase()}@test.local`;
    btn.disabled = true;
    btn.textContent = 'Accesso in corso…';

    const { error } = await pubblicoLogin(email, password);

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

async function avviaRichiestaScambio(proprietarioId) {
    _proprietarioIdRichiestaPendente = proprietarioId;
    const utente = await _sessionePubblicoAttiva();
    if (!utente) {
        if (typeof apriSceltaRichiesta === 'function') apriSceltaRichiesta(proprietarioId);
        else apriLoginPubblico();
        return;
    }
    await _richiediScambioDopoLogin();
}

async function _richiediScambioDopoLogin() {
    const proprietarioId = _proprietarioIdRichiestaPendente;
    if (!proprietarioId) return;

    const righe = [];
    carte.forEach(p => {
        const q = selezioni[p.id] || 0;
        if (q > 0) righe.push({ tipo: _tipoOggettoRichiesta, oggetto_id: p.id, quantita: q });
    });
    if (righe.length === 0) { alert('Seleziona almeno un elemento prima di richiedere.'); return; }

    const btn = document.getElementById('btnRichiediScambio');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio...'; }

    const { error } = await pubblicoInviaRichiestaScambio(proprietarioId, righe);

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Richiedi'; }

    if (error) { alert('❌ ' + error.message); return; }

    alert('✅ Richiesta inviata! Il proprietario la vedrà nella sua pagina Richieste su Bindex.');
    Object.keys(selezioni).forEach(k => { delete selezioni[k]; });
    if (typeof renderLista === 'function') renderLista();
    if (typeof aggiornaTotale === 'function') aggiornaTotale();
}
