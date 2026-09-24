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
//   notifica 'chat-messaggio' aggiornato da '#match' a '#chat'.
//   AGGIORNATO (2026-09-24, giro di migliorie): onNotificationClick ora
//   apre anche la conversazione specifica, non solo l'inbox — letto
//   statusbar.js per intero per farlo bene (n.data esiste davvero ma
//   NON sopravvive a un refresh, e un 'group' condiviso tra
//   conversazioni diverse avrebbe agganciato 'data' alla persona
//   sbagliata — vedi i commenti puntuali in _aggiornaBadgeChat sotto e
//   in paginainiziale-polling-avvio.ui.js).
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
// PUNTI ANCORA APERTI (aggiornato — vedi anche i commenti puntuali sopra
// per quelli risolti in questo giro di migliorie, 2026-09-24): rate
// limit chat mai testati sotto stress; _aggiornaBadgeChat fa 2-3
// query/60s per utente attivo, accettabile a 5 persone. Il click sulla
// riga della tessera (_ballAzioneRiga, caso 'chat-conversazione' in
// ui/widget-render-tessere-grandi.ui.js) e quello sulla notifica CSBar
// aprono entrambi ora la conversazione specifica — risolto in questo
// giro.
//
// GIRO SUCCESSIVO STESSO GIORNO (2026-09-24, "va ricontrollato tutto, va
// visto il lato server" — sql/72_chat_restrizioni_e_moderazione.sql):
// tutte e tre le restrizioni sotto (minorenni, parolacce, link esterni)
// sono ora ANCHE applicate dentro invia_messaggio/
// ottieni_o_crea_conversazione sul DB — non più scavalcabili chiamando
// le RPC direttamente. Il flag minorenne non è più un array hardcoded
// qui: vive in chat_restrizioni_utente (sql/72), scritto SOLO dall'admin
// via ui/admin-users.ui.js (checkbox nella modale utente) +
// data/admin.repository.js (adminChatRestrizioneGet/
// adminChatImpostaMinorenne). Le liste parolacce/link restano duplicate
// tra qui e sql/72 per scelta esplicita (Regola d'Oro #1) — vanno
// allineate A MANO se Claudio amplia una delle due, nessun meccanismo le
// sincronizza.
// ───────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// RESTRIZIONI D'USO (2026-09-24, richiesta esplicita di Claudio) — DOPO
// sql/72 (2026-09-24, stesso giorno, giro successivo: "va ricontrollato
// tutto, va visto il lato server") la barriera VERA è dentro le RPC
// invia_messaggio/ottieni_o_crea_conversazione sul DB. Quanto sotto resta
// solo un primo avviso lato client (UX: non far scoprire il blocco solo
// dopo il tentativo di invio) — chiunque chiami le RPC direttamente
// (console del browser, Postman) trova comunque il controllo server-side,
// non più scavalcabile.
// ═══════════════════════════════════════════════════════════════════════

// ── 1) ACCESSO VIETATO AI MINORENNI — flag letto da chat_restrizioni_utente
// (sql/72), marcato manualmente dall'admin nel pannello utenti
// (ui/admin-users.ui.js, checkbox "Utente minorenne") — non più un array
// hardcoded qui: da questo giro il flag vive sul DB, scrittura riservata
// agli admin via RLS (verificata dal vivo prima di sql/72). Wrapper in
// data/chat.repository.js (chatRestrizioneUtente), mai supabaseClient
// diretto qui — pattern del progetto (UI -> repository).
let _chatUtenteVietato = false;

async function _chatVerificaAccessoConsentito() {
    try {
        const userId = await authGetUserId();
        if (!userId) { _chatUtenteVietato = false; return _chatUtenteVietato; }
        const { data, error } = await chatRestrizioneUtente(userId);
        if (error) throw error;
        _chatUtenteVietato = !!(data && data.minorenne);
    } catch (e) {
        console.error('_chatVerificaAccessoConsentito: errore lettura restrizione:', e);
        // In dubbio NON blocca lato client: un errore di rete/sessione
        // qui non nega l'accesso a chi ha diritto di usarlo — resta
        // comunque coperto dal controllo server-side in sql/72 se il
        // flag fosse davvero true.
        _chatUtenteVietato = false;
    }
    return _chatUtenteVietato;
}
// Fire-and-forget al caricamento dello script, così il flag è già
// popolato (quando possibile) prima del primo render della tessera —
// stesso principio "tutto già in cache" usato da _aggiornaBadgeChat più
// sotto. Ricontrollato comunque ad ogni giro di quella funzione e ad
// ogni apertura della chat/inbox, quindi un mancato aggiornamento qui
// (sessione non ancora pronta a tempo di caricamento script) si
// autocorregge al primo giro utile.
_chatVerificaAccessoConsentito();

// ── 2) FILTRO PAROLACCE — lista non esaustiva, pensata per un gruppo di
// amici/famiglia, non per moderazione professionale: meglio accettare
// qualche falso negativo che bloccare frasi innocue per un falso
// positivo. \b per non colpire sottostringhe dentro parole innocue.
// Claudio può ampliare l'elenco liberamente.
const _CHAT_PAROLE_VIETATE = [
    'cazzo', 'cazzata', 'cazzone', 'stronzo', 'stronza', 'puttana', 'troia',
    'merda', 'merdoso', 'vaffanculo', 'bastardo', 'bastarda', 'coglione',
    'cogliona', 'porco dio', 'porca madonna', 'zoccola', 'figlio di puttana',
];

function _chatContieneParolacce(testo) {
    const normalizzato = String(testo || '').toLowerCase();
    return _CHAT_PAROLE_VIETATE.some(p => {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('\\b' + escaped + '\\b', 'i').test(normalizzato);
    });
}

// ── 3) SOLO LINK INTERNI A BINDEX — qualunque URL (http/https/www.) è
// bloccato a meno che non contenga il dominio del sito. Regex volutamente
// permissiva nel riconoscere "è un link" (meglio bloccare un falso
// positivo raro che lasciar passare un link vero non riconosciuto),
// rigida sul dominio consentito.
const _CHAT_DOMINIO_CONSENTITO = 'bindexxx.github.io';

function _chatContieneLinkEsterno(testo) {
    const trovati = String(testo || '').match(/\b(?:https?:\/\/|www\.)\S+/gi);
    if (!trovati) return false;
    return trovati.some(url => !url.toLowerCase().includes(_CHAT_DOMINIO_CONSENTITO));
}

// ── VOCE DI CATALOGO ──────────────────────────────────────────────────
CATALOGO_WIDGET.chat = {
    titolo: 'Chat', icona: 'fa-comment',
    preview: () => {
        // AGGIUNTO (2026-09-24): tessera "spenta" per chi è nella lista
        // vietati — niente conteggi/anteprime, anche se ci fossero
        // messaggi non letti davvero.
        if (_chatUtenteVietato) return { righe: ['Non disponibile'], dati: { totale: 0, conversazioni: [], vietato: true } };
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

    // AGGIUNTO (2026-09-24): ricontrollato ad ogni apertura, non solo
    // dalla cache popolata al caricamento script — vedi nota in cima al
    // file.
    if (await _chatVerificaAccessoConsentito()) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 1rem;">La chat non è disponibile per questo account.</p>';
        return;
    }

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento: ${escapeHtml(errC.message)}</p>`;
        return;
    }

    // AGGIUNTO (2026-09-24, giro di migliorie post-estrazione): letto UNA
    // volta qui, condiviso da _chatRendiSezioneBloccati (sotto) E dalle
    // righe delle conversazioni (badge "Bloccato" più giù) — una sola
    // query invece di due. sql/70: blocchi_chat NON richiede una
    // conversazione esistente, quindi va letta anche quando
    // 'conversazioni' è vuoto (utente che ha bloccato qualcuno prima di
    // scrivergli mai). Per questo il caso "nessuna conversazione" qui
    // sotto non fa più return immediato: costruisce comunque la sezione
    // bloccati, se c'è qualcosa da mostrare.
    const { data: bloccati, error: errB } = await chatBlocchiSet(userId);
    if (errB) console.error('renderPaginaChat: errore lettura bloccati:', errB.message);
    const idsBloccatiSet = new Set((bloccati || []).map(b => b.bloccato_id));
    const bloccatiHtml = await _chatRendiSezioneBloccati(bloccati || []);

    if (!conversazioni || conversazioni.length === 0) {
        // AGGIORNATO (2026-09-24, giro di migliorie): l'inbox da sola non
        // ha un modo di avviare una conversazione con qualcuno di nuovo —
        // si parte sempre dal bottone "Contatta" su una riga di Match.
        // Il messaggio lo dice esplicitamente invece di lasciare una
        // pagina vuota senza indicazioni.
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 1rem;">Nessuna conversazione ancora.<br>Scrivi a qualcuno dal bottone "Contatta" su una corrispondenza in Match.</p>' + bloccatiHtml;
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
            bloccato: idsBloccatiSet.has(ownerAltro),
        };
    }).sort((a, b) => String(b.ultimoQuando).localeCompare(String(a.ultimoQuando)));

    container.innerHTML = '<div class="pg-elenco">' + righe.map(r => {
        const labelSafe = escapeHtml(r.label).replace(/'/g, "\\'");
        const anteprima = r.ultimoTesto
            ? `${r.ultimoMio ? 'Tu: ' : ''}${escapeHtml(r.ultimoTesto).slice(0, 60)}${r.ultimoTesto.length > 60 ? '…' : ''}`
            : 'Nessun messaggio ancora — scrivi il primo.';
        // AGGIUNTO (2026-09-24): una conversazione con un utente bloccato
        // resta nella lista (la RLS della RPC blocca comunque l'invio, non
        // la lettura dello storico) ma senza click che riapre il modale —
        // "Bloccato" al posto del bottone non letti, coerente con
        // l'assenza di "sblocca" qui: si sblocca dalla sezione dedicata
        // sotto.
        const rigaAttrs = r.bloccato ? '' : 'data-tocca onclick="apriChat(\'' + r.ownerAltro + '\', \'' + labelSafe + '\')"';
        return `
        <div class="pg-riga" ${rigaAttrs} style="${r.bloccato ? 'opacity:.6;' : ''}">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                    ${escapeHtml(r.label)}
                    ${r.bloccato ? '<span class="badge">Bloccato</span>' : (r.nonLetti > 0 ? `<span class="badge" style="background:var(--primary); color:#fff; border:none;">${r.nonLetti}</span>` : '')}
                </div>
                <div style="font-size:0.76rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${anteprima}</div>
            </div>
        </div>`;
    }).join('') + '</div>' + bloccatiHtml;
}

// Sezione "Utenti bloccati" dell'inbox — SOLO sblocco (bloccare resta nel
// modale della conversazione, _chatBloccaUtenteClick sotto). Ritorna
// stringa vuota se l'utente non ha bloccato nessuno: niente sezione
// vuota a ingombrare la pagina. chatBlocchiSet/chatSbloccaUtente erano
// già pronte in data/chat.repository.js (sql/70) — mai collegate a
// nessuna UI fino a questo giro di migliorie. Riceve 'bloccati' già
// letto da renderPaginaChat (una sola query condivisa, vedi sopra).
async function _chatRendiSezioneBloccati(bloccati) {
    if (!bloccati || bloccati.length === 0) return '';

    const idsBloccati = bloccati.map(b => b.bloccato_id);
    const nicknameMap = {};
    try {
        const { data: nicknamesData, error: errN } = await chatOttieniNicknames(idsBloccati);
        if (errN) console.error('_chatRendiSezioneBloccati: errore lettura nickname:', errN.message);
        else (nicknamesData || []).forEach(n => { if (n.nickname) nicknameMap[n.owner_id] = n.nickname; });
    } catch (e) {
        console.error('_chatRendiSezioneBloccati: errore lettura nickname:', e);
    }

    return `
        <div class="pg-titoletto" style="margin-top:1.2rem;">Utenti bloccati</div>
        <div class="pg-elenco">
            ${idsBloccati.map(id => `
            <div class="pg-riga">
                <span style="flex:1; min-width:0; font-size:0.85rem;">${escapeHtml(nicknameMap[id] || 'Utente')}</span>
                <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.35rem 0.6rem; flex-shrink:0;" onclick="_chatSbloccaClick('${id}')">Sblocca</button>
            </div>`).join('')}
        </div>`;
}

// Chiamata dal bottone "Sblocca" sopra. Ridisegna l'intera inbox al
// termine (stesso principio di _chatBloccaUtenteClick/chiudiChat: dopo
// un'azione che cambia lo stato di blocco, la vista si aggiorna subito
// invece di aspettare il prossimo giro di polling).
async function _chatSbloccaClick(bloccatoId) {
    if (!bloccatoId) return;
    if (!confirm('Sbloccare questo utente? Potrete tornare a scrivervi in chat.')) return;
    const { error } = await chatSbloccaUtente(bloccatoId);
    if (error) { alert('Errore: ' + error.message); return; }
    await renderPaginaChat();
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

    // AGGIUNTO (2026-09-24): blocco prima ancora di aprire il modale —
    // vedi nota in cima al file (solo lato client per ora).
    if (await _chatVerificaAccessoConsentito()) {
        alert('La chat non è disponibile per questo account.');
        return;
    }

    const modal = document.getElementById('chatModal');
    const titolo = document.getElementById('chatTitolo');
    const box = document.getElementById('chatMessaggi');
    if (!modal || !box) return; // markup non ancora presente in index.html

    _chatAltroId = ownerAltro;
    if (titolo) titolo.innerHTML = `<i class="fa-solid fa-comment"></i> ${escapeHtml(personaLabel || 'Utente')}`;
    box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Apro la chat…</p>';
    modal.style.display = 'flex';
    // AGGIUNTO (2026-09-24, giro di migliorie): svuota l'input e
    // ridisabilita il bottone invio ad ogni apertura — senza questo, un
    // testo digitato ma non inviato in una conversazione precedente
    // resterebbe nel campo alla riapertura su UN'ALTRA persona, rischio
    // concreto di inviarlo al destinatario sbagliato per errore.
    const inputApertura = document.getElementById('chatInput');
    if (inputApertura) inputApertura.value = '';
    _chatSuInputCambiato();

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
        // AGGIUNTO (2026-09-24, giro di migliorie): niente giri sprecati
        // se la tab/app è in background (schermo spento, altra app in
        // primo piano su mobile) — document.hidden è vero in quel caso.
        // Risparmia rete/batteria senza cambiare il comportamento quando
        // la chat è davvero visibile.
        if (document.hidden) return;
        await _chatRenderMessaggi();
        await chatSegnaLetti(_chatConversazioneId);
    }, 6000);
    // Al ritorno in primo piano con la chat ancora aperta, aggiorna
    // subito invece di aspettare fino a 6s del prossimo giro — l'utente
    // potrebbe aver perso messaggi arrivati mentre era in background.
    document.addEventListener('visibilitychange', _chatSuVisibilitaCambiata);
}

function _chatFermaPolling() {
    if (_chatPollingHandle) { clearInterval(_chatPollingHandle); _chatPollingHandle = null; }
    document.removeEventListener('visibilitychange', _chatSuVisibilitaCambiata);
}

async function _chatSuVisibilitaCambiata() {
    if (document.hidden || !_chatConversazioneId) return;
    await _chatRenderMessaggi();
    await chatSegnaLetti(_chatConversazioneId);
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
    const avviso = document.getElementById('chatAvviso');
    if (!input || !_chatConversazioneId) return;
    const testo = input.value.trim();
    if (!testo) return;

    // AGGIUNTO (2026-09-24): filtri di moderazione — vedi nota in cima al
    // file, solo lato client per ora. Il messaggio NON viene inviato e
    // resta nel campo (l'utente può correggerlo), a differenza degli
    // errori RPC sotto che invece svuotano il campo perché il tentativo
    // di invio è già partito.
    if (_chatContieneParolacce(testo)) {
        if (avviso) { avviso.textContent = 'Messaggio non inviato: contiene linguaggio non consentito.'; avviso.style.display = 'block'; }
        return;
    }
    if (_chatContieneLinkEsterno(testo)) {
        if (avviso) { avviso.textContent = 'Messaggio non inviato: sono ammessi solo link interni a Bindex.'; avviso.style.display = 'block'; }
        return;
    }
    if (avviso) avviso.style.display = 'none';

    input.value = '';
    _chatSuInputCambiato(); // ridisabilita il bottone/svuota il contatore subito, non aspetta il prossimo input dell'utente
    const { error } = await chatInviaMessaggio(_chatConversazioneId, testo);
    if (error) { alert('Errore invio: ' + error.message); return; }
    await _chatRenderMessaggi();
}

// Bottone invio disabilitato a campo vuoto (evita l'invio di un
// messaggio bianco per doppio tap accidentale) + contatore caratteri,
// visibile solo avvicinandosi al limite (maxlength 2000 in index.html) —
// sotto quella soglia resterebbe solo rumore visivo per un messaggio
// normale. Chiamata da oninput sull'input (index.html), da apriChat()
// per partire nello stato corretto, e da _chatInviaMessaggioClick() dopo
// l'invio.
function _chatSuInputCambiato() {
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('chatInviaBtn');
    const contatore = document.getElementById('chatContatore');
    const avviso = document.getElementById('chatAvviso');
    if (!input) return;
    const lunghezza = input.value.length;
    if (btn) btn.disabled = input.value.trim().length === 0;
    if (contatore) {
        contatore.textContent = lunghezza >= 1800 ? `${lunghezza}/2000` : '';
        contatore.style.color = lunghezza >= 1950 ? 'var(--danger)' : 'var(--text-muted)';
    }
    // Nasconde l'avviso di un blocco precedente (parolacce/link) appena
    // l'utente ricomincia a modificare il testo — non deve restare lì a
    // ingombrare dopo che ha corretto il messaggio.
    if (avviso && avviso.style.display !== 'none') avviso.style.display = 'none';
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

    // AGGIUNTO (2026-09-24): tiene aggiornato il flag letto da
    // CATALOGO_WIDGET.chat.preview() (sincrona, non può controllare da
    // sola) — stesso principio "tutto già in cache" del resto di questa
    // funzione. Se è vietato, azzera anche i contatori: niente numeri
    // residui sulla tessera per chi non può comunque aprirla.
    if (await _chatVerificaAccessoConsentito()) { _numChatNonLetti = 0; _chatUltimeConversazioni = []; return; }

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

    // AGGIORNATO (2026-09-24, giro di migliorie): una notifica PER
    // CONVERSAZIONE con messaggi davvero nuovi, non più una sola
    // cumulativa — necessario per aprire la conversazione giusta al
    // click (vedi onNotificationClick, ui/paginainiziale-polling-
    // avvio.ui.js). 'group' è per-conversazione (chat-msg-<id>): letto
    // in statusbar.js che quando due notifiche condividono lo stesso
    // group, il ramo di raggruppamento aggiorna testo/target della
    // notifica esistente ma MAI il campo 'data' — con un group
    // condiviso tra conversazioni diverse, il click su una notifica
    // aggiornata avrebbe riaperto la conversazione della PRIMA persona
    // che aveva scritto, non dell'ultima. Con un group per conversazione
    // il problema non si pone: 'data' è identico ad ogni aggiornamento
    // della stessa conversazione.
    const perConvNuovi = {};
    nuovi.forEach(m => { (perConvNuovi[m.conversazione_id] ||= []).push(m); });

    // Serve owner/nickname anche per conversazioni FUORI dalle prime 3
    // mostrate sulla tessera (_chatUltimeConversazioni sopra si ferma a
    // 3): chi scrive per quarto non deve restare senza notifica
    // cliccabile.
    const convIdsNuovi = Object.keys(perConvNuovi);
    const proprietarioPerConvNuovi = {};
    conversazioni.forEach(c => { if (convIdsNuovi.includes(String(c.id))) proprietarioPerConvNuovi[c.id] = (c.owner_a === userId) ? c.owner_b : c.owner_a; });
    const ownerIdsNuovi = [...new Set(Object.values(proprietarioPerConvNuovi).filter(Boolean))];
    const nicknameMapNuovi = {};
    if (ownerIdsNuovi.length > 0) {
        try {
            const { data: nicknamesData2, error: errN2 } = await chatOttieniNicknames(ownerIdsNuovi);
            if (errN2) console.error('_aggiornaBadgeChat: errore nickname (notifiche):', errN2.message);
            else (nicknamesData2 || []).forEach(n => { if (n.nickname) nicknameMapNuovi[n.owner_id] = n.nickname; });
        } catch (e) {
            console.error('_aggiornaBadgeChat: errore nickname (notifiche):', e);
        }
    }

    convIdsNuovi.forEach(convId => {
        const ownerAltro = proprietarioPerConvNuovi[convId];
        const label = nicknameMapNuovi[ownerAltro] || 'Utente';
        const numero = perConvNuovi[convId].length;
        CSBar.avvisa('chat-messaggio', {
            text: numero === 1 ? `${label}: nuovo messaggio` : `${label}: ${numero} nuovi messaggi`,
            group: 'chat-msg-' + convId,
            // Letto da onNotificationClick (ui/paginainiziale-polling-
            // avvio.ui.js) per aprire direttamente questa conversazione
            // invece della sola inbox. NOTA: CSBar persiste le notifiche
            // in localStorage (persist:true) ma NON il campo 'data'
            // (verificato in statusbar.js, writeNow() non lo
            // serializza) — dopo un refresh/riapertura la notifica resta
            // cliccabile ma degrada ad aprire solo la lista, mai un
            // errore.
            data: { conversazioneId: convId, ownerAltro, label },
        });
    });
}
