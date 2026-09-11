// ═══════════════════════════════════════════════════════════════════════
// PAGINAINIZIALE-RENDER.UI.JS — render griglia home, gestione widget
// (mostra/nascondi/aggiungi), esecuzione azione widget — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP 6 (ULTIMO) del piano di taglio di ui/paginainiziale.ui.js
// (concordato con Claudio il 2026-09-11). Estratto da
// ui/paginainiziale.ui.js. NESSUNA riscrittura del codice esistente: solo
// spostamento, zero cambi di comportamento per l'utente finale. Con
// questo step il taglio del motore home è completo.
//
// Contiene: renderWidgetHome (il cuore visivo, disegna la griglia),
// _potaContenutoFuoriTessera, _eseguiAzioneWidget, _spostaWidget,
// _nascondiWidget, _apriPickerAggiungiWidget/_chiudiPickerAggiungiWidget,
// _mostraWidget, _aggiungiIstanzaWidget, _testForzaTaglia2x2 (bottone
// diagnostico usa-e-getta), toggleModificaWidgetHome.
//
// NOTA EREDITATA DAL COMMENTO ORIGINALE (SEZIONE 2, qui sotto invariato):
// _aggiungiIstanzaWidget richiama _apriRicercaCartaVetrina, che oggi vive
// in ui/widget-vetrina.ui.js (spostata lì allo STEP 20 del primo giro di
// ristrutturazione) — accoppiamento cross-file già esistente, non
// introdotto da questo secondo giro di taglio.
//
// Dipende da: CATALOGO_WIDGET, _layoutWidget, _salvaLayoutWidget,
// _tagliaDiNascita/_correggiTagliaZonaIcona (kernel), _tagliaEffettiva/
// _distribuisciWidgetInPagine/_aggiornaPuntiniPagine (paginazione),
// _attivaDragEResize (drag-resize), _ballCORPI/_ballPill ecc.
// (widget-render-condiviso.ui.js), e le funzioni preview() di ogni singolo
// widget dal loro file widget-<nome>.ui.js. Nessuna istruzione qui gira a
// tempo di caricamento script — l'ordine rispetto agli altri file
// paginainiziale-*.ui.js è indifferente (vedi nota identica negli STEP
// precedenti).
// ───────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 2 — Render griglia, gestione widget (mostra/nascondi/aggiungi),
// esecuzione azione widget (originariamente righe 3095-3564 di
// phone.ui.js). NOTA: subito dopo questa sezione, in phone.ui.js originale
// c'era il blocco "RICERCA CARTE per Vetrina" (_apriRicercaCartaVetrina e
// affini) — resta apposta in ui/phone.ui.js, NON qui: è logica specifica
// del widget Vetrina, non del motore home. Verrà spostata in
// widget-vetrina.ui.js allo STEP 20. _aggiungiIstanzaWidget qui sotto la
// richiama comunque (per i widget multiIstanza, oggi solo Vetrina) — è un
// accoppiamento già esistente nel codice originale, non introdotto ora:
// funziona perché tutti gli script condividono lo stesso scope globale e
// phone.ui.js è comunque caricato prima che l'utente possa cliccare.
// ───────────────────────────────────────────────────────────────────────

// ── RENDER GRIGLIA HOME ──────────────────────────────────────────────────
async function renderWidgetHome() {
    if (!_layoutWidget) await _caricaLayoutWidget();

    const cont = document.getElementById('phoneWidgetPagine');
    if (!cont) return;

    // Richiude i buchi fra pagine PRIMA di qualunque altro calcolo (vedi
    // _compattaPagineWidget) — deve girare prima che _misuraPaginaWidget/
    // _distribuisciWidgetInPagine ragionino su quali pagine esistono.
    if (_compattaPagineWidget()) _salvaLayoutWidget(false); // correzione automatica, non un'azione utente

    const visibili = _layoutWidget.filter(w => w.visibile);
    const primoRender = !_primoRenderWidgetFatto;

    // Misurata QUI, prima di costruire le tessere, cosi' la stessa misura
    // serve sia per clampare la taglia di ogni singola tessera (vedi
    // _tagliaEffettiva) sia per l'impaginazione piu' sotto — un'unica
    // fonte di verita' per "quanto spazio c'e' davvero in questo render",
    // invece di due misurazioni separate che potrebbero disallinearsi.
    const misura = _misuraPaginaWidget();

    // Raccolta locale, riversata in _ballAttenzioni a fine render: le
    // tessere si costruiscono in parallelo con Promise.all, scrivere
    // direttamente sulla globale lascerebbe residui dei widget rimossi.
    const attenzioni = {};

    const tessere = await Promise.all(visibili.map(async (w, indice) => {
        const def = CATALOGO_WIDGET[w.id];
        if (!def) return '';
        let anteprima = { righe: ['—'] };
        if (!def.bloccato) {
            try { anteprima = await def.preview(w); } catch (e) { console.error('Errore preview widget ' + w.id + ':', e); }
        } else {
            anteprima = def.preview(w);
        }

        const classeStato = anteprima.stato === 'allerta' ? 'widget-tile-allerta' : (anteprima.stato === 'ok' ? 'widget-tile-ok' : '');
        const classeCascata = primoRender ? 'widget-tile-entrata' : '';
        const stileRitardo = primoRender ? `style="animation-delay:${Math.min(indice * 45, 400)}ms"` : '';

        // CONTROLLI DI MODIFICA — ridisegnati (Claudio, 2026-09-10): prima
        // 5 bottoni fissi da 22px (su/giù/pagina prec/pagina succ/rimuovi)
        // non ci stavano in una tessera piccola (lo standard 2x2 li rende
        // comuni) e si accavallavano fra tessere vicine — vedi screenshot.
        // Il trascinamento (vedi _onWidgetPointerDown) è già il modo
        // primario e "semplice" per riordinare — su/giù/pagina prec/succ
        // restano disponibili come PIANO B dentro un menu a comparsa (⋮),
        // per chi preferisce non trascinare. Sulla tessera restano SEMPRE
        // visibili solo 2 elementi (⋮ e X), che ci stanno anche su una
        // 2x2, più la maniglia di resize.
        const menuSpostaAperto = _menuSpostaWidgetApertoId === w.instanceId;
        const controlliEdit = _editModeWidget ? `
            <div class="widget-edit-controls" onclick="event.stopPropagation()">
                <button type="button" onclick="_toggleMenuSpostaWidget('${w.instanceId}', event)" title="Sposta"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <button type="button" onclick="_nascondiWidget('${w.instanceId}')" title="Rimuovi dalla home" class="widget-edit-remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-menu-sposta${menuSpostaAperto ? ' aperto' : ''}" id="menuSposta_${w.instanceId}" onclick="event.stopPropagation()">
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', -1)"><i class="fa-solid fa-arrow-up"></i> Sposta su</button>
                <button type="button" onclick="_spostaWidgetNellaPagina('${w.instanceId}', 1)"><i class="fa-solid fa-arrow-down"></i> Sposta giù</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', -1)" ${(w.pagina || 0) === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Pagina precedente</button>
                <button type="button" onclick="_spostaWidgetInPagina('${w.instanceId}', 1)"><i class="fa-solid fa-chevron-right"></i> Pagina successiva</button>
            </div>
            <div class="widget-resize-handle" data-widget-id="${w.instanceId}" title="Trascina per ridimensionare"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>` : '';

        // Badge Pokédex sul primo numero trovato in "righe".
        // CORREZIONE 27/08/2026: la regex era /\d+/ e su "1.284 carte
        // totali" si fermava al punto, mostrando "1" invece di "1.284" —
        // succedeva su qualunque conteggio a quattro cifre. Ora tiene
        // separatori di migliaia e decimali.
        // Il badge è anche disattivabile da Impostazioni: su una tessera
        // 1x1 ripete il dato già inciso nella pancia della ball.
        // 'badge' esplicito (oggi solo 'suggerimento': conta i segnali
        // attivi, non un numero già dentro il testo) ha la precedenza;
        // altrimenti resta il comportamento di sempre per tutti gli altri.
        const primoNumero = (anteprima.righe[0] || '').match(/\d[\d.,]*/);
        // 'badge: false' = questo widget NON ha un numerino, non estrarlo.
        // Serve agli elenchi con le date (Ultime aggiunte, Prezzi
        // aggiornati): il numero pescato da righe[0] era il GIORNO della
        // prima voce, mostrato come se fosse un conteggio di notifiche —
        // "23" per una carta aggiunta il 23/08. Difetto visto in uno
        // screenshot di Claudio il 2026-09-03.
        // null e undefined restano "estrai in automatico", come sempre:
        // nessun widget esistente cambia comportamento.
        const valoreBadge = anteprima.badge === false ? null
            : (anteprima.badge != null ? anteprima.badge : (primoNumero ? primoNumero[0] : null));
        const badge = (valoreBadge != null && prefBadgeWidgetGet()) ? `<div class="widget-badge">${valoreBadge}</div>` : '';

        // Bordo colorato per rarità SOLO se la carta ha davvero un campo
        // 'rarita' valorizzato (mai confermato nello schema in questa
        // sessione — nessun rischio: se il campo non esiste, la classe
        // semplicemente non si applica e resta il bordo neutro di sempre).
        const classeRarita = anteprima.rarita ? ` widget-tile-thumb-r-${String(anteprima.rarita).toLowerCase().replace(/\s+/g, '_')}` : '';
        const rigaImmagine = anteprima.immagine
            ? `<div class="widget-tile-thumb-row"><img class="widget-tile-thumb${classeRarita}" src="${_urlImmagineVisualizzabile(anteprima.immagine, 96) || ''}" alt="" onerror="this.style.display='none';"></div>`
            : '';

        const azioneClick = _editModeWidget || def.decorativo ? '' : `onclick="_eseguiAzioneWidget('${w.instanceId}', event)"`;

        // ── VISUALE DELLA TESSERA ───────────────────────────────────────
        // Con BALL_ATTIVA la vecchia icona FontAwesome lascia il posto alla
        // sfera. Il ramo else qui sotto è il markup ORIGINALE, intatto:
        // rimettere BALL_ATTIVA a false in cima al file riporta tutto com'era.
        // I widget con immagine (Ultima carta, Carta del giorno) restano
        // senza ball e mostrano la carta, per scelta di Claudio.
        // Taglia e modalita' icona: DEVONO stare prima della visuale.
        // BUG 2026-09-03 (segnalato da Claudio con screenshot): erano
        // calcolate piu' sotto, quindi la sfera veniva costruita anche a
        // taglia minima — 90px dentro una cella da ~50px, con le sfere che
        // si sovrapponevano l'una sull'altra e l'incisione del titolo
        // ancora leggibile. Ora la modalita' icona esclude la sfera in
        // partenza.
        const _t = _tagliaEffettiva(w, misura);
        const _iconaStatica = w.mini || _t.col < CELLE_MIN_PER_SFERA || _t.row < 2;

        let visuale;
        if (BALL_ATTIVA && !anteprima.immagine && _iconaStatica) {
            // SFERA FERMA (Claudio: "devono essere comunque piccole
            // pokeball, senza movimento e senza nome, non icone a caso").
            // Stessa sfera delle taglie grandi, ridotta al lato della
            // cella, ma SPOGLIATA di tutto cio' che si muove o occupa
            // spazio: niente alone, polvere, ombra, punti esclamativi del
            // semaforo, vetro con riflesso che scorre, anelli, particelle.
            // Niente incisione: a questa misura il testo sarebbe illeggibile
            // ed e' proprio quello che si vedeva nello screenshot.
            // Restano il corpo della sfera e il badge numerico.
            const aspettoMini = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            visuale = `
                <div class="pkdx-icon-wrap pkdx-ball-statica"><div class="pkdx-ball">
                    <div class="pkdx-ball-body">${_ballSvgCache(aspettoMini.emblema, aspettoMini.colore, null)}</div>
                </div></div>`;
        } else if (BALL_ATTIVA && !anteprima.immagine) {
            const aspetto = _ballASPETTO[w.id] || { emblema: 'piu', colore: null };
            // L'incisione compare solo sulle 1x1: sulle altre taglie il
            // titolo per esteso sta fuori dalla ball, dove c'è spazio.
            let inciso = null;
            // Incisione solo sulla forma piccola (ex 1x1). Con le taglie
            // libere, confrontare w.size con la stringa '1x1' era diventato
            // sbagliato: '1x1' ora e' l'ICONA, dove non c'e' nemmeno la
            // sfera su cui incidere.
            if (_t.col <= 4 && _t.row <= 2 && prefScritteBallGet()) {
                const chiedeAttenzione = !!_ballChiedeAttenzione(w.id, anteprima);
                inciso = chiedeAttenzione
                    ? _ballAccorcia(anteprima.righe[0])
                    : (_ballTITOLI_BREVI[w.id] || def.titolo);
            }
            visuale = `
                <div class="pkdx-icon-wrap"><div class="pkdx-ball">
                    <span class="pkdx-ball-glow"></span>
                    <span class="pkdx-dust"></span>
                    <span class="ball-shadow"></span>
                    <span class="pkdx-avviso"><i class="a1">!</i><i class="a2">!</i><i class="a3">!</i></span>
                    <div class="pkdx-ball-body">${_ballSvgCache(aspetto.emblema, aspetto.colore, inciso)}</div>
                    <div class="ball-glass"><div class="ball-sweep"></div></div>
                    <span class="pkdx-lock-ring"></span>
                    <span class="pkdx-lock-ring ring-2"></span>
                    ${_ballParticelle()}
                </div></div>`;
        } else {
            visuale = `<i class="fa-solid ${def.icona} widget-tile-icon"></i>`;
        }

        // Chi ha bisogno di attenzione: letto qui, usato dal semaforo senza
        // rifare nessuna query (i preview sono già stati calcolati sopra).
        attenzioni[w.instanceId] = _ballChiedeAttenzione(w.id, anteprima);

        // ── CORPO DELLA TESSERA ─────────────────────────────────────────
        // 1x1 e mini: solo la sfera, col titolo inciso nella pancia.
        // Taglie grandi: due slot, uno accanto alla sfera e uno sotto (il
        // secondo solo dove c'è altezza, cioè 1x2 e 2x2 — vedi il CSS).
        // Con BALL_ATTIVA a false si torna al corpo originale del sito.
        // Sotto CELLE_MIN_PER_SFERA la tessera e' un'icona statica: niente
        // sfera, niente corpo ricco. Sopra, tutto come prima.
        const grande = BALL_ATTIVA && !_iconaStatica && !(_t.col === 3 && _t.row === 2);
        let corpo;
        if (grande) {
            const c = _ballCorpoWidget(w.id, anteprima);
            corpo = `
                <div class="ball-testa">
                    ${visuale}
                    <div class="ball-slot-inline">
                        <div class="widget-tile-titolo">${def.titolo}</div>
                        ${c.inline}
                    </div>
                </div>
                ${c.blocco ? `<div class="ball-slot-blocco">${c.blocco}</div>` : ''}
                ${rigaImmagine}`;
        } else {
            corpo = `
                ${visuale}
                <div class="widget-tile-titolo">${def.titolo}</div>
                ${rigaImmagine}
                <div class="widget-tile-righe">${anteprima.righe.map(r => `<span>${r}</span>`).join('')}</div>`;
        }

        return `
            <div class="widget-tile ${classeStato} ${classeCascata} widget-size-${w.size} widget-col-${_t.col} widget-row-${_t.row} ${_formaWidget(_t.col, _t.row)} ${_iconaStatica ? 'widget-tile-mini' : ''}" ${stileRitardo} data-widget-id="${w.instanceId}" data-widget-index="${indice}" ${azioneClick}>
                ${controlliEdit}
                ${badge}
                <div class="tile-tinta"></div><div class="tile-alone"></div>
                ${corpo}
            </div>`;
    }));

    let tileAggiungi = '';
    if (_editModeWidget && visibili.length < MAX_WIDGET_VISIBILI) {
        tileAggiungi = `
            <div class="widget-tile widget-tile-aggiungi widget-col-3 widget-row-2 wf-piccolo" onclick="_apriPickerAggiungiWidget()">
                <i class="fa-solid fa-plus widget-tile-icon"></i>
                <div class="widget-tile-titolo">Aggiungi</div>
            </div>`;
    }

    // ── COMPOSIZIONE DELLE PAGINE ───────────────────────────────────────
    // Le tessere sono gia' state costruite tutte insieme (con Promise.all,
    // che va lasciato in un blocco solo: spezzarlo per pagina moltiplica
    // le query). Qui si distribuiscono soltanto.
    // Impaginazione vera: chi non ci sta trabocca sulla pagina dopo.
    // 'misura' e' la stessa calcolata a inizio funzione (vedi sopra), non
    // ricalcolata qui: stessa fonte di verita' usata per clampare le
    // singole tessere.
    const distribuzione = _distribuisciWidgetInPagine(visibili, misura);
    _paginePresenti = distribuzione.length;

    const nPagine = _numeroPagineWidget();
    // Uscendo dalla modifica la pagina vuota di cortesia sparisce: se
    // l'utente era proprio li', va riportato sull'ultima pagina vera,
    // altrimenti resterebbe su uno scorrimento che non esiste piu' e i
    // puntini indicherebbero una pagina sbagliata.
    if (_paginaWidgetCorrente > nPagine - 1) _paginaWidgetCorrente = nPagine - 1;
    const classiGriglia = 'widget-griglia'
        + (BALL_ATTIVA ? ' ball-ui' : '')
        + (_editModeWidget ? ' in-modifica-widget' : '');
    const paginaHtml = [];
    for (let p = 0; p < nPagine; p++) {
        // La pagina di destinazione arriva dalla distribuzione, non piu'
        // dal campo 'pagina' letto direttamente: fra i due c'e' di mezzo il
        // traboccamento.
        const suQuestaPagina = distribuzione[p] || [];
        const dentro = suQuestaPagina
            .map(w => tessere[visibili.indexOf(w)])
            .join('');
        // Il tassello "Aggiungi" sta sull'ultima pagina REALE, non su
        // quella vuota di cortesia che compare solo in modifica.
        const ultimaReale = p === nPagine - 1 - (_editModeWidget ? 1 : 0);
        const vuota = !dentro && !(ultimaReale && tileAggiungi);
        paginaHtml.push(`
            <div class="widget-pagina" data-pagina="${p}">
                <div class="${classiGriglia}">${dentro}${ultimaReale ? tileAggiungi : ''}</div>
                ${vuota && _editModeWidget ? '<div class="widget-pagina-vuota">Pagina vuota<br><small>spingi qui un widget con la freccia \u203a</small></div>' : ''}
            </div>`);
    }

    // NAVIGAZIONE FRA PAGINE PIU' CHIARA (Claudio, 2026-09-10: "non è
    // chiaro come si fa"): prima erano solo puntini da 7px a bassissimo
    // contrasto (30% di opacità), l'unico modo per capire che si poteva
    // cambiare pagina era scoprirlo per caso scorrendo. Ora: puntini dentro
    // una pillola visibile (si riconosce come controllo, non come
    // decorazione) + due frecce ai lati per chi preferisce toccare invece
    // di scorrere (utile anche su desktop, dove lo swipe orizzontale non è
    // sempre comodo col mouse). Le frecce restano disabilitate a inizio/
    // fine, stesso linguaggio già usato per "pagina precedente" nel menu
    // sposta.
    const puntini = nPagine > 1
        ? `<div id="phoneWidgetPuntini">
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(-1)" ${_paginaWidgetCorrente === 0 ? 'disabled' : ''} aria-label="Pagina precedente"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="widget-puntini-pillola">${Array.from({ length: nPagine }, (_, i) =>
                `<button type="button" class="widget-puntino${i === _paginaWidgetCorrente ? ' attivo' : ''}" onclick="_vaiAllaPaginaWidget(${i})" aria-label="Pagina ${i + 1}"></button>`).join('')}</div>
            <button type="button" class="widget-pagina-freccia" onclick="_vaiAllaPaginaWidgetRelativa(1)" ${_paginaWidgetCorrente === nPagine - 1 ? 'disabled' : ''} aria-label="Pagina successiva"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`
        : '';

    // Il ridimensionamento ridisegna a ogni movimento del dito: senza
    // questa riga lo scorrimento orizzontale tornerebbe a zero e la pagina
    // "scapperebbe" alla prima sotto le dita.
    const scrollPrima = Math.min(cont.scrollLeft, _paginaWidgetCorrente * cont.clientWidth);
    cont.innerHTML = paginaHtml.join('');
    const vecchiPuntini = document.getElementById('phoneWidgetPuntini');
    if (vecchiPuntini) vecchiPuntini.remove();
    if (puntini) cont.insertAdjacentHTML('afterend', puntini);
    cont.scrollLeft = scrollPrima;

    _primoRenderWidgetFatto = true;
    _ballAttenzioni = attenzioni;
    _potaContenutoFuoriTessera();

    // Al primo render, dopo la cascata d'ingresso, un giro di semaforo
    // così chi ha qualcosa da fare si fa notare subito invece di aspettare
    // i 5,2 secondi del ciclo.
    if (primoRender && BALL_ATTIVA) setTimeout(_ballGiraSemaforo, 900);

    if (_editModeWidget) _attivaDragEResize();
}

// ── NIENTE RIGHE TAGLIATE A META' (Claudio, 2026-09-03) ─────────────────
// La tessera ha altezza fissa e taglia cio' che esce. Con un elenco, il
// taglio cadeva a meta' di una riga: si leggeva mezza scritta e mezza data,
// che sembra un difetto di resa piu' che un limite di spazio.
// Qui, a disegno finito, si nasconde ogni blocco che NON ci sta per intero.
// Il risultato e' un elenco che finisce dove finisce la tessera, come le
// liste dei widget di un telefono vero.
//
// PERCHE' DOPO IL DISEGNO E NON PRIMA: quante righe ci stiano dipende dal
// font, dalla densita' scelta, dalla lingua e dalla larghezza della
// tessera. Calcolarlo in anticipo vorrebbe dire indovinare l'altezza di un
// testo non ancora impaginato; misurarlo dopo e' esatto.
//
// COSTO: una lettura di geometria su poche decine di elementi. Gira anche
// durante il ridimensionamento (che ridisegna a ogni movimento del dito),
// quindi resta volutamente minimale: nessuna scrittura di stile se non
// serve, e nessun ciclo annidato.
function _potaContenutoFuoriTessera() {
    document.querySelectorAll('.widget-tile .ball-slot-blocco').forEach(blocco => {
        const tessera = blocco.closest('.widget-tile');
        if (!tessera) return;
        const stile = getComputedStyle(tessera);
        const fondo = tessera.getBoundingClientRect().bottom - (parseFloat(stile.paddingBottom) || 0);

        // I candidati sono i blocchi "atomici": una riga di elenco, una
        // colonna di categoria con le sue carte, un grafico. Mai le
        // singole carte dentro una fila — nascondere la terza carta di
        // tre lascerebbe una categoria monca, che e' peggio del taglio.
        // .ball-quota aggiunta il 2026-09-06 per il widget 'contributi':
        // barra + didascalia della percentuale, che vanno nascoste
        // INSIEME. Nessun altro widget usa questa classe, quindi la
        // riga non cambia il comportamento di nulla di esistente.
        blocco.querySelectorAll(':scope > .ball-riga, :scope > .ball-gruppi > .ball-gruppo, :scope > .ball-spark, :scope > .ball-strip, :scope > .ball-quota').forEach(pezzo => {
            // Sempre ripristinato prima di misurare: la tessera puo' essere
            // stata ingrandita dall'ultimo giro e cio' che prima non ci
            // stava ora ci sta.
            pezzo.style.display = '';
            if (pezzo.getBoundingClientRect().bottom > fondo + 1) pezzo.style.display = 'none';
        });
    });
}

// Esegue l'azione del widget: 'azione' personalizzata nel catalogo se
// presente (riceve gli stessi dati calcolati da preview, per widget come
// carta del giorno/ultima carta che devono sapere QUALE carta aprire),
// altrimenti apre come dettaglio la tab indicata in 'tab' o l'id stesso.
async function _eseguiAzioneWidget(instanceId, evt) {
    const w = _layoutWidget.find(x => x.instanceId === instanceId);
    const def = w && CATALOGO_WIDGET[w.id];
    if (!def || def.bloccato) return;

    // Missioni/Traguardi Fase 2 — apertura sezioni/widget (2026-08-30).
    // Fire-and-forget, stesso pattern di missioniAccessoRegistraOggi in
    // ui/auth.ui.js: un fallimento qui non deve mai bloccare l'apertura
    // del widget. Nessun dedup: ogni apertura conta (stesso approccio di
    // missioniRicercaRegistra). Loggato per TUTTI i widget, anche quelli
    // senza ancora una missione agganciata — le prossime missioni di
    // questa categoria non richiederanno un nuovo punto di scrittura, solo
    // una nuova lettura in ui/missioni.ui.js:raccogliDati().
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniAperturaWidgetRegistra(userId, w.id);
        } catch (e) { console.error('[missioni] registrazione apertura widget:', e); }
    })();

    // Animazione di cattura PRIMA di aprire. Mai in modalità modifica: lì
    // il tocco lungo apre il peek e il trascinamento riordina, e 2,6s di
    // animazione a ogni tentativo di spostare un widget renderebbero il
    // riordino inusabile. (_eseguiAzioneWidget non viene nemmeno agganciata
    // in edit mode — vedi azioneClick nel render — ma il controllo resta
    // come rete se un giorno la si chiamasse da altrove.)
    // L'evento serve dopo per il punto d'origine dell'apertura: va
    // conservato ORA, perché dopo l'await l'oggetto evento è esaurito.
    const punto = evt ? { clientX: evt.clientX, clientY: evt.clientY, currentTarget: evt.currentTarget } : null;
    if (BALL_ATTIVA && !_editModeWidget && evt && evt.currentTarget) {
        try { await _ballGiocaCattura(evt.currentTarget); } catch (_) { /* l'animazione non deve mai bloccare l'apertura */ }
    }

    if (def.azione) {
        let dati = null;
        try { dati = await def.preview(w); } catch (_) { dati = null; }
        def.azione(dati, punto, w);
        return;
    }
    apriDettaglioWidget(def.tab || w.id, punto);
}

// SUPERATA dalle pagine multiple (2026-09-03) e senza piu' chiamanti: con
// le pagine, muovere per indice sull'elenco visibile faceva saltare un
// widget da una pagina all'altra come effetto collaterale invisibile. Le
// frecce su/giu' usano ora _spostaWidgetNellaPagina(instanceId, dir), che
// resta dentro la pagina. Lasciata qui perche' innocua e perche' un
// eventuale onclick residuo in una schermata non ancora aggiornata
// continuerebbe a funzionare invece di lanciare un errore.
function _spostaWidget(indiceVisibile, direzione) {
    const visibili = _layoutWidget.filter(w => w.visibile);
    const target = visibili[indiceVisibile];
    const idxReale = _layoutWidget.indexOf(target);
    const idxScambio = _layoutWidget.indexOf(visibili[indiceVisibile + direzione]);
    if (idxScambio === undefined || idxScambio < 0) return;
    [_layoutWidget[idxReale], _layoutWidget[idxScambio]] = [_layoutWidget[idxScambio], _layoutWidget[idxReale]];
    _salvaLayoutWidget();
    renderWidgetHome();
}

function _nascondiWidget(instanceId) {
    const idx = _layoutWidget.findIndex(x => x.instanceId === instanceId);
    if (idx < 0) return;
    const w = _layoutWidget[idx];
    const def = CATALOGO_WIDGET[w.id];
    if (def && def.multiIstanza) {
        _layoutWidget.splice(idx, 1); // istanza effimera: via del tutto, non solo nascosta
    } else {
        w.visibile = false;
    }
    _salvaLayoutWidget();
    renderWidgetHome();
}

// Picker "Aggiungi": due tipi di voci ora. I widget multiIstanza (Vetrina)
// compaiono SEMPRE, anche se ne hai già una copia — cliccare ne crea una
// nuova. I widget normali compaiono solo se attualmente nascosti, come
// prima (_mostraWidget li riattiva, riga unica già esistente).
function _apriPickerAggiungiWidget() {
    const nascosti = _layoutWidget.filter(w => !w.visibile && !(CATALOGO_WIDGET[w.id] && CATALOGO_WIDGET[w.id].multiIstanza));
    const multi = Object.entries(CATALOGO_WIDGET).filter(([, def]) => def.multiIstanza);

    const container = document.getElementById('widgetPickerLista');
    const vociMulti = multi.map(([id, def]) => `
        <div class="widget-picker-riga" onclick="_aggiungiIstanzaWidget('${id}')">
            <i class="fa-solid ${def.icona}"></i> Aggiungi ${def.titolo}
        </div>`);
    const vociSingole = nascosti.map(w => `
        <div class="widget-picker-riga" onclick="_mostraWidget('${w.id}')">
            <i class="fa-solid ${CATALOGO_WIDGET[w.id].icona}"></i> ${CATALOGO_WIDGET[w.id].titolo}
        </div>`);
    const tutte = [...vociMulti, ...vociSingole].join('');
    container.innerHTML = tutte || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Nessun altro widget disponibile.</p>';
    document.getElementById('widgetPickerModal').style.display = 'flex';
}

function _chiudiPickerAggiungiWidget() {
    document.getElementById('widgetPickerModal').style.display = 'none';
}

function _mostraWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    const w = _layoutWidget.find(x => x.id === id);
    if (w) {
        w.visibile = true;
        w.pagina = _paginaWidgetCorrente; // compare dove stai guardando, non sulla prima pagina
        // Se non e' mai stato ridimensionato a mano (e' ancora alla taglia
        // di ripiego), nasce alla taglia giusta per il suo contenuto.
        if (w.size === '3x2') w.size = _tagliaDiNascita(id);
    }
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
}

// Crea una nuova copia di un widget multiIstanza (oggi solo Vetrina) e
// apre subito la ricerca carte per scegliere cosa mostrarci — niente
// copia vuota abbandonata in giro senza che l'utente sappia cosa farci.
function _aggiungiIstanzaWidget(id) {
    const visibiliCount = _layoutWidget.filter(w => w.visibile).length;
    if (visibiliCount >= MAX_WIDGET_VISIBILI) { alert(`Massimo ${MAX_WIDGET_VISIBILI} widget in home.`); return; }
    // Nasce sulla pagina che stai guardando, non sempre sulla prima.
    const nuovo = { id, instanceId: _nuovoInstanceId(), visibile: true, size: _tagliaDiNascita(id), mini: false, cartaId: null, pagina: _paginaWidgetCorrente, v: VERSIONE_LAYOUT_WIDGET };
    _layoutWidget.push(nuovo);
    _salvaLayoutWidget();
    _chiudiPickerAggiungiWidget();
    renderWidgetHome();
    _apriRicercaCartaVetrina(nuovo.instanceId);
}

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 3 — Bottone diagnostico "2x2" (originariamente righe 3644-3657
// di phone.ui.js). Usa-e-getta secondo Claudio, vedi compilati precedenti.
// ───────────────────────────────────────────────────────────────────────

// STRUMENTO DIAGNOSTICO (Claudio, 2026-09-10) — forza il PRIMO widget
// visibile a '2x2' cosi' si vede dal vivo quanto rende grande lo standard
// minimo di zona icona, senza doverci arrivare trascinando a mano.
// Usa-e-getta: modifica per davvero il widget (non e' un'anteprima finta),
// quindi resta lì finché non lo ridimensioni di nuovo — è lo scopo,
// vederlo esattamente come sarebbe per un utente vero.
function _testForzaTaglia2x2() {
    const w = (_layoutWidget || []).find(x => x.visibile);
    if (!w) return;
    w.size = '2x2';
    w.mini = false;
    _salvaLayoutWidget(false); // diagnostico, non conta come personalizzazione vera per le missioni
    renderWidgetHome();
}

// ───────────────────────────────────────────────────────────────────────
// SEZIONE 4 — Modifica/drag/resize, peek, apertura/chiusura dettaglio
// widget (originariamente righe 3659-4194 di phone.ui.js).
// ───────────────────────────────────────────────────────────────────────

function toggleModificaWidgetHome() {
    _editModeWidget = !_editModeWidget;
    const btn = document.getElementById('btnModificaWidgetHome');
    if (btn) {
        btn.classList.toggle('attivo', _editModeWidget);
        // Testo esplicito ("Fatto" mentre sei dentro, non solo un colore
        // diverso) — Claudio voleva un bottone che si capisce al volo,
        // stessa logica del perché e' stato spostato fuori dalla barra
        // affollata.
        const label = btn.querySelector('span');
        if (label) label.textContent = _editModeWidget ? 'Fatto' : 'Modifica';
    }
    renderWidgetHome();
}

