// ═══════════════════════════════════════════════════════════════════════
// WIDGET-CONDIVIDI.UI.JS — pagina "Condividi" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 5 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria (elenco di tutto il condivisibile reale —
// binder pubblici + Sealed — con pannello link/QR/condivisione nativa).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaCondividi() per tabId === 'condividi' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballTITOLI_BREVI.condividi / _ballASPETTO.condividi
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Nessuna voce in _ballCORPI: questo widget non ha corpo grande
//   dedicato, ricade sul corpo generico (comportamento pre-esistente,
//   non cambiato).
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.condividi = {
        titolo: 'Condividi', icona: 'fa-share-nodes',
        // Pagina dedicata costruita 2026-08-28 — prima forzava
        // arbitrariamente currentMode='scambio' (unica scelta possibile
        // dato che openQrModal dipende dallo stato globale di navigazione,
        // non da un binder scelto). Ora elenca tutto il condivisibile
        // reale (tutti i binder pubblici + Sealed), non solo Scambio.
        preview: () => ({ righe: ['Cosa vuoi condividere?'] }),
        azione: (dati, punto) => { apriDettaglioWidget('condividi', punto); },
};

// ── PAGINA "CONDIVIDI" ────────────────────────────────────────────────
// Elenca tutto il condivisibile reale: ogni binder pubblico (Scambio,
// Wishlist, altre location, extra) più Sealed, che non è un binder — vive
// nel suo currentMode a parte in navigation.ui.js. Click su una riga →
// pannello con link/QR/condivisione nativa per QUELLA cosa, sostituendo
// la vecchia scelta arbitraria "solo Scambio".
async function renderPaginaCondividi() {
    const container = document.getElementById('condividiLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    document.getElementById('condividiPannelloShare').style.display = 'none';

    // apriWidgetBinders() è la stessa funzione già riusata altrove (vedi
    // home.ui.js) per garantire _bindersElenco senza dover navigare via —
    // qui restiamo sulla pagina Condividi, non su Binders.
    if (!Array.isArray(_bindersElenco) || _bindersElenco.length === 0) {
        try { await apriWidgetBinders(); } catch (e) { console.error('renderPaginaCondividi: caricamento binder:', e); }
    }

    const pubblici = (Array.isArray(_bindersElenco) ? _bindersElenco : [])
        .filter(b => b.stato_pubblicazione === 'pubblico');

    const iconaPerTipo = { wishlist: 'fa-heart', location: 'fa-layer-group', extra: 'fa-box-archive' };
    const righeBinder = pubblici.map(b => `
        <div class="pg-riga" data-tocca onclick="_condividiElementoWidget('binder-pubblico.html', '${b.id}', '${b.tipo}', event)">
            <div class="pg-fig" style="display:flex; align-items:center; justify-content:center;"><i class="fa-solid ${iconaPerTipo[b.tipo] || 'fa-layer-group'}"></i></div>
            <div class="pg-testo"><b>${escapeHtml(b.nome || b.location_valore || b.tipo)}</b></div>
            <i class="fa-solid fa-share-nodes" style="color:var(--text-muted);"></i>
        </div>`).join('');

    // Sealed non è un binder (verificato: nessuna riga con tipo='sealed'
    // nello schema — vive in un currentMode a parte), quindi riga fissa,
    // nessun binderId da passare.
    const rigaSealed = `
        <div class="pg-riga" data-tocca onclick="_condividiElementoWidget('sealed.html', null, null, event)">
            <div class="pg-fig" style="display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-box"></i></div>
            <div class="pg-testo"><b>Sealed</b></div>
            <i class="fa-solid fa-share-nodes" style="color:var(--text-muted);"></i>
        </div>`;

    container.innerHTML = `<div class="pg-elenco">${righeBinder + rigaSealed}</div>`;
}

// Stessa identica logica di costruzione URL di _linkPubblicoCondivisione
// (navigation.ui.js) — duplicata qui apposta invece di refactorizzare
// quella funzione: lei legge lo stato globale di navigazione (currentMode/
// _binderAttivo, "il binder che hai aperto ORA"), qui invece serve il
// link per un binder scelto da una lista, senza navigarci dentro. File
// diverso, stesso comportamento — Regola d'Oro #1 (duplicazione locale
// invece di refactoring cross-file).
async function _linkCondivisioneWidget(pagina, binderId, tipoBinder) {
    const sessione = await authGetSession();
    const userId = sessione?.user?.id;
    if (!userId) return null;
    const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
    if (binderId) url.searchParams.set('binder', binderId);
    const temaSalvato = prefSiteThemeGet();
    if (temaSalvato) url.searchParams.set('tema', temaSalvato);
    if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
    if (tipoBinder === 'wishlist' && sessione?.user?.email) {
        url.searchParams.set('nome', _nomeDaEmail(sessione.user.email));
    }
    return url.href;
}

let _condividiLinkCorrente = null;

async function _condividiElementoWidget(pagina, binderId, tipoBinder, evt) {
    if (evt) evt.stopPropagation();
    const link = await _linkCondivisioneWidget(pagina, binderId, tipoBinder);
    if (!link) { alert('Devi essere loggato per condividere.'); return; }
    _condividiLinkCorrente = link;

    document.getElementById('condividiLinkInput').value = link;
    const qrContainer = document.getElementById('condividiQrContainer');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: link, width: 160, height: 160, colorDark: '#2a2438', colorLight: '#ffffff' });

    // Missione #29 "QR Hunter" (2026-08-30). Fire-and-forget, stesso
    // pattern degli altri hook missioni — un fallimento qui non deve mai
    // bloccare la generazione del QR, già avvenuta sopra.
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniQrGeneratoRegistra(userId);
        } catch (e) { console.error('[missioni] registrazione QR generato:', e); }
    })();

    // Stesso criterio di navigation.ui.js: il pulsante nativo compare solo
    // dove il browser lo supporta davvero, niente pulsante rotto altrove.
    document.getElementById('condividiBtnNativo').style.display = navigator.share ? 'block' : 'none';
    document.getElementById('condividiPannelloShare').style.display = 'block';
}

async function _copiaLinkCondividiWidget() {
    if (!_condividiLinkCorrente) return;
    try {
        await navigator.clipboard.writeText(_condividiLinkCorrente);
        alert('Link copiato negli appunti!');
    } catch (e) {
        prompt('Copia questo link:', _condividiLinkCorrente);
    }
}

async function _condividiNativoWidget() {
    if (!_condividiLinkCorrente) return;
    try { await navigator.share({ title: 'CardSync Pro', url: _condividiLinkCorrente }); }
    catch (e) { /* utente ha annullato, o browser l'ha bloccata — normale, nessun errore da mostrare */ }
}
