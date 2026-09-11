// ═══════════════════════════════════════════════════════════════════════
// WIDGET-RENDER-TESSERE-GRANDI.UI.JS — componenti visivi condivisi delle
// tessere grandi (2x1/1x2/2x2) — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (secondo giro di taglio su questo file, dopo l'estrazione
// da ui/widget-render-condiviso.ui.js). NESSUNA riscrittura del codice
// esistente: solo spostamento, zero cambi di comportamento per l'utente
// finale.
//
// Contiene: miniatura di una carta, componenti visivi condivisi
// (_ballRiga/_ballPill/_ballSparkline/_ballMiniCarta/_ballPulsante ecc.) —
// i "mattoncini" riusati da qualunque corpo di widget.
//
// _ballCORPI (il corpo grafico di ogni singolo widget) e _ballCorpoWidget
// sono stati spostati in ui/widget-render-corpi.ui.js — chiamano questi
// componenti cross-file, stesso meccanismo di sempre.
//
// La grafica della sfera in modalità icona (palette, disegno sfera,
// animazione di cattura, semaforo) resta in
// ui/widget-render-condiviso.ui.js. Nessuna istruzione qui gira a tempo di
// caricamento script — l'ordine tra i tre file widget-render-*.ui.js è
// indifferente.
// ───────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// CONTENUTI DELLE TESSERE GRANDI (sessione 2026-08-27, seconda parte)
// ═══════════════════════════════════════════════════════════════════════
// Su 1x1 la tessera è la sola sfera col titolo inciso. Sulle taglie grandi
// (2x1, 1x2, 2x2) c'era finora lo stesso identico contenuto della 1x1 —
// titolo e una riga di testo — quindi il quadruplo dello spazio non diceva
// niente di più. Qui ogni widget disegna il proprio contenuto.
//
// DUE SLOT, come nella demo di Opus:
//   inline → accanto alla sfera, riga superiore. C'è su tutte le taglie
//            grandi, deve stare stretto (su 2x1 è l'unico spazio).
//   blocco → sotto, per intero. Solo dove c'è altezza: 1x2 e 2x2.
//
// Scelta (Claudio: "come secondo te è meglio"): sulle taglie grandi la
// grafica SOSTITUISCE le righe di testo. Ripetere "7 da aggiornare" sotto
// una barra che dice già quello è la stessa informazione due volte, e ruba
// lo spazio che serve alla grafica. Il titolo resta.
//
// PER ORA solo quattro widget (Claudio: "facciamone 4 per volta"): Prezzi,
// Visualizzazione, Location, Match. Tutti gli altri ricadono su _ballCorpoGenerico,
// che mostra le righe di testo di sempre: nessuna regressione.
//
// ZERO QUERY NUOVE: tutto ciò che serve è già in memoria (carteReali,
// _elencoPrezziScaduti, _numNuoviMatch*). I preview() sono stati estesi con
// un campo 'dati' AGGIUNTIVO — le 'righe' restano identiche, così le
// tessere piccole e il semaforo continuano a funzionare come prima.

// Righe cliccabili dentro la tessera (Claudio: "lo voglio").
// Attenzione a tre cose, tutte gestite qui:
//   - stopPropagation, o il tocco farebbe partire ANCHE la cattura da 2,6s
//     e l'apertura del widget;
//   - in modalità modifica non deve fare nulla: lì si trascina e si ridimensiona;
//   - le azioni chiamano solo funzioni VERIFICATE nei file reali:
//       apriFlipCardHome(id)          → ui/home.ui.js
//       apriModalePrezziScaduti()     → ui/prices.ui.js r.212
//       filterTable() + #filterLocation → ui/cards.ui.js r.803-833
//     ognuna protetta da un typeof: se un domani sparisse, la riga smette
//     di funzionare ma non butta giù la home.
function _ballAzioneRiga(evt, tipo, valore, origine) {
    if (evt) evt.stopPropagation();
    if (_editModeWidget) return;
    _vibraSeSupportato(8);
    switch (tipo) {
        case 'carta':
            // Missioni #39/#83 (2026-08-30): origine propagata per distinguere
            // "apertura da lista top-valore" (valore_collezione) da qualunque
            // altra apertura — vedi ui/home.ui.js:apriFlipCardHome().
            if (typeof apriFlipCardHome === 'function') apriFlipCardHome(valore, origine ? { origine } : {});
            break;

        case 'tab':
            apriDettaglioWidget(valore, evt);
            break;

        // Elenco completo delle carte con prezzo da aggiornare: esiste già
        // come modale nel sito, con nomi, codici e data dell'ultimo
        // controllo. Non apriamo la sezione Prezzi: la modale dice di più
        // ed è esattamente ciò che serve dopo aver toccato quella riga.
        case 'prezzi-scaduti':
            if (typeof apriModalePrezziScaduti === 'function') apriModalePrezziScaduti();
            else apriDettaglioWidget('prezzi', evt);
            break;

        // Location: apre Visualizzazione GIÀ FILTRATA su quella posizione.
        // filterTable() legge il valore dalla tendina #filterLocation
        // (popolata da caricaCarteReali con le location realmente presenti),
        // quindi il filtro si imposta scrivendo lì e richiamandola.
        // Il filtro va applicato DOPO l'apertura: switchTab ridisegna la
        // sezione, e farlo prima verrebbe sovrascritto.
        case 'location':
            apriDettaglioWidget('visualizzazione', evt);
            setTimeout(() => {
                const select = document.getElementById('filterLocation');
                if (!select || typeof filterTable !== 'function') return;
                // Se quella location non è tra le opzioni (dato cambiato nel
                // frattempo), meglio non filtrare che filtrare a vuoto
                // lasciando una tabella misteriosamente deserta.
                const esiste = Array.from(select.options).some(o => o.value === valore);
                if (!esiste) return;
                select.value = valore;
                filterTable();
            }, 60);
            break;
    }
}

// ── MINIATURA DI UNA CARTA ───────────────────────────────────────────────
// Ricalcata su miniCarta() del mockup (cardsync.js r.516): rettangolo con
// gradiente, una barra chiara in alto al posto dell'illustrazione e una
// sottile in basso al posto del testo, angoli morbidi e ombra leggera.
//
// DIFFERENZA VOLUTA dal mockup: lì le carte erano finte, qui esistono
// davvero. Quando c'è l'immagine la mostriamo — vale più di un rettangolo
// colorato — e il disegno di Opus resta come RIPIEGO per le carte senza
// immagine, dove finora c'era un'icona grigia.
//
// Il colore del ripiego non è casuale ad ogni render: è derivato dal nome
// della carta, così la stessa carta ha sempre la sua tinta e la striscia
// non "sfarfalla" ad ogni giro di polling.
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

    // Holo scorrevole: nel mockup segnala le carte speciali. Qui dipende dal
    // campo 'rarita', che al 27/08/2026 NON esiste nello schema (verificato
    // in sessione precedente su information_schema.columns) — quindi oggi
    // non si accende su nulla e non costa niente. Se un giorno il campo
    // arriverà, si accenderà da solo sulle carte rare.
    const speciale = c.rarita && /rara|ultra|secret|holo/i.test(String(c.rarita));
    const classi = 'ball-mini' + (speciale ? ' holo' : '');

    if (c.immagine) {
        const url = _urlImmagineVisualizzabile(c.immagine, 96) || '';
        // Se l'immagine non carica, resta visibile il ripiego disegnato che
        // sta sotto: nessun buco grigio.
        return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}>
                    <i></i><u></u>
                    <img src="${url}" alt="" onerror="this.remove();">
                    ${badgeHtml}
                </span>`;
    }
    return `<span class="${classi}" style="background:linear-gradient(150deg, ${_ballTintaDaNome(c.nome)}, rgba(0,0,0,.35))" title="${titolo}" ${clic}><i></i><u></u>${badgeHtml}</span>`;
}

// ── COMPONENTI VISIVI, ricalcati dal mockup ──────────────────────────────
// Tipografia e componenti vengono da cardsync.css: k-tit (titolo), k-big
// (dato principale, 25px), k-mid, k-lab (etichetta piccola), pill, barra,
// riga, sparkline, stat-griglia, pulsante azione.
//
// NOMI PREFISSATI: nel mockup si chiamano .riga, .nome, .dato, .pill,
// .stat, .azione — nomi generici che nel CSS globale del sito sono GIÀ
// usati 17 volte. Prefissati con ball- mantenendo proprietà identiche.

// Sparkline SVG, identica a sparkline() del mockup (cardsync.js r.522):
// area sfumata sotto e linea sopra, tracciato normalizzato su min/max.
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

// Riga con barra di avanzamento (come il corpo 'set' del mockup).
function _ballRigaBarra(nome, dato, percento, azione) {
    const p = Math.max(0, Math.min(100, percento));
    const clic = azione ? ` onclick="${azione}" class="ball-riga-set ball-clic"` : ' class="ball-riga-set"';
    return `<div${clic}>
        <div class="ball-riga"><span class="ball-nome">${nome}</span><span class="ball-dato">${dato}</span></div>
        <div class="ball-barra-out"><div class="ball-barra-in" style="width:${p}%"></div></div>
    </div>`;
}

// Riga semplice nome + valore/i.
function _ballRiga(nome, ...dati) {
    return `<div class="ball-riga">
        <span class="ball-nome">${nome}</span>
        ${dati.map(d => `<span class="ball-dato">${d}</span>`).join('')}
    </div>`;
}

// Corpo dei widget non ancora collegati (gacha): niente numeri finti, solo
// una riga che dice cosa arriverà. Ricalcato sullo stato "vuoto" del
// mockup, che trattava il primo giorno come un momento importante invece
// che come un errore.
function _ballCorpoSegnaposto(titolo, d) {
    return {
        inline:
            `<p class="ball-k-tit">${titolo}</p>` +
            '<div class="ball-k-mid ball-attesa">In arrivo</div>' +
            `<span class="ball-k-lab">${(d && d.testo) || ''}</span>`,
        blocco: ''
    };
}

function _ballPill(testo, acceso) {
    return `<span class="ball-pill${acceso ? ' acceso' : ''}">${testo}</span>`;
}

function _ballPulsante(testo, azione) {
    return `<button type="button" class="ball-azione" onclick="${azione}">${testo}</button>`;
}

