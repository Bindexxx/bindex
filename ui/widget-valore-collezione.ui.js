// ═══════════════════════════════════════════════════════════════════════
// WIDGET-VALORE-COLLEZIONE.UI.JS — tessere + pagina "Valore collezione"
// / "Variazione valore" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 19 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// "Valore collezione" — CATEGORIA A: pagina propria (Le più preziose,
// media, pezzi totali). "Variazione valore" — CATEGORIA C: nessuna pagina
// propria, condividono lo stesso file perché concettualmente imparentati
// (entrambi sul valore della collezione) e perché il secondo è piccolo.
//
// PUNTO APERTO §7.2 della roadmap — STESSA causa già trovata e confermata
// dal vivo per "Contributi al gruppo" (STEP 6): 'variazione_valore' non ha
// né 'azione' né 'tab' nel catalogo. Per lo stesso motivo già verificato
// leggendo navigation.ui.js (switchTab attiva SEMPRE #visualizzazione
// incondizionatamente, la sostituisce solo per le 5 tab fisse note — non
// per 'variazione_valore'), il click su questa tessera apre Visualizzazione
// come fallback silenzioso, non "nulla". Comportamento preesistente, non
// introdotto da questa ristrutturazione, NON corretto qui senza
// autorizzazione esplicita — stessa scelta che Claudio ha già fatto per
// Contributi (placeholder "work in progress") potrebbe applicarsi anche
// qui, ma NON l'ho applicata: aspetto conferma esplicita prima di
// aggiungere qualunque comportamento nuovo, invece di presumere che valga
// la stessa decisione.
//
// CONSOLIDAMENTO: il commento che introduceva la cache dello storico
// valore (TTL_STORICO_VALORE_MS/_cacheStoricoValore/_storicoValoreConCache)
// era condiviso con la cache di "Prezzi aggiornati" (già spostata in
// widget-prezzi.ui.js allo STEP 16) — qui sotto ho scritto un commento
// nuovo, mirato solo a questa cache, invece di portare quello vecchio
// ormai per metà riferito a codice non più qui.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaValoreCollezione() per tabId === 'valore' — motore home,
//   dispatch generico, non toccato in questo step.
// - _ballCORPI.valore_collezione / _ballCORPI.variazione_valore (e
//   ASPETTO/TITOLI_BREVI corrispondenti, ui/widget-render-condiviso.ui.js)
//   — motore visivo, non toccato. Verificato: leggono rispettivamente
//   d.valore/d.media/d.pezzi/d.top e d.variazione/d.valoreOggi/
//   d.carteAggiunte/d.soloUnGiorno — forme confermate coerenti coi due
//   preview() qui sotto.
// - storicoValoreConfronta, storicoValoreUltimiGiorni, authGetUserId,
//   apriFlipCardHome, _urlImmagineVisualizzabile, escapeHtml: esterne,
//   non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── CACHE STORICO VALORE (15 minuti) ─────────────────────────────────
// Lo storico del valore cambia una volta al giorno: interrogarlo a ogni
// giro di polling (renderWidgetHome gira anche da lì) sarebbe sprecato.
// 15 minuti sono generosi e restano molto sotto la frequenza con cui il
// dato si muove davvero.
const TTL_STORICO_VALORE_MS = 15 * 60 * 1000;
let _cacheStoricoValore = { quando: 0, righe: [] };

async function _storicoValoreConCache() {
    if (Date.now() - _cacheStoricoValore.quando < TTL_STORICO_VALORE_MS) return _cacheStoricoValore.righe;
    if (typeof storicoValoreUltimiGiorni !== 'function' || typeof authGetUserId !== 'function') return [];
    try {
        const userId = await authGetUserId();
        if (!userId) return [];
        const { data } = await storicoValoreUltimiGiorni(userId, 30);
        // Come per i prezzi recenti: MAI mettere in cache un risultato
        // vuoto. Il primo giro puo' capitare prima che la tabella abbia
        // righe o mentre la rete e' giu', e memorizzare quel vuoto
        // significherebbe mostrare "in raccolta" per un quarto d'ora a un
        // widget che i dati ce li ha.
        if (data && data.length) _cacheStoricoValore = { quando: Date.now(), righe: data };
        return data || [];
    } catch (e) {
        console.error('[widget variazione_valore]', e);
        return [];
    }
}

// ── VOCE DI CATALOGO "VALORE COLLEZIONE" ─────────────────────────────
CATALOGO_WIDGET.valore_collezione = {
        titolo: 'Valore collezione', icona: 'fa-sack-dollar',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione');
            const valore = coll.reduce((t, c) => t + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
            const top = coll.slice()
                .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
                .slice(0, 3)
                .map(c => ({ nome: c.name || '—', valore: Number(c.price) || 0, id: c.id, immagine: c.immagine, rarita: c.rarita }));
            const media = coll.length ? valore / coll.length : 0;
            return {
                righe: [`€ ${valore.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`],
                dati: { valore, media, pezzi: coll.length, top }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente la sezione
        // Prezzi (tab:'prezzi') — ora ha una pagina propria dedicata
        // (#valore in index.html, renderPaginaValoreCollezione() sotto).
        // Nessun impatto sul tracciamento missioni m38/m39/m40/m80/m81
        // (registrano l'evento su w.id='valore_collezione', non su
        // 'def.tab' — vedi _eseguiAzioneWidget).
        tab: 'valore',
};

// ── VOCE DI CATALOGO "VARIAZIONE VALORE" ─────────────────────────────
CATALOGO_WIDGET.variazione_valore = {
        titolo: 'Variazione valore', icona: 'fa-arrow-trend-up',
        tagliaDefault: '6x5', // il grafico e la scomposizione hanno bisogno di altezza
        // Fase 8, Step 3 (2026-09-13): pagina propria — prima cadeva su
        // Visualizzazione come fallback silenzioso (stesso bug già noto
        // di "Contributi al gruppo"), mai un vero 'tab' impostato qui.
        // renderPaginaVariazioneValore() sotto, usa movimenti_collezione
        // (sql/54) per il "perché", non più solo storico_valore_collezione
        // (che resta comunque la fonte dell'anteprima qui sotto, invariata
        // — il grafico rapido del widget Home non cambia).
        tab: 'variazione',
        // Sostituisce il segnaposto "arrivera' con lo storico del valore
        // totale" che stava nella home fissa da mesi. Ora lo storico c'e'
        // (tabella storico_valore_collezione, migration 36) e viene
        // riempito da ui/storico-valore.avvio.js a ogni apertura.
        preview: async () => {
            const righe = await _storicoValoreConCache();

            // UN SOLO GIORNO NON E' UNA VARIAZIONE. Va detto, non
            // mostrato come "zero": zero significherebbe "non e'
            // cambiato niente", che e' un'altra cosa e sarebbe una bugia
            // il primo giorno.
            if (!righe.length) return { righe: ['In raccolta', 'nessun dato ancora'], badge: false, dati: null };
            if (righe.length < 2) {
                return {
                    righe: ['In raccolta', 'serve un secondo giorno'],
                    badge: false,
                    dati: { soloUnGiorno: true, valore: Number(righe[0].valore_totale) || 0 },
                };
            }

            const c = storicoValoreConfronta(righe);
            const eur = (v) => (v >= 0 ? '+' : '−') + formattaEuro(Math.abs(Number(v) || 0)); // formato unico, audit 2026-09-25 C2
            const testo = [eur(c.variazione)];
            if (c.carteAggiunte > 0) testo.push(`${c.carteAggiunte} cart${c.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}`);

            return {
                righe: testo,
                badge: false,
                // 'ok' o 'allerta' accendono il semaforo della sfera: qui
                // NON si usano. Un calo di valore non e' un problema da
                // risolvere e non deve far agitare la ball come fa un
                // errore in coda.
                dati: {
                    ...c,
                    serie: righe.map(r => Number(r.valore_totale) || 0),
                    valoreOggi: Number(righe[righe.length - 1].valore_totale) || 0,
                    giorniMisurati: righe.length,
                },
            };
        },
};

// ── PAGINA "VALORE COLLEZIONE" (2026-08-30) ─────────────────────────────
// Prima widget con pagina di dettaglio propria (struttura adottata da
// cardsync-tutto.html, vedi CSS pg-*/page-header in index.html) invece di
// aprire semplicemente la sezione Prezzi. Zero query nuove: riusa
// CATALOGO_WIDGET.valore_collezione.preview(), la stessa funzione già
// usata per l'anteprima del widget in Home.
// Le carte nella lista "Le più preziose" aprono il flip-viewer con
// origine:'top_valore' — STESSO meccanismo già usato per le missioni
// #39/#83 dal ball-peek in Home (vedi _ballMiniCarta/_ballAzioneRiga):
// cliccarle da qui deve contare allo stesso modo, è concettualmente la
// stessa lista.
async function renderPaginaValoreCollezione() {
    const container = document.getElementById('valoreContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.valore_collezione;
    let dati;
    try {
        const anteprima = await def.preview();
        dati = anteprima.dati;
    } catch (e) {
        console.error('renderPaginaValoreCollezione:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    const eur = (v) => formattaEuro(v); // formato unico "12.345,00 €" (decisione Claudio 2026-09-25)

    const righeCarte = (dati.top && dati.top.length)
        ? dati.top.map(c => {
            const immagineSrc = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 96) || '') : '';
            const fig = immagineSrc
                ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
                : '<div class="pg-fig"></div>';
            return `
                <div class="pg-riga" data-tocca onclick="apriFlipCardHome('${c.id}', { origine: 'top_valore' })">
                    ${fig}
                    <div class="pg-testo"><b>${escapeHtml(c.nome || '—')}</b></div>
                    <div class="pg-destra"><b>${eur(c.valore)}</b></div>
                </div>`;
        }).join('')
        : '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Ancora nessuna carta in collezione.</p>';

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Valore collezione</span>
            <span class="page-azione attiva" onclick="apriDettaglioWidget('prezzi', event)">Vai a Prezzi</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${eur(dati.valore)}</div>
                <div class="pg-sotto">${dati.pezzi} pezz${dati.pezzi === 1 ? 'o' : 'i'} · media ${eur(dati.media)}</div>
            </div>
            <div class="pg-stat">
                <div><b>${dati.pezzi}</b><span>Carte totali</span></div>
                <div><b>${eur(dati.media)}</b><span>Valore medio</span></div>
            </div>
            ${dati.top && dati.top.length ? '<div class="pg-titoletto">Le più preziose</div>' : ''}
            <div class="pg-elenco">${righeCarte}</div>
        </div>
    `;
}


// ── PAGINA "VARIAZIONE VALORE" (Fase 8, Step 3 — 2026-09-13) ────────────
// A differenza del widget Home (che resta legato a storico_valore_
// collezione, istantanea giornaliera invariata), questa pagina spiega il
// "perché" leggendo movimenti_collezione — un log differenziale, una riga
// per evento reale (aggiunta, rimozione, vendita/scambio, prezzo
// automatico/manuale, variazione quantità), non un totale per giorno.
const _ETICHETTE_TIPO_MOVIMENTO = {
    aggiunta:            { label: 'Aggiunte alla collezione',   icona: 'fa-plus',            categoria: 'movimento' },
    rimozione:           { label: 'Rimozioni manuali',          icona: 'fa-minus',           categoria: 'movimento' },
    vendita_scambio:      { label: 'Scambi conclusi',            icona: 'fa-right-left',       categoria: 'scambio' },
    prezzo_automatico:   { label: 'Oscillazione di mercato',    icona: 'fa-chart-line',       categoria: 'mercato' },
    prezzo_manuale:      { label: 'Modifiche manuali prezzo',   icona: 'fa-pen',              categoria: 'manuale' },
    variazione_quantita: { label: 'Variazioni quantità',        icona: 'fa-layer-group',      categoria: 'movimento' },
    correzione:          { label: 'Correzioni',                 icona: 'fa-wrench',           categoria: 'manuale' },
};

async function renderPaginaVariazioneValore() {
    const container = document.getElementById('variazioneContenuto');
    if (!container) return;

    const userId = await authGetUserId();
    if (!userId) return;

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</p>';

    const { data, error } = await movimentiCollezioneListMie(userId, 200);
    if (error) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento: ${error.message}</p>`;
        return;
    }

    const eventi = data || [];
    const eur = (v) => (v >= 0 ? '+' : '−') + formattaEuro(Math.abs(Number(v) || 0)); // formato unico, audit 2026-09-25 C2

    if (eventi.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Variazione valore</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">
                Ancora nessun movimento registrato.<br>
                <small>Le aggiunte/modifiche/eliminazioni da qui in poi compariranno qui.</small>
            </p>
        `;
        return;
    }

    // Somma per tipo_evento — ignora le righe con valore_delta null (es.
    // prezzo_automatico sui sealed, che aggiorna solo il prezzo di
    // riferimento — vedi sql/56 — non tocca il valore dichiarato).
    const perTipo = {};
    let totale = 0;
    eventi.forEach(m => {
        if (!perTipo[m.tipo_evento]) perTipo[m.tipo_evento] = { somma: 0, conteggio: 0 };
        perTipo[m.tipo_evento].conteggio += 1;
        if (m.valore_delta != null) {
            perTipo[m.tipo_evento].somma += Number(m.valore_delta);
            totale += Number(m.valore_delta);
        }
    });

    const righeRiepilogo = Object.keys(_ETICHETTE_TIPO_MOVIMENTO)
        .filter(t => perTipo[t])
        .map(t => {
            const info = _ETICHETTE_TIPO_MOVIMENTO[t];
            const s = perTipo[t];
            return `
                <div class="pg-riga" style="cursor:default;">
                    <div class="pg-fig" style="display:flex; align-items:center; justify-content:center; background:var(--bg-secondary, rgba(0,0,0,0.04));"><i class="fa-solid ${info.icona}"></i></div>
                    <div class="pg-testo"><b>${info.label}</b><span>${s.conteggio} event${s.conteggio === 1 ? 'o' : 'i'}</span></div>
                    <div class="pg-destra"><b style="color:${s.somma > 0 ? 'var(--success, #2e9e5b)' : (s.somma < 0 ? 'var(--danger)' : 'var(--text-muted)')};">${eur(s.somma)}</b></div>
                </div>`;
        }).join('');

    // Elenco eventi recenti — data leggibile + nome + delta, ordine già
    // dal più recente (query ORDER BY avvenuto_il DESC).
    const formattaData = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const righeEventi = eventi.slice(0, 40).map(m => {
        const info = _ETICHETTE_TIPO_MOVIMENTO[m.tipo_evento] || { label: m.tipo_evento, icona: 'fa-circle-question' };
        const deltaTxt = m.valore_delta != null ? eur(m.valore_delta) : '—';
        const deltaColore = m.valore_delta > 0 ? 'var(--success, #2e9e5b)' : (m.valore_delta < 0 ? 'var(--danger)' : 'var(--text-muted)');
        return `
            <div class="pg-riga" style="cursor:default;">
                <div class="pg-fig" style="display:flex; align-items:center; justify-content:center; background:var(--bg-secondary, rgba(0,0,0,0.04)); font-size:0.8rem;"><i class="fa-solid ${info.icona}"></i></div>
                <div class="pg-testo"><b>${escapeHtml(m.nome_snapshot || '—')}</b><span>${info.label} · ${formattaData(m.avvenuto_il)}</span></div>
                <div class="pg-destra"><b style="color:${deltaColore};">${deltaTxt}</b></div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Variazione valore</span>
            <span class="page-azione attiva" onclick="apriDettaglioWidget('valore', event)">Vai a Valore</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande" style="color:${totale > 0 ? 'var(--success, #2e9e5b)' : (totale < 0 ? 'var(--danger)' : 'var(--text-dark)')};">${eur(totale)}</div>
                <div class="pg-sotto">${eventi.length} moviment${eventi.length === 1 ? 'o' : 'i'} registrat${eventi.length === 1 ? 'o' : 'i'}</div>
            </div>
            <div class="pg-titoletto">Per categoria</div>
            <div class="pg-elenco">${righeRiepilogo}</div>
            <div class="pg-titoletto" style="margin-top:0.6rem;">Ultimi movimenti</div>
            <div class="pg-elenco">${righeEventi}</div>
        </div>
    `;
}
