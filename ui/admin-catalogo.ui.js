// Admin, scheda Catalogo (sql/140): i set nuovi trovati di notte su TCGdex entrano nel catalogo solo
// quando l'admin conferma sigla e nome. Sotto: i set che il giro sta ricontrollando e gli ultimi giri.

function _catDataIt(d) {
    if (!d) return '—';
    const x = new Date(d);
    return isNaN(x) ? '—' : x.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _catOraIt(d) {
    const x = new Date(d);
    return isNaN(x) ? '—' : x.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function _catContatore(n) {
    const el = document.getElementById('count-catalogo');
    if (!el) return;
    el.textContent = String(n);
    el.classList.toggle('zero', !n);
}

function _catEsitoGiro(g) {
    const e = g.esito || {};
    if (g.tipo === 'elenco') {
        const nuovi = (e.nuovi || []).length;
        return `Elenco TCGdex: ${e.set_su_tcgdex ?? '?'} set, ${nuovi ? nuovi + ' nuovi (' + e.nuovi.join(', ') + ')' : 'nessuno nuovo'}`;
    }
    if (g.tipo === 'set') {
        if (!e.set) return 'Nessun set da ricontrollare';
        if (e.errore) return `${e.set}: ${e.errore}`;
        return `${e.set}: carte ${e.carte ?? '?'} · ${e.nuove ?? 0} righe nuove, ${e.completate ?? 0} completate`;
    }
    return 'Errore: ' + (e.errore || JSON.stringify(e));
}

async function caricaCatalogoAdmin() {
    const box = document.getElementById('catalogo-da-confermare');
    const boxAgg = document.getElementById('catalogo-aggiornamenti');
    const boxGiri = document.getElementById('catalogo-giri');
    if (!box) return;
    box.innerHTML = '<div class="empty-state">Caricamento…</div>';

    const [{ data: nuovi, error }, { data: agg }, { data: giri }] = await Promise.all([
        catalogoAdminSetDaConfermare(), catalogoAdminAggiornamenti(), catalogoAdminGiri(),
    ]);
    if (error) {
        box.innerHTML = `<div class="empty-state">Errore: ${escAttr(error.message)}</div>`;
        _catContatore(0);
        return;
    }
    _catContatore((nuovi || []).length);
    box.innerHTML = (nuovi || []).length ? nuovi.map(s => `
        <div class="row" style="flex-wrap:wrap;">
            <div class="main" style="min-width:220px;">
                <div class="name">${escAttr(s.nome_en || s.tcgdex_id)}</div>
                <div class="meta">TCGdex <code>${escAttr(s.tcgdex_id)}</code> · uscita ${_catDataIt(s.data_uscita)} · ${s.carte_totali ?? '?'} carte${s.carte_base ? ' (' + s.carte_base + ' base)' : ''}</div>
            </div>
            <input type="text" id="cat-sigla-${escAttr(s.tcgdex_id)}" value="${escAttr(s.sigla_proposta || '')}" placeholder="Sigla (es. DLR)" maxlength="12" style="width:110px; text-transform:uppercase;">
            <input type="text" id="cat-nome-${escAttr(s.tcgdex_id)}" value="${escAttr(s.nome_it || s.nome_en || '')}" placeholder="Nome italiano" maxlength="120" style="width:220px;">
            <button class="btn-small btn-approve" onclick="catalogoConfermaSet('${escAttr(s.tcgdex_id)}')">Conferma</button>
            <button class="btn-small btn-reject" onclick="catalogoIgnoraSet('${escAttr(s.tcgdex_id)}')">Ignora</button>
        </div>`).join('')
        : '<div class="empty-state">Nessun set nuovo da confermare.</div>';

    if (boxAgg) {
        boxAgg.innerHTML = (agg || []).length ? agg.map(a => {
            let e = a.esito; try { e = _catEsitoGiro({ tipo: 'set', esito: JSON.parse(a.esito) }); } catch (_) { }
            return `<div class="row"><div class="main">
                <div class="name">${escAttr(a.sigla)}${a.cursore > 0 ? ' · a metà (dalla carta ' + (a.cursore + 1) + ')' : ''}</div>
                <div class="meta">${a.controllato_il ? 'Ultimo controllo completo: ' + _catOraIt(a.controllato_il) : 'Mai controllato tutto'}${a.fino_al ? ' · ricontrollo fino al ' + _catDataIt(a.fino_al) : ''}</div>
                <div class="meta">${escAttr(e || '')}</div>
            </div></div>`;
        }).join('') : '<div class="empty-state">Nessun set ricontrollato finora.</div>';
    }
    if (boxGiri) {
        boxGiri.innerHTML = (giri || []).length ? giri.map(g => `
            <div class="row"><div class="main">
                <div class="name" style="font-weight:500;${g.tipo === 'errore' ? ' color:var(--danger);' : ''}">${escAttr(_catEsitoGiro(g))}</div>
                <div class="meta">${_catOraIt(g.il)}</div>
            </div></div>`).join('')
            : '<div class="empty-state">Il primo giro è stanotte (dalle 2 alle 5).</div>';
    }
}

async function catalogoConfermaSet(tcgdexId) {
    const sigla = (document.getElementById('cat-sigla-' + tcgdexId)?.value || '').trim().toUpperCase();
    const nome = (document.getElementById('cat-nome-' + tcgdexId)?.value || '').trim();
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(sigla)) { mostraStatus('Sigla non valida: lettere maiuscole, numeri e trattino, al massimo 12.', false); return; }
    if (!nome) { mostraStatus('Scrivi il nome del set.', false); return; }
    const ok = await adminDialog({
        titolo: 'Confermi il set?',
        testo: `${sigla} — ${nome}. Le carte arrivano nel catalogo col giro di stanotte. La sigla è quella che si scrive nel codice delle carte (es. "${sigla} 001"): dopo non si cambia da qui.`,
        conferma: 'Conferma',
    });
    if (!ok) return;
    const { error } = await catalogoAdminConferma(tcgdexId, sigla, nome);
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }
    if (typeof setEspansioniSvuotaCache === 'function') setEspansioniSvuotaCache();
    mostraStatus(`${sigla} aggiunto: le carte arrivano stanotte.`, true);
    caricaCatalogoAdmin();
}

async function catalogoIgnoraSet(tcgdexId) {
    const ok = await adminDialog({ titolo: 'Ignorare il set?', testo: 'Non verrà più proposto. Per riprenderlo serve una modifica sul DB.', conferma: 'Ignora', pericolo: true });
    if (!ok) return;
    const { error } = await catalogoAdminIgnora(tcgdexId);
    if (error) { mostraStatus('Errore: ' + error.message, false); return; }
    mostraStatus('Set ignorato.', true);
    caricaCatalogoAdmin();
}
