// ── ui/avvisi.ui.js ──────────────────────────────────────────────────────
// (Q2 quality of life, 2026-10-12) Avvisi e finestre del sito al posto di
// alert(), confirm() e prompt() del browser: stessa grafica del sito (tema
// chiaro/scuro), la pagina non si blocca, il testo entra sempre come TESTO
// (textContent), mai come HTML.
//
//   mostraAvviso(testo)           messaggio breve in basso (scompare da solo);
//                                 se lungo o su più righe, finestra con OK.
//                                 Sostituisce alert(): non blocca, quindi il
//                                 codice dopo continua subito.
//   avvisoBreve(testo, opz)       messaggio in basso. opz: { tipo: 'ok' |
//                                 'errore' | 'info', durata (ms), azione:
//                                 { etichetta, fn } } — es. "Annulla" (Q3).
//   chiediConferma(opz)           → Promise<boolean>. opz: { titolo, testo,
//                                 conferma, annulla, pericolo }.
//   chiediTesto(opz)              → Promise<string|null> (null = Annulla,
//                                 come prompt()). opz: { titolo, testo,
//                                 valore, segnaposto, conferma, tipo,
//                                 maxLength, opzioni (suggerimenti),
//                                 multiriga (testo lungo da copiare) }.
//   avvisoFisso(id, testo, opz)   barra che resta finché avvisoFissoTogli(id)
//   avvisoFissoTogli(id)          (Q1: collezione non caricata + Riprova).
//
// Le finestre si aprono una alla volta (le altre aspettano in fila); Esc =
// Annulla, Invio = Conferma. Nessuna dipendenza: si può caricare ovunque
// prima del primo clic dell'utente.

const _AVVISI_ICONE = { ok: 'fa-circle-check', errore: 'fa-triangle-exclamation', info: 'fa-circle-info' };
let _avvisiFila = Promise.resolve(); // finestre: una alla volta

function _avvisiPila() {
    let pila = document.getElementById('avvisiPila');
    if (!pila) {
        pila = document.createElement('div');
        pila.id = 'avvisiPila';
        pila.setAttribute('role', 'status');
        pila.setAttribute('aria-live', 'polite');
        document.body.appendChild(pila);
    }
    return pila;
}

// Testi che arrivano dai vecchi alert(): l'emoji iniziale diceva il tipo.
function _avvisoTipoDaTesto(testo) {
    const t = String(testo || '').trim();
    if (/^(❌|⚠️|⚠|⛔|🚫)/.test(t) || /^(errore|impossibile|non riesco|non è stato possibile)/i.test(t)) return 'errore';
    if (/^(✓|✔|✅|✅️|🎉|📋)/.test(t)) return 'ok';
    return 'info';
}

// L'icona dice già il tipo: via il simbolo iniziale dei vecchi alert().
function _avvisoPulisci(testo) {
    return String(testo == null ? '' : testo).replace(/^\s*(❌|⚠️|⚠|✅|✓|✔️|✔)\s*/u, '');
}

function _avvisoCreaBolla(testo, opz) {
    const tipo = opz.tipo || _avvisoTipoDaTesto(testo);
    const bolla = document.createElement('div');
    bolla.className = 'avviso-bolla avviso-' + tipo;
    const icona = document.createElement('i');
    icona.className = 'fa-solid ' + (_AVVISI_ICONE[tipo] || _AVVISI_ICONE.info);
    icona.setAttribute('aria-hidden', 'true');
    const corpo = document.createElement('span');
    corpo.className = 'avviso-testo';
    corpo.textContent = _avvisoPulisci(testo);
    bolla.append(icona, corpo);
    if (opz.azione && opz.azione.etichetta && typeof opz.azione.fn === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avviso-azione';
        btn.textContent = opz.azione.etichetta;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            btn.disabled = true;
            if (!opz.fisso) _avvisoChiudiBolla(bolla);
            try { opz.azione.fn(); } catch (err) { console.error('[avvisi] azione:', err); }
            if (opz.fisso) setTimeout(() => { btn.disabled = false; }, 1500);
        });
        bolla.appendChild(btn);
    }
    if (!opz.fisso) {
        const chiudi = document.createElement('button');
        chiudi.type = 'button';
        chiudi.className = 'avviso-chiudi';
        chiudi.setAttribute('aria-label', 'Chiudi');
        chiudi.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        chiudi.addEventListener('click', (e) => { e.stopPropagation(); _avvisoChiudiBolla(bolla); });
        bolla.appendChild(chiudi);
    }
    return bolla;
}

function _avvisoChiudiBolla(bolla) {
    if (!bolla || bolla._chiusa) return;
    bolla._chiusa = true;
    clearTimeout(bolla._timer);
    bolla.classList.add('avviso-esce');
    setTimeout(() => bolla.remove(), 220);
}

function avvisoBreve(testo, opz) {
    opz = opz || {};
    const pila = _avvisiPila();
    const bolla = _avvisoCreaBolla(testo, opz);
    pila.appendChild(bolla);
    // Al massimo 4 messaggi a schermo: i più vecchi lasciano il posto.
    const bolle = [...pila.querySelectorAll('.avviso-bolla:not(.avviso-fisso)')].filter(b => !b._chiusa);
    bolle.slice(0, Math.max(0, bolle.length - 4)).forEach(_avvisoChiudiBolla);
    const tipo = opz.tipo || _avvisoTipoDaTesto(testo);
    const durata = opz.durata || (opz.azione ? 6000 : (tipo === 'errore' ? 6500 : 3800));
    bolla._timer = setTimeout(() => _avvisoChiudiBolla(bolla), durata);
    // Il tempo si ferma mentre ci si passa sopra / lo si tocca.
    bolla.addEventListener('pointerenter', () => clearTimeout(bolla._timer));
    bolla.addEventListener('pointerleave', () => { if (!bolla._chiusa) bolla._timer = setTimeout(() => _avvisoChiudiBolla(bolla), 2500); });
    return { chiudi: () => _avvisoChiudiBolla(bolla) };
}

// Al posto di alert(): breve → in basso; lungo o su più righe → finestra.
function mostraAvviso(testo, opz) {
    const t = String(testo == null ? '' : testo);
    if (t.length > 110 || t.includes('\n')) return mostraMessaggio({ testo: _avvisoPulisci(t), tipo: (opz && opz.tipo) || _avvisoTipoDaTesto(t) });
    avvisoBreve(t, opz);
    return Promise.resolve();
}

// ── Barre fisse (restano finché non si tolgono) ─────────────────────────
function avvisoFisso(id, testo, opz) {
    opz = Object.assign({}, opz || {}, { fisso: true });
    const pila = _avvisiPila();
    const vecchia = pila.querySelector('.avviso-fisso[data-id="' + String(id).replace(/[^a-z0-9_-]/gi, '') + '"]');
    const bolla = _avvisoCreaBolla(testo, opz);
    bolla.classList.add('avviso-fisso');
    bolla.dataset.id = String(id).replace(/[^a-z0-9_-]/gi, '');
    if (vecchia) vecchia.replaceWith(bolla);
    else pila.insertBefore(bolla, pila.firstChild);
}

function avvisoFissoTogli(id) {
    const pila = document.getElementById('avvisiPila');
    if (!pila) return;
    const bolla = pila.querySelector('.avviso-fisso[data-id="' + String(id).replace(/[^a-z0-9_-]/gi, '') + '"]');
    if (bolla) _avvisoChiudiBolla(bolla);
}

// ── Finestre ─────────────────────────────────────────────────────────────
// Costruisce la finestra e risolve con il valore scelto. Una alla volta.
function _avvisoFinestra(costruisci) {
    const turno = _avvisiFila.then(() => new Promise(resolve => {
        const fondo = document.createElement('div');
        fondo.className = 'avviso-fondo';
        const box = document.createElement('div');
        box.className = 'avviso-finestra';
        box.setAttribute('role', 'alertdialog');
        box.setAttribute('aria-modal', 'true');
        fondo.appendChild(box);
        const giaAttivo = document.activeElement;
        let chiusa = false;
        const chiudi = (valore) => {
            if (chiusa) return;
            chiusa = true;
            document.removeEventListener('keydown', tasti, true);
            fondo.classList.add('avviso-esce');
            setTimeout(() => fondo.remove(), 180);
            try { if (giaAttivo && giaAttivo.focus) giaAttivo.focus({ preventScroll: true }); } catch (_) { /* elemento sparito */ }
            resolve(valore);
        };
        const ctl = costruisci(box, chiudi);
        const tasti = (e) => {
            if (e.key === 'Tab') {
                // Il fuoco resta dentro la finestra (niente clic "alla cieca" sotto).
                const voci = [...box.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled);
                if (!voci.length) return;
                const i = voci.indexOf(document.activeElement);
                const prossimo = e.shiftKey ? (i <= 0 ? voci.length - 1 : i - 1) : (i === voci.length - 1 ? 0 : i + 1);
                e.preventDefault();
                voci[prossimo].focus();
                return;
            }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(ctl.annulla()); }
            else if (e.key === 'Enter' && !e.shiftKey && !(e.target && e.target.tagName === 'TEXTAREA')) {
                // Invio sul bottone Annulla lo preme (comportamento normale del bottone).
                if (e.target && e.target.classList && e.target.classList.contains('avviso-annulla')) return;
                e.preventDefault(); e.stopPropagation(); chiudi(ctl.conferma());
            }
        };
        document.addEventListener('keydown', tasti, true);
        fondo.addEventListener('click', (e) => { if (e.target === fondo) chiudi(ctl.annulla()); });
        document.body.appendChild(fondo);
        setTimeout(() => { try { (ctl.fuoco || box).focus({ preventScroll: true }); } catch (_) { /* nessun fuoco */ } }, 0);
    }));
    _avvisiFila = turno.catch(() => {});
    return turno;
}

function _avvisoTitolo(box, testoTitolo, tipo) {
    if (!testoTitolo && !tipo) return;
    const h = document.createElement('h3');
    h.className = 'avviso-titolo';
    if (tipo) {
        const i = document.createElement('i');
        i.className = 'fa-solid ' + (_AVVISI_ICONE[tipo] || _AVVISI_ICONE.info);
        i.setAttribute('aria-hidden', 'true');
        h.appendChild(i);
    }
    const s = document.createElement('span');
    s.textContent = testoTitolo || (tipo === 'errore' ? 'Attenzione' : (tipo === 'ok' ? 'Fatto' : 'Avviso'));
    h.appendChild(s);
    box.appendChild(h);
}

function _avvisoParagrafo(box, testo) {
    if (testo == null || testo === '') return;
    const p = document.createElement('p');
    p.className = 'avviso-corpo';
    p.textContent = String(testo);
    box.appendChild(p);
}

function _avvisoBottoni(box, voci) {
    const riga = document.createElement('div');
    riga.className = 'avviso-bottoni';
    const creati = voci.map(v => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = v.classe;
        b.textContent = v.etichetta;
        b.addEventListener('click', v.fn);
        riga.appendChild(b);
        return b;
    });
    box.appendChild(riga);
    return creati;
}

function mostraMessaggio(opz) {
    opz = opz || {};
    return _avvisoFinestra((box, chiudi) => {
        _avvisoTitolo(box, opz.titolo, opz.tipo || 'info');
        _avvisoParagrafo(box, opz.testo);
        const [ok] = _avvisoBottoni(box, [{ etichetta: opz.conferma || 'OK', classe: 'btn-main', fn: () => chiudi(undefined) }]);
        return { conferma: () => undefined, annulla: () => undefined, fuoco: ok };
    });
}

function chiediConferma(opz) {
    opz = typeof opz === 'string' ? { testo: opz } : (opz || {});
    return _avvisoFinestra((box, chiudi) => {
        _avvisoTitolo(box, opz.titolo || 'Confermi?', null);
        _avvisoParagrafo(box, opz.testo);
        const [, ok] = _avvisoBottoni(box, [
            { etichetta: opz.annulla || 'Annulla', classe: 'btn-secondary avviso-annulla', fn: () => chiudi(false) },
            { etichetta: opz.conferma || 'Conferma', classe: opz.pericolo ? 'btn-main avviso-pericolo' : 'btn-main', fn: () => chiudi(true) },
        ]);
        return { conferma: () => true, annulla: () => false, fuoco: ok };
    });
}

function chiediTesto(opz) {
    opz = typeof opz === 'string' ? { testo: opz } : (opz || {});
    return _avvisoFinestra((box, chiudi) => {
        _avvisoTitolo(box, opz.titolo || 'Scrivi', null);
        _avvisoParagrafo(box, opz.testo);
        // multiriga: testi lunghi da copiare (un <input> toglierebbe gli a capo)
        const campo = document.createElement(opz.multiriga ? 'textarea' : 'input');
        if (opz.multiriga) campo.rows = 7; else campo.type = opz.tipo || 'text';
        campo.className = 'avviso-campo';
        campo.value = opz.valore == null ? '' : String(opz.valore);
        if (opz.segnaposto) campo.placeholder = opz.segnaposto;
        if (opz.maxLength) campo.maxLength = opz.maxLength;
        if (opz.tipo === 'number' || opz.numerico) campo.inputMode = 'decimal';
        campo.autocomplete = 'off';
        if (Array.isArray(opz.opzioni) && opz.opzioni.length) {
            const lista = document.createElement('datalist');
            lista.id = 'avvisoSuggerimenti' + Date.now();
            opz.opzioni.forEach(v => { const o = document.createElement('option'); o.value = String(v); lista.appendChild(o); });
            campo.setAttribute('list', lista.id);
            box.appendChild(lista);
        }
        box.appendChild(campo);
        _avvisoBottoni(box, [
            { etichetta: opz.annulla || 'Annulla', classe: 'btn-secondary avviso-annulla', fn: () => chiudi(null) },
            { etichetta: opz.conferma || 'OK', classe: 'btn-main', fn: () => chiudi(campo.value) },
        ]);
        setTimeout(() => { try { campo.select(); } catch (_) { /* campo numerico */ } }, 0);
        return { conferma: () => campo.value, annulla: () => null, fuoco: campo };
    });
}
