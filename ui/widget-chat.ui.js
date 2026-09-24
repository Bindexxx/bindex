// ═══════════════════════════════════════════════════════════════════════
// WIDGET-CHAT.UI.JS — tessera + inbox della chat in-app (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// ESTRATTO (2026-09-24, sessione successiva a quella che ha creato la
// chat) da ui/widget-match.ui.js — vedi "nuovo+widget-chat.txt" per il
// piano completo. La chat era nata dentro widget-match.ui.js per
// necessità della sessione in cui è stata scritta (Claudio: "DEVE DARE
// LA POSSIBILITA DI CONTATTARE L'ALTRO UTENTE, SENZA DOXARLO"); questo
// violava il pattern "un widget = un file" e aveva una conseguenza
// funzionale reale, non solo estetica: prima di questo file, l'unico
// modo di aprire una chat era dalla riga di un match ancora attivo — se
// il match spariva (carta tolta dallo Scambio, richiesta conclusa,
// nascosta) la conversazione restava nel DB ma nessuna UI permetteva di
// riaprirla. Questo file aggiunge anche l'INBOX (renderPaginaChat, sotto)
// che risolve il problema: elenca TUTTE le conversazioni dell'utente,
// non solo quelle con un match ancora visibile.
//
// TAGLIA/INCOLLA, non riscrittura, per: variabili di stato,
// apriChat/chiudiChat, _chatAvviaPolling/_chatFermaPolling,
// _chatMessaggioHtml/_chatRenderMessaggi, _chatInviaMessaggioClick,
// _chatBloccaUtenteClick/_chatSegnalaClick, badge non letti, funzioni
// nickname. RINOMINATE in blocco (erano con suffisso "Match", non più
// corretto una volta isolate — vedi nuovo+widget-chat.txt):
//   _chatMatchConversazioneId  -> _chatConversazioneId
//   _chatMatchAltroId          -> _chatAltroId
//   _chatMatchUserId           -> _chatUserId
//   _chatMatchPollingHandle    -> _chatPollingHandle
//   apriChatMatch              -> apriChat
//   chiudiChatMatch            -> chiudiChat
//   _numChatNonLettiMatch      -> _numChatNonLetti
//   _aggiornaBadgeChatMatch    -> _aggiornaBadgeChat
//   _nicknameMatchCaricaSeVuoto -> _nicknameCaricaSeVuoto
//   salvaNicknameMatch          -> salvaNickname
// Ogni chiamante esterno aggiornato di conseguenza: _contattaPersonaMatch
// (widget-match.ui.js) ora chiama apriChat(); index.html (modale, campo
// nickname) aggiornato con gli id/onclick nuovi — vedi consegna.
//
// NICKNAME (imposta_nickname/ottieni_nicknames, sql/71): spostate qui
// per decisione di Claudio (2026-09-24, sessione di estrazione), con
// riserva esplicita di spostarle in un futuro file "impostazioni utente"
// se mai ne nascerà uno — oggi non esiste, e le RPC vivono già in
// data/chat.repository.js (nato per la chat), quindi restano dove sono
// concettualmente più a casa.
//
// TESSERA NUOVA (id catalogo 'chat', mai esistita prima — nessun
// precedente da copiare): Opzione B del mockup approvato da Claudio
// (2026-09-24) — totale non letti in grande + le ultime 3 conversazioni
// con messaggi non letti nel blocco esteso (2x2/1x2), righe cliccabili.
// Corpo grafico in ui/widget-render-corpi.ui.js (_ballCORPI.chat).
//
// ═══════════════════════════════════════════════════════════════════════
// DIPENDENZE — file toccati per far funzionare questo widget (segnalato
// per Regola d'Oro #1, ogni modifica è isolata/additiva):
// - ui/widget-render-corpi.ui.js: _ballCORPI.chat (nuovo), _ballCORPI.match
//   ripulito (tolta la parte aggiunta per la chat, torna a prima).
// - ui/widget-render-condiviso.ui.js: _ballChiedeAttenzione, nuovo caso
//   per id === 'chat' (senza, la tessera non si anima mai anche con
//   badge visibile — la funzione non gestisce widget non elencati).
// - ui/paginainiziale-dettaglio.ui.js: apriDettaglioWidget, 'chat'
//   aggiunta alla whitelist hardcoded + riga
//   `if (tabId === 'chat') renderPaginaChat();` — SENZA questo,
//   l'inbox non si apre mai (né dal tap sulla tessera, né dal click
//   sulla notifica, né dalla riga "Messaggi non letti"). Scoperta
//   durante questa sessione, non prevista dalla spec originale,
//   segnalata e approvata da Claudio prima di procedere.
// - ui/paginainiziale-polling-avvio.ui.js: chiamata rinominata
//   (_aggiornaBadgeChatMatch -> _aggiornaBadgeChat), target della
//   notifica 'chat-messaggio' aggiornato da '#match' a '#chat' (ora che
//   esiste una pagina dedicata). Aprire la conversazione specifica dal
//   click sulla notifica (n.data, mai usato nel progetto) RESTA un
//   punto aperto, non affrontato qui — richiederebbe leggere
//   statusbar.js per intero, mai fatto in nessuna sessione.
// - data/chat.repository.js: due aggiunte additive, nessuna funzione
//   esistente cambiata nel comportamento — chatMessaggiNonLettiList ora
//   seleziona anche 'creato_il' (serve per ordinare le conversazioni
//   per recency nella tessera), e una funzione nuova
//   chatUltimiMessaggiPerConversazioni() per l'anteprima ultimo
//   messaggio nell'inbox. NON era previsto dalla spec ("già generico,
//   non serve toccarlo") — deviazione minima, segnalata qui.
// - index.html: script tag, sezione #chat (inbox, nuova), modale
//   rinominato da #chatMatchModal a #chatModal (con i suoi id interni),
//   campo nickname aggiornato con gli onclick/onfocus nuovi.
//
// PUNTI ANCORA APERTI (non affrontati in questa sessione, invariati da
// nuovo+widget-chat.txt): nessun "sblocca utente" in UI (RPC
// sblocca_utente esiste, mai chiamata); rate limit chat mai testati
// sotto stress; _aggiornaBadgeChat fa 2 query/60s per utente attivo,
// accettabile a 5 persone.
// ───────────────────────────────────────────────────────────────────────

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.chat = {
    titolo: 'Chat', icona: 'fa-comment',
    preview: () => {
        const totale = _numChatNonLetti || 0;
        const conversazioni = _chatUltimeConversazioni || [];
        const dati = { totale, conversazioni };
        if (totale === 0) return { righe: ['Nessun messaggio'], dati };
        // _ballChiedeAttenzione('chat', ...) in
        // ui/widget-render-condiviso.ui.js legge righe[0] per decidere se
        // far "scuotere" la tessera: deve contenere una cifra.
        return { righe: [`${totale} messagg${totale === 1 ? 'io' : 'i'} non lett${totale === 1 ? 'o' : 'i'}`], stato: 'ok', dati };
    },
    azione: (dati, evt) => { apriDettaglioWidget('chat', evt); },
};

// ── INBOX — pagina dedicata (id sezione 'chat', vedi index.html) ───────
// Elenca TUTTE le conversazioni dell'utente (non solo quelle con
// messaggi non letti), ordinate per messaggio più recente. Risolve il
// problema che ha motivato l'estrazione: prima, una chat era
// raggiungibile SOLO dalla riga di un match ancora attivo.
async function renderPaginaChat() {
    const container = document.getElementById('chatInboxLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Carico le conversazioni…</p>';

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento: ${escapeHtml(errC.message)}</p>`;
        return;
    }
    if (!conversazioni || conversazioni.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 0;">Nessuna conversazione ancora.</p>';
        return;
    }

    const ids = conversazioni.map(c => c.id);
    const [{ data: messaggi, error: errMsg }, { data: nonLetti, error: errNL }] = await Promise.all([
        chatUltimiMessaggiPerConversazioni(ids),
        chatMessaggiNonLettiList(ids, userId),
    ]);
    if (errMsg) console.error('renderPaginaChat: errore lettura ultimi messaggi:', errMsg.message);
    if (errNL) console.error('renderPaginaChat: errore lettura non letti:', errNL.message);

    // Ultimo messaggio per conversazione: la query è già ordinata desc,
    // basta prendere il primo che si incontra per ogni conversazione_id.
    const ultimoPerConv = {};
    (messaggi || []).forEach(m => { if (!ultimoPerConv[m.conversazione_id]) ultimoPerConv[m.conversazione_id] = m; });

    const nonLettiPerConv = {};
    (nonLetti || []).forEach(m => { nonLettiPerConv[m.conversazione_id] = (nonLettiPerConv[m.conversazione_id] || 0) + 1; });

    // Nickname in batch per tutti gli "altri" owner distinti — stesso
    // pattern di renderPaginaMatch (widget-match.ui.js).
    const idsAltrui = [...new Set(conversazioni.map(c => (c.owner_a === userId) ? c.owner_b : c.owner_a).filter(Boolean))];
    const nicknameMap = {};
    if (idsAltrui.length > 0) {
        try {
            const { data: nicknamesData, error: errN } = await chatOttieniNicknames(idsAltrui);
            if (errN) console.error('renderPaginaChat: errore lettura nickname:', errN.message);
            else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
        } catch (e) {
            console.error('renderPaginaChat: errore lettura nickname:', e);
        }
    }

    const righe = conversazioni.map(c => {
        const ownerAltro = (c.owner_a === userId) ? c.owner_b : c.owner_a;
        const ultimo = ultimoPerConv[c.id];
        return {
            ownerAltro,
            label: nicknameMap[ownerAltro] || 'Utente',
            ultimoTesto: ultimo ? ultimo.testo : null,
            ultimoMio: ultimo ? ultimo.mittente_id === userId : false,
            ultimoQuando: (ultimo && ultimo.creato_il) || c.creato_il || '',
            nonLetti: nonLettiPerConv[c.id] || 0,
        };
    }).sort((a, b) => String(b.ultimoQuando).localeCompare(String(a.ultimoQuando)));

    container.innerHTML = '<div class="pg-elenco">' + righe.map(r => {
        const labelSafe = escapeHtml(r.label).replace(/'/g, "\\'");
        const anteprima = r.ultimoTesto
            ? `${r.ultimoMio ? 'Tu: ' : ''}${escapeHtml(r.ultimoTesto).slice(0, 60)}${r.ultimoTesto.length > 60 ? '…' : ''}`
            : 'Nessun messaggio ancora — scrivi il primo.';
        return `
        <div class="pg-riga" data-tocca onclick="apriChat('${r.ownerAltro}', '${labelSafe}')">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                    ${escapeHtml(r.label)}
                    ${r.nonLetti > 0 ? `<span class="badge" style="background:var(--primary); color:#fff; border:none;">${r.nonLetti}</span>` : ''}
                </div>
                <div style="font-size:0.76rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${anteprima}</div>
            </div>
        </div>`;
    }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// CHAT — MODALE DELLA SINGOLA CONVERSAZIONE (ESTRATTO 2026-09-24 da
// widget-match.ui.js, dove è nato il 2026-09-24 nella sessione
// precedente — sql/70_chat_match.sql, sql/71 per il nickname,
// data/chat.repository.js per le RPC). Modale #chatModal (index.html,
// rinominato qui da #chatMatchModal), apertura/chiusura via
// style.display come TUTTI gli altri modali del sito. Polling 6s SOLO
// mentre il modale è aperto (si ferma alla chiusura), niente
// subscription realtime — scelta invariata dalla sessione originale.
// ═══════════════════════════════════════════════════════════════════════

let _chatConversazioneId = null;
let _chatAltroId = null;
let _chatUserId = null;
let _chatPollingHandle = null;

async function apriChat(ownerAltro, personaLabel) {
    if (!ownerAltro) return;
    _chatUserId = await authGetUserId();
    if (!_chatUserId) return;

    const modal = document.getElementById('chatModal');
    const titolo = document.getElementById('chatTitolo');
    const box = document.getElementById('chatMessaggi');
    if (!modal || !box) return; // markup non ancora presente in index.html

    _chatAltroId = ownerAltro;
    if (titolo) titolo.innerHTML = `<i class="fa-solid fa-comment"></i> ${escapeHtml(personaLabel || 'Utente')}`;
    box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Apro la chat…</p>';
    modal.style.display = 'flex';

    const { data: convId, error } = await chatOttieniOCreaConversazione(ownerAltro);
    if (error || !convId) {
        box.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem;">${escapeHtml((error && error.message) || 'Errore apertura chat')}</p>`;
        return;
    }
    _chatConversazioneId = convId;
    await _chatRenderMessaggi();
    await chatSegnaLetti(convId);
    _chatAvviaPolling();
}

function chiudiChat() {
    _chatFermaPolling();
    const modal = document.getElementById('chatModal');
    if (modal) modal.style.display = 'none';
    _chatConversazioneId = null;
    _chatAltroId = null;
    // La chat aperta potrebbe aver segnato letti dei messaggi contati nel
    // badge/inbox: se si torna all'inbox o alla home, meglio un
    // aggiornamento subito invece di aspettare i 60s del polling lento.
    if (typeof _aggiornaBadgeChat === 'function') _aggiornaBadgeChat();
}

function _chatAvviaPolling() {
    _chatFermaPolling();
    _chatPollingHandle = setInterval(async () => {
        if (!_chatConversazioneId) return;
        await _chatRenderMessaggi();
        await chatSegnaLetti(_chatConversazioneId);
    }, 6000);
}

function _chatFermaPolling() {
    if (_chatPollingHandle) { clearInterval(_chatPollingHandle); _chatPollingHandle = null; }
}

function _chatMessaggioHtml(m) {
    const mio = m.mittente_id === _chatUserId;
    return `<div style="align-self:${mio ? 'flex-end' : 'flex-start'}; max-width:80%; background:${mio ? 'var(--primary)' : 'var(--primary-light)'}; color:${mio ? '#fff' : 'var(--primary)'}; padding:0.5rem 0.7rem; border-radius:12px; font-size:0.82rem; word-break:break-word; white-space:pre-wrap;">${escapeHtml(m.testo)}</div>`;
}

async function _chatRenderMessaggi() {
    if (!_chatConversazioneId) return;
    const { data, error } = await chatMessaggiList(_chatConversazioneId);
    const box = document.getElementById('chatMessaggi');
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
    const input = document.getElementById('chatInput');
    if (!input || !_chatConversazioneId) return;
    const testo = input.value.trim();
    if (!testo) return;
    input.value = '';
    const { error } = await chatInviaMessaggio(_chatConversazioneId, testo);
    if (error) { alert('Errore invio: ' + error.message); return; }
    await _chatRenderMessaggi();
}

// Blocco preventivo (sql/70: blocchi_chat non richiede una conversazione
// già esistente) — dopo il blocco chiude la chat, coerente con "non
// potrete più scrivervi" mostrato nella conferma.
async function _chatBloccaUtenteClick() {
    if (!_chatAltroId) return;
    if (!confirm('Bloccare questo utente? Non potrete più scrivervi in chat.')) return;
    const { error } = await chatBloccaUtente(_chatAltroId);
    if (error) { alert('Errore: ' + error.message); return; }
    chiudiChat();
}

// La segnalazione è ciò che sblocca la visibilità admin sullo storico
// della conversazione (RLS di sql/70) — non è solo un log, è un evento
// con effetto reale sui permessi.
async function _chatSegnalaClick() {
    if (!_chatConversazioneId) return;
    const motivo = prompt('Motivo della segnalazione (facoltativo):') || null;
    const { error } = await chatSegnalaConversazione(_chatConversazioneId, motivo);
    if (error) { alert('Errore: ' + error.message); return; }
    alert('Segnalazione inviata.');
}

// ── Nickname (impostazioni, sql/71) ───────────────────────────────────
// Chiamata da index.html, sezione "Dati e Privacy" (#impostazioniPagina-
// dati). Caricamento pigro al primo focus (onfocus), non agganciato al
// lifecycle di apertura della pagina impostazioni (vedi nota ereditata
// dalla sessione originale — quel file non è mai stato letto).

let _nicknameCaricato = false;

async function _nicknameCaricaSeVuoto() {
    if (_nicknameCaricato) return;
    _nicknameCaricato = true;
    const input = document.getElementById('nicknameInput');
    if (!input) return;
    const userId = await authGetUserId();
    if (!userId) return;
    try {
        const { data, error } = await userSettingsGet(userId);
        if (!error && data && data.nickname) input.value = data.nickname;
    } catch (e) {
        console.error('_nicknameCaricaSeVuoto: errore lettura:', e);
    }
}

async function salvaNickname() {
    const input = document.getElementById('nicknameInput');
    if (!input) return;
    const { error } = await chatImpostaNickname(input.value.trim() || null);
    if (error) { alert('Errore salvataggio: ' + error.message); return; }
    alert('Nome salvato.');
}

// ═══════════════════════════════════════════════════════════════════════
// BADGE "MESSAGGI NON LETTI" + ANTEPRIMA TESSERA (2026-09-24) — un giro
// ogni 60s (agganciato allo stesso ciclo lento di aggiornaBadgeMatch,
// vedi ui/paginainiziale-polling-avvio.ui.js), non ad ogni apertura
// tessera. Aggiorna due cache lette da CATALOGO_WIDGET.chat.preview()
// sopra — zero query nel preview() stesso, stesso principio "tutto già
// in memoria" usato da tutti gli altri widget con tessera grande.
// CSBar.avvisa('chat-messaggio', ...) per l'avviso — tipo registrato in
// notificationTypes dentro CSBar.init() (ui/paginainiziale-polling-
// avvio.ui.js), target aggiornato da '#match' a '#chat' in questa
// sessione (ora che esiste una pagina dedicata).
// ═══════════════════════════════════════════════════════════════════════
let _numChatNonLetti = 0;
// [{ ownerAltro, label, count }] — le prime 3 conversazioni con
// messaggi non letti, più recenti prima. Letta dal blocco esteso della
// tessera (Opzione B del mockup, _ballCORPI.chat in
// ui/widget-render-corpi.ui.js).
let _chatUltimeConversazioni = [];
const _chatGiaNotificati = new Set();

async function _aggiornaBadgeChat() {
    const userId = await authGetUserId();
    if (!userId) return;

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) { console.error('_aggiornaBadgeChat: errore conversazioni:', errC.message); return; }
    if (!conversazioni || conversazioni.length === 0) { _numChatNonLetti = 0; _chatUltimeConversazioni = []; return; }

    const ids = conversazioni.map(c => c.id);
    const { data: nonLetti, error: errM } = await chatMessaggiNonLettiList(ids, userId);
    if (errM) { console.error('_aggiornaBadgeChat: errore messaggi:', errM.message); return; }

    _numChatNonLetti = (nonLetti || []).length;

    // Raggruppa i non letti per conversazione (conteggio + data del più
    // recente) per l'anteprima nel blocco esteso della tessera — solo le
    // prime 3, ordinate per messaggio più recente.
    const perConversazione = {};
    (nonLetti || []).forEach(m => {
        const voce = (perConversazione[m.conversazione_id] ||= { count: 0, ultimo: '' });
        voce.count++;
        if (m.creato_il > voce.ultimo) voce.ultimo = m.creato_il;
    });
    const conversazioniOrdinate = Object.entries(perConversazione)
        .sort((a, b) => String(b[1].ultimo).localeCompare(String(a[1].ultimo)))
        .slice(0, 3);

    if (conversazioniOrdinate.length === 0) {
        _chatUltimeConversazioni = [];
    } else {
        const proprietarioPerConv = {};
        const idsDaMostrare = new Set(conversazioniOrdinate.map(([id]) => id));
        conversazioni.forEach(c => {
            if (idsDaMostrare.has(String(c.id))) proprietarioPerConv[c.id] = (c.owner_a === userId) ? c.owner_b : c.owner_a;
        });
        const ownerIdsDistinti = [...new Set(Object.values(proprietarioPerConv).filter(Boolean))];
        const nicknameMap = {};
        if (ownerIdsDistinti.length > 0) {
            try {
                const { data: nicknamesData, error: errN } = await chatOttieniNicknames(ownerIdsDistinti);
                if (errN) console.error('_aggiornaBadgeChat: errore nickname:', errN.message);
                else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
            } catch (e) {
                console.error('_aggiornaBadgeChat: errore nickname:', e);
            }
        }
        _chatUltimeConversazioni = conversazioniOrdinate.map(([convId, voce]) => {
            const ownerAltro = proprietarioPerConv[convId];
            return { ownerAltro, label: nicknameMap[ownerAltro] || 'Utente', count: voce.count };
        });
    }

    if (typeof CSBar === 'undefined' || !nonLetti) return;
    const nuovi = nonLetti.filter(m => !_chatGiaNotificati.has(m.id));
    if (nuovi.length === 0) return;
    nuovi.forEach(m => _chatGiaNotificati.add(m.id));
    CSBar.avvisa('chat-messaggio', {
        text: nuovi.length === 1 ? 'Hai un nuovo messaggio in chat.' : `Hai ${nuovi.length} nuovi messaggi in chat.`,
    });
}
