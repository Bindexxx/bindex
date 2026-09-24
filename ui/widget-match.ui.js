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
            const totale = scambio + wishlist;
            const dati = { scambio, wishlist };
            if (totale === 0) return { righe: ['Nessuna novità'], dati };
            // _ballChiedeAttenzione('match', ...) in
            // ui/widget-render-condiviso.ui.js legge righe[0] per decidere
            // se far "scuotere" la tessera: deve contenere una cifra.
            return { righe: [`${totale} nuov${totale === 1 ? 'a' : 'e'} corrispondenz${totale === 1 ? 'a' : 'e'}`], stato: 'ok', dati };
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
// arrivo", confermato da Claudio 2026-08-28). Ora apre la chat in-app —
// apriChat() vive in ui/widget-chat.ui.js (ESTRATTO dalla sessione
// successiva, era apriChatMatch() qui). Questa è l'unica riga toccata
// da quell'estrazione in questo file: se il nome smette di combaciare
// con quello nel file chat, il bottone "Contatta" smette di funzionare
// silenziosamente (nessun errore finché non si prova a cliccarlo).
function _contattaPersonaMatch(ownerAltro, personaLabel) {
    apriChat(ownerAltro, personaLabel);
}
