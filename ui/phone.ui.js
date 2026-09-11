// ── ui/phone.ui.js ─────────────────────────────────────────────────────
// Home "smartphone simulato": griglia di widget dentro una cornice
// (placeholder oggi in assets/frame/, in futuro immagine scelta
// dall'utente da un bucket Supabase — vedi _applicaCorniceUtente più
// sotto), ognuno apre a schermo intero (con tasto indietro) esattamente
// la stessa view-section che oggi apriva la voce corrispondente nel
// vecchio menu laterale, oppure un'azione diretta (vedi 'azione' nel
// catalogo). Nessuna nuova query Supabase: ogni widget riusa dati/
// funzioni già esistenti in home.ui.js/navigation.ui.js/queue.repository.js
// — vedi commento su ogni preview.
//
// Dipende da: state globale carteReali (state/cards.state.js), switchTab/
// currentMode/openQrModal (ui/navigation.ui.js), _contaCodaErrori/
// _elencoPrezziScaduti/_dispositiviAttiviOra/apriFlipCardHome/
// aggiornaStatCardHome/caricaAvvisiHome (ui/home.ui.js), prefWidgetLayoutGet/
// Set (data/preferences.repository.js), _urlImmagineVisualizzabile/
// escapeHtml (utils condivisi).
//
// DUE WIDGET BLOCCATI (Claudio, sessione 2026-08-24): "Match trovati" ed
// "Estensione: stato rapido" compaiono nel catalogo ma con dati statici —
// il primo richiede il corpo completo di caricaMatch()/queue.ui.js (finora
// letti solo i nomi delle funzioni, mai il contenuto), il secondo richiede
// extension.ui.js (mai aperto in questa sessione). Niente inventato: sono
// segnalati con bloccato:true, vedi resa in renderWidgetHome().

// ── CATALOGO WIDGET DISPONIBILI ──────────────────────────────────────────
// NOTA (Claudio, 2026-08-24): il widget "Home" che c'era qui è stato
// rimosso — non ha più senso aprire la Home come un dettaglio da un
// widget.
// AGGIORNAMENTO 2026-09-03: la home fissa (#phoneHomePage) è stata
// eliminata del tutto. La home ORA È la pagina a widget, con le pagine
// orizzontali stile telefono. Il commento qui sopra parlava di uno swipe
// verticale fra due pagine che non esiste più.
// [SEZIONE SPOSTATA in ui/widget-set.ui.js — STEP 18 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// CATALOGO_WIDGET ora dichiarato (registro vuoto) in ui/paginainiziale.ui.js,
// caricato PRIMA di questo file — STEP 0 ristrutturazione file widget,
// 2026-09-11 (vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md).
// Qui sotto si popola solo con le voci NON ANCORA estratte nei rispettivi
// widget-<nome>.ui.js: ogni volta che un widget viene estratto (step 3-22
// della roadmap), la sua voce sparisce da qui e va scritta direttamente
// come CATALOGO_WIDGET.<id> = {...} dentro il file di quel widget.
Object.assign(CATALOGO_WIDGET, {
// [SEZIONE SPOSTATA in ui/widget-visualizzazione.ui.js — STEP 21 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-inserimento.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // [VOCE 'binder' SPOSTATA in ui/widget-binder.ui.js — STEP 3 ristrutturazione file widget, 2026-09-11]
// [SEZIONE SPOSTATA in ui/widget-sealed.ui.js — STEP 17 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-vetrina.ui.js — STEP 20 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // RIMOSSO (Claudio, 2026-08-28): "Carta del giorno", ritenuto inutile.
    // Voci orfane in _ballTITOLI_BREVI/_ballASPETTO lasciate intatte —
    // per ripristinarlo, riportare qui l'oggetto originale (vedi git/backup).
    // RIMOSSO (Claudio, 2026-08-28): "Gruppo", ritenuto inutile.
// [SEZIONE SPOSTATA in ui/widget-location.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
    // RIMOSSO (Claudio, 2026-08-28): "Orologio".
    // RIMOSSO (Claudio, 2026-08-28): "Aggiungi carta".
// [SEZIONE SPOSTATA in ui/widget-condividi.ui.js — STEP 5 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-match.ui.js — STEP 13 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-estensione.ui.js — STEP 9 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

    // ═══════════════════════════════════════════════════════════════════
    // WIDGET NUOVI (27/08/2026) — ispirati ai tipi del mockup di Opus.
    // ═══════════════════════════════════════════════════════════════════
    // Nascono TUTTI nascosti: _caricaLayoutWidget aggiunge gli id non
    // presenti nel layout salvato con visibile:false, quindi compaiono nel
    // picker "Aggiungi" senza spostare nulla di ciò che hai già in home.
    //
    // Nessuna query nuova: tutto da carteReali, già in memoria.
    //
    // AGGIORNATO 2026-09-07 — il paragrafo sotto era vero il 27/08, non lo
    // è più per intero:
    //   - 'missioni' è diventato un widget reale nel frattempo (vedi sotto
    //     CATALOGO_WIDGET.missioni: RPC vera, pagina dedicata propria).
    //   - 'bustina' è in corso di sblocco (Roadmap_Widget_Bustina_2026-09-07
    //     + compilato di sessione): schema e RPC lato DB già in produzione,
    //     verificati dal vivo con aperture reali.
    //   - 'polvere' resta segnaposto per scelta esplicita di Claudio
    //     (2026-09-07): la RPC che la genera esiste già (doppioni della
    //     bustina), ma dove/come si spende è rimandato a una sessione
    //     dedicata a parte.
    //   - 'fortuna' e i "traguardi-a-punti" restano non implementati,
    //     nessun cambiamento su questi due: il testo originale sotto vale
    //     ancora SOLO per loro.
    //
    // NON portati dal mockup, e perché (testo originale): appartengono a
    // un'economia di gioco (aprire pacchetti, guadagnare valuta) che in
    // CardSync non esisteva ancora al 27/08. "Set completo" richiederebbe
    // di sapere quante carte compone ogni set: dato non presente nello
    // schema, e non lo deduco dal codice.

// [SEZIONE SPOSTATA in ui/widget-valore-collezione.ui.js — STEP 19 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-doppioni.ui.js — STEP 8 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

    wishlist_obiettivi: {
        titolo: 'Wishlist', icona: 'fa-heart',
        preview: () => {
            const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
            const conObiettivo = desiderate.filter(c => c.prezzoObiettivo != null && c.prezzoObiettivo > 0);
            const raggiunte = conObiettivo.filter(c => c.price > 0 && c.price <= c.prezzoObiettivo);
            if (desiderate.length === 0) return { righe: ['Wishlist vuota'], dati: { totale: 0, raggiunte: 0, conObiettivo: 0, lista: [] } };
            return {
                righe: [raggiunte.length > 0 ? `${raggiunte.length} sotto obiettivo` : `${desiderate.length} carte desiderate`],
                stato: raggiunte.length > 0 ? 'ok' : undefined,
                dati: {
                    totale: desiderate.length,
                    conObiettivo: conObiettivo.length,
                    raggiunte: raggiunte.length,
                    lista: (raggiunte.length ? raggiunte : conObiettivo).slice(0, 3).map(c => ({
                        nome: c.name || '—',
                        prezzo: Number(c.price) || 0,
                        obiettivo: Number(c.prezzoObiettivo) || 0,
                        id: c.id
                    }))
                }
            };
        },
        // MODIFICATO (2026-08-30): prima apriva semplicemente Binder
        // (tab:'binder') — ora ha una pagina propria dedicata (#wishlist
        // in index.html, renderPaginaWishlist() sotto). Nessun impatto sul
        // tracciamento missioni (registrano l'evento su w.id=
        // 'wishlist_obiettivi', non su def.tab).
        tab: 'wishlist',
    },

    // RIMOSSO (2026-08-29): "Traguardi" — unificato nel widget "Missioni",
    // che ora apre una pagina dedicata con missioni del giorno + traguardi
    // permanenti Fase 1 (65 voci dal catalogo dichiarativo in
    // ui/missioni.ui.js). Voci grafiche orfane in _ballTITOLI_BREVI/
    // _ballASPETTO/_ballCORPI (righe ~1096/1127/1749) lasciate intatte per
    // rollback a una riga, stesso principio della pulizia widget 24→19
    // (Compilato_2026-08-28). _caricaLayoutWidget filtra da sé i layout
    // salvati che referenziano ancora 'traguardi' (CATALOGO_WIDGET[w.id]
    // fallisce, riga .filter già esistente) — nessun'altra modifica
    // necessaria per chi ha già questa tessera in home.

    // RIMOSSO (Claudio, 2026-08-28): "Lingue".

// [SEZIONE SPOSTATA in ui/widget-set.ui.js — STEP 18 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

    // ═══════════════════════════════════════════════════════════════════
    // SEGNAPOSTO GACHA (27/08/2026)
    // ═══════════════════════════════════════════════════════════════════
    // Claudio: "verranno collegati in seguito con un aggiornamento
    // riguardante un gacha". Finché quel sistema non esiste, questi tre
    // NON mostrano dati finti spacciati per veri: dichiarano di essere in
    // arrivo. Sono 'bloccato: true', quindi il preview è sincrono e il
    // tocco non apre niente (vedi _eseguiAzioneWidget, che esce subito sui
    // widget bloccati) — nessun vicolo cieco per l'utente.
    //
    // Quando arriverà il gacha: togliere 'bloccato', sostituire il preview
    // con quello vero e riempire il corpo in _ballCORPI, dove ognuno ha già
    // la sua voce pronta.
    // ══════════════════════════════════════════════════════════════════
    // BLOCCHI DELLA HOME FISSA DIVENTATI WIDGET (Claudio, 2026-09-03)
    // ══════════════════════════════════════════════════════════════════
    // I blocchi di #home erano cinque, ma solo TRE meritavano un widget:
    //   - "Cosa richiede la tua attenzione" NON e' qui: il widget
    //     'suggerimento' ("Prossima azione") calcola gia' esattamente le
    //     stesse quattro voci con la stessa priorita' (coda errori ->
    //     prezzi scaduti -> wishlist sotto obiettivo -> gruppo al lavoro).
    //     Duplicarlo avrebbe pagato due volte le stesse 3 query.
    //   - "Carte Totali / Valore Est." NON e' qui: gia' coperto da
    //     'valore_collezione' e 'visualizzazione'.
    //   - "Ultima sincronizzazione" NON e' qui: nessuna funzione in tutto
    //     il progetto riempie #ultimaSincronizzazioneHome. E' un
    //     contenitore morto che mostra "Caricamento..." per sempre. Non si
    //     porta in un widget un dato che non esiste: prima va deciso da
    //     dove viene.
// [SEZIONE SPOSTATA in ui/widget-valore-collezione.ui.js — STEP 19 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-in-primo-piano.ui.js — STEP 10 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-ultime-aggiunte.ui.js — STEP 12 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-contributi.ui.js — STEP 6 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-bustina.ui.js — STEP 4 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-polvere.ui.js — STEP 15 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
// [SEZIONE SPOSTATA in ui/widget-missioni.ui.js — STEP 14 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
});

// [SEZIONE SPOSTATA in ui/widget-valore-collezione.ui.js — STEP 19 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-contributi.ui.js — STEP 6 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-render-condiviso.ui.js — STEP 1 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-vetrina.ui.js — STEP 20 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-dafare.ui.js — STEP 7 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-missioni.ui.js — STEP 14 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]



// [SEZIONE SPOSTATA in ui/widget-match.ui.js — STEP 13 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-valore-collezione.ui.js — STEP 19 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// ── PAGINA "WISHLIST" (2026-08-30) ──────────────────────────────────────
// Secondo widget con pagina di dettaglio propria, stesso pattern di
// renderPaginaValoreCollezione() sopra. A differenza di quella, qui la
// pagina mostra TUTTA la wishlist (non solo il preview a 3 carte del
// widget) — letta direttamente da carteReali (stessa fonte del preview,
// senza il .slice(0,3)), zero query nuove.
//
// Ordinamento: raggiunte prima (le carte con prezzo attuale <= obiettivo,
// ordinate per sconto più grande), poi le altre con obiettivo impostato
// (ordinate per vicinanza — prezzo più vicino all'obiettivo prima), infine
// quelle senza obiettivo impostato in fondo (alfabetico) — deciso da
// Claudio.
let _wishlistCarteComputate = [];
let _wishlistFiltroAttivo = 'tutte';
let _wishlistRicercaTesto = '';

function _wishlistClassificaEOrdina() {
    const desiderate = carteReali.filter(c => c.tabella === 'wishlist' || c.stato === 'wishlist');
    const conPrezzo = (c) => Number(c.price) || 0;
    const conObiettivoVal = (c) => (c.prezzoObiettivo != null && Number(c.prezzoObiettivo) > 0) ? Number(c.prezzoObiettivo) : null;

    const righe = desiderate.map(c => {
        const obiettivo = conObiettivoVal(c);
        const prezzo = conPrezzo(c);
        const raggiunta = obiettivo != null && prezzo > 0 && prezzo <= obiettivo;
        return { id: c.id, nome: c.name || '—', immagine: c.immagine || null, prezzo, obiettivo, raggiunta };
    });

    const raggiunte = righe.filter(r => r.raggiunta)
        .sort((a, b) => (b.obiettivo - b.prezzo) - (a.obiettivo - a.prezzo)); // sconto più grande prima
    const inCorso = righe.filter(r => !r.raggiunta && r.obiettivo != null)
        .sort((a, b) => (a.prezzo - a.obiettivo) - (b.prezzo - b.obiettivo)); // più vicine prima
    const senzaObiettivo = righe.filter(r => r.obiettivo == null)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    _wishlistCarteComputate = [...raggiunte, ...inCorso, ...senzaObiettivo];
    return { totale: righe.length, conObiettivo: raggiunte.length + inCorso.length, raggiunte: raggiunte.length };
}

async function renderPaginaWishlist() {
    const container = document.getElementById('wishlistContenuto');
    if (!container) return;

    _wishlistFiltroAttivo = 'tutte';
    _wishlistRicercaTesto = '';
    const { totale, conObiettivo, raggiunte } = _wishlistClassificaEOrdina();

    if (totale === 0) {
        container.innerHTML = `
            <div class="page-header">
                <span class="page-title">Wishlist</span>
            </div>
            <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">La tua wishlist è vuota.</p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Wishlist</span>
            <span class="page-azione attiva" onclick="_vaiAlBinderWishlist(event)">Vai alla Wishlist</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-intro">
                <div class="pg-grande">${totale}</div>
                <div class="pg-sotto">${conObiettivo} con obiettivo di prezzo · ${raggiunte} già raggiunte</div>
            </div>
            <div class="pg-stat">
                <div><b>${totale}</b><span>Desiderate</span></div>
                <div><b>${conObiettivo}</b><span>Con obiettivo</span></div>
                <div><b>${raggiunte}</b><span>Raggiunte</span></div>
            </div>
            <input type="text" class="pg-cerca" placeholder="Cerca nella wishlist..." oninput="_wishlistCercaInput(this.value)">
            <div class="pg-filtri">
                <span class="pg-filtro attivo" data-filtro="tutte" onclick="_wishlistImpostaFiltro('tutte')">Tutte</span>
                <span class="pg-filtro" data-filtro="raggiunte" onclick="_wishlistImpostaFiltro('raggiunte')">Raggiunte</span>
                <span class="pg-filtro" data-filtro="in_corso" onclick="_wishlistImpostaFiltro('in_corso')">In corso</span>
                <span class="pg-filtro" data-filtro="senza_obiettivo" onclick="_wishlistImpostaFiltro('senza_obiettivo')">Senza obiettivo</span>
            </div>
            <div class="pg-elenco" id="wishlistElenco"></div>
        </div>
    `;
    _wishlistRenderElenco();
}

function _wishlistImpostaFiltro(filtro) {
    _wishlistFiltroAttivo = filtro;
    document.querySelectorAll('.pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.filtro === filtro);
    });
    _wishlistRenderElenco();
}

function _wishlistCercaInput(valore) {
    _wishlistRicercaTesto = (valore || '').toLowerCase();
    _wishlistRenderElenco();
}

function _wishlistRenderElenco() {
    const elenco = document.getElementById('wishlistElenco');
    if (!elenco) return;

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    let righe = _wishlistCarteComputate;
    if (_wishlistFiltroAttivo === 'raggiunte') righe = righe.filter(r => r.raggiunta);
    else if (_wishlistFiltroAttivo === 'in_corso') righe = righe.filter(r => !r.raggiunta && r.obiettivo != null);
    else if (_wishlistFiltroAttivo === 'senza_obiettivo') righe = righe.filter(r => r.obiettivo == null);
    if (_wishlistRicercaTesto) righe = righe.filter(r => r.nome.toLowerCase().includes(_wishlistRicercaTesto));

    if (righe.length === 0) {
        // Messaggio diverso da quello a pagina intera (wishlist vuota):
        // qui la wishlist ha carte, solo il filtro/ricerca corrente non
        // trova corrispondenze.
        elenco.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0;">Nessuna carta corrisponde alla ricerca o al filtro.</p>';
        return;
    }

    elenco.innerHTML = righe.map(r => {
        const immagineSrc = r.immagine ? (_urlImmagineVisualizzabile(r.immagine, 96) || '') : '';
        const fig = immagineSrc
            ? `<img class="pg-fig" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="pg-fig"></div>';
        const badge = r.raggiunta ? '<span class="pg-badge-raggiunta">Raggiunto</span>' : '';
        const destra = r.obiettivo != null
            ? `<b>${eur(r.prezzo)}</b>obiettivo ${eur(r.obiettivo)}`
            : `<b>${eur(r.prezzo)}</b>nessun obiettivo`;
        return `
            <div class="pg-riga ${r.raggiunta ? 'pg-riga-raggiunta' : ''}" data-tocca onclick="apriFlipCardHome('${r.id}', { origine: 'wishlist_pagina' })">
                ${fig}
                <div class="pg-testo"><b>${escapeHtml(r.nome)}${badge}</b></div>
                <div class="pg-destra">${destra}</div>
            </div>`;
    }).join('');
}

// Salta direttamente al binder di tipo 'wishlist', invece di lasciare
// l'utente sulla griglia dei contenitori di Binder (2026-08-30). Usa SOLO
// funzioni reali già esistenti in ui/binder.ui.js, nessuna query nuova
// inventata:
//   1) apriDettaglioWidget('binder', evt) — mostra la view-section Binder
//      (switchTab interno, MAI toccato direttamente qui) E chiama già da
//      sola apriWidgetBinders() al suo interno, awaited (vedi
//      apriDettaglioWidget riga ~2733) — _bindersElenco è già garantita
//      popolata quando questa await finisce, nessuna seconda chiamata
//      necessaria.
//   2) apriBinderDettaglio(id) — cerca dentro _bindersElenco.
async function _vaiAlBinderWishlist(evt) {
    await apriDettaglioWidget('binder', evt);
    const binderWishlist = _bindersElenco.find(b => b.tipo === 'wishlist');
    if (binderWishlist) {
        await apriBinderDettaglio(binderWishlist.id);
    }
    // Se non trovato (caso limite — binderWishlistGarantisci() dovrebbe
    // impedirlo sempre, vedi _garantisciTuttiIBinder in ui/binder.ui.js):
    // resta sulla griglia dei contenitori invece di rompere la pagina.
}


// [SEZIONE SPOSTATA in ui/widget-location.ui.js — STEP 11 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-doppioni.ui.js — STEP 8 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-sealed.ui.js — STEP 17 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-set.ui.js — STEP 18 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


// [SEZIONE SPOSTATA in ui/widget-bustina.ui.js — STEP 4 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/widget-condividi.ui.js — STEP 5 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]

// [SEZIONE SPOSTATA in ui/paginainiziale.ui.js — STEP 0 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]
