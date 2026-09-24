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
//   non toccato se non per l'aggiunta del trigger popup (vedi quel file).
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

    const righeMissioni = missioniOggiPool.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('');
    // Settimanali/mensili (2026-08-30, generalizzato): ora estratte a
    // sorte come le giornaliere, NON più "tutte visibili sempre" — mostro
    // solo il pool estratto per questa settimana/mese. Le una_tantum
    // restano invece tutte visibili sempre (obiettivi permanenti).
    const missioniRicorrentiNonGiornaliere = [...missioniSettimanaPool, ...missioniMesePool];
    const missioniUnaTantum = CATALOGO_MISSIONI.filter(m => m.finestra === 'una_tantum');
    const altreMissioni = [...missioniRicorrentiNonGiornaliere, ...missioniUnaTantum];
    const righeAltre = altreMissioni.map(m => _righeMissioneHtml(m, dati, idNuove.has(m.id))).join('');

    containerMissioni.innerHTML = `
        <div class="pg-titoletto">Oggi</div>
        <div class="pg-elenco">${righeMissioni}</div>
        ${altreMissioni.length ? `<div class="pg-titoletto" style="margin-top:0.8rem;">Settimanali, mensili &amp; permanenti</div><div class="pg-elenco">${righeAltre}</div>` : ''}
    `;
}

// Riga singola per una missione (completata o no), usata sia nel blocco
// "oggi" che in quello "settimanali & mensili". Tap sulla riga (2026-08-31,
// richiesta di Claudio: "cliccando su una missione appaia la descrizione,
// sennò l'utente non sa cosa fare, e anche la ricompensa collegata") →
// espande un blocco sotto con descrizione + ricompensa. pg-riga resta
// esattamente com'era (nessun rischio di rompere il layout condiviso con
// le altre pagine pg-*) — il dettaglio è un div FRATELLO nascosto di
// default, non dentro pg-riga stesso.
function _righeMissioneHtml(m, dati, appenaCompletata) {
    const soddisfatta = MOTORE_MISSIONI.valuta(m, dati);
    const icona = soddisfatta ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
    const colore = soddisfatta ? 'var(--success)' : 'var(--text-muted)';
    const badgeNuova = appenaCompletata ? `<span class="badge" style="background-color:var(--success); color:#fff; margin-left:0.4rem; font-size:0.65rem;">+${m.ricompensa.quantita || 1} ${m.ricompensa.tipo}</span>` : '';
    const idBase = 'missioneDettaglio-' + m.id;
    return `
        <div>
            <div class="pg-riga" style="cursor:pointer;" onclick="_toggleDettaglioMissione('${m.id}')">
                <i class="${icona}" style="color:${colore};"></i>
                <span style="flex:1; ${soddisfatta ? 'opacity:0.7;' : ''}">${escapeHtml(m.titolo)}${badgeNuova}</span>
                <i class="fa-solid fa-chevron-down" id="${idBase}-chevron" style="font-size:0.7rem; color:var(--text-muted); transition:transform 0.2s; flex-shrink:0;"></i>
            </div>
            <div id="${idBase}" style="display:none; padding:0 0.2rem 0.6rem 1.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                <div>${escapeHtml(m.descrizione || m.titolo)}</div>
                <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(m.ricompensa)}</div>
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

// Testo leggibile della ricompensa — stessi 4 tipi già usati nel catalogo
// (polvere/stampino/bustina/skip_missione), più il campo opzionale 'bonus'
// (es. m53/m99/m100 "possibilita_bustina/stampino") mostrato come nota a
// parte, senza promettere una certezza che non c'è.
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
