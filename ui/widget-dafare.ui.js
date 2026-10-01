// ═══════════════════════════════════════════════════════════════════════
// WIDGET-DAFARE.UI.JS — tessera "Prossima azione" + pagina "Da Fare"
// (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 7 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A: id catalogo 'suggerimento' (titolo tessera "Prossima
// azione"), apre la pagina "Da Fare" (#dafare). Unificati dal 2026-08-28
// (Claudio: "saranno la stessa cosa") — renderPaginaDaFare() riusa
// CATALOGO_WIDGET.suggerimento.preview() come unica fonte dei segnali,
// zero duplicazione. Per questo la voce di catalogo e la pagina vivono
// nello stesso file, a differenza di altri widget dove sono più separate.
//
// Include anche lo STORICO "DA FARE" (24h): _daFareUltimoStato,
// FINESTRA_STORICO_DAFARE_MS, _rilevaTransizioniDaFare,
// _segnaDaFareRisolto — usati solo da questo widget (verificato).
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaDaFare() per tabId === 'dafare' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.suggerimento / _ballASPETTO.suggerimento / _ballTITOLI_BREVI
//   .suggerimento (ui/widget-render-condiviso.ui.js) — motore visivo, non
//   toccato.
// - _contaCodaErrori, _elencoPrezziScaduti, _dispositiviAttiviOra: esterne,
//   vivono in ui/home.ui.js (vecchio file, non toccato da questa
//   ristrutturazione).
// ───────────────────────────────────────────────────────────────────────
// ── STORICO "DA FARE" (24h) — Claudio, 2026-08-28 ────────────────────────
// _daFareUltimoStato: SOLO in memoria, non persistito, per-tab. Serve
// unicamente a confrontare "prima" con "ora" a ogni preview() del widget
// 'suggerimento' (~ogni 15s mentre la home è aperta, stesso polling già
// esistente) — zero query in più per il confronto stesso. La scrittura
// vera su preferenze_utente scatta SOLO quando un segnale sparisce
// dall'elenco attivo (transizione), non a ogni tick.
// LIMITE ACCETTATO: se un segnale nasce e si risolve interamente senza
// che la home sia mai aperta nel frattempo, la transizione non viene mai
// osservata — nessuno storico per quel caso. Accettabile per una funzione
// "in più", non richiede un cron server-side.
let _daFareUltimoStato = {};
const FINESTRA_STORICO_DAFARE_MS = 24 * 60 * 60 * 1000; // Claudio: "24 ore va benissimo"

function _rilevaTransizioniDaFare(segnaliOra) {
    const idAttiviOra = new Set(segnaliOra.map(s => s.id));
    Object.keys(_daFareUltimoStato).forEach(id => {
        if (_daFareUltimoStato[id].attivo && !idAttiviOra.has(id)) {
            _segnaDaFareRisolto(id, _daFareUltimoStato[id].testo); // fire-and-forget, non blocca il render
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

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.suggerimento = {
        titolo: 'Centro operativo', icona: 'fa-lightbulb',
        // UNIFICATO con "Da fare" (Claudio, 2026-08-28: "saranno la stessa
        // cosa"). Stessa priorità di sempre (coda errori → prezzi scaduti
        // → wishlist sotto obiettivo → gruppo al lavoro) ma ora raccoglie
        // TUTTI i segnali attivi, non solo il primo: il tile mostra solo
        // il più urgente in testo, 'badge' (letto da renderWidgetHome
        // invece del numero estratto da 'righe[0]') conta quanti sono
        // attivi, e 'dati.segnali' è l'elenco completo che legge
        // renderPaginaDaFare(). Il tap apre sempre la pagina dedicata,
        // mai più una tab diversa a seconda del segnale.
        //
        // FASE 8, STEP 4 (2026-09-13): rinominato da "Prossima azione" a
        // "Centro operativo" (roadmap) — id di catalogo 'suggerimento'
        // NON cambiato apposta (il tracciamento missioni/il resto del
        // codice lo referenzia per id, non per titolo). Aggiunti 3 nuovi
        // segnali chiesti dalla roadmap: match trovati, richieste da
        // gestire ("interesse ricevuto"), elementi ancora in "?". Tutti e
        // tre a ZERO query aggiuntive: match e richieste riusano
        // CATALOGO_WIDGET.match.preview()/CATALOGO_WIDGET.richieste.
        // preview() (stessa filosofia già in uso per valore_collezione —
        // "un solo posto dove il dato è calcolato"), elementi in "?" legge
        // carteReali già in memoria (nessuna nuova interrogazione).
        // "Missioni/reward pronti da riscuotere" (roadmap): superato — i
        // premi si assegnano da soli al completamento, non c'è niente da
        // riscuotere. Al suo posto (2026-09-26, Claudio: "sì"): segnale
        // "missioni ancora da fare oggi", vedi sotto.
        // RESTYLE BINDEX FASE 3a (2026-10-01, tavole "Centro operativo"):
        // - ordine "da fare": richieste → carte da correggere → prezzi;
        // - le carte in "?" passano in "Opportunità e sistemazioni" (tavola:
        //   "3 cose da fare adesso · 3 opportunità" = Match, Wishlist, "?");
        // - wishlist sotto obiettivo porta alla pagina Wishlist (prima Binders);
        // - ogni segnale porta con sé i dati per la scheda della pagina
        //   (miniature, righe) — sempre dati già letti, nessuna query nuova
        //   tranne il conteggio dispositivi, che sostituisce la vecchia
        //   _dispositiviAttiviOra (stessa RPC, una chiamata sola).
        preview: async () => {
            const segnali = [];

            // "Interesse ricevuto" — richieste di scambio ricevute che
            // aspettano una MIA decisione (accetta/rifiuta). Zero query
            // proprie: CATALOGO_WIDGET.richieste.preview() la fa già.
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

            // Match — CATALOGO_WIDGET.match.preview() è sincrona (legge due
            // variabili di modulo già aggiornate dal polling di queue.ui.js).
            // scambio = tue carte Scambio che altri cercano; wishlist = carte
            // che cerchi e altri hanno in Scambio (trova_match_* in queue.ui.js).
            try {
                const matchInfo = CATALOGO_WIDGET.match.preview();
                const nScambio = (matchInfo.dati && matchInfo.dati.scambio) || 0;
                const nWishlist = (matchInfo.dati && matchInfo.dati.wishlist) || 0;
                const totaleMatch = nScambio + nWishlist;
                if (totaleMatch > 0) segnali.push({ id: 'match_trovati', testo: `${totaleMatch} corrispondenz${totaleMatch === 1 ? 'a' : 'e'} nel gruppo`, stato: 'ok', tab: 'match', nScambio, nWishlist });
            } catch (e) { console.error('[Centro operativo] match:', e); }

            const wishlistSottoTarget = carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
            if (wishlistSottoTarget.length > 0) segnali.push({ id: 'wishlist_obiettivo', testo: `${wishlistSottoTarget.length} in wishlist sotto obiettivo`, stato: 'ok', tab: 'wishlist', carte: wishlistSottoTarget });

            // Elementi ancora in location "?" — solo collezione (mai
            // wishlist, che non ha una location reale).
            const inAttesaLocation = carteReali.filter(c => c.tabella === 'carte' && c.location === '?');
            if (inAttesaLocation.length > 0) segnali.push({ id: 'elementi_senza_location', testo: `${inAttesaLocation.length} element${inAttesaLocation.length === 1 ? 'o' : 'i'} ancora in "?"`, stato: undefined, tab: 'location', carte: inAttesaLocation });

            // Missioni del giorno non ancora fatte (2026-09-26). Riusa
            // CATALOGO_WIDGET.missioni.preview() (ui/widget-missioni.ui.js),
            // la stessa della tessera Missioni. Non è una voce: finisce nel
            // riquadro "Oggi"; il segnale serve allo storico 24h.
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

            _rilevaTransizioniDaFare(segnali); // storico 24h — vedi sopra la funzione

            // Ogni segnale sa in quale sezione della tessera/pagina va:
            //   'fare'        → "Da fare adesso" (bordo rosso, conta nel badge)
            //   'opportunita' → "Opportunità e sistemazioni"
            //   missioni e gruppo → riquadri a parte (non sono voci)
            // I campi di prima (id/testo/stato/tab) restano identici: lo
            // storico 24h li legge così.
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
                // Badge rosso = SOLO le cose da fare adesso (azioni), non le
                // opportunità né le informazioni (prima contava tutto).
                azioni: daFare.length,
                dati,
            };
        },
        azione: (dati, punto) => { apriDettaglioWidget('dafare', punto); },
};

// ── PAGINA "CENTRO OPERATIVO" (#dafare) ─────────────────────────────────
// Nessuna logica propria sui segnali: riusa CATALOGO_WIDGET.suggerimento
// .preview(), la stessa fonte della tessera — un solo posto dove i segnali
// sono calcolati (Claudio, 2026-08-28).
//
// RESTYLE BINDEX FASE 3a (2026-10-01) — ridisegnata sulle tavole approvate
// (telefono + PC): riepilogo in alto, "Da fare adesso" (schede con bordo
// rosso, miniature, bottone che porta alla pagina giusta), "Opportunità e
// sistemazioni", e i riquadri Oggi / Il gruppo adesso / Fatto nelle ultime
// 24 ore (a lato su PC, in fondo su telefono — decide la larghezza vera
// della pagina, CSS @container). "Controlla prezzi" APRE la pagina
// Controllo prezzi, non fa partire il controllo (file 01 § D).
// Lo storico 24h È implementato (migration 31, preferenze_utente.
// dafare_risolti): tolto il vecchio commento "APERTO: non ancora
// implementata", non più vero.

// Quanti dispositivi del gruppo stanno controllando prezzi adesso: stessa
// RPC di _dispositiviAttiviOra (ui/home.ui.js, leggi_stato_claim_gruppo,
// soglia 10 minuti di default), ma conta i dispositivi distinti invece di
// dire solo sì/no — file 02: "senza ordine attivo → N dispositivi al
// lavoro". Nessun nome, nessun dettaglio sulle carte.
async function _daFareDispositiviAlLavoro() {
    try {
        const { data, error } = await claimGruppoStato();
        if (error) { console.error('[Centro operativo] dispositivi:', error.message); return 0; }
        return new Set((data || []).map(r => r.dispositivo || r.claimed_by || r.id)).size;
    } catch (e) { console.error('[Centro operativo] dispositivi:', e); return 0; }
}

// Miniature (max 3 + "+N"), immagini sempre dal filtro unico.
function _daFareMiniature(immagini, totale) {
    const lista = (immagini || []).map(i => _urlImmagineVisualizzabile(i, 80)).filter(Boolean).slice(0, 3);
    if (!lista.length) return '';
    const altre = (totale || 0) - lista.length;
    return `<div class="co-mini">${lista.map(src => `<img src="${src}" alt="" loading="lazy" onerror="this.remove();">`).join('')}${altre > 0 ? `<span class="co-mini-altre">+${altre}</span>` : ''}</div>`;
}

// "oggi 10:12" / "ieri 21:50" / "28/09 18:12"
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

// Titolo/sottotitolo di ogni scheda: dove ci sono dati più precisi (un
// solo richiedente, una sola carta) la frase è quella delle tavole,
// altrimenti resta il testo generico del segnale.
function _daFareTesti(s, nickname) {
    const titolo = escapeHtml(s.testo);
    if (s.id === 'richieste_da_gestire') {
        const righe = s.righe || [];
        // FASE 8b: un ospite non ha id utente → conta come persona a sé (per codice RQ).
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

    // Nickname di chi ha chiesto (mai l'email): una RPC sola, solo se
    // ci sono richieste in attesa.
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

    // Storico: segnali risolti negli ultimi FINESTRA_STORICO_DAFARE_MS,
    // persistente per-utente (migration 31).
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

    // Riquadro "Oggi": missioni del giorno.
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

    // Riquadro "Il gruppo adesso": solo quanti dispositivi, nessun nome.
    // "Stanno controllando i prezzi di …" richiede un dato che il DB non
    // ha ancora (ordine attivo, file 03) — arriva con la FASE 8.
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

// Riusa apriDettaglioWidget per tutte le destinazioni tranne 'home' (già
// collaudato, incluso il caricamento dati di Binders quando serve) — la
// pagina "Da fare" stessa resta aperta nello stesso container, cambia
// solo la view-section mostrata dentro.
function _apriVoceDaFare(tab, evt) {
    if (tab === 'home') {
        chiudiDettaglioWidget();
        setTimeout(_vaiAllaPaginaHome, DURATA_ANIMAZIONE_DETTAGLIO_MS);
        return;
    }
    apriDettaglioWidget(tab, evt);
}
