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

// ── PAGINA "LOCATION" (2026-08-30) ──────────────────────────────────────
// Terzo widget con pagina di dettaglio propria. Due fonti unite:
//   1) CATALOGO_WIDGET.location.preview() → dati.voci: location USATE da
//      almeno una carta, con conteggio (da carteReali, stesso calcolo del
//      tile — nessuna query nuova per questa parte).
//   2) locationsList(userId) (data/locations.repository.js) → TUTTE le
//      location esistenti nella tabella 'location', comprese quelle senza
//      ancora nessuna carta. Necessaria: senza unire le due fonti, una
//      location appena creata (0 carte) non comparirebbe mai qui, e
//      sembrerebbe che "+ Aggiungi" non abbia fatto nulla.
// Click su una riga → RIUSA _ballAzioneRiga(evt,'location',nome), lo
// stesso meccanismo già esistente che apre Visualizzazione filtrata su
// quella location — nessuna logica di filtro duplicata qui.
//
// "+ Aggiungi" ora reale (locationInsert, con locationExists prima per
// evitare doppioni — nessun vincolo UNIQUE noto sulla tabella).
// "✕ Rimuovi" resta placeholder: data/locations.repository.js non ha
// nessuna funzione di eliminazione — non inventata.
// Opzione A confermata da Claudio: blocca l'eliminazione se la location ha
// ancora almeno una carta assegnata — le carte salvano la location come
// testo libero (c.location), non un riferimento alla tabella, quindi
// cancellarla senza controllo lascerebbe carte con un nome "orfano" (non
// più presente in 'location' ma ancora scritto sulla carta).
async function _locationRimuovi(nome) {
    const carteConQuestaLocation = carteReali.filter(c => c.stato === 'collezione' && (c.location || '—') === nome).length;
    if (carteConQuestaLocation > 0) {
        alert(`"${nome}" ha ancora ${carteConQuestaLocation} cart${carteConQuestaLocation === 1 ? 'a assegnata' : 'e assegnate'}. Sposta prima quelle carte su un'altra location, poi riprova.`);
        return;
    }
    if (!confirm(`Eliminare la location "${nome}"? Non ha nessuna carta assegnata.`)) return;

    const userId = await authGetUserId();
    if (!userId) return;
    const { error } = await locationDelete(userId, nome);
    if (error) { alert('Errore nella cancellazione: ' + error.message); return; }

    renderPaginaLocation();
}

async function _locationAggiungi() {
    const nome = (prompt('Nome della nuova location:') || '').trim();
    if (!nome) return;
    const userId = await authGetUserId();
    if (!userId) return;

    const { data: esistenti, error: errCheck } = await locationExists(userId, nome);
    if (errCheck) { alert('Errore nel controllo: ' + errCheck.message); return; }
    if (esistenti && esistenti.length > 0) { alert(`"${nome}" esiste già.`); return; }

    const { error: errIns } = await locationInsert(userId, nome);
    if (errIns) { alert('Errore nella creazione: ' + errIns.message); return; }

    renderPaginaLocation(); // ricarica la pagina, la nuova location comparirà con 0 carte
}

async function renderPaginaLocation() {
    const container = document.getElementById('locationContenuto');
    if (!container) return;

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

    // Unione con le location senza ancora nessuna carta (vedi commento
    // sopra). Fallimento qui non deve mai nascondere le location che
    // hanno già delle carte (quelle sopra sono già pronte) — solo le
    // location vuote in più non compariranno.
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
    }
    // Riordina dopo l'unione: conteggio discendente, a parità alfabetico —
    // così le location vuote (0) finiscono in fondo, non sparse a caso.
    voci.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Location</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0 0.5rem;">Nessuna carta ha ancora una location.</p>
            <div class="pg-bottoni" style="justify-content:center;">
                <button class="primario" onclick="_locationAggiungi()">+ Crea la prima location</button>
            </div>
        `;
        return;
    }

    const totale = voci.length;
    const [nomePiuPiena, conteggioPiuPieno] = voci[0];

    const righe = voci.map(([nome, n]) => `
        <div class="pg-riga" data-tocca>
            <div class="pg-testo" style="cursor:pointer;" onclick="_ballAzioneRiga(event, 'location', '${String(nome).replace(/'/g, "\\'")}')">
                <b>${escapeHtml(nome)}</b>
            </div>
            <div class="pg-destra" style="cursor:pointer;" onclick="_ballAzioneRiga(event, 'location', '${String(nome).replace(/'/g, "\\'")}')">
                <b>${n}</b>${n === 1 ? 'carta' : 'carte'}
            </div>
            <span class="pg-filtro" style="margin-left:8px;" onclick="event.stopPropagation(); _locationRimuovi('${String(nome).replace(/'/g, "\\'")}')" title="Rimuovi location">✕</span>
        </div>`).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Location</span>
            <span class="page-azione attiva" onclick="_locationAggiungi()">+ Aggiungi</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">più piena: ${escapeHtml(nomePiuPiena)} (${conteggioPiuPieno} carte)</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Location totali</span></div>
                <div><b>${escapeHtml(nomePiuPiena)}</b><span>Più piena (${conteggioPiuPieno})</span></div>
            </div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}
