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
// 1) NICKNAME al posto dell'email-prefix nella lista Match. Prima di
//    questa sessione ogni riga mostrava (m.altra_email||'').split('@')[0]
//    — espone potenzialmente l'identità reale. Ora renderPaginaMatch()
//    recupera in batch i nickname di tutti gli owner distinti presenti
//    nei risultati (chatOttieniNicknames, RPC SECURITY DEFINER — non ho
//    verificato le RLS di preferenze_utente in questa sessione, quindi
//    NON ho aperto una policy di lettura pubblica: la RPC espone solo
//    la colonna nickname, bypass mirato). Se un utente non ha ancora
//    impostato un nickname, resta il fallback email-prefix di prima —
//    zero rottura per chi non lo imposta.
// 2) CHAT IN-APP. _contattaPersonaMatch() era un placeholder (alert
//    "in arrivo", confermato da Claudio 2026-08-28). Ora apre il modale
//    #chatMatchModal (index.html, da aggiungere — vedi consegna) via
//    apriChatMatch(). Persistente (tabella messaggi, sql/70), niente
//    realtime: polling 6s SOLO mentre il modale è aperto, stesso
//    principio "niente interrogazioni continue per ogni utente" già
//    scelto da Claudio per il badge Match esistente. Blocco e
//    segnalazione inclusi (sql/70: blocchi_chat, segnalazioni_chat — un
//    admin vede lo storico di una conversazione SOLO se è stata
//    segnalata, mai altrimenti).
// NON INCLUSO qui (serve ui/queue.ui.js + statusbar.js, mai letti in
// questa sessione — richiesti a Claudio): badge "messaggi non letti"
// sulla tessera Home, tendina di notifica CSBar per nuovi messaggi.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
    // Sbloccato (Claudio, 2026-08-27): queue.ui.js letto per intero in
    // questa sessione. Zero query proprie: legge _numNuoviMatchScambio/
    // _numNuoviMatchWishlist, due variabili di modulo scritte da
    // aggiornaBadgeMatch() (queue.ui.js) — funzione che prima girava una
    // sola volta al login e ora è agganciata anche al polling lento (60s,
    // vedi avviaPollingWidgetHome, ora in ui/paginainiziale.ui.js). Scelta esplicita di
    // Claudio: "la cosa più semplice e affidabile quando avremo anche più
    // utenti" — niente interrogazione delle RPC di match ogni 15s per
    // ogni utente col widget attivo.
CATALOGO_WIDGET.match = {
        titolo: 'Match trovati', icona: 'fa-handshake',
        preview: () => {
            const scambio = typeof _numNuoviMatchScambio !== 'undefined' ? _numNuoviMatchScambio : 0;
            const wishlist = typeof _numNuoviMatchWishlist !== 'undefined' ? _numNuoviMatchWishlist : 0;
            const chat = _numChatNonLettiMatch || 0;
            const totale = scambio + wishlist;
            const dati = { scambio, wishlist, chatNonLetti: chat };
            if (totale === 0 && chat === 0) return { righe: ['Nessuna novità'], dati };
            // AGGIUNTO (2026-09-24): il testo deve contenere una cifra
            // quando c'è qualcosa da vedere — _ballChiedeAttenzione('match',
            // ...) in ui/widget-render-condiviso.ui.js legge righe[0] per
            // decidere se far "scuotere" la tessera, non toccato qui ma
            // rispettato.
            const parti = [];
            if (totale > 0) parti.push(`${totale} nuov${totale === 1 ? 'a' : 'e'} corrispondenz${totale === 1 ? 'a' : 'e'}`);
            if (chat > 0) parti.push(`${chat} messagg${chat === 1 ? 'io' : 'i'} non lett${chat === 1 ? 'o' : 'i'}`);
            return { righe: [parti.join(', ')], stato: 'ok', dati };
        },
        // Pagina dedicata costruita 2026-08-28 (prima apriva Binders in
        // generale, unico punto disponibile all'epoca).
        azione: (dati, evt) => { apriDettaglioWidget('match', evt); },
};

// Riusa trovaMatch() e la stessa chiave stabile di _chiaveMatch (entrambe
// già in queue.ui.js) — zero duplicazione della logica di interrogazione,
// solo una resa diversa: entrambe le direzioni insieme, raggruppate per
// persona, righe separate anche per la stessa carta (Claudio, 2026-08-28,
// risposte 1/3/6).
async function renderPaginaMatch() {
    const container = document.getElementById('matchLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze…</p>';

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    const [{ data: dataScambio, error: errS }, { data: dataWishlist, error: errW }, { data: dataScambioSealed, error: errSs }, { data: dataWishlistSealed, error: errWs }] = await Promise.all([
        trovaMatch('trova_match_scambio_wishlist', userId),
        trovaMatch('trova_match_wishlist_scambio', userId),
        trovaMatch('trova_match_scambio_wishlist_sealed', userId),
        trovaMatch('trova_match_wishlist_scambio_sealed', userId),
    ]);
    if (errS || errW) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nella ricerca match: ${((errS || errW).message)}</p>`;
        return;
    }
    // Fase 6, Step 3 (2026-09-13): sealed (sql/52) è "a corredo" — un
    // errore lì non deve svuotare la pagina se le carte hanno funzionato.
    if (errSs) console.error('Errore match scambio sealed:', errSs.message);
    if (errWs) console.error('Errore match wishlist sealed:', errWs.message);

    // Stessa chiave di _chiaveMatch (queue.ui.js) — non duplicata qui come
    // funzione a sé per non rischiare che le due si scollino nel tempo,
    // semplicemente la stessa formula copiata: se cambia una, deve
    // cambiare anche l'altra (commento su entrambe).
    const righeScambio = (dataScambio || []).map(m => ({
        chiave: `${m.mia_carta_id}_${m.altra_wishlist_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: m.altro_binder_id || null, // presente solo dopo la migration 29
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tuo, in Scambio, ${Number(m.mio_prezzo || 0).toFixed(2)} €) — lo cerca${m.altro_prezzo_obiettivo != null ? ` fino a ${Number(m.altro_prezzo_obiettivo).toFixed(2)} €` : ''}`,
        richiedibile: false, // l'oggetto è mio — nulla da richiedere qui
    }));
    const righeWishlist = (dataWishlist || []).map(m => ({
        chiave: `${m.mia_wishlist_id}_${m.altra_carta_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: m.altro_binder_id || null,
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tua, in Wishlist${m.mio_prezzo_obiettivo != null ? `, fino a ${Number(m.mio_prezzo_obiettivo).toFixed(2)} €` : ''}) — ce l'ha in Scambio a ${Number(m.altro_prezzo || 0).toFixed(2)} €`,
        richiedibile: true,
        oggettoId: m.altra_carta_id,
        tipoRichiesta: 'carta',
        nomeOggetto: m.mio_nome || '',
    }));
    // Fase 6, Step 3: stesse due forme, lato Sealed (id diversi, stesse
    // colonne di visualizzazione — sql/52 le ha disegnate a specchio
    // apposta per questo).
    const righeScambioSealed = (dataScambioSealed || []).map(m => ({
        chiave: `s_${m.mio_prodotto_id}_${m.altra_wishlist_sealed_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: null, // gli Scaffali Scambio non hanno ancora un link diretto da qui
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tuo sealed, in Scambio, ${Number(m.mio_prezzo || 0).toFixed(2)} €) — lo cerca${m.altro_prezzo_obiettivo != null ? ` fino a ${Number(m.altro_prezzo_obiettivo).toFixed(2)} €` : ''}`,
        richiedibile: false,
    }));
    const righeWishlistSealed = (dataWishlistSealed || []).map(m => ({
        chiave: `s_${m.mia_wishlist_sealed_id}_${m.altro_prodotto_id}`,
        persona: (m.altra_email || '').split('@')[0] || 'Utente',
        ownerAltro: m.altro_owner_id,
        binderAltro: null,
        testo: `<strong>${escapeHtml(m.mio_nome)}</strong> (tua sealed, in Wishlist${m.mio_prezzo_obiettivo != null ? `, fino a ${Number(m.mio_prezzo_obiettivo).toFixed(2)} €` : ''}) — ce l'ha in Scambio a ${Number(m.altro_prezzo || 0).toFixed(2)} €`,
        richiedibile: true,
        oggettoId: m.altro_prodotto_id,
        tipoRichiesta: 'sealed',
        nomeOggetto: m.mio_nome || '',
    }));

    // Collegato a preferenze_utente.match_nascosti (migration 30,
    // eseguita) — persistente per-utente, non per-dispositivo (Claudio,
    // 2026-08-28, risposta 2: non riusa prefMatchVistiGet, che è
    // localStorage e quindi per-dispositivo).
    const nascosti = await _matchNascostiSet(userId);
    const tutte = [...righeScambio, ...righeWishlist, ...righeScambioSealed, ...righeWishlistSealed].filter(r => !nascosti.has(r.chiave));

    if (tutte.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 0;">Nessuna corrispondenza al momento.</p>';
        return;
    }

    // AGGIUNTA (2026-09-24): nickname al posto dell'email-prefix, in
    // batch per tutti gli owner distinti di questa pagina — una sola
    // chiamata RPC indipendentemente da quante righe/persone ci sono.
    // Se la chiamata fallisce (rete, RPC non ancora eseguita sul DB di
    // produzione, ecc.) si degrada silenziosamente al fallback
    // email-prefix già presente in r.persona — nessuna riga sparisce.
    const idsDistinti = [...new Set(tutte.map(r => r.ownerAltro).filter(Boolean))];
    const nicknameMap = {};
    if (idsDistinti.length > 0) {
        try {
            const { data: nicknamesData, error: errN } = await chatOttieniNicknames(idsDistinti);
            if (errN) console.error('Errore lettura nickname:', errN.message);
            else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
        } catch (e) {
            console.error('Errore lettura nickname:', e);
        }
    }

    const perPersona = {};
    tutte.forEach(r => { (perPersona[r.ownerAltro] ||= []).push(r); });

    container.innerHTML = Object.entries(perPersona).map(([ownerAltro, righe]) => {
        const label = nicknameMap[ownerAltro] || righe[0].persona;
        const labelSafe = escapeHtml(label).replace(/'/g, "\\'");
        return `
        <div>
            <div class="pg-titoletto"><i class="fa-solid fa-user"></i> ${escapeHtml(label)}</div>
            <div class="pg-elenco">
                ${righe.map(r => `
                    <div class="pg-riga" style="flex-wrap:wrap; gap:0.5rem;">
                        <span style="flex:1; min-width:200px; font-size:0.82rem;">${r.testo}</span>
                        <div style="display:flex; gap:0.4rem; flex-shrink:0;">
                            ${r.richiedibile ? `<button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); apriRichiediMatch('${r.ownerAltro}', '${r.oggettoId}', '${r.tipoRichiesta}', '${String(r.nomeOggetto).replace(/'/g, "\\'")}', '${labelSafe}')" title="Richiedi"><i class="fa-solid fa-paper-plane"></i></button>` : ''}
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _apriBinderAltruiMatch('${r.ownerAltro}', '${r.binderAltro || ''}')" title="Vai al binder"><i class="fa-solid fa-layer-group"></i></button>
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _contattaPersonaMatch('${r.ownerAltro}', '${labelSafe}')" title="Contatta"><i class="fa-solid fa-comment"></i></button>
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.55rem;" onclick="event.stopPropagation(); _nascondiMatch('${r.chiave}', event)" title="Nascondi"><i class="fa-solid fa-eye-slash"></i></button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>`;
    }).join('');
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
async function _nascondiMatch(chiave, evt) {
    const tile = evt?.currentTarget?.closest('.widget-picker-riga');
    if (tile) tile.style.display = 'none';

    const userId = await authGetUserId();
    if (!userId) return;
    const attuali = await _matchNascostiSet(userId);
    attuali.add(chiave);
    const { error } = await userSettingsUpsertMatchNascosti(userId, [...attuali]);
    if (error) console.error('_nascondiMatch: errore salvataggio:', error.message);
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
// arrivo", confermato da Claudio 2026-08-28). Ora apre la chat in-app.
function _contattaPersonaMatch(ownerAltro, personaLabel) {
    apriChatMatch(ownerAltro, personaLabel);
}

// ═══════════════════════════════════════════════════════════════════════
// CHAT IN-APP (2026-09-24) — sql/70_chat_match.sql, sql/71 per il
// nickname, data/chat.repository.js per le RPC. Modale #chatMatchModal
// (index.html), apertura/chiusura via style.display come TUTTI gli altri
// modali del sito (verificato sul CSS reale, .modal-overlay { display:
// none; ...}, nessuna classe .active in nessun foglio stile del
// progetto — non è un pattern dedotto dal nome delle funzioni).
// Polling 6s SOLO mentre il modale è aperto (si ferma alla chiusura),
// niente subscription realtime — coerente con la scelta già fatta da
// Claudio per il badge Match esistente ("niente interrogazioni continue
// per ogni utente quando saremo di più").
// ═══════════════════════════════════════════════════════════════════════

let _chatMatchConversazioneId = null;
let _chatMatchAltroId = null;
let _chatMatchUserId = null;
let _chatMatchPollingHandle = null;

async function apriChatMatch(ownerAltro, personaLabel) {
    if (!ownerAltro) return;
    _chatMatchUserId = await authGetUserId();
    if (!_chatMatchUserId) return;

    const modal = document.getElementById('chatMatchModal');
    const titolo = document.getElementById('chatMatchTitolo');
    const box = document.getElementById('chatMatchMessaggi');
    if (!modal || !box) return; // markup non ancora presente in index.html

    _chatMatchAltroId = ownerAltro;
    if (titolo) titolo.innerHTML = `<i class="fa-solid fa-comment"></i> ${escapeHtml(personaLabel || 'Utente')}`;
    box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Apro la chat…</p>';
    modal.style.display = 'flex';

    const { data: convId, error } = await chatOttieniOCreaConversazione(ownerAltro);
    if (error || !convId) {
        box.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem;">${escapeHtml((error && error.message) || 'Errore apertura chat')}</p>`;
        return;
    }
    _chatMatchConversazioneId = convId;
    await _chatRenderMessaggi();
    await chatSegnaLetti(convId);
    _chatAvviaPolling();
}

function chiudiChatMatch() {
    _chatFermaPolling();
    const modal = document.getElementById('chatMatchModal');
    if (modal) modal.style.display = 'none';
    _chatMatchConversazioneId = null;
    _chatMatchAltroId = null;
}

function _chatAvviaPolling() {
    _chatFermaPolling();
    _chatMatchPollingHandle = setInterval(async () => {
        if (!_chatMatchConversazioneId) return;
        await _chatRenderMessaggi();
        await chatSegnaLetti(_chatMatchConversazioneId);
    }, 6000);
}

function _chatFermaPolling() {
    if (_chatMatchPollingHandle) { clearInterval(_chatMatchPollingHandle); _chatMatchPollingHandle = null; }
}

function _chatMessaggioHtml(m) {
    const mio = m.mittente_id === _chatMatchUserId;
    return `<div style="align-self:${mio ? 'flex-end' : 'flex-start'}; max-width:80%; background:${mio ? 'var(--primary)' : 'var(--primary-light)'}; color:${mio ? '#fff' : 'var(--primary)'}; padding:0.5rem 0.7rem; border-radius:12px; font-size:0.82rem; word-break:break-word; white-space:pre-wrap;">${escapeHtml(m.testo)}</div>`;
}

async function _chatRenderMessaggi() {
    if (!_chatMatchConversazioneId) return;
    const { data, error } = await chatMessaggiList(_chatMatchConversazioneId);
    const box = document.getElementById('chatMatchMessaggi');
    if (!box) return;
    if (error) {
        box.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem;">${escapeHtml(error.message)}</p>`;
        return;
    }
    if (!data || data.length === 0) {
        box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Nessun messaggio ancora — scrivi il primo.</p>';
        return;
    }
    box.innerHTML = data.map(_chatMessaggioHtml).join('');
    box.scrollTop = box.scrollHeight;
}

async function _chatInviaMessaggioClick() {
    const input = document.getElementById('chatMatchInput');
    if (!input || !_chatMatchConversazioneId) return;
    const testo = input.value.trim();
    if (!testo) return;
    input.value = '';
    const { error } = await chatInviaMessaggio(_chatMatchConversazioneId, testo);
    if (error) { alert('Errore invio: ' + error.message); return; }
    await _chatRenderMessaggi();
}

// Blocco preventivo (sql/70: blocchi_chat non richiede una conversazione
// già esistente) — dopo il blocco chiude la chat, coerente con "non
// potrete più scrivervi" mostrato nella conferma.
async function _chatBloccaUtenteClick() {
    if (!_chatMatchAltroId) return;
    if (!confirm('Bloccare questo utente? Non potrete più scrivervi in chat.')) return;
    const { error } = await chatBloccaUtente(_chatMatchAltroId);
    if (error) { alert('Errore: ' + error.message); return; }
    chiudiChatMatch();
}

// La segnalazione è ciò che sblocca la visibilità admin sullo storico
// della conversazione (RLS di sql/70) — non è solo un log, è un evento
// con effetto reale sui permessi.
async function _chatSegnalaClick() {
    if (!_chatMatchConversazioneId) return;
    const motivo = prompt('Motivo della segnalazione (facoltativo):') || null;
    const { error } = await chatSegnalaConversazione(_chatMatchConversazioneId, motivo);
    if (error) { alert('Errore: ' + error.message); return; }
    alert('Segnalazione inviata.');
}

// ── Nickname (impostazioni, sql/71) ───────────────────────────────────
// Chiamata da index.html, sezione "Dati e Privacy" (#impostazioniPagina-
// dati) — campo nuovo aggiunto lì in questa consegna. Caricamento pigro
// al primo focus (onfocus), non agganciato al lifecycle di apertura
// della pagina impostazioni: non ho mai letto il file che gestisce
// quell'apertura in questa sessione, quindi non ci ho inventato un
// aggancio — questo è autosufficiente.

let _nicknameMatchCaricato = false;

async function _nicknameMatchCaricaSeVuoto() {
    if (_nicknameMatchCaricato) return;
    _nicknameMatchCaricato = true;
    const input = document.getElementById('nicknameMatchInput');
    if (!input) return;
    const userId = await authGetUserId();
    if (!userId) return;
    try {
        const { data, error } = await userSettingsGet(userId);
        if (!error && data && data.nickname) input.value = data.nickname;
    } catch (e) {
        console.error('_nicknameMatchCaricaSeVuoto: errore lettura:', e);
    }
}

async function salvaNicknameMatch() {
    const input = document.getElementById('nicknameMatchInput');
    if (!input) return;
    const { error } = await chatImpostaNickname(input.value.trim() || null);
    if (error) { alert('Errore salvataggio: ' + error.message); return; }
    alert('Nome salvato.');
}

// ═══════════════════════════════════════════════════════════════════════
// BADGE "MESSAGGI NON LETTI" (2026-09-24) — stesso principio di
// aggiornaBadgeMatch() in ui/queue.ui.js (letto per intero in questa
// sessione): un giro ogni 60s, non ad ogni apertura tessera. Aggiorna
// _numChatNonLettiMatch, letta sopra da preview(), e manda UN avviso
// CSBar per messaggio davvero nuovo (stesso concetto di _giaNotificati
// in queue.ui.js, ma un Set a sé qui — quello è privato a quel file).
//
// NON AGGANCIATA al ciclo di polling automatico: avviaPollingWidgetHome()
// (ui/paginainiziale.ui.js, MAI letto in questa sessione) è quello che
// oggi chiama aggiornaBadgeMatch() ogni 60s. Finché non leggo quel file
// o non aggiungi tu la riga, questa funzione va chiamata a mano (es.
// dalla console) o non gira mai automaticamente. Riga da aggiungere in
// ui/paginainiziale.ui.js, ovunque compaia "aggiornaBadgeMatch();" nel
// ciclo di polling lento:
//     aggiornaBadgeMatch();
//     _aggiornaBadgeChatMatch();   // <— AGGIUNTA
//
// CSBar.notify() usato DIRETTO (non CSBar.avvisa()): avvisa() richiede un
// preset già registrato in notificationTypes, passato a CSBar.init() in
// un file che non ho mai letto in questa sessione — notify() prende
// l'oggetto già completo, non serve nessun registro da modificare.
// target: '#match' — stesso pattern già usato e confermato funzionante
// per il widget Set (vedi compilato 2026-09-20). Il click sulla tessera
// nel blocco esteso (_ballAzioneRiga(event,'tab','match'), vedi
// ui/widget-render-corpi.ui.js) segue lo stesso pattern già in uso per
// 'binder' — non ho letto _ballAzioneRiga stessa (vive in
// ui/widget-render-tessere-grandi.ui.js, mai richiesta), quindi questa
// parte è un'inferenza dal pattern esistente, da verificare dal vivo.
let _numChatNonLettiMatch = 0;
const _chatGiaNotificati = new Set();

async function _aggiornaBadgeChatMatch() {
    const userId = await authGetUserId();
    if (!userId) return;

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) { console.error('_aggiornaBadgeChatMatch: errore conversazioni:', errC.message); return; }
    if (!conversazioni || conversazioni.length === 0) { _numChatNonLettiMatch = 0; return; }

    const ids = conversazioni.map(c => c.id);
    const { data: nonLetti, error: errM } = await chatMessaggiNonLettiList(ids, userId);
    if (errM) { console.error('_aggiornaBadgeChatMatch: errore messaggi:', errM.message); return; }

    _numChatNonLettiMatch = (nonLetti || []).length;

    if (typeof CSBar === 'undefined' || !nonLetti) return;
    const nuovi = nonLetti.filter(m => !_chatGiaNotificati.has(m.id));
    if (nuovi.length === 0) return;
    nuovi.forEach(m => _chatGiaNotificati.add(m.id));
    CSBar.notify({
        title: 'Nuovo messaggio',
        text: nuovi.length === 1 ? 'Hai un nuovo messaggio in chat.' : `Hai ${nuovi.length} nuovi messaggi in chat.`,
        target: '#match',
        group: 'chat-match-messaggio',
        groupLabel: 'Messaggi chat',
    });
}
