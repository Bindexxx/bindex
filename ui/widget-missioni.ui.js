// ═══════════════════════════════════════════════════════════════════════
// WIDGET-MISSIONI.UI.JS — tessera + pagina "Missioni" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 14 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11.
//
// CATEGORIA A: pagina propria (missioni giornaliere/settimanali/mensili/
// una_tantum + traguardi permanenti, unificati). Chiama
// MOTORE_MISSIONI.valutaEAssegna() (ui/missioni.ui.js) — motore missioni
// vero, separato da tempo, non toccato da questo step se non per
// l'aggiunta descritta sotto.
//
// CONSOLIDAMENTO FATTO IN QUESTO STEP (richiesto dalla roadmap, §6):
// avvisi CSBar + beep + rilettura saldo polvere per la status bar erano
// duplicati quasi identici qui e in ui/missioni-watcher.js — CON UN BUG
// REALE trovato leggendo il codice: i due punti usavano due metodi
// diversi per il saldo (qui il corretto polvereSaldoLeggi(), il watcher
// il vecchio ricompenseSaldo() che tronca oltre ~1000 righe). Consolidati
// in _missioniNotificaCompletamenti(), ora dentro ui/missioni.ui.js (il
// motore, non questo file: la usa anche missioni-watcher.js, che non ha
// nulla a che fare col dominio widget-home). Approvato da Claudio dopo
// verifica diretta del corpo di polvere_saldo() su Supabase (SELECT
// COALESCE(SUM...), SECURITY DEFINER, nessuna scrittura) — nessun limite
// aggiuntivo richiesto oltre alla guardia "solo se c'è qualcosa di nuovo"
// già presente prima, preservata identica.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaMissioni() per tabId === 'missioni' — motore home,
//   dispatch generico, non toccato in questo step.
// - MOTORE_MISSIONI, CATALOGO_MISSIONI, CATALOGO_TRAGUARDI,
//   _missioniNotificaCompletamenti (ui/missioni.ui.js) — motore missioni,
//   non toccato se non per l'aggiunta della funzione condivisa sopra.
// - _watcherMissioniGiro e tutto il resto di ui/missioni-watcher.js —
//   aggiornato per usare la funzione condivisa, non spostato qui.
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

// ── PAGINA "MISSIONI" (missioni giornaliere/settimanali/mensili/una_tantum
// + traguardi permanenti, unificati — Claudio 2026-08-29) ────────────────
// Chiama MOTORE_MISSIONI.valutaEAssegna() (ui/missioni.ui.js), che raccoglie
// i dati via data/missioni.repository.js, valuta il catalogo Fase 1 e
// assegna automaticamente le ricompense delle voci appena soddisfatte
// (Claudio: "automatico, si sblocca da solo" — nessun bottone Riscuoti).
async function renderPaginaMissioni() {
    const containerMissioni = document.getElementById('missioniListaOggi');
    const containerTraguardi = document.getElementById('missioniListaTraguardi');
    if (!containerMissioni || !containerTraguardi) return;
    containerMissioni.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Caricamento…</p>';
    containerTraguardi.innerHTML = '';

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
    // beep + rilettura saldo polvere ora in un'unica funzione condivisa
    // (_missioniNotificaCompletamenti, ui/missioni.ui.js), usata anche da
    // ui/missioni-watcher.js. Non awaited qui, come il refresh del saldo
    // non lo era nemmeno prima — stesso comportamento fire-and-forget di
    // sempre, non blocca il render della pagina.
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

    // Traguardi: vista compatta per non riversare 65+ righe su mobile — per
    // ogni scala mostra il prossimo scalino non ancora raggiunto (o "tutti
    // sbloccati" se completa), più il conteggio totale sbloccati in alto.
    //
    // BUG TROVATO E CORRETTO (2026-09-01, segnalato da Claudio: "la pagina
    // Traguardi non mostra Maestro CardSync/Leggenda CardSync"): la causa
    // reale non erano le due voci nuove in sé, ma un problema preesistente
    // più ampio, mai notato prima perché nessuno aveva ancora controllato
    // a fondo. Questo array 'scale' elencava SOLO 6 scale (carte, valore,
    // location, wishlist, doppioni, missioni) — le altre 4 già esistenti
    // (t_accessi_, t_binder_aperture_, aggiunte in sessione 2026-08-30) non
    // sono MAI comparse in questa pagina, così come i 4 TRAGUARDI_SINGOLI
    // (t_giorno_impeccabile, t_collezionista_completo, aggiunti in sessioni
    // precedenti, e t_maestro_cardsync/t_leggenda_cardsync di oggi): non
    // esisteva alcun blocco di rendering per loro, non solo mancavano dalla
    // lista. idTraguardiSbloccati sotto era già calcolato ma MAI usato in
    // questo render (codice morto, lasciato con lo stesso nome per non
    // introdurre confusione se in futuro serve davvero evidenziare i
    // "nuovi" — vedi nota su righeSingoli sotto).
    const idTraguardiSbloccati = new Set(nuoviTraguardi.map(t => t.id));
    const scale = [
        { prefisso: 't_carte_', titolo: 'Carte', metrica: 'carte_totali' },
        { prefisso: 't_valore_', titolo: 'Valore collezione', metrica: 'valore_collezione' },
        { prefisso: 't_location_', titolo: 'Location', metrica: 'location_distinte' },
        { prefisso: 't_wishlist_', titolo: 'Wishlist', metrica: 'wishlist_totale' },
        { prefisso: 't_doppioni_', titolo: 'Doppioni', metrica: 'doppioni_totali' },
        { prefisso: 't_missioni_', titolo: 'Missioni completate', metrica: 'missioni_completate_totale' },
        { prefisso: 't_accessi_', titolo: 'Accessi', metrica: 'accessi_totali' },
        { prefisso: 't_binder_aperture_', titolo: 'Binder aperti dal gruppo', metrica: 'binder_aperture_totale' },
        { prefisso: 't_match_', titolo: 'Match trovati', metrica: 'match_trovati_totale' },
        { prefisso: 't_binder_visitati_', titolo: 'Binder visitati', metrica: 'binder_visitati_distinti_totale' },
    ];
    const righeScale = scale.map((s, i) => {
        const voci = CATALOGO_TRAGUARDI.filter(t => t.id.startsWith(s.prefisso)).sort((a, b) => a.valore - b.valore);
        const valoreAttuale = dati[s.metrica] || 0;
        const prossima = voci.find(t => valoreAttuale < t.valore);
        if (!prossima) {
            return `<div class="pg-riga"><i class="fa-solid fa-trophy" style="color:var(--success);"></i><span style="flex:1;">${s.titolo}: tutti i traguardi sbloccati! 🎉</span></div>`;
        }
        const perc = Math.min(100, Math.round((valoreAttuale / prossima.valore) * 100));
        // Stessa struttura/classi già usate per le barre di avanzamento
        // della pagina Set (.pg-riga-set/.pg-barra-track/.pg-barra-fill,
        // vedi renderPaginaSet()) — coerenza visiva, zero CSS nuovo.
        // Espansione al tap (2026-08-31, stessa richiesta/stesso pattern
        // già fatto per le missioni): mostra descrizione + ricompensa del
        // PROSSIMO scalino non ancora raggiunto. Solo qui in questo
        // render, non tocca la pagina Set che riusa la stessa classe
        // .pg-riga-set senza onclick (verificato, nessun conflitto).
        const idBase = 'traguardoScalaDettaglio-' + i;
        return `
            <div>
                <div class="pg-riga-set" style="cursor:pointer;" onclick="_toggleDettaglioMissione('scala-${i}')">
                    <div class="pg-riga-set-testa"><b>${s.titolo}</b><span>prossimo: ${escapeHtml(prossima.titolo)} (${valoreAttuale}/${prossima.valore}) <i class="fa-solid fa-chevron-down" id="missioneDettaglio-scala-${i}-chevron" style="font-size:0.65rem; transition:transform 0.2s;"></i></span></div>
                    <div class="pg-barra-track"><div class="pg-barra-fill" style="width:${perc}%"></div></div>
                </div>
                <div id="missioneDettaglio-scala-${i}" style="display:none; padding:0.3rem 0.2rem 0.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                    <div>${escapeHtml(prossima.descrizione || prossima.titolo)}</div>
                    <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(prossima.ricompensa)}</div>
                </div>
            </div>`;
    }).join('');

    // Traguardi "singoli" (non in scala, soglia unica) — MAI renderizzati
    // prima in questa pagina (vedi nota sopra). Testo di stato diverso a
    // seconda del tipo di metrica: booleano ('==' → sbloccato/non ancora),
    // altrimenti valore/soglia (percentuale o conteggio). Sbloccato = la
    // metrica soddisfa GIA' la condizione ora, stessa semplificazione già
    // usata sopra per "tutti sbloccati" nelle scale (non interroga
    // traguardi_riscossi direttamente, ricalcola dal valore corrente —
    // coerente, non un'invenzione nuova).
    const _statoSingoloTesto = (t, dati) => {
        const valore = dati[t.metrica];
        if (t.operatore === '==') return valore ? 'Sbloccato' : 'Non ancora';
        const unita = t.metrica === 'percentuale_traguardi_sbloccati' ? '%' : '';
        return `${valore || 0}${unita} / ${t.valore}${unita}`;
    };
    const righeSingoli = TRAGUARDI_SINGOLI.map((t, i) => {
        const sbloccato = MOTORE_MISSIONI.valuta(t, dati);
        const idBase = 'singolo-' + i;
        return `
            <div>
                <div class="pg-riga-set" style="cursor:pointer;" onclick="_toggleDettaglioMissione('${idBase}')">
                    <div class="pg-riga-set-testa">
                        <b>${escapeHtml(t.titolo)}</b>
                        <span>${sbloccato ? '<i class="fa-solid fa-trophy" style="color:var(--success);"></i> ' : ''}${_statoSingoloTesto(t, dati)} <i class="fa-solid fa-chevron-down" id="missioneDettaglio-${idBase}-chevron" style="font-size:0.65rem; transition:transform 0.2s;"></i></span>
                    </div>
                </div>
                <div id="missioneDettaglio-${idBase}" style="display:none; padding:0.3rem 0.2rem 0.6rem; font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
                    <div>${escapeHtml(t.descrizione || t.titolo)}</div>
                    <div style="margin-top:0.25rem; color:var(--primary); font-weight:600;">${_testoRicompensa(t.ricompensa)}</div>
                </div>
            </div>`;
    }).join('');

    containerTraguardi.innerHTML = `<div class="pg-elenco">${righeScale}${righeSingoli}</div>`;
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
