// Widget e pagina Missioni.

CATALOGO_WIDGET.missioni = {
        titolo: 'Missioni', icona: 'fa-list-check',
        preview: async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return { righe: ['Accedi per vedere le missioni'], dati: { placeholder: true } };
                const oggi = MOTORE_MISSIONI.periodoCorrente('giornaliera');
                const pool = MOTORE_MISSIONI.missioniDelGiorno(userId, oggi.periodo);
                const { data: righeFatte, error } = await missioniCompletateIdPerPeriodi(userId, [oggi.periodo]);
                if (error) throw error;
                const idFatte = new Set((righeFatte || []).map(r => r.missione_id));
                const voci = pool.map(m => ({ titolo: m.titolo, fatta: idFatte.has(m.id), ricompensa: m.ricompensa }));
                const fatte = voci.filter(v => v.fatta).length;
                return {
                    righe: [`${fatte} di ${pool.length} oggi`],
                    dati: { fatte, totali: pool.length, voci },
                };
            } catch (e) {
                console.error('[missioni widget] preview:', e);
                return { righe: ['Missioni del giorno'], dati: { placeholder: true } };
            }
        },
};

let _missioniCache = null;
let _missioniTabAttiva = 'oggi';
const _MISSIONI_TAB_LABEL = { oggi: 'Oggi', settimana: 'Settimana', mese: 'Mese' };

async function renderPaginaMissioni() {
    const containerMissioni = document.getElementById('missioniListaOggi');
    if (!containerMissioni) return;
    containerMissioni.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';

    const userId = await authGetUserId();
    if (!userId) {
        containerMissioni.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Accedi per vedere le tue missioni.</p>';
        return;
    }

    let risultato;
    try {
        risultato = await MOTORE_MISSIONI.valutaEAssegna(userId);
    } catch (e) {
        console.error('renderPaginaMissioni:', e);
        containerMissioni.innerHTML = '<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento delle missioni.</p>';
        return;
    }
    const { dati, missioniOggiPool, missioniSettimanaPool, missioniMesePool, nuoveMissioni, nuoviTraguardi } = risultato;

    if (typeof _aggiornaPallinoMenu === 'function') {   }

    const idNuove = new Set(nuoveMissioni.map(m => m.id));

    _missioniNotificaCompletamenti(nuoveMissioni, nuoviTraguardi);

    _missioniCache = {
        dati,
        idNuove,
        gruppi: {
            oggi: missioniOggiPool,
            settimana: missioniSettimanaPool,
            mese: missioniMesePool,
        },
    };
    _missioniTabAttiva = 'oggi';
    _missioniRenderPagina();
}

function _missioniRenderPagina() {
    const container = document.getElementById('missioniListaOggi');
    if (!container || !_missioniCache) return;
    const { dati, idNuove, gruppi } = _missioniCache;

    const poolOggi = gruppi.oggi;
    const completateOggi = poolOggi.filter(m => MOTORE_MISSIONI.valuta(m, dati)).length;
    const totaleOggi = poolOggi.length;
    const percentOggi = totaleOggi > 0 ? Math.round((completateOggi / totaleOggi) * 100) : 100;

    const RAGGIO_ANELLO = 27;
    const CIRCONFERENZA = 2 * Math.PI * RAGGIO_ANELLO;
    const offsetAnello = CIRCONFERENZA * (1 - percentOggi / 100);

    let titoloRiepilogo;
    if (totaleOggi === 0) titoloRiepilogo = 'Nessuna missione oggi disponibile';
    else if (completateOggi >= totaleOggi) titoloRiepilogo = 'Tutte le missioni di oggi completate!';
    else if (completateOggi === 0) titoloRiepilogo = 'Si comincia!';
    else titoloRiepilogo = completateOggi === 1 ? '1 missione fatta oggi' : `${completateOggi} missioni fatte oggi`;
    const mancanti = totaleOggi - completateOggi;
    const sottoRiepilogo = mancanti <= 0 ? 'torna domani per le nuove' : (mancanti === 1 ? 'ancora 1 missione oggi' : `ancora ${mancanti} missioni oggi`);

    const tutte = [...gruppi.oggi, ...gruppi.settimana, ...gruppi.mese];
    const polverePresa = tutte.filter(m => MOTORE_MISSIONI.valuta(m, dati))
        .reduce((s, m) => s + (m.ricompensa && m.ricompensa.tipo === 'polvere' ? (m.ricompensa.quantita || 0) : 0), 0);

    const streak = dati.giorni_consecutivi || 0;

    const pcSotto = [sottoRiepilogo];
    if (polverePresa > 0) pcSotto.push(`+${polverePresa} ✧ presi`);
    if (streak > 1) pcSotto.push(`serie di ${streak} giorni 🔥`);

    const riepilogoHtml = `
        <div class="msn-testa">
            <div class="msn-riepilogo">
                <div class="msn-ring">
                    <svg width="62" height="62">
                        <circle cx="31" cy="31" r="${RAGGIO_ANELLO}" stroke="var(--primary-light)" stroke-width="6" fill="none"></circle>
                        <circle cx="31" cy="31" r="${RAGGIO_ANELLO}" stroke="var(--primary)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${CIRCONFERENZA.toFixed(1)}" stroke-dashoffset="${offsetAnello.toFixed(1)}"></circle>
                    </svg>
                    <div class="msn-ring-testo">${completateOggi}/${totaleOggi}</div>
                </div>
                <div style="min-width:0;">
                    <div class="msn-riepilogo-titolo">${escapeHtml(titoloRiepilogo)}</div>
                    <div class="msn-riepilogo-sotto msn-solo-tel">${escapeHtml(sottoRiepilogo)}</div>
                    <div class="msn-riepilogo-sotto msn-solo-pc">${escapeHtml(pcSotto.join(' · '))}</div>
                </div>
            </div>
        </div>`;

    const scadenze = _missioniScadenze();
    const tabsDef = [
        { chiave: 'oggi', pool: gruppi.oggi, scade: scadenze.oggi, vuoto: 'Nessuna missione di oggi' },
        { chiave: 'settimana', pool: gruppi.settimana, scade: scadenze.settimana, vuoto: 'Nessuna missione della settimana' },
        { chiave: 'mese', pool: gruppi.mese, scade: scadenze.mese, vuoto: 'Nessuna missione del mese' },
    ];
    const tabsHtml = tabsDef.map(t => {
        const daFare = t.pool.some(m => !MOTORE_MISSIONI.valuta(m, dati));
        const attiva = t.chiave === _missioniTabAttiva;
        return `<button class="msn-tab${attiva ? ' active' : ''}" onclick="_missioniCambiaTab('${t.chiave}')">${_MISSIONI_TAB_LABEL[t.chiave]}${daFare ? '<span class="msn-tab-pallino"></span>' : ''}</button>`;
    }).join('');

    const elencoHtml = (t) => t.pool.length
        ? t.pool.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('')
        : `<div class="msn-vuoto"><i class="fa-regular fa-calendar"></i><b>${escapeHtml(t.vuoto)}</b><span>Per ora non ce ne sono: appena arrivano le trovi qui</span></div>`;

    const tabAttivo = tabsDef.find(t => t.chiave === _missioniTabAttiva) || tabsDef[0];
    const colonneHtml = tabsDef.map(t => {
        const daFare = t.pool.some(m => !MOTORE_MISSIONI.valuta(m, dati));
        return `
        <div class="msn-colonna">
            <div class="msn-colonna-testa"><b>${_MISSIONI_TAB_LABEL[t.chiave]}</b>${daFare ? '<span class="msn-pallino-in-riga"></span>' : ''}<span class="msn-colonna-scade">${escapeHtml(t.scade)}</span></div>
            <div class="pg-elenco">${elencoHtml(t)}</div>
        </div>`;
    }).join('');

    const prossimoHtml = _missioniProssimoTraguardoHtml(dati);
    const streakCardHtml = _missioniStreakCardHtml(streak);

    container.innerHTML = `
        ${riepilogoHtml}
        <div class="msn-solo-tel">
            <div class="msn-tabs">${tabsHtml}</div>
            <div class="pg-elenco">${elencoHtml(tabAttivo)}</div>
        </div>
        <div class="msn-solo-pc msn-colonne">${colonneHtml}</div>
        <div class="msn-fondo">
            ${prossimoHtml}
            ${streakCardHtml}
        </div>
        <div class="msn-solo-pc" id="msnRecenti">${_missioniCache.recentiHtml || ''}</div>
    `;
    if (_missioniCache.recentiHtml === undefined) _missioniCaricaRecenti();
}

function _missioniScadenze() {
    const ora = new Date();
    const mezzanotte = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() + 1);
    const ore = Math.max(0, Math.floor((mezzanotte - ora) / 3600000));
    const oggi = ore >= 1 ? `scade tra ${ore} h` : 'scade tra poco';
    const settimana = ora.getDay() === 0 ? 'scade stasera' : 'scade domenica';
    const mese = ora.toLocaleDateString('it-IT', { month: 'long' });
    return { oggi, settimana, mese };
}

async function _missioniCaricaRecenti() {
    if (!_missioniCache) return;
    const cache = _missioniCache;
    cache.recentiHtml = '';
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const oggi = new Date();
        const giorni = [];
        for (let i = 1; i <= 6; i++) {
            const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - i);
            giorni.push({ data: d, periodo: MOTORE_MISSIONI.periodoCorrente('giornaliera', d).periodo });
        }
        const setPassata = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 7);
        const periodoSett = MOTORE_MISSIONI.periodoCorrente('settimanale', setPassata).periodo;
        const { data, error } = await missioniCompletateIdPerPeriodi(userId, [...giorni.map(g => g.periodo), periodoSett]);
        if (error) throw error;
        const fattePer = {};
        (data || []).forEach(r => { (fattePer[r.periodo] = fattePer[r.periodo] || new Set()).add(r.missione_id); });

        const polvere = (pool, fatte) => pool.filter(m => fatte.has(m.id))
            .reduce((s, m) => s + (m.ricompensa && m.ricompensa.tipo === 'polvere' ? (m.ricompensa.quantita || 0) : 0), 0);
        const box = [];
        giorni.forEach((g, i) => {
            const fatte = fattePer[g.periodo];
            if (!fatte) return;
            const pool = MOTORE_MISSIONI.missioniDelGiorno(userId, g.periodo);
            const n = pool.filter(m => fatte.has(m.id)).length;
            if (!n) return;
            const etichetta = i === 0 ? 'ieri' : g.data.toLocaleDateString('it-IT', { weekday: 'long' });
            box.push({ etichetta, testo: `${n} su ${pool.length}`, polvere: polvere(pool, fatte) });
        });
        const fatteSett = fattePer[periodoSett];
        if (fatteSett) {
            const pool = MOTORE_MISSIONI.missioniDellaSettimana(userId, periodoSett);
            const n = pool.filter(m => fatteSett.has(m.id)).length;
            if (n) box.push({ etichetta: 'settimana scorsa', testo: `${n} su ${pool.length} settimanali`, polvere: polvere(pool, fatteSett) });
        }
        const recenti = box.slice(0, 4);
        if (!recenti.length) return;
        const totale = recenti.reduce((s, b) => s + b.polvere, 0);
        cache.recentiHtml = `
            <div class="msn-card msn-recenti">
                <div class="msn-recenti-testa"><b>Completate di recente</b><span>ultimi 7 giorni${totale ? ` · +${totale} ✧` : ''}</span></div>
                <div class="msn-recenti-griglia">${recenti.map(b => `
                    <div class="msn-recente">
                        <span>${escapeHtml(b.etichetta)}</span>
                        <b>${escapeHtml(b.testo)}</b>
                        ${b.polvere ? `<em>+${b.polvere} ✧</em>` : ''}
                    </div>`).join('')}
                </div>
            </div>`;
    } catch (e) {
        console.error('[missioni] completate di recente:', e);
    }
    if (_missioniCache !== cache) return;
    const el = document.getElementById('msnRecenti');
    if (el) el.innerHTML = cache.recentiHtml;
}

function _missioniProssimoTraguardo(dati) {
    const riscossi = new Set(dati._traguardiRiscossiIds || []);
    let migliore = null;
    for (const t of CATALOGO_TRAGUARDI) {
        if (t.operatore !== '>=' || !t.valore) continue;
        if (riscossi.has(t.id)) continue;
        const valoreAttuale = dati[t.metrica];
        if (valoreAttuale === undefined) continue;
        if (valoreAttuale >= t.valore) continue;
        const percent = Math.max(0, Math.min(99, Math.round((valoreAttuale / t.valore) * 100)));
        if (!migliore || percent > migliore.percent) {
            migliore = { t, valoreAttuale, percent };
        }
    }
    return migliore;
}

function _missioniProssimoTraguardoHtml(dati) {
    const migliore = _missioniProssimoTraguardo(dati);
    if (!migliore) return '';
    const { t, valoreAttuale, percent } = migliore;
    const valoreVisualizzato = Math.round(valoreAttuale);
    const avanzamento = t.metrica === 'valore_collezione'
        ? `valore collezione ${valoreVisualizzato} € su ${t.valore} €`
        : `${valoreVisualizzato} su ${t.valore}`;
    const premio = _missioniPremioBreve(t.ricompensa);
    return `
        <div class="msn-card msn-card-cliccabile" onclick="apriDettaglioWidget('achievement', event)" title="Tocca per vedere tutti i traguardi">
            <div class="msn-card-titolo">Prossimo traguardo${premio ? `<span class="msn-card-premio">${escapeHtml(premio)}</span>` : ''}</div>
            <div class="msn-card-nome">${escapeHtml(t.titolo)}</div>
            <div class="pg-barra-track" style="margin-bottom:5px;"><div class="pg-barra-fill" style="width:${percent}%;"></div></div>
            <div class="msn-card-sotto">${escapeHtml(avanzamento)}</div>
        </div>`;
}

function _missioniStreakCardHtml(streak) {
    if (streak > 0) {
        const testo = streak === 1 ? '1 giorno di fila' : `${streak} giorni di fila`;
        const prossimo = streak + 1;
        const ordinali = ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo'];
        const sotto = prossimo < ordinali.length ? `torna domani per il ${ordinali[prossimo]}` : 'torna domani per non perdere la serie';
        return `
        <div class="msn-card msn-card-streak">
            <span class="msn-fuoco">🔥</span>
            <div><div class="msn-card-streak-numero">${testo}</div><div class="msn-card-sotto">${sotto}</div></div>
        </div>`;
    }
    return `
        <div class="msn-card msn-card-streak">
            <span class="msn-fuoco spento">🔥</span>
            <div><div class="msn-card-streak-numero">Nessuna serie</div><div class="msn-card-sotto">accedi ogni giorno per iniziarne una</div></div>
        </div>`;
}

function _missioniPremioBreve(ricompensa) {
    if (!ricompensa) return '';
    if (ricompensa.tipo === 'polvere') return `+${ricompensa.quantita || 1} ✧`;
    return _ricompensaTestoBreve(ricompensa);
}

function _missioniAvanzamento(m, dati) {
    if (m.operatore !== '>=' || typeof m.valore !== 'number' || m.valore <= 1) return null;
    const v = Number(dati[m.metrica]);
    if (!isFinite(v)) return null;
    return `${Math.min(Math.round(v), m.valore)}/${m.valore}`;
}

function _missioniCambiaTab(chiave) {
    if (!_missioniCache) return;
    _missioniTabAttiva = chiave;
    _missioniRenderPagina();
}

function _righeMissioneHtml(m, dati, appenaCompletata) {
    const soddisfatta = MOTORE_MISSIONI.valuta(m, dati);
    const badgeNuova = appenaCompletata ? `<span class="msn-nuova">Nuovo!</span>` : '';
    const idBase = 'missioneDettaglio-' + m.id;
    const avanzamento = soddisfatta ? null : _missioniAvanzamento(m, dati);
    const premio = _missioniPremioBreve(m.ricompensa);
    const destra = soddisfatta
        ? `<span class="msn-premio-preso" title="Premio già assegnato"><i class="fa-solid fa-check"></i> ${escapeHtml(premio)}</span>`
        : `<div class="msn-destra">${avanzamento ? `<span>${avanzamento}</span>` : ''}<b>${escapeHtml(premio)}</b></div>`;
    return `
        <div class="msn-riga-blocco">
            <div class="pg-riga msn-riga" onclick="_toggleDettaglioMissione('${m.id}')">
                <div class="msn-check${soddisfatta ? ' fatta' : ''}">${soddisfatta ? '<i class="fa-solid fa-check"></i>' : ''}</div>
                <div style="flex:1; min-width:0;">
                    <div class="msn-riga-testo-riga1${soddisfatta ? ' fatta' : ''}">${escapeHtml(m.titolo)}${badgeNuova}</div>
                    <div class="msn-riga-testo-riga2">${escapeHtml(m.descrizione || '')}</div>
                </div>
                ${destra}
            </div>
            <div id="${idBase}" class="msn-riga-dettaglio" style="display:none;">
                ${escapeHtml(_testoRicompensa(m.ricompensa))}
            </div>
        </div>`;
}

function _toggleDettaglioMissione(id) {
    const dettaglio = document.getElementById('missioneDettaglio-' + id);
    if (!dettaglio) return;
    const aperto = dettaglio.style.display !== 'none';
    dettaglio.style.display = aperto ? 'none' : 'block';
}

function _ricompensaTestoBreve(ricompensa) {
    const q = ricompensa.quantita || 1;
    let base;
    if (ricompensa.tipo === 'polvere') base = `${q} polvere`;
    else if (ricompensa.tipo === 'bustina') base = `${q} bustina${q === 1 ? '' : 'e'}`;
    else if (ricompensa.tipo === 'stampino') base = `uno stampino${ricompensa.riferimento ? ` (${ricompensa.riferimento.replace(/_/g, ' ')})` : ''}`;
    else if (ricompensa.tipo === 'skip_missione') base = `salta una missione`;
    else base = `${q} ${ricompensa.tipo}`;
    const bonus = ricompensa.bonus ? ` — più una possibilità di ${ricompensa.bonus.replace('possibilita_', '').replace('_', ' ')} extra` : '';
    return `${base}${bonus}`;
}

function _testoRicompensa(ricompensa) {
    const q = ricompensa.quantita || 1;
    let base;
    if (ricompensa.tipo === 'polvere') base = `${q} polvere`;
    else if (ricompensa.tipo === 'bustina') base = `${q} bustina${q === 1 ? '' : 'e'}`;
    else if (ricompensa.tipo === 'stampino') base = `uno stampino${ricompensa.riferimento ? ` (${ricompensa.riferimento.replace(/_/g, ' ')})` : ''}`;
    else if (ricompensa.tipo === 'skip_missione') base = `salta una missione`;
    else base = `${q} ${ricompensa.tipo}`;
    const bonus = ricompensa.bonus ? ` — più una possibilità di ${ricompensa.bonus.replace('possibilita_', '').replace('_', ' ')} extra` : '';
    return `Ricompensa: ${base}${bonus}`;
}
