// ═══════════════════════════════════════════════════════════════════════
// WIDGET-MISSIONI.UI.JS — tessera + pagina "Missioni" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 14 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11.
//
// SEMPLIFICATA (2026-09-25, Milestones = Achievement — decisione di
// Claudio in sessione): la sezione Traguardi (containerTraguardi, scale a
// barra, TRAGUARDI_SINGOLI) è stata RIMOSSA da questa pagina — quei dati
// vivono ora esclusivamente nel widget Achievement
// (ui/widget-achievement.ui.js). Questa pagina mostra solo missioni
// giornaliere/settimanali/mensili/una_tantum. MOTORE_MISSIONI.valutaEAssegna()
// continua a valutare E scrivere i traguardi esattamente come prima
// (traguardi_riscossi non cambia): qui cambia solo cosa viene mostrato,
// non cosa viene calcolato/salvato — il popup di sblocco (dentro
// _missioniNotificaCompletamenti, ui/missioni.ui.js) continua quindi a
// scattare anche aprendo questa pagina, non solo dal watcher in
// background.
//
// RESTYLE GRAFICO (2026-09-25, Variante C scelta da Claudio dopo revisione
// di 3 mockup HTML — vedi Compilato precedente). Cambia SOLO la resa
// visiva di questa pagina, non cosa viene raccolto/calcolato/scritto:
// - Riepilogo in alto: anello di progresso (missioni di OGGI, sempre —
//   indipendente dal tab selezionato) + testo + streak "giorni
//   consecutivi" (dati.giorni_consecutivi, campo GIÀ calcolato da
//   MOTORE_MISSIONI.raccogliDati() via missioniGiorniConsecutivi() in
//   data/missioni.repository.js — funzione preesistente, già testata
//   [fix timezone 2026-09-19], usata finora solo per i traguardi "Torna
//   domani"/"Costanza": qui viene semplicemente MOSTRATA in UI per la
//   prima volta, zero query nuove). ATTENZIONE (segnalato a Claudio prima
//   di scrivere questo file): è uno streak di GIORNI CON ACCESSO
//   all'app (action='accesso' in activity_log), non di "giorni con
//   almeno una missione completata" — non esiste nel DB una metrica di
//   quel secondo tipo (verificato: activity_log non logga un evento
//   "missione completata", solo eventi di navigazione/apertura widget).
// - Tab Oggi/Settimana/Mese/Permanenti (riusa .binder-modalita-toggle/-btn,
//   stesso pattern di Match/Set/Binder) con pallino di notifica rosso sul
//   tab se quella finestra ha ancora missioni da fare. Cambio tab NON
//   rifà query: usa la cache _missioniCache popolata da un solo giro di
//   MOTORE_MISSIONI.valutaEAssegna() per apertura pagina.
// - Righe checklist più grandi (cerchio di spunta 26px, ricompensa sempre
//   visibile come sottotitolo) — il tap-to-espandi la descrizione
//   completa (richiesta originale di Claudio, 2026-08-31) resta invariato,
//   solo lo stile della riga cambia.
//
// CONSOLIDAMENTO FATTO NELLO STEP 14 (invariato): avvisi CSBar + beep +
// rilettura saldo polvere sono in _missioniNotificaCompletamenti(), dentro
// ui/missioni.ui.js (il motore, non questo file: la usa anche
// missioni-watcher.js).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale-dettaglio.ui.js) continua a
//   chiamare renderPaginaMissioni() per tabId === 'missioni' — motore
//   home, dispatch generico, non toccato in questa sessione.
// - MOTORE_MISSIONI, CATALOGO_MISSIONI, CATALOGO_TRAGUARDI,
//   _missioniNotificaCompletamenti (ui/missioni.ui.js) — motore missioni,
//   non toccato se non per l'aggiunta del trigger popup (vedi quel file,
//   sessione precedente).
// - _watcherMissioniGiro e tutto il resto di ui/missioni-watcher.js — non
//   toccato in questa sessione.
// - authGetUserId, escapeHtml: esterne, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.missioni = {
        titolo: 'Missioni', icona: 'fa-list-check',
        // Async: chiama il repository per il conteggio di oggi. Se l'utente
        // non è loggato o la query fallisce, ricade su un testo neutro
        // invece di un errore visibile (stesso principio degli altri
        // preview() del catalogo).
        preview: async () => {
            try {
                const userId = await authGetUserId();
                if (!userId) return { righe: ['Accedi per vedere le missioni'], dati: { placeholder: true } };
                const oggi = MOTORE_MISSIONI.periodoCorrente('giornaliera');
                const pool = MOTORE_MISSIONI.missioniDelGiorno(userId, oggi.periodo);
                const { count, error } = await missioniCompletatePeriodo(userId, oggi.periodo);
                if (error) throw error;
                const fatte = count || 0;
                return {
                    righe: [`${fatte}/${pool.length} missioni completate oggi`],
                    dati: { fatte, totali: pool.length },
                };
            } catch (e) {
                console.error('[missioni widget] preview:', e);
                return { righe: ['Missioni del giorno'], dati: { placeholder: true } };
            }
        },
};

// ── STATO DI PAGINA (restyle 2026-09-25) ─────────────────────────────
// Cache popolata una volta per apertura pagina da renderPaginaMissioni(),
// riletta da _missioniRenderPagina()/_missioniCambiaTab() per ridisegnare
// solo il markup, senza rifare query. Reimpostata ad ogni renderPaginaMissioni().
let _missioniCache = null;
let _missioniTabAttiva = 'oggi';
const _MISSIONI_TAB_LABEL = { oggi: 'Oggi', settimana: 'Settimana', mese: 'Mese', permanenti: 'Permanenti' };

// ── PAGINA "MISSIONI" (giornaliere/settimanali/mensili/una_tantum —
// SEMPLIFICATA 2026-09-25: i traguardi permanenti sono usciti da questa
// pagina, ora vivono nel widget Achievement) ─────────────────────────────
// Chiama MOTORE_MISSIONI.valutaEAssegna() (ui/missioni.ui.js), che raccoglie
// i dati via data/missioni.repository.js, valuta il catalogo Fase 1 e
// assegna automaticamente le ricompense delle voci appena soddisfatte
// (Claudio: "automatico, si sblocca da solo" — nessun bottone Riscuoti).
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

    // Aggiorna il badge del widget in home, se aperto in background —
    // stesso principio di aggiornaBadgeMatch(), nessun refresh di pagina.
    if (typeof _aggiornaPallinoMenu === 'function') { /* nessun pallino per missioni al momento, placeholder per coerenza futura */ }

    const idNuove = new Set(nuoveMissioni.map(m => m.id));

    // CONSOLIDATO (STEP 14 ristrutturazione, 2026-09-11): avvisi CSBar +
    // beep + rilettura saldo polvere in un'unica funzione condivisa
    // (_missioniNotificaCompletamenti, ui/missioni.ui.js), usata anche da
    // ui/missioni-watcher.js. Dal 2026-09-25 quella funzione include anche
    // il trigger del popup di sblocco Achievement per ogni nuovo
    // traguardo — invariato qui, nessuna chiamata in più da aggiungere in
    // questo file. Non awaited, come il refresh del saldo non lo era
    // nemmeno prima — stesso comportamento fire-and-forget di sempre, non
    // blocca il render della pagina.
    _missioniNotificaCompletamenti(nuoveMissioni, nuoviTraguardi);

    // Le una_tantum restano sempre tutte visibili (obiettivi permanenti,
    // nessuna estrazione a sorte) — stesso filtro di sempre, ora è il pool
    // del tab "Permanenti" invece di finire in coda al pool "oggi".
    const missioniUnaTantum = CATALOGO_MISSIONI.filter(m => m.finestra === 'una_tantum');

    _missioniCache = {
        dati,
        idNuove,
        gruppi: {
            oggi: missioniOggiPool,
            settimana: missioniSettimanaPool,
            mese: missioniMesePool,
            permanenti: missioniUnaTantum,
        },
    };
    _missioniTabAttiva = 'oggi';
    _missioniRenderPagina();
}

// Ridisegna riepilogo + tab + elenco dalla cache già raccolta — nessuna
// query. Chiamata sia dal primo render (sopra) sia da _missioniCambiaTab()
// al cambio tab.
function _missioniRenderPagina() {
    const container = document.getElementById('missioniListaOggi');
    if (!container || !_missioniCache) return;
    const { dati, idNuove, gruppi } = _missioniCache;

    // Il riepilogo (anello + testo + streak) si riferisce SEMPRE a "Oggi",
    // indipendentemente dal tab selezionato sotto — coerente col mockup
    // scelto (Variante C): i tab servono a sfogliare le finestre, il
    // riepilogo in cima resta un ancoraggio fisso. Calcolato con
    // MOTORE_MISSIONI.valuta() sullo stesso pool mostrato nelle righe
    // (non da dati.missioni_completate_periodo, che riflette le righe già
    // scritte su DB): stessa fonte di verità di ciò che l'utente vede
    // spuntato, zero rischio di disallineamento fra numero e spunte.
    const poolOggi = gruppi.oggi;
    const completateOggi = poolOggi.filter(m => MOTORE_MISSIONI.valuta(m, dati)).length;
    const totaleOggi = poolOggi.length;
    const percentOggi = totaleOggi > 0 ? Math.round((completateOggi / totaleOggi) * 100) : 100;

    const RAGGIO_ANELLO = 23;
    const CIRCONFERENZA = 2 * Math.PI * RAGGIO_ANELLO;
    const offsetAnello = CIRCONFERENZA * (1 - percentOggi / 100);

    let titoloRiepilogo;
    if (totaleOggi === 0) {
        titoloRiepilogo = 'Nessuna missione oggi disponibile';
    } else if (completateOggi >= totaleOggi) {
        titoloRiepilogo = 'Tutte le missioni di oggi completate!';
    } else {
        const mancanti = totaleOggi - completateOggi;
        titoloRiepilogo = mancanti === 1 ? 'Ancora 1 missione oggi' : `Ancora ${mancanti} missioni oggi`;
    }

    // Streak = giorni consecutivi CON ACCESSO (vedi commento in testa al
    // file) — dati.giorni_consecutivi è già calcolato da raccogliDati(),
    // nessuna query qui.
    const streak = dati.giorni_consecutivi || 0;
    const streakHtml = streak > 0
        ? `<div class="msn-streak"><i class="fa-solid fa-fire"></i> ${streak === 1 ? '1 giorno consecutivo' : `${streak} giorni consecutivi`}</div>`
        : '';

    const riepilogoHtml = `
        <div class="msn-riepilogo" style="margin-bottom:1rem;">
            <div class="msn-ring">
                <svg width="54" height="54">
                    <circle cx="27" cy="27" r="${RAGGIO_ANELLO}" stroke="var(--primary-light)" stroke-width="6" fill="none"></circle>
                    <circle cx="27" cy="27" r="${RAGGIO_ANELLO}" stroke="var(--primary)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${CIRCONFERENZA.toFixed(1)}" stroke-dashoffset="${offsetAnello.toFixed(1)}"></circle>
                </svg>
                <div class="msn-ring-testo">${completateOggi}/${totaleOggi}</div>
            </div>
            <div>
                <div class="msn-riepilogo-titolo">${escapeHtml(titoloRiepilogo)}</div>
                ${streakHtml}
            </div>
        </div>`;

    const tabsDef = [
        { chiave: 'oggi', pool: gruppi.oggi },
        { chiave: 'settimana', pool: gruppi.settimana },
        { chiave: 'mese', pool: gruppi.mese },
        { chiave: 'permanenti', pool: gruppi.permanenti },
    ];
    const tabsHtml = tabsDef.map(t => {
        const daFare = t.pool.some(m => !MOTORE_MISSIONI.valuta(m, dati));
        const attiva = t.chiave === _missioniTabAttiva;
        return `<button class="binder-modalita-btn${attiva ? ' active' : ''}" style="position:relative;" onclick="_missioniCambiaTab('${t.chiave}')">${_MISSIONI_TAB_LABEL[t.chiave]}${daFare ? '<span class="msn-tab-pallino"></span>' : ''}</button>`;
    }).join('');

    const poolAttivo = (tabsDef.find(t => t.chiave === _missioniTabAttiva) || tabsDef[0]).pool;
    const righeHtml = poolAttivo.length
        ? poolAttivo.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('')
        : '<div class="msn-vuoto">Nessuna missione in questa categoria al momento.</div>';

    container.innerHTML = `
        ${riepilogoHtml}
        <div class="binder-modalita-toggle">${tabsHtml}</div>
        <div class="pg-elenco">${righeHtml}</div>
    `;
}

// Cambio tab (Oggi/Settimana/Mese/Permanenti) — usa la cache, nessuna
// nuova query. Se la pagina non è mai stata renderizzata in questa
// sessione (cache assente), non fa nulla: non dovrebbe mai accadere dato
// che i bottoni esistono solo dopo il primo render, difensivo comunque.
function _missioniCambiaTab(chiave) {
    if (!_missioniCache) return;
    _missioniTabAttiva = chiave;
    _missioniRenderPagina();
}

// Riga singola per una missione (completata o no), usata in tutti e 4 i
// tab (Oggi/Settimana/Mese/Permanenti). Tap sulla riga (2026-08-31,
// richiesta di Claudio: "cliccando su una missione appaia la descrizione,
// sennò l'utente non sa cosa fare, e anche la ricompensa collegata") →
// espande un blocco sotto con la descrizione completa — comportamento
// INVARIATO dal restyle 2026-09-25: cambia solo lo stile della riga
// (cerchio di spunta più grande, ricompensa breve già visibile come
// sottotitolo, non solo nel blocco espanso).
function _righeMissioneHtml(m, dati, appenaCompletata) {
    const soddisfatta = MOTORE_MISSIONI.valuta(m, dati);
    const badgeNuova = appenaCompletata ? `<span class="badge" style="background-color:var(--success); color:#fff;">Nuovo!</span>` : '';
    const idBase = 'missioneDettaglio-' + m.id;
    return `
        <div>
            <div class="pg-riga" style="cursor:pointer; padding:12px 6px; gap:12px;" onclick="_toggleDettaglioMissione('${m.id}')">
                <div class="msn-check${soddisfatta ? ' fatta' : ''}">${soddisfatta ? '<i class="fa-solid fa-check"></i>' : ''}</div>
                <div style="flex:1; min-width:0;">
                    <div class="msn-riga-testo-riga1${soddisfatta ? ' fatta' : ''}">${escapeHtml(m.titolo)}${badgeNuova}</div>
                    <div class="msn-riga-testo-riga2">${escapeHtml(_ricompensaTestoBreve(m.ricompensa))}</div>
                </div>
                <i class="fa-solid fa-chevron-down" id="${idBase}-chevron" style="font-size:0.7rem; color:var(--text-muted); transition:transform 0.2s; flex-shrink:0;"></i>
            </div>
            <div id="${idBase}" style="display:none; padding:0 0.2rem 0.6rem 2.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                ${escapeHtml(m.descrizione || m.titolo)}
            </div>
        </div>`;
}

function _toggleDettaglioMissione(id) {
    const dettaglio = document.getElementById('missioneDettaglio-' + id);
    const chevron = document.getElementById('missioneDettaglio-' + id + '-chevron');
    if (!dettaglio) return;
    const aperto = dettaglio.style.display !== 'none';
    dettaglio.style.display = aperto ? 'none' : 'block';
    if (chevron) chevron.style.transform = aperto ? 'rotate(0deg)' : 'rotate(180deg)';
}

// Testo BREVE della ricompensa (senza prefisso "Ricompensa:"), usato come
// sottotitolo sempre visibile nella riga (restyle 2026-09-25). Duplica
// volutamente la logica di _testoRicompensa() sotto invece di refactorare
// quest'ultima per condividerla — stesso file, ma Regola d'Oro #1
// (preferire codice locale duplicato a refactoring, anche a basso
// rischio): _testoRicompensa() resta identica a prima, nessun rischio di
// romperla per chi la richiama altrove.
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

// Testo leggibile della ricompensa — stessi 4 tipi già usati nel catalogo
// (polvere/stampino/bustina/skip_missione), più il campo opzionale 'bonus'
// (es. m53/m99/m100 "possibilita_bustina/stampino") mostrato come nota a
// parte, senza promettere una certezza che non c'è. INVARIATA dal restyle
// (usata oggi solo nel blocco descrizione espanso, se in futuro serve
// altrove).
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
