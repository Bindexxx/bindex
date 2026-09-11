// ═══════════════════════════════════════════════════════════════════════
// WIDGET-SET.UI.JS — libreria set + tessera/pagina "Set" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 18 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// Contiene la "LIBRERIA DEI SET" (_ballLIBRERIA_MANUALE, _ballLIBRERIA_SET,
// _ballCaricaLibreriaDaDb, _ballSetBase, _ballALIAS_TESTA,
// _ballSetBaseConAlias, _ballLeggiCodice) — nonostante il prefisso "_ball"
// (solo convenzione anti-collisione nomi globali, vedi nota già lasciata
// in ui/widget-render-condiviso.ui.js allo STEP 1), è dato/logica
// specifica del widget Set: verificato allora che nessun altro punto del
// sito la usa, confermato di nuovo qui.
//
// CATEGORIA A: pagina propria di sola consultazione (nessun click sulle
// righe, nessuna ricerca — scelta di Claudio), ordinamento fisso per
// percentuale.
//
// DIPENDENZA DA data/sets.library.js: CARDSYNC_SET_LIBRARY, letta da
// _ballLIBRERIA_SET al caricamento — quel file va PRIMA di questo in
// index.html (aggiornato il commento lì). Se manca, si ricade sulle poche
// voci scritte a mano (_ballLIBRERIA_MANUALE).
//
// DIPENDENZA INVERSA GIÀ ESISTENTE (stabilita allo STEP 0): initPhoneShell()
// (ui/paginainiziale.ui.js, caricato PRIMA di questo file) chiama
// _ballCaricaLibreriaDaDb() qui sotto — funziona perché initPhoneShell()
// viene invocata solo a fine caricamento pagina (script inline in fondo a
// index.html), quando tutti gli script, compreso questo, sono già
// disponibili in scope globale condiviso.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaSet() per tabId === 'set' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.set_completamento / _ballASPETTO.set_completamento /
//   _ballTITOLI_BREVI.set_completamento (ui/widget-render-condiviso.ui.js)
//   — motore visivo, non toccato. Verificato: legge d.voci/d.riconosciute
//   dal 'dati' restituito dal preview() qui sotto — forma confermata
//   coerente.
// - escapeHtml, setEspansioniLeggiTutte, renderWidgetHome
//   (ui/paginainiziale.ui.js): esterne/cross-file, non toccate.
// ───────────────────────────────────────────────────────────────────────

// ── LIBRERIA DEI SET ─────────────────────────────────────────────────────
// Il codice carta è nella forma "SIGLA NUMERO" — es. "ASC 123" = carta 123
// di Ascesa Eroica. La sigla identifica l'espansione; il numero da solo non
// dice quante carte la compongono.
//
// PERCHÉ SERVE QUESTA TABELLA (Claudio): il denominatore che si vede sulle
// carte ("123/167") è il conteggio STAMPATO, non il totale reale — oltre
// quel numero ci sono le secret rare. Calcolare l'avanzamento su 167
// significherebbe mostrare "104%" a chi possiede anche le secret.
// Servono quindi due numeri per ogni set: quante carte nel set base e
// quante in tutto.
//
// STATO: vuota di proposito. Riempirla con dati inventati sarebbe peggio
// che non averla — vedi le domande poste a Claudio a fine sessione su dove
// farla vivere (tabella Supabase o file statico) e da dove prendere i
// totali. Finché è vuota, il widget Set mostra quante carte hai per
// espansione SENZA percentuali: un dato vero e utile, invece di una
// percentuale su un totale sbagliato.
//
// Forma di ogni voce:
//   SIGLA: { nome: 'Nome esteso', base: 167, totale: 190 }
//     base   = carte del set principale (il denominatore stampato)
//     totale = base + secret rare e aggiunte
// La libreria vera vive in data/sets.library.js, generato da
// genera-libreria-set.html e caricato PRIMA di questo file in index.html.
// Qui restano solo le voci scritte a mano: servono da rete di sicurezza se
// quel file manca (non ancora generato, oppure caricamento fallito).
const _ballLIBRERIA_MANUALE = {
    // ASC — Ascesa Eroica (Ascended Heroes), 30/01/2026. Numeri verificati
    // su fonti pubbliche concordi: 217 carte nel set principale, 78 secret
    // rare, 295 in totale. È il caso esatto per cui questa libreria esiste:
    // una carta "ASC 123/217" appartiene a un set che ne ha 295, quindi
    // calcolare l'avanzamento sul 217 stampato darebbe oltre il 100% a chi
    // le possiede tutte.
    ASC: { nome: 'Ascesa Eroica', base: 217, totale: 295 }
};

// Le voci generate hanno la precedenza su quelle manuali: se un domani il
// file automatico correggerà un numero scritto a mano, vince il dato
// aggiornato dalla fonte. Le voci lette dalla tabella Supabase, quando
// arrivano, hanno la precedenza su entrambe (vedi _ballCaricaLibreriaDaDb).
let _ballLIBRERIA_SET = Object.assign(
    {},
    _ballLIBRERIA_MANUALE,
    (typeof CARDSYNC_SET_LIBRARY !== 'undefined' && CARDSYNC_SET_LIBRARY) ? CARDSYNC_SET_LIBRARY : {}
);

// Sovrascrive la libreria con la tabella 'set_espansioni' (migration 28),
// che è la fonte aggiornabile senza toccare il repository del sito.
// Se la tabella non c'è ancora, non risponde o è vuota, NON si tocca
// niente: resta la libreria dal file statico. Una libreria un po' più
// vecchia è sempre meglio di nessuna libreria.
async function _ballCaricaLibreriaDaDb() {
    if (typeof setEspansioniLeggiTutte !== 'function') return;
    try {
        const righe = await setEspansioniLeggiTutte();
        if (!righe || !righe.length) return;

        const daDb = {};
        righe.forEach(r => {
            if (!r.sigla || !r.carte_totali) return;
            daDb[String(r.sigla).toUpperCase()] = {
                nome: r.nome || r.sigla,
                base: r.carte_base ?? null,
                totale: r.carte_totali
            };
        });
        _ballLIBRERIA_SET = Object.assign({}, _ballLIBRERIA_SET, daDb);
        renderWidgetHome();
    } catch (e) {
        console.error('Libreria set da DB:', e);
    }
}


// Ricava sigla e numero dal codice carta.
//
// REGOLA (tarata sui 1143 codici reali della collezione, non su ipotesi):
// l'ULTIMA sequenza numerica è il numero della carta; tutto ciò che la
// precede identifica il set, sottoinsiemi compresi. Copre il 97% delle
// carte (98 sigle su 100), contro l'80% di una regex "sigla + numero".
//
// Esempi reali risolti da questa regola:
//   "ASC 251"       → ASC / 251
//   "PAR164"        → PAR / 164        (senza spazio)
//   "XASC123"       → XASC / 123
//   "BRS TG04"      → BRS-TG / 4       (Trainer Gallery: numerazione a sé)
//   "CRZ GG22"      → CRZ-GG / 22      (Galarian Gallery)
//   "CEL TR 15"     → CEL-TR / 15      (sottoinsieme Team Rocket)
//   "PPS8 SCR 107"  → SCR / 107        (bustina premio, ricondotta al set)
//   "MCD25 5"       → MCD25 / 5        (McDonald's, uno per anno)
//   "SM-P 47"       → SM-P / 47        (promo)
//
// I sottoinsiemi restano set DISTINTI apposta: una Trainer Gallery ha una
// propria numerazione e un proprio totale, sommarla al set principale
// falserebbe entrambi gli avanzamenti.
//
// NON riconosciuti, per ora: "MFB" e "PR" (28+1 carte) — codici senza
// numero, quindi senza posizione in un set. Vanno chiariti con Claudio.
//
// CASO AMBIGUO NOTO: "SV9033" viene letto come SV9 / 33. Potrebbe essere
// il set giapponese SV9 carta 033 (interpretazione scelta) oppure SV carta
// 9033. Sono 9 carte: se la lettura è sbagliata, si corregge qui.
// VARIANTI POKÉ BALL / MASTER BALL (Claudio): le sigle che iniziano per X
// — XASC, XPRE, XBLK, XWHT, XJTG, XMEG, XDRI, XPFL, 255 carte in tutto —
// NON sono set a sé: sono le stesse carte del set base con il pattern
// Poké Ball o Master Ball al posto del reverse normale.
// "XASC 123" è la carta 123 di Ascesa Eroica, non una carta in più.
//
// Per l'avanzamento del set vanno quindi ricondotte al set base, altrimenti
// ASC comparirebbe come due espansioni distinte e nessuna delle due
// risulterebbe mai completa. La variante resta comunque nota (campo
// 'variante'), utile se un giorno vorrai contare il master set — cioè tutte
// le varianti — invece del solo set base.
//
// BUSTINE PREMIO (Claudio): le sigle che iniziano per "PPS<numero>-"
// — es. PPS8-SCR, PPS6-TWM, PPS7-JTG, 48 carte in tutto — sono carte
// normali di un'espansione reale, solo stampate come bustina premio.
// Stesso trattamento delle varianti X: ricondotte al set base (campo
// 'variante' = 'stampata'). Verificato sui 1143+ codici reali il
// 2026-08-28: tutte le 19 teste PPS trovate puntano a un set già in
// libreria, nessuna eccezione.
function _ballSetBase(testa) {
    const mX = testa.match(/^X([A-Z]{2,6})(-.*)?$/);
    if (mX) return { set: mX[1] + (mX[2] || ''), variante: 'ball' };

    // Bustine premio: "PPS8 SCR 107" → testa normalizzata "PPS8-SCR".
    // Carte normali di un'espansione reale, solo stampate diversamente.
    // Verificato sui dati reali (2026-08-28): 19 teste PPS<n>-<SIGLA>,
    // tutte riconducibili a un set già in libreria, nessuna eccezione.
    const mPPS = testa.match(/^PPS\d+-(.+)$/);
    if (mPPS) return { set: mPPS[1], variante: 'stampata' };

    // Trick or Trade: "BOO24 PAR 023" → testa normalizzata "BOO24-PAR".
    // Applicato "PER ORA" (Claudio, 2026-08-28) sulla base di 3 fonti
    // esterne concordi (Bulbapedia, Pokellector, un'inserzione che vende
    // le singole carte catalogandole col set/numero originale) che
    // descrivono le BOO come ristampe timbrate di carte di set esistenti,
    // stesso numero originale — non un set con numerazione propria. Se un
    // riscontro sui dati fisici dicesse diversamente, questa riga va tolta.
    const mBOO = testa.match(/^BOO\d+-(.+)$/);
    if (mBOO) return { set: mBOO[1], variante: 'halloween' };

    return { set: testa, variante: null };
}

// Alias per teste che in collezione non coincidono con la sigla ufficiale
// TCGdex. Una riga per ogni caso: aggiunta SOLO dopo conferma esplicita di
// Claudio sul significato del codice, mai dedotta dal pattern (a differenza
// di X e PPS, qui non c'è una regola regolare da riconoscere).
const _ballALIAS_TESTA = {
    'SM': 'SMP',   // SM Black Star Promos (confermato da Claudio, 2026-08-28)
    'TR': 'RO',    // Team Rocket, sigla storica (confermato da Claudio, 2026-08-28)
    'FL': 'UNB',   // Legami Inossidabili / Unbroken Bonds (confermato da Claudio, 2026-08-28)
    'TM': 'TRI',   // Battaglie Trionfali, HS4 (confermato da Claudio, 2026-08-28)
    'NG': 'N1',    // Neo Genesis (fonte esterna verificata, confermato 2026-08-28)
    'NDI': 'N2',   // Neo Discovery, codice reale confermato "NDI-nn" (fonte esterna, 2026-08-28)
    'NR': 'N3',    // Neo Revelation, codice reale confermato "NR-nn" (fonte esterna, 2026-08-28)
    'NDE': 'N4',   // Neo Destiny, codice reale confermato "NDE-nn" (fonte esterna, 2026-08-28)
    'UD': 'UND',   // Undaunted / Senza Paura (confermato da Claudio, 2026-08-28)
    'CL': 'COL',   // Call of Legends / Richiamo delle Leggende — NON la Pokémon Card
                   // Game Classic (quella userebbe CLK/CLL/CLF, mai "CL" nudo — la
                   // carta reale in collezione è "CL 92", senza suffisso). Confermato
                   // da Claudio 2026-08-28.
    'TK2-M': 'TK2M', // Trainer Kit Minun — stesso bug del separatore delle Trainer
                      // Gallery (spazio "TK2 M3" collassato in trattino dal lettore,
                      // ma la libreria usa "TK2M" senza separatore). Confermato 2026-08-28.
    'TK10-A': 'TK10A', // Trainer Kit Alolan Raichu, stesso bug. Confermato 2026-08-28.
    'M24': 'MCD24', // McDonald's Collection 2024 (confermato da Claudio, 2026-08-28)
};

function _ballSetBaseConAlias(testa) {
    return _ballSetBase(_ballALIAS_TESTA[testa] || testa);
}

function _ballLeggiCodice(codice) {
    if (!codice) return null;
    const t = String(codice).trim().toUpperCase();

    const m = t.match(/^(.*?)[\s\-_]*(\d{1,3})$/);
    if (m) {
        // Spazi e trattini interni diventano un separatore unico, così
        // "CEL TR 15" e "CEL-TR-15" finiscono nello stesso set.
        const testa = m[1].trim().replace(/^[\s\-_]+|[\s\-_]+$/g, '').replace(/[\s\-_]+/g, '-');
        if (testa && /[A-Z]/.test(testa)) {
            const b = _ballSetBaseConAlias(testa);
            return { set: b.set, variante: b.variante, numero: parseInt(m[2], 10) };
        }
    }

    // Set SENZA numerazione, es. "MFB" (My First Battle, 28 carte) e "PR".
    // Claudio: quelle carte un numero non ce l'hanno proprio. Restituiamo
    // comunque il set con numero null: così le carte non spariscono dal
    // conteggio delle espansioni, ma non entrano in nessun avanzamento —
    // senza numerazione non esiste un "quante ne mancano".
    if (/^[A-Z][A-Z\-]{0,7}$/.test(t)) {
        const b = _ballSetBaseConAlias(t);
        return { set: b.set, variante: b.variante, numero: null };
    }
    return null;
}

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // ── SET / ESPANSIONI ─────────────────────────────────────────────────
    // Avanzamento verso il set completo, dedotto dal CODICE della carta.
    //
    // ATTENZIONE, LIMITE DICHIARATO: il formato di 'codice' non è definito
    // da nessuna parte nel sito — nessun placeholder d'esempio, nessuna
    // validazione, nessuna regex: arriva grezzo dalla colonna. Quello che
    // segue riconosce i formati più diffusi (vedi _ballLeggiCodice) e, se
    // non riconosce nulla, il widget dice "codici non riconosciuti" invece
    // di mostrare percentuali inventate. Da tarare su codici reali.
CATALOGO_WIDGET.set_completamento = {
        titolo: 'Set', icona: 'fa-layer-group',
        preview: () => {
            const coll = carteReali.filter(c => c.stato === 'collezione' && c.tabella === 'carte');
            const set = {};
            let riconosciute = 0;
            coll.forEach(c => {
                const letto = _ballLeggiCodice(c.code);
                if (!letto) return;
                riconosciute++;
                if (!set[letto.set]) set[letto.set] = { numeri: new Set(), senzaNumero: 0 };
                // Le carte con numero si contano per numeri DISTINTI: la
                // stessa carta posseduta in versione normale e Poké Ball
                // vale uno solo ai fini del set completo.
                if (letto.numero != null) set[letto.set].numeri.add(letto.numero);
                else set[letto.set].senzaNumero++;
            });

            const voci = Object.entries(set).map(([sigla, conteggio]) => {
                const info = _ballLIBRERIA_SET[sigla];
                const hai = conteggio.numeri.size + conteggio.senzaNumero;
                return {
                    sigla,
                    nome: info ? info.nome : sigla,
                    hai,
                    // Un set senza numerazione (MFB) non ha avanzamento
                    // possibile: si mostra solo quante carte hai.
                    senzaNumerazione: conteggio.numeri.size === 0 && conteggio.senzaNumero > 0,
                    // Il totale c'è solo se il set è in libreria: senza,
                    // niente percentuale (mai un avanzamento su un totale
                    // che non conosciamo).
                    totale: info ? info.totale : null,
                    perc: info && info.totale && conteggio.numeri.size > 0
                        ? Math.min(100, (conteggio.numeri.size / info.totale) * 100)
                        : null
                };
            }).sort((a, b) => (b.perc ?? -1) - (a.perc ?? -1) || b.hai - a.hai);

            if (voci.length === 0) {
                return { righe: [riconosciute === 0 ? 'Codici non riconosciuti' : 'Nessun set'], dati: { voci: [], riconosciute, inLibreria: 0 } };
            }
            const inLibreria = voci.filter(v => v.totale).length;
            const prima = voci[0];
            return {
                righe: [prima.totale ? `${prima.nome}: ${prima.hai}/${prima.totale}` : `${voci.length} espansioni`],
                dati: { voci, riconosciute, inLibreria }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente
        // Visualizzazione generica (tab:'visualizzazione') — ora ha una
        // pagina propria (#set in index.html, renderPaginaSet() sotto).
        // Nessun click sulle righe (deciso da Claudio): la pagina è solo
        // di consultazione.
        tab: 'set',
};

// ── PAGINA "SET" (2026-08-30) ───────────────────────────────────────────
// Sesto widget con pagina di dettaglio propria. Riusa
// CATALOGO_WIDGET.set_completamento.preview() per intero (dati.voci: già
// TUTTE le espansioni, non solo le prime 4 del ball — nessun taglio da
// togliere qui, a differenza delle altre pagine). Sola consultazione:
// nessun click sulle righe, nessuna ricerca, ordinamento fisso per
// percentuale (deciso da Claudio) — stesso ordine già dato dal preview.
async function renderPaginaSet() {
    const container = document.getElementById('setContenuto');
    if (!container) return;

    const def = CATALOGO_WIDGET.set_completamento;
    let dati;
    try {
        dati = def.preview().dati;
    } catch (e) {
        console.error('renderPaginaSet:', e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento.</p>';
        return;
    }

    const voci = (dati && dati.voci) || [];
    if (voci.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Set</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessuna espansione trovata.</p>
        `;
        return;
    }

    const totale = voci.length;
    const inLibreria = dati.inLibreria || 0;
    const riconosciute = dati.riconosciute || 0;
    const prima = voci[0];

    const righe = voci.map(v => {
        const haBarra = v.totale && v.perc != null;
        const testa = haBarra
            ? `<b>${escapeHtml(v.nome)}</b><span>${v.hai}/${v.totale} · ${Math.round(v.perc)}%</span>`
            : `<b>${escapeHtml(v.nome)}</b><span>${v.hai} cart${v.hai === 1 ? 'a' : 'e'}</span>`;
        const barra = haBarra
            ? `<div class="pg-barra-track"><div class="pg-barra-fill" style="width:${v.perc}%"></div></div>`
            : '<span style="font-size:0.7rem; color:var(--text-muted);">Avanzamento non disponibile — libreria set da compilare</span>';
        return `<div class="pg-riga-set"><div class="pg-riga-set-testa">${testa}</div>${barra}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Set</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${prima.totale && prima.perc != null ? `${prima.nome}: ${Math.round(prima.perc)}% completo` : `${prima.nome} in testa`}</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Espansioni</span></div>
                <div><b>${inLibreria}</b><span>In libreria</span></div>
                <div><b>${riconosciute}</b><span>Carte riconosciute</span></div>
            </div>
            <div class="pg-elenco">${righe}</div>
        </div>
    `;
}
