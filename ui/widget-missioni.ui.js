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
// - Tab Oggi/Settimana/Mese (riusa .binder-modalita-toggle/-btn,
//   stesso pattern di Match/Set/Binder) con pallino di notifica rosso sul
//   tab se quella finestra ha ancora missioni da fare. Cambio tab NON
//   rifà query: usa la cache _missioniCache popolata da un solo giro di
//   MOTORE_MISSIONI.valutaEAssegna() per apertura pagina.
// - Righe checklist più grandi (cerchio di spunta 26px, ricompensa sempre
//   visibile come sottotitolo) — il tap-to-espandi la descrizione
//   completa (richiesta originale di Claudio, 2026-08-31) resta invariato,
//   solo lo stile della riga cambia.
//
// AGGIUNTA STESSA SESSIONE (2026-09-25, dopo test di Claudio: "troppo
// spazio vuoto" sotto una lista corta, #phoneScreen ha altezza fissa e non
// si adatta al contenuto): 2 card in fondo alla pagina, entrambe lette da
// 'dati' già raccolto, zero query nuove —
// - "Prossimo traguardo" (_missioniProssimoTraguardoHtml): il traguardo a
//   soglia numerica ('>=') NON ancora sbloccato con la percentuale più
//   alta, con barra di avanzamento, cliccabile → apre il widget Achievement
//   (apriDettaglioWidget('achievement', event), stessa funzione/tabId già
//   usata altrove in index.html). Non conta i traguardi booleani a scatto
//   singolo (operatore '==').
// - "Costanza" (_missioniStreakCardHtml): stesso streak del riepilogo in
//   cima, in versione più grande/evidente, con messaggio "Torna domani per
//   non perdere la serie" — solo informativa, non cliccabile.
//
// TERZO GIRO STESSA SESSIONE (2026-09-25, dopo verifica di Claudio su
// questa seconda modifica):
// - Streak tolto dal riepilogo in cima (era mostrato lì E nella card
//   "Costanza" — ridondante, segnalato da Claudio). Resta SOLO nella card
//   in fondo.
//
// QUARTO GIRO STESSA SESSIONE (2026-09-25, decisione architetturale di
// Claudio: "tutte le permanenti le trasformerei in traguardi e le
// toglierei dalle missioni"): 6 delle 7 missioni una_tantum
// (m50_missione_compiuta, m54_cacciatore_di_obiettivi, m44_torna_domani,
// m45_costanza, m46_settimana_attiva, m75_matchmaker) sono state RIMOSSE
// dal catalogo (ui/missioni-catalogo.ui.js) e convertite in traguardi —
// vedi quel file per il dettaglio (3 già coperte da traguardi esistenti,
// 3 sostituite da una nuova scala t_streak_* estesa). Di conseguenza il tab
// "Permanenti" qui non avrebbe più nulla di stabile da mostrare ed è stato
// RIMOSSO (Claudio: "Va benissimo, rimuovi la tab") — restano solo
// Oggi/Settimana/Mese. La settima missione una_tantum,
// m95_il_tuo_telefono, è diventata anch'essa un traguardo il 2026-09-26
// (t_il_tuo_telefono, visibile in Achievement — vedi
// ui/missioni-catalogo.ui.js e sql/79): oggi non esiste più nessuna
// missione una_tantum.
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
                // AGGIORNATO 2026-09-26 (tessera Home vera, Claudio:
                // "Facciamolo"): prima era un conteggio di TUTTE le righe
                // completate oggi (missioniCompletatePeriodo) — contava anche
                // m94_personalizza, assegnata dal suo aggancio diretto pure
                // quando non è tra le 4 estratte, quindi poteva dare "5/4".
                // Ora legge QUALI missioni sono fatte (stessa funzione del
                // motore, una query) e conta solo quelle del pool di oggi.
                const { data: righeFatte, error } = await missioniCompletateIdPerPeriodi(userId, [oggi.periodo]);
                if (error) throw error;
                const idFatte = new Set((righeFatte || []).map(r => r.missione_id));
                const voci = pool.map(m => ({ titolo: m.titolo, fatta: idFatte.has(m.id), ricompensa: m.ricompensa }));
                const fatte = voci.filter(v => v.fatta).length;
                return {
                    // Restyle FASE 2: stato corto accanto alla sfera. Nessun
                    // badge: i premi si assegnano da soli, non c'è niente da
                    // riscuotere (vedi widget-dafare).
                    righe: [`${fatte} di ${pool.length} oggi`],
                    dati: { fatte, totali: pool.length, voci },
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
const _MISSIONI_TAB_LABEL = { oggi: 'Oggi', settimana: 'Settimana', mese: 'Mese' };

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

// Ridisegna riepilogo + tab + elenco dalla cache già raccolta — nessuna
// query. Chiamata sia dal primo render (sopra) sia da _missioniCambiaTab()
// al cambio tab.
//
// RESTYLE TAVOLA (2026-10-01, tavole OK-missioni / PC-missioni): testata
// con bottone "Traguardi", anello di oggi con riepilogo dei premi, righe
// con avanzamento "1/3" e premio "+5 ✧"; su PC (pagina larga >= 780px,
// container query su #missioni) le tre finestre stanno affiancate in tre
// colonne invece che nei tab, e in fondo c'è "Completate di recente".
// NESSUN bottone "Riscuoti": i premi si assegnano da soli (decisione di
// Claudio) — una missione fatta mostra il premio già preso in verde.
function _missioniRenderPagina() {
    const container = document.getElementById('missioniListaOggi');
    if (!container || !_missioniCache) return;
    const { dati, idNuove, gruppi } = _missioniCache;

    // Il riepilogo si riferisce SEMPRE a "Oggi", indipendentemente dal tab
    // selezionato sotto. Calcolato con MOTORE_MISSIONI.valuta() sullo
    // stesso pool mostrato nelle righe: stessa fonte di verità di ciò che
    // l'utente vede spuntato.
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

    // Polvere già presa oggi (solo premi di tipo polvere: gli altri tipi
    // non hanno un numero da sommare) — per la riga sotto il titolo su PC.
    const tutte = [...gruppi.oggi, ...gruppi.settimana, ...gruppi.mese];
    const polverePresa = tutte.filter(m => MOTORE_MISSIONI.valuta(m, dati))
        .reduce((s, m) => s + (m.ricompensa && m.ricompensa.tipo === 'polvere' ? (m.ricompensa.quantita || 0) : 0), 0);

    // Streak = giorni consecutivi CON ACCESSO (vedi commento in testa al
    // file) — dati.giorni_consecutivi è già calcolato da raccogliDati().
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

    // Telefono: un solo elenco (tab attivo). PC: tre colonne, tutte visibili.
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

// Scritte di scadenza delle tre finestre ("scade tra 6 h", "scade
// domenica", "ottobre"), calcolate dall'ora del dispositivo — stessi
// confini di MOTORE_MISSIONI.periodoCorrente() (giorno locale, settimana
// lunedì-domenica, mese di calendario).
function _missioniScadenze() {
    const ora = new Date();
    const mezzanotte = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() + 1);
    const ore = Math.max(0, Math.floor((mezzanotte - ora) / 3600000));
    const oggi = ore >= 1 ? `scade tra ${ore} h` : 'scade tra poco';
    const settimana = ora.getDay() === 0 ? 'scade stasera' : 'scade domenica';
    const mese = ora.toLocaleDateString('it-IT', { month: 'long' });
    return { oggi, settimana, mese };
}

// "Completate di recente" (solo PC, tavola PC-missioni): gli ultimi giorni
// e la settimana scorsa, quante missioni del loro pool sono state fatte e
// quanta polvere hanno dato. Una sola query (missioniCompletateIdPerPeriodi,
// già usata dalla tessera Home) per tutti i periodi insieme; i pool dei
// giorni passati sono ricalcolati con la stessa estrazione deterministica
// del motore. Fatta DOPO il primo disegno, così la pagina non aspetta.
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

// Card "Prossimo traguardo" (2026-09-25): il traguardo NON ancora sbloccato
// con la percentuale di completamento più alta — rimando cliccabile al
// widget Achievement (apriDettaglioWidget('achievement', ...), stessa
// funzione/tabId già usata altrove in index.html per aprire quella pagina,
// invariata). Considera SOLO i traguardi con operatore '>=' (soglia
// numerica, es. "100 carte") — esclude i traguardi booleani a scatto
// singolo (es. t_giorno_impeccabile, operatore '==', valore true), per cui
// una "percentuale di avvicinamento" non ha senso. CATALOGO_TRAGUARDI è la
// stessa costante globale già usata da MOTORE_MISSIONI (ui/missioni-catalogo.ui.js),
// dati._traguardiRiscossiIds è già esposto da raccogliDati() (ui/missioni.ui.js,
// sessione precedente) — nessuna nuova query.
function _missioniProssimoTraguardo(dati) {
    const riscossi = new Set(dati._traguardiRiscossiIds || []);
    let migliore = null;
    for (const t of CATALOGO_TRAGUARDI) {
        if (t.operatore !== '>=' || !t.valore) continue;
        if (riscossi.has(t.id)) continue;
        const valoreAttuale = dati[t.metrica];
        if (valoreAttuale === undefined) continue;
        // Già raggiunto ma non ancora in traguardi_riscossi: lo assegna il
        // prossimo giro del motore — non è un "prossimo" traguardo.
        if (valoreAttuale >= t.valore) continue;
        // Percentuale mostrata cappata al 99%: se un traguardo è già >=100%
        // ma non ancora risulta in traguardi_riscossi, è solo questione del
        // prossimo giro di MOTORE_MISSIONI.valutaEAssegna() (o del prossimo
        // apertura pagina) — non ha senso proclamarlo "100% ma bloccato".
        const percent = Math.max(0, Math.min(99, Math.round((valoreAttuale / t.valore) * 100)));
        if (!migliore || percent > migliore.percent) {
            migliore = { t, valoreAttuale, percent };
        }
    }
    return migliore;
}

function _missioniProssimoTraguardoHtml(dati) {
    const migliore = _missioniProssimoTraguardo(dati);
    if (!migliore) return ''; // tutti i traguardi a soglia numerica già sbloccati, o dato mancante — nessun blocco, nessun errore
    const { t, valoreAttuale, percent } = migliore;
    // Arrotondato SOLO per la visualizzazione (es. valore_collezione è una
    // somma di prezzi, quasi mai un numero intero).
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

// Card "Costanza": stesso streak calcolato dal chiamante (giorni di fila
// con accesso), nessuna query aggiuntiva qui.
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

// Premio in forma corta per la colonna destra delle righe ("+5 ✧"); per i
// premi senza numero di polvere usa il testo breve già esistente.
function _missioniPremioBreve(ricompensa) {
    if (!ricompensa) return '';
    if (ricompensa.tipo === 'polvere') return `+${ricompensa.quantita || 1} ✧`;
    return _ricompensaTestoBreve(ricompensa);
}

// Avanzamento "1/3" di una missione a soglia numerica; null per le
// missioni a scatto singolo (operatore '==') dove un conteggio non ha senso.
function _missioniAvanzamento(m, dati) {
    if (m.operatore !== '>=' || typeof m.valore !== 'number' || m.valore <= 1) return null;
    const v = Number(dati[m.metrica]);
    if (!isFinite(v)) return null;
    return `${Math.min(Math.round(v), m.valore)}/${m.valore}`;
}

// Cambio tab (Oggi/Settimana/Mese) — usa la cache, nessuna
// nuova query. Se la pagina non è mai stata renderizzata in questa
// sessione (cache assente), non fa nulla: non dovrebbe mai accadere dato
// che i bottoni esistono solo dopo il primo render, difensivo comunque.
function _missioniCambiaTab(chiave) {
    if (!_missioniCache) return;
    _missioniTabAttiva = chiave;
    _missioniRenderPagina();
}

// Riga singola per una missione (completata o no), usata in tutti e 3 i
// tab (Oggi/Settimana/Mese). Tap sulla riga (2026-08-31,
// richiesta di Claudio: "cliccando su una missione appaia la descrizione,
// sennò l'utente non sa cosa fare, e anche la ricompensa collegata") →
// espande un blocco sotto con la descrizione completa — comportamento
// INVARIATO dal restyle 2026-09-25: cambia solo lo stile della riga
// (cerchio di spunta più grande, ricompensa breve già visibile come
// sottotitolo, non solo nel blocco espanso).
function _righeMissioneHtml(m, dati, appenaCompletata) {
    const soddisfatta = MOTORE_MISSIONI.valuta(m, dati);
    const badgeNuova = appenaCompletata ? `<span class="msn-nuova">Nuovo!</span>` : '';
    const idBase = 'missioneDettaglio-' + m.id;
    const avanzamento = soddisfatta ? null : _missioniAvanzamento(m, dati);
    const premio = _missioniPremioBreve(m.ricompensa);
    // Restyle tavola: descrizione sempre visibile sotto il titolo, a destra
    // avanzamento + premio. Fatta → premio in pillola verde ("preso", si
    // assegna da solo). Il tap apre comunque il dettaglio con la ricompensa
    // completa (richiesta di Claudio 2026-08-31, invariata).
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
