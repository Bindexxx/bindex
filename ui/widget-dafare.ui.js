// Widget Prossima azione e pagina Da fare.

let _daFareUltimoStato = {};
const FINESTRA_STORICO_DAFARE_MS = 24 * 60 * 60 * 1000;

function _rilevaTransizioniDaFare(segnaliOra) {
    const idAttiviOra = new Set(segnaliOra.map(s => s.id));
    Object.keys(_daFareUltimoStato).forEach(id => {
        if (_daFareUltimoStato[id].attivo && !idAttiviOra.has(id)) {
            _segnaDaFareRisolto(id, _daFareUltimoStato[id].testo);
        }
    });
    const nuovoStato = {};
    segnaliOra.forEach(s => { nuovoStato[s.id] = { attivo: true, testo: s.testo }; });
    Object.keys(_daFareUltimoStato).forEach(id => {
        if (!nuovoStato[id]) nuovoStato[id] = { attivo: false, testo: _daFareUltimoStato[id].testo };
    });
    _daFareUltimoStato = nuovoStato;
}

async function _segnaDaFareRisolto(id, testo) {
    try {
        const userId = await authGetUserId();
        if (!userId) return;
        const { data, error } = await userSettingsGet(userId);
        if (error) { console.error('_segnaDaFareRisolto: lettura fallita:', error.message); return; }
        let storico = {};
        try { storico = (data && data.dafare_risolti) ? JSON.parse(data.dafare_risolti) : {}; } catch (_) { storico = {}; }
        storico[id] = { testo, risoltoIl: new Date().toISOString() };
        const { error: errScrittura } = await userSettingsUpsertDaFareRisolti(userId, storico);
        if (errScrittura) console.error('_segnaDaFareRisolto: scrittura fallita:', errScrittura.message);
    } catch (e) { console.error('_segnaDaFareRisolto:', e); }
}

CATALOGO_WIDGET.suggerimento = {
        titolo: 'Centro operativo', icona: 'fa-lightbulb',
        preview: async () => {
            const segnali = [];

            let righeRichieste = [];
            try {
                const richiesteInfo = await CATALOGO_WIDGET.richieste.preview();
                const daGestire = (richiesteInfo.dati && richiesteInfo.dati.totale) || 0;
                righeRichieste = (richiesteInfo.dati && richiesteInfo.dati.righeInAttesa) || [];
                if (daGestire > 0) segnali.push({ id: 'richieste_da_gestire', testo: `${daGestire} richiest${daGestire === 1 ? 'a' : 'e'} da gestire`, stato: 'allerta', tab: 'richieste', immagini: (richiesteInfo.dati.immagini || []).slice(0, 3), righe: righeRichieste, valore: richiesteInfo.dati.valore || 0 });
            } catch (e) { console.error('[Centro operativo] richieste:', e); }

            const codaErrori = await _contaCodaErrori();
            if (codaErrori > 0) segnali.push({ id: 'coda_errori', testo: `${codaErrori} cart${codaErrori === 1 ? 'a' : 'e'} da correggere`, stato: 'allerta', tab: 'inserimento', quante: codaErrori });

            const lista = (typeof _elencoPrezziScaduti !== 'undefined' && _elencoPrezziScaduti) ? _elencoPrezziScaduti : [];
            if (lista.length > 0) segnali.push({ id: 'prezzi_scaduti', testo: `${lista.length} prezz${lista.length === 1 ? 'o' : 'i'} da aggiornare`, stato: 'allerta', tab: 'prezzi', immagini: lista.map(c => c.immagine).filter(Boolean).slice(0, 3), quante: lista.length });

            try {
                const matchInfo = CATALOGO_WIDGET.match.preview();
                const nScambio = (matchInfo.dati && matchInfo.dati.scambio) || 0;
                const nWishlist = (matchInfo.dati && matchInfo.dati.wishlist) || 0;
                const totaleMatch = nScambio + nWishlist;
                if (totaleMatch > 0) segnali.push({ id: 'match_trovati', testo: `${totaleMatch} corrispondenz${totaleMatch === 1 ? 'a' : 'e'} nel gruppo`, stato: 'ok', tab: 'match', nScambio, nWishlist });
            } catch (e) { console.error('[Centro operativo] match:', e); }

            const wishlistSottoTarget = carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            if (wishlistSottoTarget.length > 0) segnali.push({ id: 'wishlist_obiettivo', testo: `${wishlistSottoTarget.length} in wishlist sotto obiettivo`, stato: 'ok', tab: 'wishlist', carte: wishlistSottoTarget });

            const inAttesaLocation = carteReali.filter(c => c.tabella === 'carte' && c.location === '?');
            if (inAttesaLocation.length > 0) segnali.push({ id: 'elementi_senza_location', testo: `${inAttesaLocation.length} element${inAttesaLocation.length === 1 ? 'o' : 'i'} ancora in "?"`, stato: undefined, tab: 'location', carte: inAttesaLocation });

            let missioni = null;
            try {
                const missioniInfo = await CATALOGO_WIDGET.missioni.preview();
                const d = missioniInfo && missioniInfo.dati;
                if (d && !d.placeholder && d.totali) {
                    const inPalio = (d.voci || []).filter(v => !v.fatta && v.ricompensa && v.ricompensa.tipo === 'polvere').reduce((t, v) => t + (v.ricompensa.quantita || 1), 0);
                    missioni = { fatte: d.fatte, totali: d.totali, inPalio };
                }
                const mancanti = missioni ? Math.max(0, missioni.totali - missioni.fatte) : 0;
                if (mancanti > 0) segnali.push({ id: 'missioni_da_fare', testo: mancanti === 1 ? 'Ti manca 1 missione oggi' : `Ti mancano ${mancanti} missioni oggi`, stato: undefined, tab: 'missioni' });
            } catch (e) { console.error('[Centro operativo] missioni:', e); }

            const dispositivi = await _daFareDispositiviAlLavoro();
            if (dispositivi > 0) segnali.push({ id: 'gruppo_al_lavoro', testo: 'Il gruppo sta lavorando', stato: undefined, tab: 'home' });

            _rilevaTransizioniDaFare(segnali);

            const META = {
                richieste_da_gestire:    { gruppo: 'fare', icona: 'fa-handshake', sotto: 'aspettano una tua risposta', bottone: 'Gestisci', bottoneIcona: 'fa-arrow-right' },
                coda_errori:             { gruppo: 'fare', icona: 'fa-triangle-exclamation', sotto: 'non trovate su Cardmarket', bottone: 'Correggi', bottoneIcona: 'fa-wrench' },
                prezzi_scaduti:          { gruppo: 'fare', icona: 'fa-tags', sotto: `mai controllati o più vecchi di ${typeof SOGLIA_GIORNI_PREZZO_SCADUTO !== 'undefined' ? SOGLIA_GIORNI_PREZZO_SCADUTO : 7} giorni`, bottone: 'Controlla prezzi', bottoneIcona: 'fa-arrow-right' },
                match_trovati:           { gruppo: 'opportunita', icona: 'fa-heart', sotto: 'carte che cerchi o che cercano da te', bottone: 'Vedi Match' },
                wishlist_obiettivo:      { gruppo: 'opportunita', icona: 'fa-arrow-trend-down', sotto: 'al prezzo che volevi o meno', immagini: wishlistSottoTarget.map(c => c.immagine).filter(Boolean).slice(0, 3), bottone: 'Vedi Wishlist' },
                elementi_senza_location: { gruppo: 'opportunita', icona: 'fa-circle-question', sotto: 'scegli dove metterli', immagini: inAttesaLocation.map(c => c.immagine).filter(Boolean).slice(0, 3), bottone: 'Sposta', bottoneIcona: 'fa-arrow-right' },
            };
            segnali.forEach(s => {
                const m = META[s.id] || { gruppo: 'info' };
                Object.keys(m).forEach(k => { if (s[k] === undefined) s[k] = m[k]; });
            });
            const daFare = segnali.filter(s => s.gruppo === 'fare');
            const opportunita = segnali.filter(s => s.gruppo === 'opportunita');
            const segnaleMissioni = segnali.find(s => s.id === 'missioni_da_fare') || null;
            const dati = { segnali, daFare, opportunita, missioni, segnaleMissioni, gruppoAlLavoro: dispositivi > 0, dispositivi };

            if (daFare.length === 0 && opportunita.length === 0) return { righe: ['Tutto in ordine'], stato: 'ok', dati };
            const primo = segnali[0];
            return {
                righe: [daFare.length ? `${daFare.length} da fare adesso` : `${opportunita.length} opportunità`],
                stato: primo.stato,
                azioni: daFare.length,
                dati,
            };
        },
        azione: (dati, punto) => { apriDettaglioWidget('dafare', punto); },
};

async function _daFareDispositiviAlLavoro() {
    try {
        const { data, error } = await claimGruppoStato();
        if (error) { console.error('[Centro operativo] dispositivi:', error.message); return 0; }
        return new Set((data || []).map(r => r.dispositivo || r.claimed_by || r.id)).size;
    } catch (e) { console.error('[Centro operativo] dispositivi:', e); return 0; }
}

function _daFareMiniature(immagini, totale) {
    const lista = (immagini || []).map(i => _urlImmagineVisualizzabile(i, 80)).filter(Boolean).slice(0, 3);
    if (!lista.length) return '';
    const altre = (totale || 0) - lista.length;
    return `<div class="co-mini">${lista.map(src => `<img src="${src}" alt="" loading="lazy" onerror="this.remove();">`).join('')}${altre > 0 ? `<span class="co-mini-altre">+${altre}</span>` : ''}</div>`;
}

function _daFareQuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const giorno = new Date(d); giorno.setHours(0, 0, 0, 0);
    const diff = Math.round((oggi - giorno) / 86400000);
    if (diff === 0) return `oggi ${ora}`;
    if (diff === 1) return `ieri ${ora}`;
    return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${ora}`;
}

function _daFareNomi(carte) {
    const nomi = (carte || []).map(c => c.name).filter(Boolean);
    if (!nomi.length) return '';
    return escapeHtml(nomi.slice(0, 2).join(', ')) + (nomi.length > 2 ? ` e altre ${nomi.length - 2}` : '');
}

function _daFareTesti(s, nickname) {
    const titolo = escapeHtml(s.testo);
    if (s.id === 'richieste_da_gestire') {
        const righe = s.righe || [];
        const _chiRiga = (r) => { const rs = r.richieste_scambio || {}; return rs.richiedente_id || (rs.codice_rq ? 'ospite:' + rs.codice_rq : null); };
        const persone = [...new Set(righe.map(_chiRiga).filter(Boolean))];
        const oggetti = righe.map(r => (r.snapshot || {}).nome || (r.snapshot || {}).codice).filter(Boolean);
        const pezzi = [];
        if (oggetti.length) pezzi.push(escapeHtml(oggetti.slice(0, 2).join(', ')) + (oggetti.length > 2 ? ` e altri ${oggetti.length - 2}` : ''));
        if (s.valore > 0) pezzi.push(formattaEuro(s.valore));
        pezzi.push(persone.length > 1 ? `da ${persone.length} persone` : 'aspetta una tua risposta');
        if (persone.length === 1) {
            const rsOspite = persone[0].startsWith('ospite:') ? ((righe[0] || {}).richieste_scambio || {}) : null;
            const chi = rsOspite
                ? escapeHtml((rsOspite.ospite_nome || 'Un ospite') + ' (ospite)')
                : (nickname[persone[0]] ? escapeHtml(nickname[persone[0]]) : 'Qualcuno del gruppo');
            return { titolo: `${chi} ti ha chiesto ${righe.length} oggett${righe.length === 1 ? 'o' : 'i'}`, sotto: pezzi.join(' · ') };
        }
        return { titolo, sotto: pezzi.join(' · ') };
    }
    if (s.id === 'coda_errori') return { titolo, sotto: `L'estensione non ${s.quante === 1 ? 'l’ha trovata' : 'le ha trovate'} su Cardmarket` };
    if (s.id === 'match_trovati') {
        const pezzi = [];
        if (s.nWishlist) pezzi.push(`${s.nWishlist} che cerchi`);
        if (s.nScambio) pezzi.push(`${s.nScambio} che cercano da te`);
        return { titolo, sotto: pezzi.join(' · ') || escapeHtml(s.sotto || '') };
    }
    if (s.id === 'wishlist_obiettivo' && (s.carte || []).length === 1) {
        const c = s.carte[0];
        return { titolo: `${escapeHtml(c.name || 'Una carta')} è sotto il tuo obiettivo`, sotto: `${formattaEuro(c.price)} · obiettivo ${formattaEuro(c.prezzoObiettivo)}` };
    }
    if (s.id === 'elementi_senza_location') {
        const n = (s.carte || []).length;
        return { titolo: `${n} cart${n === 1 ? 'a' : 'e'} ancora in “?”`, sotto: `${_daFareNomi(s.carte)} · scegli dove ${n === 1 ? 'metterla' : 'metterle'}` };
    }
    return { titolo, sotto: _daFareNomi(s.carte) || escapeHtml(s.sotto || '') };
}

function _daFareScheda(s, nickname) {
    const t = _daFareTesti(s, nickname);
    const fare = s.gruppo === 'fare';
    const totaleImg = s.id === 'prezzi_scaduti' ? s.quante : (s.carte ? s.carte.length : (s.righe ? s.righe.length : 0));
    const btn = s.bottone ? `<button type="button" class="co-btn${fare ? ' co-btn-pieno' : ''}" onclick="event.stopPropagation(); _apriVoceDaFare('${s.tab}', event)">${s.bottoneIcona ? `<i class="fa-solid ${s.bottoneIcona}"></i> ` : ''}${s.bottone}</button>` : '';
    return `
        <div class="co-scheda${fare ? ' co-fare' : ''} co-${s.id}">
            <div class="co-ico"><i class="fa-solid ${s.icona || 'fa-circle-info'}"></i></div>
            <div class="co-corpo">
                <div class="co-tit">${t.titolo}</div>
                ${t.sotto ? `<div class="co-sotto">${t.sotto}</div>` : ''}
                ${_daFareMiniature(s.immagini, totaleImg)}
            </div>
            ${btn}
        </div>`;
}

async function renderPaginaDaFare() {
    const container = document.getElementById('daFareLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    const riepilogoEl = document.getElementById('daFareRiepilogo');

    let anteprima;
    try { anteprima = await CATALOGO_WIDGET.suggerimento.preview(); } catch (e) { console.error('renderPaginaDaFare:', e); anteprima = { dati: { segnali: [], daFare: [], opportunita: [] } }; }
    const d = anteprima.dati || {};
    const segnali = d.segnali || [];
    const daFare = d.daFare || [];
    const opportunita = d.opportunita || [];

    const nickname = {};
    const rich = daFare.find(s => s.id === 'richieste_da_gestire');
    const idsRichiedenti = rich ? [...new Set((rich.righe || []).map(r => (r.richieste_scambio || {}).richiedente_id).filter(Boolean))] : [];
    if (idsRichiedenti.length) {
        try {
            const { data, error } = await chatOttieniNicknames(idsRichiedenti);
            if (error) console.error('renderPaginaDaFare: nickname:', error.message);
            else (data || []).forEach(n => { if (n.nickname) nickname[n.owner_id] = n.nickname; });
        } catch (e) { console.error('renderPaginaDaFare: nickname:', e); }
    }

    let risolti = [];
    try {
        const userId = await authGetUserId();
        if (userId) {
            const { data, error } = await userSettingsGet(userId);
            if (!error && data && data.dafare_risolti) {
                const storico = JSON.parse(data.dafare_risolti) || {};
                const ora = Date.now();
                const idAttivi = new Set(segnali.map(s => s.id));
                risolti = Object.entries(storico)
                    .filter(([id, v]) => !idAttivi.has(id) && (ora - new Date(v.risoltoIl).getTime()) < FINESTRA_STORICO_DAFARE_MS)
                    .sort((x, y) => new Date(y[1].risoltoIl) - new Date(x[1].risoltoIl))
                    .map(([, v]) => v);
            }
        }
    } catch (e) { console.error('renderPaginaDaFare: storico:', e); }

    if (riepilogoEl) {
        const pezzi = [];
        pezzi.push(daFare.length
            ? `<b class="co-rosso">${daFare.length} ${daFare.length === 1 ? 'cosa' : 'cose'} da fare adesso</b>`
            : '<b class="co-verde">Niente da fare adesso</b>');
        if (opportunita.length) pezzi.push(`${opportunita.length} opportunità`);
        pezzi.push('aggiornato ora');
        riepilogoEl.innerHTML = pezzi.join(' · ');
    }

    const sezione = (icona, titolo, voci) => voci.length ? `
        <div class="co-sez"><i class="fa-solid ${icona}"></i> ${titolo} <span class="co-conta">${voci.length}</span></div>
        <div class="co-elenco${titolo.startsWith('Opportunità') ? ' co-elenco-due' : ''}">${voci.map(s => _daFareScheda(s, nickname)).join('')}</div>` : '';

    const principale = (daFare.length || opportunita.length)
        ? sezione('fa-bolt', 'Da fare adesso', daFare) + sezione('fa-lightbulb', 'Opportunità e sistemazioni', opportunita)
        : `<div class="co-vuoto"><i class="fa-solid fa-circle-check"></i>Niente da fare — tutto in ordine.</div>`;

    let oggi = '';
    if (d.missioni) {
        const m = d.missioni;
        const perc = Math.round((m.fatte / m.totali) * 100);
        oggi = `
            <div class="co-riquadro">
                <div class="co-sez co-sez-piccola"><i class="fa-solid fa-calendar-day"></i> Oggi</div>
                <div class="co-riga-miss"><b>Missioni del giorno</b><span><b>${m.fatte}</b> di ${m.totali}${m.inPalio ? ` · +${m.inPalio} ✧ in palio` : ''}</span></div>
                <div class="co-barra"><div style="width:${perc}%"></div></div>
                <button type="button" class="co-btn" onclick="_apriVoceDaFare('missioni', event)"><i class="fa-solid fa-bullseye"></i> Vai alle missioni</button>
            </div>`;
    }

    const nDisp = d.dispositivi || 0;
    const gruppo = `
        <div class="co-riquadro">
            <div class="co-sez co-sez-piccola"><i class="fa-solid fa-users"></i> Il gruppo adesso</div>
            ${nDisp
                ? `<div class="co-gruppo"><span class="co-pallino"></span><b>${nDisp} dispositiv${nDisp === 1 ? 'o' : 'i'}</b> al lavoro sui prezzi</div>`
                : '<div class="co-gruppo co-spento"><span class="co-pallino"></span>Nessuno sta controllando i prezzi adesso</div>'}
        </div>`;

    const fatto = risolti.length ? `
        <div class="co-riquadro">
            <div class="co-sez co-sez-piccola"><i class="fa-solid fa-clock-rotate-left"></i> Fatto nelle ultime 24 ore</div>
            ${risolti.map(v => `<div class="co-fatto"><i class="fa-solid fa-circle-check"></i><s>${escapeHtml(v.testo)}</s><span>${_daFareQuando(v.risoltoIl)}</span></div>`).join('')}
        </div>` : '';

    container.innerHTML = `
        <div class="co-pagina">
            <div class="co-principale">${principale}</div>
            <div class="co-lato">${oggi}${gruppo}${fatto}</div>
        </div>`;
}

function _apriVoceDaFare(tab, evt) {
    if (tab === 'home') {
        chiudiDettaglioWidget();
        setTimeout(_vaiAllaPaginaHome, DURATA_ANIMAZIONE_DETTAGLIO_MS);
        return;
    }
    apriDettaglioWidget(tab, evt);
}
