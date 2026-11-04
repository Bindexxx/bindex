// Componenti comuni delle tessere grandi.

function _ballAzioneRiga(evt, tipo, valore, origine) {
    if (evt) evt.stopPropagation();
    if (_editModeWidget) return;
    _vibraSeSupportato(8);
    switch (tipo) {
        case 'carta':
            if (typeof apriFlipCardHome === 'function') apriFlipCardHome(valore, origine ? { origine } : {});
            break;

        case 'tab':
            apriDettaglioWidget(valore, evt);
            break;

        case 'chat-conversazione':
            apriDettaglioWidget('chat', evt);
            if (typeof apriChat === 'function' && typeof DURATA_ANIMAZIONE_DETTAGLIO_MS !== 'undefined') {
                setTimeout(() => apriChat(valore, origine || 'Utente'), DURATA_ANIMAZIONE_DETTAGLIO_MS + 50);
            }
            break;

        case 'prezzi-scaduti':
            if (typeof apriModalePrezziScaduti === 'function') apriModalePrezziScaduti();
            else apriDettaglioWidget('prezzi', evt);
            break;

        case 'location':
            apriDettaglioWidget('visualizzazione', evt);
            setTimeout(() => {
                const select = document.getElementById('filterLocation');
                if (!select || typeof filterTable !== 'function') return;
                const esiste = Array.from(select.options).some(o => o.value === valore);
                if (!esiste) return;
                select.value = valore;
                filterTable();
            }, 60);
            break;
    }
}

function _ballTintaDaNome(nome) {
    let h = 0;
    const t = String(nome || '');
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
    return `hsl(${h}, 52%, 58%)`;
}

function _ballMiniCarta(c, badge, origine) {
    const titolo = String(c.nome || '').replace(/"/g, '&quot;');
    const clic = `onclick="_ballAzioneRiga(event,'carta','${c.id}','${origine || ''}')"`;
    const badgeHtml = badge ? `<b class="ball-mini-badge">${badge}</b>` : '';

    const speciale = c.rarita && /ultra|secret/i.test(String(c.rarita));
    const anello = (c.rarita === 'rara' || c.rarita === 'ultra_rara' || c.rarita === 'secret') ? ' r-' + c.rarita : '';
    const classi = 'ball-mini' + anello + (speciale ? ' holo' : '');

    if (c.immagine) {
        const url = _urlImmagineVisualizzabile(c.immagine, 96) || '';
        return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}>
                    <i></i><u></u>
                    <img src="${url}" alt="" onerror="this.remove();">
                    ${badgeHtml}
                </span>`;
    }
    return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}><i></i><u></u>${badgeHtml}</span>`;
}

function _ballSparkline(serie, colore) {
    if (!serie || serie.length < 2) return '';
    const min = Math.min(...serie), max = Math.max(...serie);
    const span = (max - min) || 1;
    const punti = serie.map((v, i) => {
        const x = (i / (serie.length - 1)) * 100;
        const y = 30 - ((v - min) / span) * 26;
        return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return `<svg class="ball-spark" viewBox="0 0 100 34" preserveAspectRatio="none">
        <polygon points="0,34 ${punti.join(' ')} 100,34" fill="${colore}" opacity=".16"/>
        <polyline points="${punti.join(' ')}" fill="none" stroke="${colore}" stroke-width="2.4"
                  stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

function _ballRigaBarra(nome, dato, percento, azione) {
    const p = Math.max(0, Math.min(100, percento));
    const clic = azione ? ` onclick="${azione}" class="ball-riga-set ball-clic"` : ' class="ball-riga-set"';
    return `<div${clic}>
        <div class="ball-riga"><span class="ball-nome">${nome}</span><span class="ball-dato">${dato}</span></div>
        <div class="ball-barra-out"><div class="ball-barra-in" style="width:${p}%"></div></div>
    </div>`;
}

function _ballRiga(nome, ...dati) {
    return `<div class="ball-riga">
        <span class="ball-nome">${nome}</span>
        ${dati.map(d => `<span class="ball-dato">${d}</span>`).join('')}
    </div>`;
}

function _ballCorpoSegnaposto(titolo, d) {
    return {
        inline:
            `<p class="ball-k-tit">${titolo}</p>` +
            '<div class="ball-k-mid ball-attesa">In arrivo</div>' +
            `<span class="ball-k-lab">${(d && d.testo) || ''}</span>`,
        blocco: ''
    };
}

const _BALL_TAVOLOZZA = ['#7c4dff', '#e0457b', '#1f88c9', '#e6a100', '#2f8f6b', '#9a5a2a', '#5aa8d8', '#8a8f98'];
function _ballColoreDaChiave(k) {
    let h = 0;
    const t = String(k == null ? '' : k);
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return _BALL_TAVOLOZZA[h % _BALL_TAVOLOZZA.length];
}
function _binderColore(binder) {
    const c = binder && binder.colore;
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
    return _ballColoreDaChiave((binder && (binder.nome || binder.tipo)) || '');
}
function _ballCopertine(voci, riempi) {
    const esc = (t) => (typeof escapeHtml === 'function' ? escapeHtml(t) : String(t));
    if (riempi) {
        return '<div class="ball-cov ball-cov-fill">' + voci.map(v =>
            `<span class="ball-cov-v"><i style="background:${(v.colore && /^#[0-9a-fA-F]{6}$/.test(v.colore)) ? v.colore : _ballColoreDaChiave(v.nome)}" title="${esc(v.nome)}">${v.icona ? `<em class="fa-solid ${v.icona}"></em>` : ''}${v.pubblico ? '<b class="fa-solid fa-globe"></b>' : ''}</i><small>${esc(v.nome)}</small></span>`
        ).join('') + '</div>';
    }
    return '<div class="ball-cov">' + voci.map(v =>
        `<i style="background:${(v.colore && /^#[0-9a-fA-F]{6}$/.test(v.colore)) ? v.colore : _ballColoreDaChiave(v.nome)}" title="${esc(v.nome)}">${v.icona ? `<em class="fa-solid ${v.icona}"></em>` : ''}${v.pubblico ? '<b class="fa-solid fa-globe"></b>' : ''}</i>`
    ).join('') + '</div>';
}

function _ballRipiano(n, chiavi) {
    const quante = Math.min(7, n || 0);
    const altezze = [26, 20, 24, 18, 26, 22, 20];
    let scatole = '';
    for (let i = 0; i < quante; i++) {
        const tinta = _BALL_TAVOLOZZA[i % _BALL_TAVOLOZZA.length];
        scatole += `<b style="left:${10 + i * 26}px;height:${altezze[i]}px;background:${tinta}"></b>`;
    }
    return `<div class="ball-ripiano">${scatole}</div>`;
}

function _ballQuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const giorno = new Date(d); giorno.setHours(0, 0, 0, 0);
    const diff = Math.round((oggi - giorno) / 86400000);
    if (diff === 0) return 'oggi';
    if (diff === 1) return 'ieri';
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}

function _ballPill(testo, acceso) {
    return `<span class="ball-pill${acceso ? ' acceso' : ''}">${testo}</span>`;
}

function _ballPulsante(testo, azione) {
    return `<button type="button" class="ball-azione" onclick="${azione}">${testo}</button>`;
}

function _ballCorpoFotoCarta(d) {
    if (!d || !d.immagine) return '';
    const url = _urlImmagineVisualizzabile(d.immagine, 300) || '';
    if (!url) return '';

    const esc = (t) => (typeof escapeHtml === 'function' ? escapeHtml(t) : String(t));
    const eur = (v) => formattaEuro(v);
    const coloreVar = d.variazioneNumerica > 0 ? 'var(--success)'
        : (d.variazioneNumerica < 0 ? 'var(--danger)' : 'var(--text-muted)');

    const ombra = 'text-shadow:0 1px 3px rgba(0,0,0,.6);';
    return `
        <div class="ball-foto-carta" style="position:relative; width:100%; flex:1 1 0; min-height:0; container-type:size;">
            <div class="ball-foto-carta-c" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); height:min(100cqh, calc(100cqw * 88 / 63)); aspect-ratio:63 / 88; border-radius:6% / 4.3%; overflow:hidden; background:transparent; container-type:size; box-shadow:0 4px 14px rgba(0,0,0,.25);">
                <img src="${url}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;" onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(150deg, ${_ballTintaDaNome(d.nome)}, rgba(0,0,0,.35))';">
                <div style="position:absolute; inset:0; background:linear-gradient(180deg, transparent 55%, rgba(0,0,0,.85) 100%);"></div>
                <div style="position:absolute; left:0; right:0; bottom:0; padding:6cqw 7cqw; color:#fff; min-width:0;">
                    <div style="font-weight:800; font-size:clamp(0.6rem, 8cqw, 0.95rem); line-height:1.15; ${ombra} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(d.nome || '')}</div>
                    ${d.codice ? `<div style="font-size:clamp(0.5rem, 6cqw, 0.72rem); opacity:.85; margin-top:0.05rem; ${ombra}">${esc(d.codice)}</div>` : ''}
                    <div style="display:flex; align-items:baseline; gap:0.5rem; margin-top:0.2rem;">
                        ${d.prezzo != null ? `<span style="font-weight:700; font-size:clamp(0.6rem, 8cqw, 0.95rem); ${ombra}">${eur(d.prezzo)}</span>` : ''}
                        ${d.variazione ? `<span style="font-size:clamp(0.5rem, 6.5cqw, 0.75rem); font-weight:700; color:${coloreVar}; ${ombra}">${esc(d.variazione)}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
}
