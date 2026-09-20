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
// AGGIORNAMENTO 2026-09-20 (sessione widget Location): il tasto "+ Aggiungi"
// dell'header è sostituito da "Gestisci" — modalità gestione con
// aggiungi / rinomina / elimina / sposta le carte, singolo o su selezione
// multipla. Il "✕" per riga della vecchia pagina è confluito lì. La voce
// CATALOGO_WIDGET.location qui sotto e la firma renderPaginaLocation()
// (chiamata senza argomenti da paginainiziale-dettaglio.ui.js) sono
// INVARIATE. Rinomina = RPC atomica sql/65 (data/locations.repository.js:
// locationRinomina). Il nome del binder-location NON cambia da solo:
// la RPC mette il nuovo nome in binders.nome_proposto (stato 'pending') e
// il client invia la richiesta admin già esistente (creaRichiestaPendente
// 'binder_nome'). Chi vuole mostrare il nuovo nome in attesa legge
// binders.nome_in_attesa (colonna generata, NULL = nessuna proposta).
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
// Due fonti unite (invariato dal 2026-08-30):
//   1) CATALOGO_WIDGET.location.preview() → dati.voci: location USATE da
//      almeno una carta, con conteggio (da carteReali, nessuna query nuova).
//   2) locationsList(userId) → TUTTE le location della tabella 'location',
//      comprese quelle senza ancora nessuna carta.
// Click su una riga (fuori dalla modalità Gestisci) → RIUSA
// _ballAzioneRiga(evt,'location',nome): apre Visualizzazione filtrata.
//
// MODALITÀ "GESTISCI" (2026-09-20). Stato tenuto qui sotto (prefisso _loc,
// verificato senza collisioni con gli altri file):
//   _locDati      → ultima lettura (voci + binder-location per nome): i tap
//                   di selezione ridisegnano da qui, senza nuove query.
//   _locGestione  → modalità attiva. Si azzera a ogni apertura "fresca"
//                   della pagina (renderPaginaLocation() senza argomenti);
//                   le operazioni interne ricaricano con { mantieni:true }.
//   _locSelezione → nomi selezionati (azioni massive).
//   _locPannello  → pannello inline "Sposta carte" (inline, non overlay:
//                   niente position:fixed dentro la cornice).
//
// CONTENITORI DI SISTEMA — '?', 'SCAMBIO', 'WISHLIST' (decisione di
// Claudio): ci sono funzioni del sito che si basano su questi nomi, quindi
// qui sono BLOCCATI del tutto: niente rinomina, elimina, selezione, "sposta
// carte" da lì; mai come nome nuovo né destinazione. Unica eccezione: '?'
// (fallback "in attesa di una location", vedi widget-dafare) resta valida
// come DESTINAZIONE dello spostamento. Le carte dentro si sistemano come
// sempre (modifica carta / widget Da fare).
// '—' = carte senza location (preview() le raggruppa così): se compare è
// una riga inerte, nessuna azione.
//
// LOCATION VUOTE: MAI cancellate in automatico — né dopo uno spostamento
// né altrove. Si eliminano solo se l'utente lo chiede (🗑 / "Elimina (n)").
// Sono rese molto evidenti (badge VUOTA + riga rossa) in entrambe le viste.
// I conteggi che decidono se eliminare/spostare sono RICALCOLATI da
// carteReali al momento dell'azione (mai dalla cache di disegno: una carta
// arrivata dall'estensione nel frattempo non deve sparire nel nulla).
const _LOC_SISTEMA = ['?', 'SCAMBIO', 'WISHLIST'];
let _locDati = { voci: [], binder: {} };
let _locGestione = false;
let _locSelezione = new Set();
let _locPannello = null;
let _locOccupato = false;

function _locSistema(nome) { return _LOC_SISTEMA.includes(String(nome).trim().toUpperCase()); }
// Riga senza nome vero (carte senza location): nessuna azione.
function _locInerte(nome) { return nome === '—'; }
// Su queste righe si può selezionare/rinominare/spostare/eliminare.
function _locModificabile(nome) { return !_locSistema(nome) && !_locInerte(nome); }
// Nomi che non si possono creare né usare come nome nuovo.
function _locRiservata(nome) { return _locSistema(nome) || _locInerte(String(nome).trim()); }
function _locConteggioLive(nome) {
    return carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome).length;
}
function _locAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function _locCarte(n) { return `${n} cart${n === 1 ? 'a' : 'e'}`; }

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
    _locPannello = null;
    await renderPaginaLocation({ mantieni: true });
}

// ── Aggiungi ────────────────────────────────────────────────────────────
async function _locAggiungi() {
    if (_locOccupato) return;
    const nome = (prompt('Nome della nuova location:') || '').trim();
    if (!nome) return;
    if (_locRiservata(nome)) { alert(`"${nome}" è un nome di sistema (già esistente e non modificabile): scegline un altro.`); return; }
    const uguale = _locDati.voci.find(([n]) => String(n).toLowerCase() === nome.toLowerCase());
    if (uguale) { alert(`"${uguale[0]}" esiste già.`); return; }

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
async function _locRinomina(i) {
    if (_locOccupato) return;
    const riga = _locDati.voci[i];
    if (!riga) return;
    const nome = riga[0];
    if (!_locModificabile(nome)) { alert(`"${nome}" è un contenitore di sistema: non si può rinominare.`); return; }

    const input = prompt(`Nuovo nome per "${nome}":`, nome);
    if (input === null) return;
    const nuovo = input.trim();
    if (!nuovo || nuovo === nome) return;
    if (_locRiservata(nuovo)) { alert(`"${nuovo}" è un nome di sistema: scegline un altro.`); return; }
    const uguale = _locDati.voci.find(([n]) => n !== nome && String(n).toLowerCase() === nuovo.toLowerCase());
    if (uguale) { alert(`"${uguale[0]}" esiste già. Scegli un altro nome (oppure usa "Sposta carte" per unirle).`); return; }

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
        alert(`Nessuna location eliminabile:\n- ${saltate.join('\n- ')}\n\nSi eliminano solo le location VUOTE. Sposta prima le carte con "Sposta carte".`);
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
        await renderPaginaLocation({ mantieni: true });
    } finally { _locOccupato = false; }
}
function _locEliminaSelezionate() { _locElimina([..._locSelezione]); }
function _locEliminaRiga(i) { const r = _locDati.voci[i]; if (r) _locElimina([r[0]]); }

// ── Sposta le carte (singola o selezione) ───────────────────────────────
function _locApriPannelloSposta(i) {
    if (_locOccupato) return;
    const nomi = (i === null || i === undefined) ? [..._locSelezione] : [(_locDati.voci[i] || [])[0]].filter(Boolean);
    const sorgenti = nomi.filter(nome => _locModificabile(nome) && _locConteggioLive(nome) > 0);
    if (sorgenti.length === 0) { alert('Nessuna carta da spostare: le location scelte sono vuote.'); return; }
    _locPannello = { sorgenti };
    _locDisegna();
    const sel = document.getElementById('locDestSelect');
    if (sel) sel.focus();
}
function _locChiudiPannello() { _locPannello = null; _locDisegna(); }

async function _locConfermaSposta() {
    if (_locOccupato || !_locPannello) return;
    const sorgenti = _locPannello.sorgenti;
    const nuovaTesto = ((document.getElementById('locDestNuova') || {}).value || '').trim();
    const scelta = (document.getElementById('locDestSelect') || {}).value || '';

    let destinazione = scelta;
    let daCreare = false;
    if (nuovaTesto) {
        if (_locRiservata(nuovaTesto)) { alert(`"${nuovaTesto}" è un nome di sistema: per "?" usa la tendina, gli altri non sono validi come destinazione.`); return; }
        const uguale = _locDati.voci.find(([n]) => String(n).toLowerCase() === nuovaTesto.toLowerCase());
        destinazione = uguale ? uguale[0] : nuovaTesto;
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
        await _locDopoModificaCarte();
    } finally { _locOccupato = false; }
}

// ── Selezione / modalità ────────────────────────────────────────────────
function _locToggleGestione() {
    _locGestione = !_locGestione;
    _locSelezione.clear();
    _locPannello = null;
    _locDisegna();
}
function _locToggleSel(i) {
    if (_locPannello) return;
    const riga = _locDati.voci[i];
    if (!riga || !_locModificabile(riga[0])) return;
    if (_locSelezione.has(riga[0])) _locSelezione.delete(riga[0]); else _locSelezione.add(riga[0]);
    _locDisegna();
}
function _locSelezionaTutte() {
    if (_locPannello) return;
    const scelte = _locDati.voci.map(([n]) => n).filter(_locModificabile);
    if (scelte.length > 0 && scelte.every(n => _locSelezione.has(n))) _locSelezione.clear();
    else scelte.forEach(n => _locSelezione.add(n));
    _locDisegna();
}
function _locApriFiltro(evt, i) {
    const riga = _locDati.voci[i];
    if (riga) _ballAzioneRiga(evt, 'location', riga[0]);
}

// ── Disegno (sincrono, da _locDati) ─────────────────────────────────────
// Stile "location vuota": molto evidente, in entrambe le viste.
const _LOC_STILE_VUOTA = 'background:rgba(211,47,47,.09); border-left:4px solid var(--danger); border-radius:8px; padding-left:8px;';
const _LOC_BADGE_VUOTA = '<span style="display:inline-block; font-size:0.72rem; font-weight:800; letter-spacing:.06em; padding:4px 10px; border-radius:999px; background:var(--danger); color:#fff;">VUOTA</span>';

function _locDisegna() {
    const container = document.getElementById('locationContenuto');
    if (!container) return;
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

    const bloccato = !!_locPannello; // pannello Sposta aperto: righe in sola lettura

    const righe = voci.map(([nome, n], i) => {
        const sistema = _locSistema(nome);
        const vuota = n === 0 && _locModificabile(nome); // '?' vuoto è normale: nessun allarme
        const b = _locDati.binder[nome];

        // Sotto il nome: binder in attesa di nuovo nome / etichetta sistema.
        let sub = '';
        if (b && b.nome_in_attesa) {
            sub = `<span>Binder: ${escapeHtml(b.nome)} (${escapeHtml(b.nome_in_attesa)} — in attesa di approvazione)</span>`;
        } else if (nome === '?') {
            sub = '<span>Fallback: carte in attesa di una location</span>';
        } else if (sistema) {
            sub = '<span>Contenitore di sistema — non modificabile</span>';
        } else if (_locInerte(nome)) {
            sub = '<span>Carte senza location</span>';
        }
        const testo = `<div class="pg-testo"><b>${escapeHtml(nome)}</b>${sub}</div>`;
        const conteggio = vuota
            ? `<div class="pg-destra">${_LOC_BADGE_VUOTA}</div>`
            : `<div class="pg-destra"><b>${n}</b>${n === 1 ? 'carta' : 'carte'}</div>`;

        if (!_locGestione) {
            const stileN = vuota ? ` style="${_LOC_STILE_VUOTA}"` : '';
            return `<div class="pg-riga" data-tocca${stileN} onclick="_locApriFiltro(event, ${i})">${testo}${conteggio}</div>`;
        }

        const modificabile = _locModificabile(nome);
        const sel = _locSelezione.has(nome);
        let casella = `<span style="width:18px; flex:0 0 auto;"></span>`;
        if (modificabile) {
            casella = `<input type="checkbox" ${sel ? 'checked' : ''} ${bloccato ? 'disabled' : ''} onclick="event.stopPropagation(); _locToggleSel(${i})" style="accent-color:var(--primary); width:18px; height:18px; flex:0 0 auto; margin:0;">`;
        } else if (sistema) {
            casella = `<i class="fa-solid fa-lock" title="Contenitore di sistema" style="width:18px; flex:0 0 auto; color:var(--text-muted); font-size:0.8rem; text-align:center;"></i>`;
        }
        const pill = 'padding:5px 9px; flex:0 0 auto;';
        let icone = '';
        if (modificabile && !bloccato) {
            icone += `<span class="pg-filtro" style="${pill}" title="Rinomina" onclick="event.stopPropagation(); _locRinomina(${i})"><i class="fa-solid fa-pen"></i></span>`;
            if (n > 0) icone += `<span class="pg-filtro" style="${pill}" title="Sposta le carte in un'altra location" onclick="event.stopPropagation(); _locApriPannelloSposta(${i})"><i class="fa-solid fa-arrow-right"></i></span>`;
            if (n === 0) icone += `<span class="pg-filtro" style="${pill} color:var(--danger);" title="Elimina (è vuota)" onclick="event.stopPropagation(); _locEliminaRiga(${i})"><i class="fa-solid fa-trash"></i></span>`;
        }
        let stile = 'gap:8px;';
        if (vuota) stile += ' ' + _LOC_STILE_VUOTA;
        if (sel) stile += ' background:var(--primary-light);';
        const tocca = (modificabile && !bloccato) ? `data-tocca onclick="_locToggleSel(${i})"` : '';
        return `<div class="pg-riga" ${tocca} style="${stile}">${casella}${testo}${conteggio}${icone}</div>`;
    }).join('');

    const nVuote = voci.filter(([nome, n]) => n === 0 && _locModificabile(nome)).length;

    // ── Modalità normale ────────────────────────────────────────────────
    if (!_locGestione) {
        const totale = voci.length;
        const [nomePiuPiena, conteggioPiuPieno] = voci[0];
        const tileVuote = nVuote > 0
            ? `<div style="background:rgba(211,47,47,.12);"><b style="color:var(--danger);">${nVuote}</b><span>Vuote</span></div>` : '';
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Location</span>
                <span class="page-azione attiva" onclick="_locToggleGestione()">Gestisci</span>
            </div>
            <div class="pg-pagina">
                <div class="pg-intro">
                    <div class="pg-grande">${totale}</div>
                    <div class="pg-sotto">più piena: ${escapeHtml(nomePiuPiena)} (${conteggioPiuPieno} carte)</div>
                </div>
                <div class="pg-stat">
                    <div><b>${totale}</b><span>Location totali</span></div>
                    <div><b>${escapeHtml(nomePiuPiena)}</b><span>Più piena (${conteggioPiuPieno})</span></div>
                    ${tileVuote}
                </div>
                <div class="pg-elenco">${righe}</div>
            </div>
        `;
        return;
    }

    // ── Modalità Gestisci ───────────────────────────────────────────────
    const nSel = _locSelezione.size;
    const scelte = voci.filter(([n]) => _locModificabile(n));
    const tutteSel = scelte.length > 0 && scelte.every(([n]) => _locSelezione.has(n));

    let pannello = '';
    if (_locPannello) {
        const sorgenti = _locPannello.sorgenti;
        const totale = sorgenti.reduce((somma, nome) => somma + _locConteggioLive(nome), 0);
        const opzioni = voci
            .map(([n]) => n)
            .filter(n => (_locModificabile(n) || n === '?') && !sorgenti.includes(n))
            .map(n => `<option value="${_locAttr(n)}">${escapeHtml(n)}</option>`).join('');
        pannello = `
            <div style="display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:12px; background:var(--primary-light);">
                <div class="pg-testo">
                    <b style="white-space:normal;">Sposta ${_locCarte(totale)} da ${sorgenti.map(n => escapeHtml(n)).join(', ')} in:</b>
                </div>
                <select id="locDestSelect" class="pg-cerca">
                    <option value="">— scegli una location —</option>${opzioni}
                </select>
                <input id="locDestNuova" class="pg-cerca" type="text" placeholder="oppure scrivi il nome di una nuova location" onkeydown="if(event.key==='Enter'){event.preventDefault(); _locConfermaSposta();}">
                <div class="pg-bottoni">
                    <button class="primario" onclick="_locConfermaSposta()">Sposta</button>
                    <button onclick="_locChiudiPannello()">Annulla</button>
                </div>
            </div>`;
    }

    const barraSelezione = (nSel > 0 && !bloccato) ? `
        <div class="pg-bottoni">
            <button onclick="_locApriPannelloSposta(null)"><i class="fa-solid fa-arrow-right"></i> Sposta carte (${nSel})</button>
            <button onclick="_locEliminaSelezionate()" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina (${nSel})</button>
        </div>` : '';

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Gestisci location</span>
            <span class="page-azione attiva" onclick="_locToggleGestione()">Fine</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-bottoni">
                <button class="primario" ${bloccato ? 'disabled' : ''} onclick="_locAggiungi()">+ Nuova location</button>
                <button ${bloccato ? 'disabled' : ''} onclick="_locSelezionaTutte()">${tutteSel ? 'Deseleziona tutte' : 'Seleziona tutte'}</button>
            </div>
            ${barraSelezione}
            ${pannello}
            <div class="pg-sotto">Tocca le righe per selezionarle. Icone: ✎ rinomina, → sposta le carte, cestino solo sulle location vuote (nessuna viene eliminata da sola).${nVuote > 0 ? ` <b style="color:var(--danger);">${nVuote} vuote.</b>` : ''}</div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}

// ── Ingresso: lettura dati + disegno ────────────────────────────────────
// Chiamata SENZA argomenti dal dispatch di apriDettaglioWidget → apertura
// fresca (esce dalla modalità Gestisci). Le operazioni di questo file la
// richiamano con { mantieni: true } per restare dove si era.
async function renderPaginaLocation(opzioni) {
    const container = document.getElementById('locationContenuto');
    if (!container) return;

    if (!(opzioni && opzioni.mantieni === true)) {
        _locGestione = false;
        _locSelezione.clear();
        _locPannello = null;
    }

    const def = CATALOGO_WIDGET.location;
    let voci;
    try {
        const anteprima = def.preview();
        voci = (anteprima.dati && anteprima.dati.voci) || [];
    } catch (e) {
        console.error('renderPaginaLocation:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    // Unione con le location senza ancora nessuna carta. Un fallimento qui
    // non deve mai nascondere le location che hanno già delle carte.
    const binder = {};
    const userId = await authGetUserId();
    if (userId) {
        try {
            const { data: tutte, error } = await locationsList(userId);
            if (error) throw error;
            const nomiConCarte = new Set(voci.map(([nome]) => nome));
            (tutte || []).forEach(r => {
                if (r.nome && !nomiConCarte.has(r.nome)) voci.push([r.nome, 0]);
            });
        } catch (e) {
            console.error('renderPaginaLocation (locationsList):', e);
        }
        // Binder-location, solo per mostrare il nome in attesa di
        // approvazione (binders.nome_in_attesa). Non bloccante.
        try {
            const { data: binders, error } = await bindersQueryTutti(userId);
            if (error) throw error;
            (binders || []).filter(b => b.tipo === 'location' && b.location_valore).forEach(b => { binder[b.location_valore] = b; });
        } catch (e) {
            console.error('renderPaginaLocation (binders):', e);
        }
    }
    // Conteggio discendente, a parità alfabetico: le location vuote in fondo.
    voci.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

    _locDati = { voci, binder };
    // Selezione/pannello riferiti a nomi che non esistono più: via.
    const nomi = new Set(voci.map(([n]) => n));
    _locSelezione = new Set([..._locSelezione].filter(n => nomi.has(n)));
    if (_locPannello && !_locPannello.sorgenti.every(n => nomi.has(n))) _locPannello = null;

    _locDisegna();
}
