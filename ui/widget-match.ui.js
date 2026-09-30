// ═══════════════════════════════════════════════════════════════════════
// WIDGET-MATCH.UI.JS — tessera + pagina "Match trovati" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP 13 della ristrutturazione file widget home (vedi
// Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md). Estratto da
// ui/phone.ui.js il 2026-09-11. NESSUNA riscrittura: solo spostamento di
// codice, zero cambi di comportamento per l'utente finale.
//
// CATEGORIA A, ma con IL MOTORE NOTIFICHE VERO in ui/queue.ui.js (letto
// per intero in questo step, come richiesto dalla roadmap): questo file
// legge SOLO _numNuoviMatchScambio/_numNuoviMatchWishlist (due variabili
// globali scritte da aggiornaBadgeMatch() in ui/queue.ui.js — NON
// interrogate qui, zero query proprie per l'anteprima) e riusa
// trovaMatch()/_chiaveMatch (stessa formula copiata, non factorizzata,
// commento originale preservato) per la pagina di dettaglio.
//
// ORDINE DI CARICAMENTO CRITICO: ui/queue.ui.js carica PRIMA di questo
// file (verificato in index.html) — le due variabili sopra esistono già
// quando questo file viene interpretato. Non toccato l'ordine.
//
// COSA RESTA FUORI (non spostato qui, invariato):
// - aggiornaBadgeMatch() e tutto il resto di ui/queue.ui.js — file a sé,
//   gestisce anche "Carte con problemi" e allerta prezzo wishlist, non
//   solo Match: non è dominio di questo widget.
// - avviaPollingWidgetHome() (ui/paginainiziale.ui.js) continua a
//   chiamare aggiornaBadgeMatch() ogni 60s — motore home, non toccato.
//   Corretto un commento stale qui sotto ("vedi ... qui sotto") che
//   puntava a una posizione valida solo prima dello STEP 0.
// - apriDettaglioWidget (ui/paginainiziale.ui.js) continua a chiamare
//   renderPaginaMatch() per tabId === 'match' — motore home, dispatch
//   generico, non toccato in questo step.
// - _ballCORPI.match / _ballASPETTO.match / _ballTITOLI_BREVI.match / _ballPill
//   (ui/widget-render-condiviso.ui.js) — motore visivo, non toccato.
//   Verificato: legge d.scambio/d.wishlist dal 'dati' restituito dal
//   preview() qui sotto — forma confermata coerente.
// - trovaMatch, authGetUserId, userSettingsGet,
//   userSettingsUpsertMatchNascosti, missioniBinderPubblicoVisitatoRegistra,
//   escapeHtml: esterne, non toccate.
// ───────────────────────────────────────────────────────────────────────
//
// AGGIUNTA (2026-09-24, filone "Contattare senza doxxare" — sql/70 e
// sql/71, data/chat.repository.js):
// NICKNAME al posto dell'email-prefix nella lista Match. Prima di
// questa sessione ogni riga mostrava (m.altra_email||'').split('@')[0]
// — espone potenzialmente l'identità reale. Ora renderPaginaMatch()
// recupera in batch i nickname di tutti gli owner distinti presenti
// nei risultati (chatOttieniNicknames, RPC SECURITY DEFINER — non ho
// verificato le RLS di preferenze_utente in questa sessione, quindi
// NON ho aperto una policy di lettura pubblica: la RPC espone solo
// la colonna nickname, bypass mirato). Se un utente non ha ancora
// impostato un nickname, resta il fallback email-prefix di prima —
// zero rottura per chi non lo imposta.
//
// ESTRATTA (2026-09-24, sessione successiva, "nuovo+widget-chat.txt"):
// la chat in-app (_contattaPersonaMatch apriva un modale con
// messaggi/blocco/segnalazione/badge/nickname) viveva qui per necessità
// della sessione in cui è nata. Ora è un widget a sé,
// ui/widget-chat.ui.js (id catalogo 'chat') — vedi quel file per tutto
// il resto. _contattaPersonaMatch() RESTA qui come ponte verso il
// widget chat (sotto), unica riga toccata.
//
// RESTYLE (2026-09-24, sessione successiva ancora — "tab + card per
// persona"): mockup su Claude Artifact (canvas "Match — mockup restyle"),
// 4 alternative mostrate a Claudio, scelta confermata: "A ma con le tab
// di C" (card per persona di A dentro le due tab di C). renderPaginaMatch()
// riscritta, CSS nuovo scoped a #match in index.html (vedi commento lì).
// Cosa cambia per l'utente:
// - Due TAB in testa ("Lo hai tu" / "Lo cerchi") al posto di un'unica
//   lista che mescolava righe Scambio (richiedibile:false) e Wishlist
//   (richiedibile:true) — stesso identico dato (righeScambio/Wishlist/
//   *Sealed) invariato, solo raggruppato per tab invece che tutto insieme.
// - "Contatta" ora è UN SOLO bottone in testata della card-persona
//   (prima era ripetuto identico su ogni riga della stessa persona).
// - Azioni secondarie (Binder nel tab "Lo cerchi", Nascondi in entrambi)
//   spostate in un menu "⋯" per riga — stesso pattern (_matchToggleMenu/
//   _matchChiudiMenuAperto, un solo listener "click fuori" alla volta)
//   già usato da ui/widget-chat.ui.js per il menu ⋮ dei messaggi — COPIATO
//   apposta, non fattorizzato in un file condiviso (Regola d'Oro #1): se
//   cambia uno dei due pattern, va cambiato anche l'altro a mano.
// - _nascondiMatch(): il selector usato per l'hide ottimistico prima del
//   salvataggio puntava a '.widget-picker-riga', una classe che non esiste
//   più nel markup di questa pagina da quando esiste .pg-riga (probabile
//   refuso ereditato da un altro widget, mai stato funzionante qui —
//   nessuna prova che fosse mai stato corretto). Corretto per puntare
//   alla nuova '.match-riga', altrimenti l'hide ottimistico sarebbe
//   rimasto silenziosamente rotto anche dopo il restyle.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // Sbloccato (Claudio, 2026-08-27): queue.ui.js letto per intero in
    // questa sessione. Zero query proprie: legge _numNuoviMatchScambio/
    // _numNuoviMatchWishlist, due variabili di modulo scritte da
    // aggiornaBadgeMatch() (queue.ui.js) — funzione che prima girava una
    // sola volta al login e ora è agganciata anche al polling lento (60s,
    // vedi avviaPollingWidgetHome). Scelta esplicita di Claudio: "la cosa
    // più semplice e affidabile quando avremo anche più utenti" — niente
    // interrogazione delle RPC di match ogni 15s per ogni utente col
    // widget attivo.
CATALOGO_WIDGET.match = {
        titolo: 'Match trovati', icona: 'fa-handshake',
        preview: () => {
            const scambio = typeof _numNuoviMatchScambio !== 'undefined' ? _numNuoviMatchScambio : 0;
            const wishlist = typeof _numNuoviMatchWishlist !== 'undefined' ? _numNuoviMatchWishlist : 0;
            const totale = scambio + wishlist;
            const dati = { scambio, wishlist };
            if (totale === 0) return { righe: ['Nessuna novità'], dati };
            // _ballChiedeAttenzione('match', ...) in
            // ui/widget-render-condiviso.ui.js legge righe[0] per decidere
            // se far "scuotere" la tessera: deve contenere una cifra.
            // Restyle FASE 2: match nuovi da vedere = azione → badge rosso.
            return { righe: [`${totale} corrispondenz${totale === 1 ? 'a nuova' : 'e nuove'}`], stato: 'ok', azioni: totale, dati };
        },
        // Pagina dedicata costruita 2026-08-28 (prima apriva Binders in
        // generale, unico punto disponibile all'epoca).
        azione: (dati, evt) => { apriDettaglioWidget('match', evt); },
};

// ═══════════════════════════════════════════════════════════════════════
// PAGINA MATCH — RESTYLE BINDEX FASE 3b (2026-10-01, tavole "Match")
// ═══════════════════════════════════════════════════════════════════════
// Cosa cambia rispetto alla versione "tab + card per persona":
// - si apre su "Lo cerchi" (decisione file 01 § D), tab con icona;
// - riepilogo "N corrispondenze · M nuove" (nuove = mai viste su questo
//   dispositivo: stesso "visto" del badge, prefMatchVistiGet) — aprire la
//   pagina le segna come viste e aggiorna il badge (file 02);
// - ogni riga ha miniatura, codice · lingua · condizione, prezzo e
//   un'etichetta colorata: "Nel suo budget" / "Senza budget" / "X € sopra
//   il suo budget" (Lo hai tu), "Sotto il tuo obiettivo" / "X € sopra il
//   tuo obiettivo" (Lo cerchi);
// - "Lo cerchi": spunta + "Richiedi le selezionate" = UNA richiesta con più
//   oggetti (invia_richiesta_scambio accetta già p_righe con più righe,
//   anche miste carta/sealed — verificato sul DB reale il 2026-10-01);
// - "1 nascosta · Mostra" per rivedere (e ripristinare) le nascoste;
// - PC: a sinistra l'elenco delle persone, a destra il dettaglio della
//   persona scelta; telefono: una card per persona.
// - Il nome è SEMPRE il nickname; se la persona non ne ha uno, "Un utente
//   del gruppo" — mai più il prefisso dell'email (regola "nickname, mai
//   email").
//
// DATI CHE LE RPC DI MATCH NON DANNO (verificato con pg_get_function_result,
// 2026-10-01): immagine, codice, lingua, condizione, quantità disponibile,
// binder dell'altra persona. Miniatura e dati della carta si leggono dalla
// MIA copia (carteReali: la mia carta in Scambio, o la mia voce di Wishlist,
// che è la stessa carta); per i sealed non c'è una miniatura affidabile e
// resta l'icona. NON ci sono quindi, per ora, "ne ha N in Scambio", i
// bottoni "La sua Wishlist / Il suo Scambio" e l'etichetta allegata a
// "Proponi": richiedono di estendere le RPC (SECURITY DEFINER) e il tipo
// dei messaggi — lavoro FASE 8, da verificare sul DB prima di scrivere SQL.

let _matchTabAttivo = 'cerchi';
let _matchDati = null;            // { righe, nicknameMap, nuovi:Set, nascosti:Set }
let _matchPersonaSel = { hai: null, cerchi: null }; // PC: persona mostrata a destra, per tab
let _matchSelezionate = new Set(); // chiavi spuntate in "Lo cerchi"
let _matchMostraNascoste = false;
let _matchMenuIdx = 0;

function _matchCartaMia(id) {
    return (typeof carteReali !== 'undefined' ? carteReali : []).find(c => String(c.id) === String(id)) || null;
}

async function renderPaginaMatch() {
    const container = document.getElementById('matchLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze…</p>';
    _matchTabAttivo = 'cerchi';      // la pagina si apre sempre su "Lo cerchi"
    _matchPersonaSel = { hai: null, cerchi: null };
    _matchSelezionate = new Set();
    _matchMostraNascoste = false;

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    const [{ data: dataScambio, error: errS }, { data: dataWishlist, error: errW }, { data: dataScambioSealed, error: errSs }, { data: dataWishlistSealed, error: errWs }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
        trovaMatch('trova_match_scambio_wishlist_sealed', userId),
        trovaMatch('trova_match_wishlist_scambio_sealed', userId),
    ]);
    if (errS || errW) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nella ricerca match: ${escapeHtml((errS || errW).message)}</p>`;
        return;
    }
    // Fase 6, Step 3 (2026-09-13): sealed (sql/52) è "a corredo" — un
    // errore lì non deve svuotare la pagina se le carte hanno funzionato.
    if (errSs) console.error('Errore match scambio sealed:', errSs.message);
    if (errWs) console.error('Errore match wishlist sealed:', errWs.message);

    // Le chiavi sono la stessa formula di _chiaveMatch (queue.ui.js) — non
    // una funzione a sé per non far scollare le due nel tempo: se cambia
    // una, deve cambiare anche l'altra.
    const daCarta = (mioId) => {
        const c = _matchCartaMia(mioId) || {};
        return { nome: c.name || '', code: c.code || '', lang: c.lang || '', cond: c.cond || '', img: c.immagine || null, miaId: c.id || null };
    };
    const righe = [];
    (dataScambio || []).forEach(m => righe.push({
        chiave: `${m.mia_carta_id}_${m.altra_wishlist_id}`, lato: 'hai', tipo: 'carta', ownerAltro: m.altro_owner_id,
        ...daCarta(m.mia_carta_id), nome: m.mio_nome || daCarta(m.mia_carta_id).nome,
        prezzo: Number(m.mio_prezzo) || 0, obiettivo: m.altro_prezzo_obiettivo,
    }));
    (dataWishlist || []).forEach(m => righe.push({
        chiave: `${m.mia_wishlist_id}_${m.altra_carta_id}`, lato: 'cerchi', tipo: 'carta', ownerAltro: m.altro_owner_id,
        ...daCarta(m.mia_wishlist_id), nome: m.mio_nome || daCarta(m.mia_wishlist_id).nome,
        prezzo: Number(m.altro_prezzo) || 0, obiettivo: m.mio_prezzo_obiettivo, oggettoId: m.altra_carta_id,
    }));
    // Sealed: stesse due forme (id diversi, sql/52 le ha disegnate a specchio).
    (dataScambioSealed || []).forEach(m => righe.push({
        chiave: `s_${m.mio_prodotto_id}_${m.altra_wishlist_sealed_id}`, lato: 'hai', tipo: 'sealed', ownerAltro: m.altro_owner_id,
        nome: m.mio_nome || '', code: '', lang: '', cond: '', img: null,
        prezzo: Number(m.mio_prezzo) || 0, obiettivo: m.altro_prezzo_obiettivo,
    }));
    (dataWishlistSealed || []).forEach(m => righe.push({
        chiave: `s_${m.mia_wishlist_sealed_id}_${m.altro_prodotto_id}`, lato: 'cerchi', tipo: 'sealed', ownerAltro: m.altro_owner_id,
        nome: m.mio_nome || '', code: '', lang: '', cond: '', img: null,
        prezzo: Number(m.altro_prezzo) || 0, obiettivo: m.mio_prezzo_obiettivo, oggettoId: m.altro_prodotto_id,
    }));

    // Collegato a preferenze_utente.match_nascosti (migration 30) —
    // persistente per-utente, non per-dispositivo (Claudio, 2026-08-28).
    const nascosti = await _matchNascostiSet(userId);

    // Nickname in batch per tutti gli owner distinti — una sola RPC. Se
    // fallisce (rete, RPC non ancora sul DB) nessuna riga sparisce: il nome
    // diventa "Un utente del gruppo".
    const idsDistinti = [...new Set(righe.map(r => r.ownerAltro).filter(Boolean))];
    const nicknameMap = {};
    if (idsDistinti.length > 0) {
        try {
            const { data: nicknamesData, error: errN } = await chatOttieniNicknames(idsDistinti);
            if (errN) console.error('Errore lettura nickname:', errN.message);
            else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
        } catch (e) { console.error('Errore lettura nickname:', e); }
    }

    // "Nuove" = mai viste su questo dispositivo. Si fotografano PRIMA di
    // segnarle come viste, così restano evidenziate finché la pagina è aperta.
    const visti = _matchVisti();
    const nuovi = new Set(righe.filter(r => !nascosti.has(r.chiave) && !visti.has(r.chiave)).map(r => r.chiave));
    _matchDati = { righe, nicknameMap, nuovi, nascosti };

    // Aprire la pagina = aver visto le corrispondenze (file 02): si segnano
    // e si aggiorna il badge subito, senza aspettare il polling di 60s.
    const daSegnare = righe.filter(r => !nascosti.has(r.chiave)).map(r => r.chiave);
    if (daSegnare.length) {
        _segnaMatchVisti(daSegnare);
        if (typeof aggiornaBadgeMatch === 'function') aggiornaBadgeMatch().catch(e => console.error('aggiornaBadgeMatch:', e));
    }

    _matchRenderDaDati();
}

function _matchNomePersona(ownerId) {
    return (_matchDati && _matchDati.nicknameMap[ownerId]) || 'Un utente del gruppo';
}

// Etichetta colorata della riga. "Lo hai tu": il budget è dell'ALTRA
// persona (il suo prezzo obiettivo per la mia carta); "Lo cerchi": il
// budget è MIO (il mio prezzo obiettivo per la sua carta).
function _matchEtichetta(r) {
    const ob = r.obiettivo;
    if (r.lato === 'hai') {
        if (ob == null) return { cls: 'bx-stato', testo: 'Senza budget' };
        if (r.prezzo <= Number(ob)) return { cls: 'bx-stato bx-stato-conclusa', testo: 'Nel suo budget' };
        return { cls: 'bx-stato bx-stato-attesa', testo: `${formattaEuro(r.prezzo - Number(ob))} sopra il suo budget` };
    }
    if (ob == null) return null;
    if (r.prezzo <= Number(ob)) return { cls: 'bx-stato bx-stato-conclusa', testo: 'Sotto il tuo obiettivo' };
    return { cls: 'bx-stato bx-stato-attesa', testo: `${formattaEuro(r.prezzo - Number(ob))} sopra il tuo obiettivo` };
}

function _matchRaggruppa(righe) {
    const perPersona = new Map();
    righe.forEach(r => { if (!perPersona.has(r.ownerAltro)) perPersona.set(r.ownerAltro, []); perPersona.get(r.ownerAltro).push(r); });
    return [...perPersona.entries()].map(([ownerAltro, rr]) => {
        const label = _matchNomePersona(ownerAltro);
        const inBudget = rr.filter(r => { const e = _matchEtichetta(r); return e && e.cls.includes('conclusa'); }).length;
        const tuttiNuovi = rr.filter(r => _matchDati.nuovi.has(r.chiave)).length;
        return { ownerAltro, label, labelSafe: escapeJsAttr(label), righe: rr, inBudget, nuovi: tuttiNuovi, totale: rr.reduce((t, r) => t + r.prezzo, 0) };
    });
}

function _matchRenderDaDati() {
    const container = document.getElementById('matchLista');
    if (!container || !_matchDati) return;
    _matchMenuIdx = 0;
    const { righe, nascosti, nuovi } = _matchDati;
    const visibili = righe.filter(r => !nascosti.has(r.chiave));
    const nascoste = righe.filter(r => nascosti.has(r.chiave));

    if (visibili.length === 0 && nascoste.length === 0) {
        container.innerHTML = '<p class="match-vuoto">Nessuna corrispondenza al momento.</p>';
        return;
    }

    const righeCerchi = visibili.filter(r => r.lato === 'cerchi');
    const righeHai = visibili.filter(r => r.lato === 'hai');
    // Se un tab è vuoto e l'altro no, si mostra quello con contenuto.
    let tab = _matchTabAttivo;
    if (tab === 'cerchi' && righeCerchi.length === 0 && righeHai.length > 0) tab = 'hai';
    else if (tab === 'hai' && righeHai.length === 0 && righeCerchi.length > 0) tab = 'cerchi';
    _matchTabAttivo = tab;

    const persone = new Set(visibili.map(r => r.ownerAltro)).size;
    const nNuove = visibili.filter(r => nuovi.has(r.chiave)).length;
    const riepilogo = `<b>${visibili.length} corrispondenz${visibili.length === 1 ? 'a' : 'e'}</b><span class="match-riep-pc"> con ${persone} person${persone === 1 ? 'a' : 'e'} del gruppo</span>${nNuove ? ` · <b class="match-rosso">${nNuove} nuov${nNuove === 1 ? 'a' : 'e'}</b>` : ''}`;

    const righeTab = tab === 'cerchi' ? righeCerchi : righeHai;
    const nascosteTab = nascoste.filter(r => r.lato === tab);
    const gruppi = _matchRaggruppa(righeTab);
    const gruppiNascosti = _matchMostraNascoste ? _matchRaggruppa(nascosteTab) : [];
    if (gruppi.length && !gruppi.some(g => g.ownerAltro === _matchPersonaSel[tab])) _matchPersonaSel[tab] = gruppi[0].ownerAltro;

    const tabBtn = (id, icona, testo, n) =>
        `<button type="button" class="match-tabbtn ${tab === id ? 'attivo' : ''}" onclick="_matchCambiaTab('${id}')"><i class="fa-solid ${icona}"></i> ${testo} &middot; ${n}</button>`;
    const tabsHtml = `<div class="match-tabs">${tabBtn('cerchi', 'fa-heart', 'Lo cerchi', righeCerchi.length)}${tabBtn('hai', 'fa-right-left', 'Lo hai tu', righeHai.length)}</div>`;

    const descr = tab === 'cerchi' ? 'Cose della tua Wishlist che qualcuno del gruppo ha in Scambio' : 'Cose tue in Scambio che qualcuno del gruppo ha in Wishlist';
    const vuoto = tab === 'cerchi'
        ? 'Nessuna corrispondenza: nessuno ha ancora ciò che cerchi in Wishlist.'
        : 'Nessuna corrispondenza: nulla di tuo che gli altri stiano cercando al momento.';

    const elencoPC = gruppi.map(g => {
        const sotto = tab === 'cerchi'
            ? `${g.righe.length} cart${g.righe.length === 1 ? 'a' : 'e'} della tua Wishlist · ${formattaEuro(g.totale)}`
            : `cerca ${g.righe.length} tu${g.righe.length === 1 ? 'a carta' : 'e carte'} in Scambio`;
        const chip = g.inBudget ? `<span class="bx-stato bx-stato-conclusa">${g.inBudget} ${tab === 'cerchi' ? 'sotto obiettivo' : 'nel budget'}</span>` : '';
        return `<div class="match-mrow ${g.ownerAltro === _matchPersonaSel[tab] ? 'sel' : ''}" onclick="_matchSelezionaPersona('${g.ownerAltro}')">
            <div class="match-avatar">${escapeHtml(g.label.charAt(0).toUpperCase())}</div>
            <div class="match-mtesto"><div class="match-persona-nome">${escapeHtml(g.label)}${g.nuovi ? ' <span class="match-punto"></span>' : ''}</div><div class="match-persona-sotto">${sotto}</div></div>
            ${chip}<i class="fa-solid fa-chevron-right match-freccia"></i></div>`;
    }).join('');

    const nascosteHtml = nascosteTab.length
        ? `<div class="match-nascoste"><i class="fa-solid fa-eye-slash"></i> ${nascosteTab.length} nascost${nascosteTab.length === 1 ? 'a' : 'e'} · <a href="#" onclick="event.preventDefault(); _matchToggleNascoste()">${_matchMostraNascoste ? 'Nascondi' : 'Mostra'}</a></div>`
        : '';

    const card = (g, nasc) => _matchCardPersonaHtml(g, tab === 'cerchi', nasc, g.ownerAltro === _matchPersonaSel[tab]);
    const cards = gruppi.length
        ? gruppi.map(g => card(g, false)).join('')
        : `<p class="match-vuoto">${vuoto}</p>`;
    const cardsNasc = gruppiNascosti.map(g => card(g, true)).join('');

    container.innerHTML = `
        <p class="pg-sotto match-riepilogo">${riepilogo}</p>
        <div class="match-layout">
            ${tabsHtml}
            <div class="match-master">
                <div class="match-descr">${descr}</div>
                ${elencoPC}
                ${nascosteHtml}
            </div>
            <div class="match-dettaglio">${cards}${cardsNasc}${nascosteTab.length ? `<div class="match-nascoste match-nascoste-tel"><i class="fa-solid fa-eye-slash"></i> ${nascosteTab.length} nascost${nascosteTab.length === 1 ? 'a' : 'e'} · <a href="#" onclick="event.preventDefault(); _matchToggleNascoste()">${_matchMostraNascoste ? 'Nascondi' : 'Mostra'}</a></div>` : ''}</div>
        </div>`;
}

function _matchCardPersonaHtml(g, eCerchi, nascoste, selPC) {
    const n = g.righe.length;
    const sotto = eCerchi
        ? `ha ${n} cart${n === 1 ? 'a' : 'e'} della tua Wishlist · totale ${formattaEuro(g.totale)}`
        : `cerca ${n} tu${n === 1 ? 'a carta' : 'e carte'} in Scambio · valore ${formattaEuro(g.totale)}`;
    const titoloPC = eCerchi ? `${escapeHtml(g.label)} ha ${n} ${n === 1 ? 'carta' : 'carte'} che cerchi` : `${escapeHtml(g.label)} cerca ${n} tu${n === 1 ? 'a carta' : 'e carte'}`;
    const selezionate = eCerchi ? g.righe.filter(r => _matchSelezionate.has(r.chiave)) : [];
    const azioneFondo = nascoste ? '' : (eCerchi
        ? `<button type="button" class="match-fondo ${selezionate.length ? 'attivo' : ''}" ${selezionate.length ? '' : 'disabled'} onclick="_matchRichiediSelezionate('${g.ownerAltro}')"><i class="fa-solid fa-paper-plane"></i> Richiedi le selezionate${selezionate.length ? ` (${selezionate.length})` : ''}</button>`
        : `<button type="button" class="match-fondo" onclick="_contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')"><i class="fa-solid fa-comment"></i> Proponi a ${escapeHtml(g.label)}</button>`);
    return `
        <div class="match-persona ${nascoste ? 'match-persona-nasc' : ''} ${selPC ? 'match-persona-sel' : ''}" data-owner="${g.ownerAltro}">
            <div class="match-persona-head">
                <div class="match-avatar">${escapeHtml(g.label.charAt(0).toUpperCase())}</div>
                <div style="flex:1; min-width:0;">
                    <div class="match-persona-nome"><span class="match-tel">${escapeHtml(g.label)}</span><span class="match-pc">${titoloPC}</span></div>
                    <div class="match-persona-sotto">${nascoste ? 'nascoste' : sotto}</div>
                </div>
                <button type="button" class="match-icobtn match-scrivi" onclick="event.stopPropagation(); _contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')" title="Scrivi a ${g.labelSafe}" aria-label="Scrivi a ${g.labelSafe}"><i class="fa-solid fa-comment"></i><span class="match-pc"> Scrivi a ${escapeHtml(g.label)}</span></button>
            </div>
            ${g.righe.map(r => _matchRigaHtml(r, eCerchi, g, nascoste)).join('')}
            ${azioneFondo ? `<div class="match-persona-fondo">${azioneFondo}</div>` : ''}
        </div>`;
}

function _matchRigaHtml(r, eCerchi, g, nascosta) {
    const idx = _matchMenuIdx++;
    const chiaveSafe = escapeJsAttr(r.chiave);
    const src = _urlImmagineVisualizzabile(r.img, 96);
    // Tap sulla miniatura = carta a schermo intero con flip (stesso
    // apriImmagineIngrandita del resto del sito). Solo per le carte di cui
    // si ha la copia in memoria; i sealed non hanno un visualizzatore.
    const zoom = (r.tipo === 'carta' && r.miaId) ? ` onclick="event.stopPropagation(); apriImmagineIngrandita('${escapeJsAttr(String(r.miaId))}')"` : '';
    const miniatura = `<span class="bx-lente match-thumb"${zoom}>${src ? `<img class="match-img" src="${src}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'match-img match-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">` : `<span class="match-img match-img-vuota"><i class="fa-solid ${r.tipo === 'sealed' ? 'fa-box' : 'fa-image'}"></i></span>`}</span>`;
    const meta = [r.code, r.lang, r.cond].filter(Boolean).map(escapeHtml).join(' · ');
    const eti = _matchEtichetta(r);
    const prezzoTesto = eCerchi
        ? `Lo ha in Scambio a <b>${formattaEuro(r.prezzo)}</b>${r.obiettivo != null ? ` · tuo obiettivo ${formattaEuro(r.obiettivo)}` : ''}`
        : `Tuo in Scambio a <b>${formattaEuro(r.prezzo)}</b>${r.obiettivo != null ? ` · lo cerca fino a ${formattaEuro(r.obiettivo)}` : ' · nessun limite di prezzo'}`;
    const nuovo = _matchDati.nuovi.has(r.chiave) ? ' <span class="match-nuovo">NUOVO</span>' : '';
    const spunta = (eCerchi && !nascosta)
        ? `<input type="checkbox" class="match-spunta" ${_matchSelezionate.has(r.chiave) ? 'checked' : ''} onclick="event.stopPropagation(); _matchToggleSpunta('${chiaveSafe}')" aria-label="Seleziona ${escapeHtml(r.nome)}">` : '';
    const primaria = nascosta ? '' : (eCerchi
        ? `<button type="button" class="match-azione match-pc-flex" onclick="event.stopPropagation(); _matchRichiediUna('${chiaveSafe}')"><i class="fa-solid fa-paper-plane"></i> Richiedi</button>`
        : `<button type="button" class="match-azione match-pc-flex" onclick="event.stopPropagation(); _contattaPersonaMatch('${g.ownerAltro}', '${g.labelSafe}')"><i class="fa-solid fa-comment"></i> Proponi</button>`);
    const voceMenu = nascosta
        ? `<button type="button" onclick="_matchChiudiMenuAperto(); _riattivaMatch('${chiaveSafe}')"><i class="fa-solid fa-eye"></i> Mostra di nuovo</button>`
        : `<button type="button" onclick="_matchChiudiMenuAperto(); _nascondiMatch('${chiaveSafe}', event)"><i class="fa-solid fa-eye-slash"></i> Nascondi</button>`;
    return `
        <div class="match-riga">
            ${spunta}${miniatura}
            <div class="match-riga-testo">
                <div class="match-riga-nome">${escapeHtml(r.nome || '(senza nome)')}${nuovo}</div>
                ${meta ? `<div class="match-riga-meta">${meta}</div>` : ''}
                <div class="match-riga-prezzo">${prezzoTesto}</div>
                ${eti ? `<span class="${eti.cls}">${eti.testo}</span>` : ''}
            </div>
            ${primaria}
            <button type="button" class="match-icobtn" onclick="_matchToggleMenu(${idx}, event)" title="Altre azioni" aria-label="Altre azioni"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="match-menu" id="matchMenu_${idx}">${voceMenu}</div>
        </div>`;
}

// Cambio tab / persona / nascoste: nessuna nuova query, i dati sono già in
// memoria (_matchDati) — si ridisegna e basta.
function _matchCambiaTab(tab) { _matchTabAttivo = tab; _matchRenderDaDati(); }
function _matchSelezionaPersona(ownerId) { _matchPersonaSel[_matchTabAttivo] = ownerId; _matchRenderDaDati(); }
function _matchToggleNascoste() { _matchMostraNascoste = !_matchMostraNascoste; _matchRenderDaDati(); }
function _matchToggleSpunta(chiave) {
    if (_matchSelezionate.has(chiave)) _matchSelezionate.delete(chiave); else _matchSelezionate.add(chiave);
    _matchRenderDaDati();
}

function _matchVoceRichiesta(r) {
    return { chiave: r.chiave, tipo: r.tipo, oggettoId: r.oggettoId, nome: r.nome, code: r.code, img: r.img, prezzo: r.prezzo };
}
function _matchRichiediUna(chiave) {
    const r = _matchDati && _matchDati.righe.find(x => x.chiave === chiave);
    if (!r) return;
    apriRichiediMatchMulti(r.ownerAltro, _matchNomePersona(r.ownerAltro), [_matchVoceRichiesta(r)]);
}
function _matchRichiediSelezionate(ownerId) {
    if (!_matchDati) return;
    const voci = _matchDati.righe.filter(r => r.ownerAltro === ownerId && r.lato === 'cerchi' && _matchSelezionate.has(r.chiave)).map(_matchVoceRichiesta);
    if (!voci.length) return;
    apriRichiediMatchMulti(ownerId, _matchNomePersona(ownerId), voci);
}
// Dopo una richiesta inviata (queue.ui.js → confermaRichiediMatch): le
// righe richieste escono dalla selezione.
function _matchRichiestaInviata(chiavi) {
    (chiavi || []).forEach(c => _matchSelezionate.delete(c));
    _matchRenderDaDati();
}

// Menu "⋯" per riga — stesso pattern di _chatToggleMenu/
// _chatChiudiMenuFuori in ui/widget-chat.ui.js (COPIATO, non condiviso,
// vedi commento di testata). Un solo menu aperto alla volta, chiuso da un
// singolo listener "click fuori" registrato con { once: true }.
function _matchToggleMenu(idx, evt) {
    evt.stopPropagation();
    const menu = document.getElementById('matchMenu_' + idx);
    if (!menu) return;
    const giaAperto = menu.classList.contains('aperto');
    _matchChiudiMenuAperto();
    if (!giaAperto) {
        menu.classList.add('aperto');
        setTimeout(() => { document.addEventListener('click', _matchChiudiMenuAperto, { once: true }); }, 0);
    }
}
function _matchChiudiMenuAperto() {
    document.querySelectorAll('#match .match-menu.aperto').forEach(m => m.classList.remove('aperto'));
}

// Legge preferenze_utente.match_nascosti (migration 30) e lo trasforma
// in un Set di chiavi — stesso pattern di lettura di userSettingsGet già
// usato altrove nel sito, nessuna query nuova inventata.
async function _matchNascostiSet(userId) {
    if (!userId) return new Set();
    try {
        const { data, error } = await userSettingsGet(userId);
        if (error || !data || !data.match_nascosti) return new Set();
        return new Set(JSON.parse(data.match_nascosti));
    } catch (e) {
        console.error('_matchNascostiSet: errore lettura/parsing:', e);
        return new Set();
    }
}

// Nasconde subito la riga (feedback immediato, prima ancora che il
// salvataggio finisca) e scrive per davvero su preferenze_utente —
// persistente per-utente, sopravvive a refresh e cambio dispositivo.
// RESTYLE 3b: aggiorna anche _matchDati, così "1 nascosta · Mostra" e i
// conteggi restano coerenti senza rifare le RPC.
async function _nascondiMatch(chiave, evt) {
    const tile = evt?.currentTarget?.closest('.match-riga') || evt?.target?.closest?.('.match-riga');
    if (tile) tile.style.display = 'none';
    await _matchAggiornaNascosti(chiave, true);
}

// Ripristina una riga nascosta (voce "Mostra di nuovo" nel menu ⋯).
async function _riattivaMatch(chiave) {
    await _matchAggiornaNascosti(chiave, false);
}

async function _matchAggiornaNascosti(chiave, nascondi) {
    const userId = await authGetUserId();
    if (!userId) return;
    const attuali = await _matchNascostiSet(userId);
    if (nascondi) attuali.add(chiave); else attuali.delete(chiave);
    const { error } = await userSettingsUpsertMatchNascosti(userId, [...attuali]);
    if (error) { console.error('_matchAggiornaNascosti: errore salvataggio:', error.message); return; }
    if (_matchDati) {
        _matchDati.nascosti = attuali;
        if (nascondi) _matchSelezionate.delete(chiave);
        _matchRenderDaDati();
    }
}

// Stesso schema URL di _linkPubblicoCondivisione (navigation.ui.js):
// binder-pubblico.html?u=<owner>&binder=<id>, aperto in nuova scheda come
// già fa apriAnteprimaLinkCondiviso — nessun meccanismo nuovo inventato.
// Se binderAltro è vuoto (migration 29 non ancora applicata sul DB, o
// l'altra persona non ha ancora quel binder materializzato) mostra il
// segnaposto invece di costruire un link rotto.
function _apriBinderAltruiMatch(ownerAltro, binderAltro) {
    if (!ownerAltro || !binderAltro) {
        alert('Collegamento diretto al binder non ancora disponibile.');
        return;
    }
    // Missione #70 "Binder pubblico" (2026-08-30): visita del binder
    // pubblico di un altro utente TRAMITE MATCH — utente loggato, quindi
    // scrivibile direttamente (a differenza della "popolarità" m18-20, che
    // conta le aperture anonime da binder-pubblico.html e passa per la RPC
    // SECURITY DEFINER di migration 33). Fire-and-forget, come gli altri.
    // AGGIORNATO (2026-09-01): passo anche binderAltro — serve al traguardo
    // cumulativo #56-65 "binder visitati" per contare binder DISTINTI (non
    // solo le visite totali, già usate dalla missione #70 sopra).
    (async () => {
        try {
            const userId = await authGetUserId();
            if (userId) await missioniBinderPubblicoVisitatoRegistra(userId, binderAltro);
        } catch (e) { console.error('[missioni] registrazione visita binder pubblico:', e); }
    })();
    const url = new URL('binder-pubblico.html?u=' + encodeURIComponent(ownerAltro), window.location.href);
    url.searchParams.set('binder', binderAltro);
    window.open(url.href, '_blank');
}

// SOSTITUITO (2026-09-24): era un segnaposto ("Funzione di contatto in
// arrivo", confermato da Claudio 2026-08-28). Ora apre la chat in-app —
// apriChat() vive in ui/widget-chat.ui.js (ESTRATTO dalla sessione
// successiva, era apriChatMatch() qui). Questa è l'unica riga toccata
// da quell'estrazione in questo file: se il nome smette di combaciare
// con quello nel file chat, il bottone "Contatta" smette di funzionare
// silenziosamente (nessun errore finché non si prova a cliccarlo).
function _contattaPersonaMatch(ownerAltro, personaLabel) {
    apriChat(ownerAltro, personaLabel);
}
