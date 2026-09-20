// ═══════════════════════════════════════════════════════════════════════
// WIDGET-LOCATION.UI.JS — tessera + pagina "Location" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 11 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: pagina propria che unisce due fonti (location USATE da
// preview(), da carteReali — zero query nuove — e TUTTE le location via
// locationsList(), incluse quelle senza ancora nessuna carta). Include
// anche "+ Aggiungi" (_locationAggiungi) e "✕ Rimuovi" (_locationRimuovi,
// bloccata se la location ha ancora carte assegnate).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaLocation() per tabId === 'location' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballCORPI.location / _ballASPETTO.location / _ballTITOLI_BREVI
//   .location / _ballAzioneRiga / _ballRigaBarra
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.voci dal 'dati' restituito dal preview() qui
//   sotto — forma confermata coerente, nessuna modifica necessaria.
// - authGetUserId, locationsList, locationExists, locationInsert,
//   locationDelete, escapeHtml: esterne, non toccate.
//
// AGGIORNAMENTO 2026-09-20 (sessione widget Location): pagina rifatta a
// TESSERE con anteprima del binder-location (copertina reale, icona di
// ripiego), stessa griglia e stesso spirito di ui/widget-condividi.ui.js —
// ma il tap sulla tessera GESTISCE la location invece di condividerla:
// vedi carte / rinomina / sposta tutte le carte / elimina (solo se vuota).
// Spunta in alto a destra sulla tessera = selezione multipla (sposta /
// elimina in blocco). "Più piena" → "Più valore". La voce
// CATALOGO_WIDGET.location qui sotto e la firma renderPaginaLocation()
// (chiamata senza argomenti da paginainiziale-dettaglio.ui.js) sono
// INVARIATE. Rinomina = RPC atomica sql/65 (data/locations.repository.js:
// locationRinomina). Il nome del binder-location NON cambia da solo:
// la RPC mette il nuovo nome in binders.nome_proposto (stato 'pending') e
// il client invia la richiesta admin già esistente (creaRichiestaPendente
// 'binder_nome'). Chi vuole mostrare il nuovo nome in attesa legge
// binders.nome_in_attesa (colonna generata, NULL = nessuna proposta).
// CSS della pagina e modale "Gestisci": iniettati da questo file
// (_locAssicuraStile) — index.html NON toccato.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.location = {
        titolo: 'Location', icona: 'fa-map-pin',
        preview: () => {
            const collezione = carteReali.filter(c => c.stato === 'collezione');
            const conteggi = {};
            collezione.forEach(c => { const k = c.location || '—'; conteggi[k] = (conteggi[k] || 0) + 1; });
            const ordinate = Object.entries(conteggi).sort((a, b) => b[1] - a[1]);
            const top = ordinate.slice(0, 2);
            if (top.length === 0) return { righe: ['Nessuna carta'] };
            // 'voci' = tutte le posizioni ordinate: le tessere grandi ne
            // disegnano quattro, le righe di testo restano le prime due.
            return { righe: top.map(([k, v]) => `${k}: ${v}`), dati: { voci: ordinate } };
        },
        // AGGIUNTO (2026-08-30): prima non aveva 'tab', quindi
        // _eseguiAzioneWidget cadeva su apriDettaglioWidget(w.id, ...) =
        // apriDettaglioWidget('location', ...) — non essendo 'location' né
        // una whitelist custom né una vera view-section, il tap sul tile
        // non portava da nessuna parte. Ora ha una pagina propria (#location
        // in index.html, renderPaginaLocation() sotto).
        tab: 'location',
};

// ── PAGINA "LOCATION" ────────────────────────────────────────────────────
// Fonti unite:
//   1) carteReali (stato 'collezione', già in memoria, nessuna query):
//      per ogni location numero di carte (righe, come nel widget Binder) e
//      VALORE = Σ prezzo × qty (stessa formula di widget-valore-collezione).
//   2) locationsList(userId) → TUTTE le location della tabella 'location',
//      comprese quelle senza ancora nessuna carta.
//   3) bindersQueryTutti(userId) → il binder-location di ogni location:
//      copertina (via _risolviCopertinaBinder, ui/binder.ui.js, stessa
//      cache di Binder e Condividi) e nome in attesa (nome_in_attesa).
//
// TESSERE (2026-09-20): tap sulla tessera → modale "Gestisci" a schermo
// intero DENTRO la cornice (stesso meccanismo di #condividiShareModal:
// _rettangoloSchermoCornice + resize). Il modale è creato da JS, non c'è
// markup in index.html.
//
// Stato tenuto qui sotto (prefisso _loc, verificato senza collisioni):
//   _locDati      → { voci:[{nome,n,valore}], binder:{nome→riga binders},
//                     copertine:{nome→url} }: le tessere si ridisegnano da
//                   qui, senza nuove query.
//   _locSelezione → nomi spuntati (azioni multiple).
//   _locModale    → null | {tipo:'gestisci', nome} | {tipo:'sposta', sorgenti}
//   _locOccupato  → blocca i doppi tap durante un'operazione.
// Si esce da selezione/modale a ogni apertura "fresca" della pagina
// (renderPaginaLocation() senza argomenti); le operazioni interne
// ricaricano con { mantieni:true }.
//
// CONTENITORI DI SISTEMA — '?', 'SCAMBIO', 'WISHLIST' (decisione di
// Claudio): ci sono funzioni del sito che si basano su questi nomi, quindi
// BLOCCATI: niente rinomina, elimina, selezione, "sposta carte" da lì; mai
// come nome nuovo né destinazione. Eccezione: '?' (fallback "in attesa di
// una location", vedi widget-dafare) resta valida come DESTINAZIONE. Dal
// modale si possono comunque VEDERE le loro carte.
// '—' = carte senza location (se mai comparisse): tessera inerte.
//
// LOCATION VUOTE: MAI cancellate in automatico — né dopo uno spostamento
// né altrove. Si eliminano solo su richiesta esplicita dell'utente. Sono
// rese molto evidenti (tessera rossa, fascia VUOTA, riquadro "Vuote").
// I conteggi che decidono se eliminare/spostare sono RICALCOLATI da
// carteReali al momento dell'azione (mai dalla cache di disegno: una carta
// arrivata dall'estensione nel frattempo non deve sparire nel nulla).
const _LOC_SISTEMA = ['?', 'SCAMBIO', 'WISHLIST'];
let _locDati = { voci: [], binder: {}, copertine: {} };
let _locSelezione = new Set();
let _locModale = null;
let _locOccupato = false;
let _locModaleResizeHandler = null;

function _locSistema(nome) { return _LOC_SISTEMA.includes(String(nome).trim().toUpperCase()); }
// Tessera senza nome vero (carte senza location): nessuna azione.
function _locInerte(nome) { return nome === '—'; }
// Su queste si può selezionare/rinominare/spostare/eliminare.
function _locModificabile(nome) { return !_locSistema(nome) && !_locInerte(nome); }
// Nomi che non si possono creare né usare come nome nuovo.
function _locRiservata(nome) { return _locSistema(nome) || _locInerte(String(nome).trim()); }
function _locConteggioLive(nome) {
    return carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome).length;
}
function _locVoce(nome) { return _locDati.voci.find(v => v.nome === nome) || null; }
function _locAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function _locCarte(n) { return `${n} cart${n === 1 ? 'a' : 'e'}`; }
function _locEur(v) {
    const n = Number(v) || 0;
    return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 });
}
function _locIconaFallback(nome) {
    const u = String(nome).trim().toUpperCase();
    if (u === '?') return 'fa-circle-question';
    if (u === 'SCAMBIO') return 'fa-right-left';
    if (u === 'WISHLIST') return 'fa-heart';
    if (nome === '—') return 'fa-circle-question';
    return 'fa-box-open'; // come _iconaFallbackBinder() per i binder-location
}

// Dopo QUALUNQUE modifica alle location: le liste cache usate da altre
// pagine (tendina Inserimento, checkbox Prezzi, tendina modifica inline)
// vengono invalidate, così alla prossima apertura si ricaricano.
function _locInvalidaCache() {
    _locationDisponibiliCache = null;
    _locationCaricate = false;
    _locationComuneCaricata = false;
}

async function _locDopoModificaCarte() {
    _locInvalidaCache();
    if (typeof caricaCarteReali === 'function') await caricaCarteReali();
    _locSelezione.clear();
    await renderPaginaLocation({ mantieni: true });
}

// ── CSS (iniettato una volta sola) ──────────────────────────────────────
// Stessa geometria di .condividi-* (colonne da --ball-misura-binder,
// copertina 58.2% con proporzione 63:88) con classi proprie: non si
// aggiunge un consumer alle classi di Condividi (Regola d'Oro #1).
function _locAssicuraStile() {
    if (document.getElementById('locStileWidget')) return;
    const st = document.createElement('style');
    st.id = 'locStileWidget';
    st.textContent = `
        .loc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(max(var(--ball-misura-binder, 90px), 110px), 1fr)); gap:0.8rem; margin-top:0.4rem; }
        .loc-tile { cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.3rem; padding:0.55rem 0.4rem 0.6rem; border-radius:12px; border:1px solid transparent; transition:background-color .15s ease; min-width:0; }
        .loc-tile:hover { background-color:var(--bg-color); }
        .loc-tile.loc-sel { background:var(--primary-light); border-color:var(--primary); }
        .loc-tile.loc-vuota { background:rgba(211,47,47,.09); border-color:rgba(211,47,47,.55); }
        .loc-cover { position:relative; width:58.2%; margin:0 auto; aspect-ratio:63 / 88; border-radius:10px; background:var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.12); }
        .loc-cover img { width:100%; height:100%; object-fit:cover; }
        .loc-cover > i.loc-ico { font-size:1.6rem; color:var(--text-muted); }
        .loc-tile.loc-vuota .loc-cover img, .loc-tile.loc-vuota .loc-cover > i.loc-ico { opacity:.45; }
        .loc-check { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:color-mix(in srgb, var(--card-bg) 88%, transparent); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:2; }
        .loc-check input { width:14px; height:14px; margin:0; cursor:pointer; accent-color:var(--primary); }
        .loc-lock { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:color-mix(in srgb, var(--card-bg) 88%, transparent); display:flex; align-items:center; justify-content:center; font-size:.7rem; color:var(--text-muted); z-index:2; }
        .loc-attesa { position:absolute; top:4px; left:4px; width:22px; height:22px; border-radius:50%; background:#b8860b; color:#fff; display:flex; align-items:center; justify-content:center; font-size:.68rem; z-index:2; }
        .loc-badge-vuota { position:absolute; left:0; right:0; bottom:0; background:var(--danger); color:#fff; font-size:.7rem; font-weight:800; letter-spacing:.08em; text-align:center; padding:3px 0; z-index:2; }
        .loc-nome { font-size:.8rem; font-weight:700; color:var(--text-dark); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
        .loc-meta { font-size:.68rem; color:var(--text-muted); text-align:center; line-height:1.25; }
        .loc-meta b { color:var(--text-dark); font-weight:650; }
        #locGestisciModal.modal-overlay { align-items:stretch; justify-content:stretch; padding:0; }
        #locGestisciModal .modal-content { max-width:none; width:100%; height:100%; max-height:none; }
        #locGestisciModal .loc-mcover { width:120px; margin:0 auto 0.8rem; aspect-ratio:63 / 88; border-radius:12px; background:var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.2); position:relative; }
        #locGestisciModal .loc-mcover img { width:100%; height:100%; object-fit:cover; }
        #locGestisciModal .loc-mcover i { font-size:2.2rem; color:var(--text-muted); }
        #locGestisciModal .loc-mbtn { width:100%; margin-top:0.55rem; }
        #locGestisciModal .loc-mbadge-vuota { display:inline-block; font-size:.78rem; font-weight:800; letter-spacing:.08em; padding:4px 12px; border-radius:999px; background:var(--danger); color:#fff; }
    `;
    document.head.appendChild(st);
}

// ── Modale "Gestisci" ───────────────────────────────────────────────────
// Mirror di _condividiSharePosiziona()/apriCondividiPannelloShare()
// (ui/widget-condividi.ui.js): duplicazione intenzionale, stessa tecnica.
function _locModalePosiziona() {
    const modal = document.getElementById('locGestisciModal');
    const r = (typeof _rettangoloSchermoCornice === 'function') ? _rettangoloSchermoCornice() : null;
    if (!modal || !r) return;
    modal.style.top = r.top + 'px';
    modal.style.left = r.left + 'px';
    modal.style.width = r.width + 'px';
    modal.style.height = r.height + 'px';
    modal.style.borderRadius = r.borderRadius;
    const contenuto = modal.querySelector('.modal-content');
    if (contenuto) contenuto.style.borderRadius = r.borderRadius;
}

function _locAssicuraModale() {
    _locAssicuraStile();
    let m = document.getElementById('locGestisciModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'locGestisciModal';
    m.className = 'modal-overlay';
    m.setAttribute('onclick', '_locChiudiModale()');
    m.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <button class="close-modal-btn" onclick="_locChiudiModale()"><i class="fa-solid fa-xmark"></i></button>
            <div id="locModaleCorpo" style="max-width:380px; margin:0 auto;"></div>
        </div>`;
    document.body.appendChild(m);
    return m;
}

function _locApriModale(stato) {
    _locModale = stato;
    const modal = _locAssicuraModale();
    _locModaleDisegna();
    modal.style.display = 'flex';
    _locModalePosiziona();
    if (!_locModaleResizeHandler) {
        _locModaleResizeHandler = () => _locModalePosiziona();
        window.addEventListener('resize', _locModaleResizeHandler);
    }
}

function _locChiudiModale() {
    _locModale = null;
    const modal = document.getElementById('locGestisciModal');
    if (modal) modal.style.display = 'none';
    if (_locModaleResizeHandler) {
        window.removeEventListener('resize', _locModaleResizeHandler);
        _locModaleResizeHandler = null;
    }
}

function _locModaleDisegna() {
    const corpo = document.getElementById('locModaleCorpo');
    if (!corpo || !_locModale) return;

    // ── Sposta: scelta destinazione ─────────────────────────────────────
    if (_locModale.tipo === 'sposta') {
        const sorgenti = _locModale.sorgenti;
        const totale = sorgenti.reduce((somma, nome) => somma + _locConteggioLive(nome), 0);
        const opzioni = _locDati.voci
            .map(v => v.nome)
            .filter(n => (_locModificabile(n) || n === '?') && !sorgenti.includes(n))
            .map(n => `<option value="${_locAttr(n)}">${escapeHtml(n)}</option>`).join('');
        corpo.innerHTML = `
            <h3 style="font-weight:800; margin-bottom:0.4rem;"><i class="fa-solid fa-arrow-right" style="color:var(--primary);"></i> Sposta le carte</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">${_locCarte(totale)} da ${sorgenti.map(n => `<b style="color:var(--text-dark);">${escapeHtml(n)}</b>`).join(', ')} in:</p>
            <select id="locDestSelect" class="pg-cerca">
                <option value="">— scegli una location —</option>${opzioni}
            </select>
            <input id="locDestNuova" class="pg-cerca" type="text" style="margin-top:0.55rem;" placeholder="oppure scrivi il nome di una nuova location" onkeydown="if(event.key==='Enter'){event.preventDefault(); _locConfermaSposta();}">
            <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.6rem;">Le location di partenza NON vengono eliminate: restano, vuote e ben evidenziate.</p>
            <button type="button" class="btn-main loc-mbtn" onclick="_locConfermaSposta()">Sposta</button>
            <button type="button" class="btn-secondary loc-mbtn" onclick="_locChiudiModale()">Annulla</button>`;
        return;
    }

    // ── Gestisci: menu della singola location ───────────────────────────
    const nome = _locModale.nome;
    const v = _locVoce(nome);
    if (!v) { corpo.innerHTML = '<p style="color:var(--text-muted);">Location non trovata.</p>'; return; }
    const b = _locDati.binder[nome];
    const url = _locDati.copertine[nome];
    const vuota = v.n === 0 && _locModificabile(nome);
    const cover = url
        ? `<img src="${_locAttr(url)}" alt="${_locAttr(nome)}" onerror="this.remove();">`
        : `<i class="fa-solid ${_locIconaFallback(nome)}"></i>`;
    const meta = vuota
        ? '<span class="loc-mbadge-vuota">VUOTA</span>'
        : `<b style="color:var(--text-dark);">${_locCarte(v.n)}</b> · ${_locEur(v.valore)}`;
    const inAttesa = (b && b.nome_in_attesa)
        ? `<p style="font-size:0.78rem; color:#b8860b; font-weight:600; margin-top:0.6rem;">⏳ Binder: ${escapeHtml(b.nome)} (${escapeHtml(b.nome_in_attesa)} — in attesa di approvazione)</p>` : '';
    const modificabile = _locModificabile(nome);
    const nota = modificabile ? '' : `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.6rem;">${
        nome === '?' ? 'Fallback: qui finiscono le carte in attesa di una location. Non si rinomina né si elimina.'
        : _locInerte(nome) ? 'Carte senza location.'
        : 'Contenitore di sistema: ci sono funzioni del sito che si basano su questo nome. Non modificabile.'}</p>`;

    let azioni = '';
    if (v.n > 0) azioni += `<button type="button" class="btn-main loc-mbtn" onclick="_locVediCarte()"><i class="fa-solid fa-eye"></i> Vedi le carte</button>`;
    if (modificabile) {
        azioni += `<button type="button" class="btn-secondary loc-mbtn" onclick="_locRinominaModale()"><i class="fa-solid fa-pen"></i> Rinomina</button>`;
        if (v.n > 0) azioni += `<button type="button" class="btn-secondary loc-mbtn" onclick="_locSpostaModale()"><i class="fa-solid fa-arrow-right"></i> Sposta tutte le carte in un'altra location</button>`;
        if (v.n === 0) azioni += `<button type="button" class="btn-secondary loc-mbtn" style="color:var(--danger);" onclick="_locEliminaModale()"><i class="fa-solid fa-trash"></i> Elimina questa location (è vuota)</button>`;
    }

    corpo.innerHTML = `
        <div class="loc-mcover">${cover}</div>
        <h3 style="font-weight:800; margin-bottom:0.3rem; word-break:break-word;">${escapeHtml(nome)}</h3>
        <div style="font-size:0.85rem; color:var(--text-muted);">${meta}</div>
        ${inAttesa}${nota}
        <div style="margin-top:0.8rem;">${azioni}</div>`;
}

// Tap su una tessera.
function _locApriGestione(i) {
    if (_locOccupato) return;
    const v = _locDati.voci[i];
    if (v) _locApriModale({ tipo: 'gestisci', nome: v.nome });
}
function _locVediCarte() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    const nome = _locModale.nome;
    _locChiudiModale();
    _ballAzioneRiga(null, 'location', nome);
}
async function _locRinominaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    await _locRinomina(_locModale.nome);
}
function _locSpostaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    _locApriSposta([_locModale.nome]);
}
async function _locEliminaModale() {
    if (!_locModale || _locModale.tipo !== 'gestisci') return;
    await _locElimina([_locModale.nome]);
}

// ── Aggiungi ────────────────────────────────────────────────────────────
async function _locAggiungi() {
    if (_locOccupato) return;
    const nome = (prompt('Nome della nuova location:') || '').trim();
    if (!nome) return;
    if (_locRiservata(nome)) { alert(`"${nome}" è un nome di sistema (già esistente e non modificabile): scegline un altro.`); return; }
    const uguale = _locDati.voci.find(v => String(v.nome).toLowerCase() === nome.toLowerCase());
    if (uguale) { alert(`"${uguale.nome}" esiste già.`); return; }

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { data: esistenti, error: errCheck } = await locationExists(userId, nome);
        if (errCheck) { alert('Errore nel controllo: ' + errCheck.message); return; }
        if (esistenti && esistenti.length > 0) { alert(`"${nome}" esiste già.`); return; }
        const { error: errIns } = await locationInsert(userId, nome);
        if (errIns) { alert('Errore nella creazione: ' + errIns.message); return; }
        _locInvalidaCache();
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}

// ── Rinomina ────────────────────────────────────────────────────────────
async function _locRinomina(nome) {
    if (_locOccupato) return;
    if (!_locVoce(nome)) return;
    if (!_locModificabile(nome)) { alert(`"${nome}" è un contenitore di sistema: non si può rinominare.`); return; }

    const input = prompt(`Nuovo nome per "${nome}":`, nome);
    if (input === null) return;
    const nuovo = input.trim();
    if (!nuovo || nuovo === nome) return;
    if (_locRiservata(nuovo)) { alert(`"${nuovo}" è un nome di sistema: scegline un altro.`); return; }
    const uguale = _locDati.voci.find(v => v.nome !== nome && String(v.nome).toLowerCase() === nuovo.toLowerCase());
    if (uguale) { alert(`"${uguale.nome}" esiste già. Scegli un altro nome (oppure usa "Sposta tutte le carte" per unirle).`); return; }

    const n = _locConteggioLive(nome);
    if (!confirm(`Rinominare "${nome}" in "${nuovo}"?\n\nSi aggiornano anche le ${_locCarte(n)} di questa location. Il nome del binder collegato cambierà solo dopo l'approvazione di un admin.`)) return;

    _locOccupato = true;
    try {
        const { data, error } = await locationRinomina(nome, nuovo);
        if (error) { alert('Errore nella rinomina: ' + error.message); return; }

        // Il nome in attesa è GIÀ nel DB (la RPC ha scritto nome_proposto +
        // nome_stato='pending', mai binders.nome — trigger sql/26). Qui
        // manca solo la richiesta all'admin, con il flusso già esistente.
        let avviso = '';
        if (data && data.proposta_nome && data.binder_id) {
            const userId = await authGetUserId();
            const { error: errRichiesta } = await creaRichiestaPendente(userId, 'binder_nome', { binder_id: data.binder_id, nome_proposto: nuovo });
            if (errRichiesta) {
                console.error('Nome binder in attesa ma richiesta non inviata:', errRichiesta.message);
                avviso = `Location rinominata. Il nuovo nome del binder è in attesa, ma la richiesta all'admin non è partita (${errRichiesta.message}). Riproponilo dal pannello Design del binder.`;
            }
        }
        _locChiudiModale();
        await _locDopoModificaCarte();
        if (avviso) alert(avviso);
    } finally { _locOccupato = false; }
}

// ── Elimina (solo su richiesta esplicita; singola o selezione) ──────────
async function _locElimina(nomi) {
    if (_locOccupato || !nomi || nomi.length === 0) return;
    const eliminabili = [];
    const saltate = [];
    nomi.forEach(nome => {
        const n = _locConteggioLive(nome);
        if (!_locModificabile(nome)) saltate.push(`${nome} (contenitore di sistema)`);
        else if (n > 0) saltate.push(`${nome} (${_locCarte(n)})`);
        else eliminabili.push(nome);
    });
    if (eliminabili.length === 0) {
        alert(`Nessuna location eliminabile:\n- ${saltate.join('\n- ')}\n\nSi eliminano solo le location VUOTE. Sposta prima le carte.`);
        return;
    }
    let msg = eliminabili.length === 1
        ? `Eliminare la location "${eliminabili[0]}"? È vuota.`
        : `Eliminare ${eliminabili.length} location vuote?\n- ${eliminabili.join('\n- ')}`;
    if (saltate.length > 0) msg += `\n\nNon verranno eliminate:\n- ${saltate.join('\n- ')}`;
    if (!confirm(msg)) return;

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { error } = await locationDeleteBatch(userId, eliminabili);
        if (error) { alert('Errore nella cancellazione: ' + error.message); return; }
        _locInvalidaCache();
        _locSelezione.clear();
        _locChiudiModale();
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}
function _locEliminaSelezionate() { _locElimina([..._locSelezione]); }

// ── Sposta le carte (singola o selezione) ───────────────────────────────
function _locApriSposta(nomi) {
    if (_locOccupato) return;
    const sorgenti = (nomi || []).filter(nome => _locModificabile(nome) && _locConteggioLive(nome) > 0);
    if (sorgenti.length === 0) { alert('Nessuna carta da spostare: le location scelte sono vuote.'); return; }
    _locApriModale({ tipo: 'sposta', sorgenti });
    const sel = document.getElementById('locDestSelect');
    if (sel) sel.focus();
}
function _locSpostaSelezionate() { _locApriSposta([..._locSelezione]); }

async function _locConfermaSposta() {
    if (_locOccupato || !_locModale || _locModale.tipo !== 'sposta') return;
    const sorgenti = _locModale.sorgenti;
    const nuovaTesto = ((document.getElementById('locDestNuova') || {}).value || '').trim();
    const scelta = (document.getElementById('locDestSelect') || {}).value || '';

    let destinazione = scelta;
    let daCreare = false;
    if (nuovaTesto) {
        if (_locRiservata(nuovaTesto)) { alert(`"${nuovaTesto}" è un nome di sistema: per "?" usa la tendina, gli altri non sono validi come destinazione.`); return; }
        const uguale = _locDati.voci.find(v => String(v.nome).toLowerCase() === nuovaTesto.toLowerCase());
        destinazione = uguale ? uguale.nome : nuovaTesto;
        daCreare = !uguale;
    }
    if (!destinazione) { alert('Scegli una location di destinazione oppure scrivine una nuova.'); return; }
    if (sorgenti.includes(destinazione)) { alert('La destinazione coincide con una delle location di partenza.'); return; }
    if (_locInerte(destinazione) || (_locSistema(destinazione) && destinazione !== '?')) { alert(`"${destinazione}" non è una destinazione valida.`); return; }

    const totale = sorgenti.reduce((somma, nome) => somma + _locConteggioLive(nome), 0);
    if (totale === 0) { alert('Nel frattempo non ci sono più carte da spostare.'); return; }
    if (!confirm(`Spostare ${_locCarte(totale)} da ${sorgenti.map(n => `"${n}"`).join(', ')} in "${destinazione}"?\n\nLe location di partenza NON vengono eliminate: restano, vuote e ben evidenziate.`)) return;

    _locOccupato = true;
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        if (daCreare) {
            const { data: esistenti, error: errCheck } = await locationExists(userId, destinazione);
            if (errCheck) { alert('Errore nel controllo: ' + errCheck.message); return; }
            if (!esistenti || esistenti.length === 0) {
                const { error: errIns } = await locationInsert(userId, destinazione);
                if (errIns) { alert('Errore nella creazione della location: ' + errIns.message); return; }
            }
        }
        const { error } = await locationSpostaCarte(userId, sorgenti, destinazione);
        if (error) { alert('Errore nello spostamento: ' + error.message); return; }
        _locChiudiModale();
        await _locDopoModificaCarte();
    } finally { _locOccupato = false; }
}

// ── Selezione multipla (spunte sulle tessere) ───────────────────────────
// Aggiorna solo classi/spunte e barra, senza ridisegnare la griglia.
function _locToggleSel(i) {
    const v = _locDati.voci[i];
    if (!v || !_locModificabile(v.nome)) return;
    if (_locSelezione.has(v.nome)) _locSelezione.delete(v.nome); else _locSelezione.add(v.nome);
    _locAggiornaSelezioneUI();
}
function _locSelezionaTutte() {
    const scelte = _locDati.voci.map(v => v.nome).filter(_locModificabile);
    if (scelte.length > 0 && scelte.every(n => _locSelezione.has(n))) _locSelezione.clear();
    else scelte.forEach(n => _locSelezione.add(n));
    _locAggiornaSelezioneUI();
}
function _locAnnullaSelezione() { _locSelezione.clear(); _locAggiornaSelezioneUI(); }

function _locAggiornaSelezioneUI() {
    document.querySelectorAll('#locationContenuto .loc-tile[data-i]').forEach(el => {
        const v = _locDati.voci[Number(el.dataset.i)];
        if (!v) return;
        const sel = _locSelezione.has(v.nome);
        el.classList.toggle('loc-sel', sel);
        const cb = el.querySelector('.loc-check input');
        if (cb) cb.checked = sel;
    });
    const barra = document.getElementById('locBarra');
    if (!barra) return;
    const nSel = _locSelezione.size;
    const scelte = _locDati.voci.filter(v => _locModificabile(v.nome));
    const tutteSel = scelte.length > 0 && scelte.every(v => _locSelezione.has(v.nome));
    barra.innerHTML = `
        <button onclick="_locSelezionaTutte()">${tutteSel ? 'Deseleziona tutte' : 'Seleziona tutte'}</button>
        ${nSel > 0 ? `
        <button onclick="_locSpostaSelezionate()"><i class="fa-solid fa-arrow-right"></i> Sposta carte (${nSel})</button>
        <button onclick="_locEliminaSelezionate()" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina (${nSel})</button>
        <button onclick="_locAnnullaSelezione()">Annulla</button>` : ''}`;
}

// ── Disegno (sincrono, da _locDati) ─────────────────────────────────────
function _locDisegna() {
    const container = document.getElementById('locationContenuto');
    if (!container) return;
    _locAssicuraStile();
    const voci = _locDati.voci;

    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Location</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0 0.5rem;">Nessuna carta ha ancora una location.</p>
            <div class="pg-bottoni" style="justify-content:center;">
                <button class="primario" onclick="_locAggiungi()">+ Crea la prima location</button>
            </div>
        `;
        return;
    }

    const nVuote = voci.filter(v => v.n === 0 && _locModificabile(v.nome)).length;
    // "Più valore": la location col valore più alto (nessuna se tutte a 0).
    const top = voci.reduce((m, v) => (v.valore > (m ? m.valore : 0) ? v : m), null);

    const tessere = voci.map((v, i) => {
        const { nome, n, valore } = v;
        const modificabile = _locModificabile(nome);
        const sistema = _locSistema(nome);
        const vuota = n === 0 && modificabile; // '?' vuoto è normale: nessun allarme
        const b = _locDati.binder[nome];
        const url = _locDati.copertine[nome];
        const sel = _locSelezione.has(nome);
        const cover = url
            ? `<img src="${_locAttr(url)}" alt="${_locAttr(nome)}" loading="lazy" onerror="this.remove();">`
            : `<i class="fa-solid ${_locIconaFallback(nome)} loc-ico"></i>`;
        const check = modificabile
            ? `<label class="loc-check" title="Seleziona" onclick="event.stopPropagation();"><input type="checkbox" ${sel ? 'checked' : ''} onclick="event.stopPropagation(); _locToggleSel(${i})"></label>`
            : (sistema ? '<span class="loc-lock" title="Contenitore di sistema"><i class="fa-solid fa-lock"></i></span>' : '');
        const attesa = (b && b.nome_in_attesa)
            ? `<span class="loc-attesa" title="${_locAttr(`Binder: ${b.nome} (${b.nome_in_attesa} — in attesa di approvazione)`)}"><i class="fa-solid fa-hourglass-half"></i></span>` : '';
        const badge = vuota ? '<span class="loc-badge-vuota">VUOTA</span>' : '';
        const meta = vuota
            ? '<div class="loc-meta">0 carte</div>'
            : `<div class="loc-meta"><b>${n}</b> ${n === 1 ? 'carta' : 'carte'}<br>${_locEur(valore)}</div>`;
        return `
            <div class="loc-tile${vuota ? ' loc-vuota' : ''}${sel ? ' loc-sel' : ''}" data-i="${i}" title="${_locAttr(nome)}" onclick="_locApriGestione(${i})">
                <div class="loc-cover">${cover}${check}${attesa}${badge}</div>
                <div class="loc-nome">${escapeHtml(nome)}</div>
                ${meta}
            </div>`;
    }).join('');

    const tileVuote = nVuote > 0
        ? `<div style="background:rgba(211,47,47,.12);"><b style="color:var(--danger);">${nVuote}</b><span>Vuote</span></div>` : '';
    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Location</span>
            <span class="page-azione attiva" onclick="_locAggiungi()">+ Nuova location</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${voci.length}</div>
                <div class="pg-sotto">${top ? `più valore: ${escapeHtml(top.nome)} (${_locEur(top.valore)})` : 'nessuna location con un valore'}</div>
            </div>
            <div class="pg-stat">
                <div><b>${voci.length}</b><span>Location totali</span></div>
                <div><b>${top ? escapeHtml(top.nome) : '—'}</b><span>Più valore${top ? ` (${_locEur(top.valore)})` : ''}</span></div>
                ${tileVuote}
            </div>
            <div class="pg-sotto">Tocca una tessera per gestirla. Con le spunte scegli più location e le sposti o le elimini in blocco.</div>
            <div class="pg-bottoni" id="locBarra"></div>
            <div class="loc-grid">${tessere}</div>
        </div>
    `;
    _locAggiornaSelezioneUI();
}

// ── Ingresso: lettura dati + disegno ────────────────────────────────────
// Chiamata SENZA argomenti dal dispatch di apriDettaglioWidget → apertura
// fresca (azzera selezione e modale). Le operazioni di questo file la
// richiamano con { mantieni: true }.
async function renderPaginaLocation(opzioni) {
    const container = document.getElementById('locationContenuto');
    if (!container) return;
    _locAssicuraStile();

    const mantieni = !!(opzioni && opzioni.mantieni === true);
    if (!mantieni) {
        _locSelezione.clear();
        _locChiudiModale();
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    }

    // 1) Carte in collezione → conteggio (righe) e valore (prezzo × qty)
    const agg = {};
    try {
        carteReali.filter(c => c.stato === 'collezione').forEach(c => {
            const k = c.location || '—';
            const a = agg[k] || (agg[k] = { nome: k, n: 0, valore: 0 });
            a.n += 1;
            a.valore += (Number(c.price) || 0) * (Number(c.qty) || 1);
        });
    } catch (e) {
        console.error('renderPaginaLocation:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }
    const voci = Object.values(agg);

    // 2) Location senza ancora nessuna carta + 3) binder-location.
    // Un fallimento qui non deve mai nascondere le location che hanno già
    // delle carte.
    const binder = {};
    const copertine = {};
    const userId = await authGetUserId();
    if (userId) {
        try {
            const { data: tutte, error } = await locationsList(userId);
            if (error) throw error;
            const nomiConCarte = new Set(voci.map(v => v.nome));
            (tutte || []).forEach(r => {
                if (r.nome && !nomiConCarte.has(r.nome)) voci.push({ nome: r.nome, n: 0, valore: 0 });
            });
        } catch (e) {
            console.error('renderPaginaLocation (locationsList):', e);
        }
        try {
            const { data: binders, error } = await bindersQueryTutti(userId);
            if (error) throw error;
            (binders || []).filter(b => b.tipo === 'location' && b.location_valore).forEach(b => { binder[b.location_valore] = b; });
            // Copertine: stessa funzione/cache di Binder e Condividi.
            if (typeof _risolviCopertinaBinder === 'function') {
                await Promise.all(voci.map(async v => {
                    const b = binder[v.nome];
                    if (!b) return;
                    try { copertine[v.nome] = await _risolviCopertinaBinder(userId, b); }
                    catch (e) { console.error('renderPaginaLocation (copertina):', e); }
                }));
            }
        } catch (e) {
            console.error('renderPaginaLocation (binders):', e);
        }
    }

    // Ordine: prima le location con carte, per VALORE decrescente (poi
    // numero di carte, poi nome); in fondo le vuote, in ordine alfabetico.
    voci.sort((a, b) => (b.n > 0) - (a.n > 0)
        || b.valore - a.valore
        || b.n - a.n
        || String(a.nome).localeCompare(String(b.nome)));

    _locDati = { voci, binder, copertine };
    // Selezione riferita a nomi che non esistono più: via.
    const nomi = new Set(voci.map(v => v.nome));
    _locSelezione = new Set([..._locSelezione].filter(n => nomi.has(n)));
    // Modale aperto su una location sparita/cambiata: chiuso.
    if (_locModale) {
        const ok = _locModale.tipo === 'gestisci' ? nomi.has(_locModale.nome) : _locModale.sorgenti.every(n => nomi.has(n));
        if (!ok) _locChiudiModale(); else _locModaleDisegna();
    }

    _locDisegna();
}
