// ═══════════════════════════════════════════════════════════════════════
// RICHIESTE-SCAMBIO.UI.JS — pagina "Richieste" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// Fase 4, Step 3 (2026-09-13). Due viste (Ricevute/Inviate) sulle righe di
// richieste_scambio_righe — il nome/dettagli di ogni oggetto vengono dallo
// SNAPSHOT congelato nella riga (mai da una join su carte/prodotti_sealed,
// che potrebbero essere già stati modificati o non esistere più dopo una
// conclusione — vedi sql/48/50).
//
// NON QUI: l'invio di una nuova richiesta (Step 4, dal link pubblico
// binder-pubblico.html/scaffali-pubblico.html — non ancora fatto). Questa
// pagina gestisce SOLO richieste già esistenti.
//
// Dipende da: data/richieste-scambio.repository.js, ui/auth.ui.js
// (authGetUserId), utils condivisi (escapeHtml, formattaEuro).

let _richiesteVista = 'ricevute'; // 'ricevute' | 'inviate'
let _richiesteRicevute = [];
let _richiesteInviate = [];

const MOTIVI_ANNULLAMENTO = {
    ho_cambiato_idea: 'Ho cambiato idea',
    non_piu_disponibile: 'Non più disponibile',
    accordo_non_concluso: 'Accordo non concluso',
    errore_prenotazione: 'Errore nella prenotazione',
    sostituito_altro_accordo: 'Sostituito da un altro accordo',
    intervento_amministrativo: 'Intervento amministrativo',
};

const STATO_RIGA_LABEL = {
    in_attesa: { testo: 'In attesa', colore: 'var(--text-muted)' },
    accettata: { testo: 'Riservata', colore: 'var(--primary)' },
    rifiutata: { testo: 'Rifiutata', colore: 'var(--danger)' },
    annullata: { testo: 'Annullata', colore: 'var(--danger)' },
    conclusa: { testo: 'Conclusa', colore: 'var(--success)' },
};


async function apriPaginaRichieste() {
    const userId = await authGetUserId();
    if (!userId) return;

    const [{ data: ricevute, error: errRic }, { data: inviate, error: errInv }] = await Promise.all([
        richiesteScambioRicevuteList(userId),
        richiesteScambioInviateList(userId),
    ]);
    if (errRic) console.error('apriPaginaRichieste (ricevute):', errRic.message);
    if (errInv) console.error('apriPaginaRichieste (inviate):', errInv.message);

    _richiesteRicevute = ricevute || [];
    _richiesteInviate = inviate || [];

    renderPaginaRichieste();
}


function cambiaVistaRichieste(vista) {
    _richiesteVista = vista;
    document.getElementById('btnRichiesteRicevute').classList.toggle('active', vista === 'ricevute');
    document.getElementById('btnRichiesteInviate').classList.toggle('active', vista === 'inviate');
    renderPaginaRichieste();
}


function renderPaginaRichieste() {
    const wrap = document.getElementById('richiesteContenuto');
    if (!wrap) return;

    const righe = _richiesteVista === 'ricevute' ? _richiesteRicevute : _richiesteInviate;
    const eRicevute = _richiesteVista === 'ricevute';

    if (righe.length === 0) {
        wrap.innerHTML = `<div class="stato-vuoto"><i class="fa-solid fa-handshake"></i><br>Nessuna richiesta ${eRicevute ? 'ricevuta' : 'inviata'} ancora.</div>`;
        return;
    }

    wrap.innerHTML = righe.map(r => {
        const snap = r.snapshot || {};
        const nome = escapeHtml(snap.nome || snap.codice || '(senza nome)');
        const stato = STATO_RIGA_LABEL[r.stato_riga] || { testo: r.stato_riga, colore: 'var(--text-muted)' };
        const idAttr = String(r.id).replace(/'/g, "\\'");

        let azioni = '';
        if (eRicevute && r.stato_riga === 'in_attesa') {
            azioni = `
                <button class="btn-main" style="padding:0.4rem 0.8rem; font-size:0.78rem;" onclick="_azioneRichiesta('accetta', '${idAttr}')"><i class="fa-solid fa-check"></i> Accetta</button>
                <button class="btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.78rem;" onclick="_azioneRichiesta('rifiuta', '${idAttr}')"><i class="fa-solid fa-xmark"></i> Rifiuta</button>`;
        } else if (eRicevute && r.stato_riga === 'accettata') {
            azioni = `
                <button class="btn-main" style="padding:0.4rem 0.8rem; font-size:0.78rem;" onclick="_azioneRichiesta('concludi', '${idAttr}')"><i class="fa-solid fa-flag-checkered"></i> Concludi</button>
                <button class="btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.78rem; color:var(--danger);" onclick="_azioneRichiesta('sblocca', '${idAttr}')"><i class="fa-solid fa-unlock"></i> Sblocca</button>`;
        } else if (!eRicevute && (r.stato_riga === 'in_attesa' || r.stato_riga === 'accettata')) {
            azioni = `<button class="btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.78rem; color:var(--danger);" onclick="_azioneRichiesta('annulla', '${idAttr}')"><i class="fa-solid fa-ban"></i> Annulla</button>`;
        }

        const motivoTxt = r.motivo_chiusura ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;">Motivo: ${MOTIVI_ANNULLAMENTO[r.motivo_chiusura] || r.motivo_chiusura}</div>` : '';

        return `
            <div class="card-row" style="flex-wrap:wrap;">
                ${snap.immagine ? `<img src="${escapeHtml(snap.immagine)}" alt="" class="card-thumb" onerror="this.style.display='none';">` : ''}
                <div class="card-info" style="min-width:160px;">
                    <div class="card-name">${nome} <span style="font-weight:600; color:var(--text-muted);">×${r.quantita_richiesta}</span></div>
                    <div class="card-meta">
                        <span class="badge" style="color:${stato.colore}; border-color:${stato.colore};">${stato.testo}</span>
                        ${r.prezzo_congelato != null ? `<span class="badge">${formattaEuro(r.prezzo_congelato)} cad.</span>` : ''}
                    </div>
                    ${motivoTxt}
                </div>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">${azioni}</div>
            </div>`;
    }).join('');
}


// Punto unico per tutte le azioni — evita 5 funzioni quasi identiche,
// ognuna richiama semplicemente la RPC giusta con gli argomenti giusti.
async function _azioneRichiesta(azione, rigaId) {
    let risultato;

    if (azione === 'accetta') {
        if (!confirm('Accettare questa richiesta? La carta/prodotto diventerà riservato.')) return;
        risultato = await accettaRigaRichiesta(rigaId);

    } else if (azione === 'rifiuta') {
        if (!confirm('Rifiutare questa richiesta?')) return;
        risultato = await rifiutaRigaRichiesta(rigaId);

    } else if (azione === 'annulla' || azione === 'sblocca') {
        const motivo = await _chiediMotivo(azione);
        if (!motivo) return; // annullato dall'utente
        risultato = azione === 'annulla' ? await annullaRigaRichiesta(rigaId, motivo) : await sbloccaRigaRichiesta(rigaId, motivo);

    } else if (azione === 'concludi') {
        // Location SEMPRE "?" (Claudio, 2026-09-26): chi conclude non deve
        // vedere né scegliere le Location dell'altro utente — l'oggetto
        // arriva in "?" (Centro Operativo) e il destinatario lo sposta
        // dove vuole. Prima era un prompt() a testo libero.
        if (!confirm('Concludere lo scambio? L\'oggetto verrà trasferito ora, azione irreversibile.\nIl destinatario lo troverà nella Location "?" e potrà spostarlo dove vuole.')) return;
        risultato = await concludiRigaRichiesta(rigaId, '?');
    }

    if (risultato && risultato.error) {
        alert('❌ ' + risultato.error.message);
        return;
    }

    await apriPaginaRichieste(); // ricarica tutto, più semplice e sicuro di un aggiornamento locale mirato
}


// Motivo obbligatorio, uno dei 6 fissi (mai testo libero — coerente con la
// roadmap, "Motivi consentiti, senza testo libero").
// AGGIORNATO 2026-09-26 (Claudio): prima era un prompt() dove scrivere il
// numero a mano (un valore sbagliato annullava l'azione in silenzio). Ora
// è un piccolo riquadro con una tendina. Costruito qui al volo e rimosso
// alla chiusura: nessun HTML nuovo in index.html, nessun CSS nuovo — solo
// classi già esistenti (.modal-overlay/.modal-content come #qrModal,
// .filter-select, .btn-main/.btn-secondary). Agganciato a <body> come
// #qrModal, quindi sopra tutto il resto (z-index di .modal-overlay).
// Ritorna una Promise: la chiave del motivo scelto, oppure null se
// l'utente chiude/annulla (stesso contratto di prima per il chiamante).
function _chiediMotivo(azione) {
    return new Promise((risolvi) => {
        const titolo = azione === 'sblocca' ? 'Sbloccare la richiesta?' : 'Annullare la richiesta?';
        const opzioni = Object.keys(MOTIVI_ANNULLAMENTO)
            .map(k => `<option value="${k}">${escapeHtml(MOTIVI_ANNULLAMENTO[k])}</option>`).join('');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-content" style="text-align:left;">
                <div style="font-weight:700; margin-bottom:0.8rem;">${titolo}</div>
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:0.3rem;">Motivo</label>
                <select class="filter-select" style="width:100%;">
                    <option value="">— Scegli un motivo —</option>
                    ${opzioni}
                </select>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem;">
                    <button type="button" class="btn-secondary" data-azione="annulla">Indietro</button>
                    <button type="button" class="btn-main" data-azione="conferma" disabled>Conferma</button>
                </div>
            </div>`;

        const tendina = overlay.querySelector('select');
        const btnConferma = overlay.querySelector('[data-azione="conferma"]');

        function chiudi(valore) {
            document.removeEventListener('keydown', suTasto);
            overlay.remove();
            risolvi(valore);
        }
        function suTasto(e) { if (e.key === 'Escape') chiudi(null); }

        tendina.addEventListener('change', () => { btnConferma.disabled = !tendina.value; });
        btnConferma.addEventListener('click', () => { if (tendina.value) chiudi(tendina.value); });
        overlay.querySelector('[data-azione="annulla"]').addEventListener('click', () => chiudi(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(null); });
        document.addEventListener('keydown', suTasto);

        document.body.appendChild(overlay);
        tendina.focus();
    });
}
