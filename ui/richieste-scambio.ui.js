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
        const motivo = _chiediMotivo();
        if (!motivo) return; // annullato dall'utente
        risultato = azione === 'annulla' ? await annullaRigaRichiesta(rigaId, motivo) : await sbloccaRigaRichiesta(rigaId, motivo);

    } else if (azione === 'concludi') {
        const location = (prompt('Dove il destinatario metterà l\'oggetto ricevuto? (lascia vuoto per "?" — Centro Operativo)') || '').trim();
        if (!confirm('Concludere lo scambio? L\'oggetto verrà trasferito ora, azione irreversibile.')) return;
        risultato = await concludiRigaRichiesta(rigaId, location || '?');
    }

    if (risultato && risultato.error) {
        alert('❌ ' + risultato.error.message);
        return;
    }

    await apriPaginaRichieste(); // ricarica tutto, più semplice e sicuro di un aggiornamento locale mirato
}


// Motivo obbligatorio, uno dei 6 fissi (mai testo libero — coerente con la
// roadmap, "Motivi consentiti, senza testo libero"). prompt() con numero
// invece di un select dedicato: più veloce da costruire, coerente con lo
// stesso livello di rifinitura già usato per altre azioni rapide in questa
// sessione — un select vero è un miglioramento facile per una sessione
// futura se Claudio lo preferisce.
function _chiediMotivo() {
    const chiavi = Object.keys(MOTIVI_ANNULLAMENTO);
    const elenco = chiavi.map((k, i) => `${i + 1}. ${MOTIVI_ANNULLAMENTO[k]}`).join('\n');
    const scelta = prompt(`Motivo (scrivi il numero):\n${elenco}`);
    const idx = parseInt(scelta, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= chiavi.length) return null;
    return chiavi[idx];
}
