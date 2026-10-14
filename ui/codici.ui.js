// ── ui/codici.ui.js ──────────────────────────────────────────────────────
// Impostazioni → Codici (2026-10-14): campo per riscattare un codice ed elenco
// dei codici già usati. Il controllo vero (codice valido, attivo, non scaduto,
// non già usato, limite tentativi) e l'accredito delle ricompense li fa il
// database in riscatta_codice (sql/102). Qui solo input, messaggi ed elenco.
//
// Finché sql/102 non è eseguito: "I codici non sono ancora attivi" e niente
// elenco (la sezione resta visibile, come richiesto).
//
// Si aggiorna al clic su "Codici" (PC, _impostazioniAlMostrare) e
// all'apertura della voce (telefono).
//
// Dipende da: data/codici.repository.js, escapeHtml (utils/comuni.js);
// facoltativi: polvereSaldoLeggi (data/bustina.repository.js), CSBar
// (statusbar.js), _widgetPolvereSaldo (ui/widget-polvere.ui.js).

let _codiciInCorso = null;      // lettura dell'elenco in corso
let _codiciRiscattoInCorso = false;

const _CODICI_NOMI = {
    polvere: ['Polvere', 'Polvere'],
    stampino: ['stampino', 'stampini'],
    bustina: ['bustina', 'bustine'],
    skip_missione: ['salta missione', 'salta missione'],
};

// Il database non ha (ancora) la funzione o la tabella: sql/102 non eseguito.
function _codiciNonAttivi(error) {
    const codice = String(error && error.code || '');
    const testo = String(error && error.message || '');
    return codice === 'PGRST202' || codice === 'PGRST205' || codice === '42883' || codice === '42P01'
        || (/riscatta_codice|codici_riscattati/i.test(testo) && /schema cache|does not exist|Could not find/i.test(testo));
}

function _codiciTestoRicompense(lista) {
    if (!Array.isArray(lista) || !lista.length) return '';
    return lista.map(r => {
        const n = Number(r && r.quantita) || 1;
        const nomi = _CODICI_NOMI[r && r.tipo] || [String(r && r.tipo || ''), String(r && r.tipo || '')];
        return `+${n.toLocaleString('it-IT')} ${n === 1 ? nomi[0] : nomi[1]}`;
    }).join(' · ');
}

function _codiciMessaggio(testo, tipo) {
    const el = document.getElementById('impCodiciMsg');
    if (!el) return;
    el.textContent = testo || '';
    el.className = 'imp-nota imp-codici-msg' + (tipo ? ' ' + tipo : '');
    el.style.display = testo ? '' : 'none';
}

async function codiciRiscattaDaCampo() {
    if (_codiciRiscattoInCorso) return;
    const input = document.getElementById('impCodiceInput');
    const btn = document.getElementById('impCodiceBtn');
    const codice = String(input && input.value || '').replace(/\s+/g, '').toUpperCase();
    if (!codice) { _codiciMessaggio('Scrivi un codice.', 'errore'); if (input) input.focus(); return; }

    _codiciRiscattoInCorso = true;
    if (btn) btn.disabled = true;
    _codiciMessaggio('Controllo il codice…', '');
    try {
        let risposta;
        try { risposta = await codiciRiscatta(codice); } catch (e) { risposta = { data: null, error: e }; }
        const { data, error } = risposta || {};
        if (error) {
            if (_codiciNonAttivi(error)) _codiciMessaggio('I codici non sono ancora attivi: riprova più avanti.', 'info');
            else { console.error('[codici] riscatto:', error.message || error); _codiciMessaggio('Non sono riuscito a controllare il codice. Riprova tra poco.', 'errore'); }
            return;
        }
        if (!data || data.ok !== true) {
            _codiciMessaggio((data && data.errore) || 'Codice non valido.', 'errore');
            return;
        }
        const premi = _codiciTestoRicompense(data.ricompense);
        _codiciMessaggio(`Codice riscattato!${data.descrizione ? ' ' + data.descrizione + '.' : ''}${premi ? ' ' + premi : ''}`, 'ok');
        if (input) input.value = '';
        codiciAggiorna();
        _codiciAggiornaPolvere(data.ricompense);
    } finally {
        _codiciRiscattoInCorso = false;
        if (btn) btn.disabled = false;
    }
}

// Saldo Polvere nella barra in alto e nella tessera, se il codice ne ha data.
function _codiciAggiornaPolvere(ricompense) {
    if (!Array.isArray(ricompense) || !ricompense.some(r => r && r.tipo === 'polvere')) return;
    if (typeof _widgetPolvereSaldo !== 'undefined' && _widgetPolvereSaldo) _widgetPolvereSaldo.quando = 0;
    if (typeof polvereSaldoLeggi !== 'function') return;
    polvereSaldoLeggi().then(({ data, error }) => {
        if (error || typeof CSBar === 'undefined') return;
        try { CSBar.setCurrency({ value: Number(data) || 0, glyph: '✧', label: 'Polvere' }); } catch (_) { /* niente */ }
    }).catch(() => { /* niente: il saldo si aggiorna al giro successivo */ });
}

function codiciAggiorna() {
    if (_codiciInCorso) return _codiciInCorso;
    _codiciInCorso = _codiciCaricaUsati().finally(() => { _codiciInCorso = null; });
    return _codiciInCorso;
}

async function _codiciCaricaUsati() {
    const box = document.getElementById('impCodiciUsati');
    const riass = document.getElementById('impCodiciRiassunto');
    if (!box) return;
    let risposta;
    try { risposta = await codiciUsatiLeggi(50); } catch (e) { risposta = { data: null, error: e }; }
    const { data, error } = risposta || {};
    if (error) {
        box.innerHTML = '';
        if (!_codiciNonAttivi(error)) console.error('[codici] elenco:', error.message || error);
        return;
    }
    const righe = Array.isArray(data) ? data : [];
    if (riass) riass.textContent = righe.length
        ? `${righe.length} codic${righe.length === 1 ? 'e usato' : 'i usati'} · scrivine un altro per riscattarlo`
        : 'Hai un codice? Scrivilo qui per ricevere il premio';
    if (!righe.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<p class="imp-etichetta">CODICI USATI</p>` + righe.map(r => {
        const quando = r.riscattato_il ? new Date(r.riscattato_il).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const premi = _codiciTestoRicompense(r.ricompense);
        return `<div class="imp-codici-riga-usato">
            <span class="imp-ico"><i class="fa-solid fa-gift"></i></span>
            <div class="imp-codici-testo"><b>${escapeHtml(r.codice || '')}</b><span>${escapeHtml([r.descrizione, premi].filter(Boolean).join(' · '))}</span></div>
            <span class="imp-codici-data">${escapeHtml(quando)}</span>
        </div>`;
    }).join('');
}
