// Widget Chat: tessera e messaggi.

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
        _chatUtenteVietato = false;
    }
    return _chatUtenteVietato;
}
window.addEventListener('load', () => { _chatVerificaAccessoConsentito(); });

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

const _CHAT_RE_URL = /(?:https?:\/\/|www\.)\S+/gi;
const _CHAT_RE_URL_INTERNO = /^(?:https?:\/\/)?(?:www\.)?bindexxx\.github\.io(?:$|[\/?#)\],;!]|\.(?:$|[^a-z0-9\-]))/i;

function _chatContieneLinkEsterno(testo) {
    const trovati = String(testo || '').match(_CHAT_RE_URL);
    if (!trovati) return false;
    return trovati.some(url => !_CHAT_RE_URL_INTERNO.test(url));
}

CATALOGO_WIDGET.chat = {
    titolo: 'Chat', icona: 'fa-comment',
    preview: () => {
        if (_chatUtenteVietato) return { righe: ['Non disponibile'], dati: { totale: 0, conversazioni: [], vietato: true } };
        const totale = _numChatNonLetti || 0;
        const conversazioni = _chatUltimeConversazioni || [];
        const dati = { totale, conversazioni };
        if (totale === 0) return { righe: [_chatLetturaFallita ? '—' : 'Nessun messaggio'], dati };
        return { righe: [`${totale} messagg${totale === 1 ? 'io' : 'i'} nuov${totale === 1 ? 'o' : 'i'}`], stato: 'ok', azioni: totale, dati };
    },
    azione: (dati, evt) => { apriDettaglioWidget('chat', evt); },
};

async function renderPaginaChat() {
    const container = document.getElementById('chatInboxLista');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Carico le conversazioni…</p>';

    const userId = await authGetUserId();
    if (!userId) { container.innerHTML = ''; return; }

    if (await _chatVerificaAccessoConsentito()) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:2rem 1rem;">La chat non è disponibile per questo account.</p>';
        return;
    }

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); font-size:0.85rem; padding:1rem 0;">Errore nel caricamento: ${escapeHtml(errC.message)}</p>`;
        return;
    }

    const { data: bloccati, error: errB } = await chatBlocchiSet(userId);
    if (errB) console.error('renderPaginaChat: errore lettura bloccati:', errB.message);
    const idsBloccatiSet = new Set((bloccati || []).map(b => b.bloccato_id));
    const bloccatiHtml = await _chatRendiSezioneBloccati(bloccati || []);

    if (!conversazioni || conversazioni.length === 0) {
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

    const ultimoPerConv = {};
    (messaggi || []).forEach(m => { if (!ultimoPerConv[m.conversazione_id]) ultimoPerConv[m.conversazione_id] = m; });

    const nonLettiPerConv = {};
    (nonLetti || []).forEach(m => { nonLettiPerConv[m.conversazione_id] = (nonLettiPerConv[m.conversazione_id] || 0) + 1; });

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
        const labelSafe = escapeJsAttr(r.label);
        const anteprima = r.ultimoTesto
            ? `${r.ultimoMio ? 'Tu: ' : ''}${escapeHtml(r.ultimoTesto).slice(0, 60)}${r.ultimoTesto.length > 60 ? '…' : ''}`
            : 'Nessun messaggio ancora — scrivi il primo.';
        const rigaAttrs = r.bloccato ? '' : 'data-tocca onclick="apriChat(\'' + r.ownerAltro + '\', \'' + labelSafe + '\')"';
        const iniziale = (r.label || '?').trim().charAt(0).toUpperCase() || '?';
        return `
        <div class="pg-riga" ${rigaAttrs} style="${r.bloccato ? 'opacity:.6;' : ''}">
            <div class="chat-avatar piccolo" data-avatar-utente="${r.ownerAltro}">${escapeHtml(iniziale)}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                    ${escapeHtml(r.label)}
                    ${r.bloccato ? '<span class="badge">Bloccato</span>' : (r.nonLetti > 0 ? `<span class="badge" style="background:var(--primary); color:var(--on-primary, #fff); border:none;">${r.nonLetti}</span>` : '')}
                </div>
                <div style="font-size:0.76rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${anteprima}</div>
            </div>
        </div>`;
    }).join('') + '</div>' + bloccatiHtml;
    if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(container);
}

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

async function _chatSbloccaClick(bloccatoId) {
    if (!bloccatoId) return;
    if (!(await chiediConferma({ titolo: 'Sbloccare questo utente?', testo: 'Potrete tornare a scrivervi in chat.', conferma: 'Sblocca' }))) return;
    const { error } = await chatSbloccaUtente(bloccatoId);
    if (error) { mostraAvviso('Errore: ' + error.message); return; }
    await renderPaginaChat();
}

let _chatConversazioneId = null;
let _chatAltroId = null;
let _chatUserId = null;
let _chatPollingHandle = null;

let _chatRichiestaAllegata = null;
function apriChatPerRichiesta(ownerAltro, personaLabel, richiestaId) {
    _chatRichiestaAllegata = richiestaId ? { id: richiestaId, altro: ownerAltro } : null;
    return apriChat(ownerAltro, personaLabel);
}

async function apriChat(ownerAltro, personaLabel) {
    if (!ownerAltro) return;
    _chatUserId = await authGetUserId();
    if (!_chatUserId) return;

    if (await _chatVerificaAccessoConsentito()) {
        mostraAvviso('La chat non è disponibile per questo account.');
        return;
    }

    const modal = document.getElementById('chatModal');
    const titolo = document.getElementById('chatTitolo');
    const avatar = document.getElementById('chatAvatar');
    const box = document.getElementById('chatMessaggi');
    if (!modal || !box) return;

    _chatAltroId = ownerAltro;
    const label = personaLabel || 'Utente';
    if (titolo) titolo.textContent = label;
    if (avatar) {
        avatar.textContent = label.trim().charAt(0).toUpperCase() || '?';
        avatar.style.backgroundImage = ''; avatar.classList.remove('con-foto');
        avatar.dataset.avatarUtente = ownerAltro;
        if (typeof fotoProfiloApplica === 'function') fotoProfiloApplica(avatar.parentNode);
    }
    _chatMessaggiRenderatiIds = new Set();
    _chatChiudiMenuFuori();
    box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding-top:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Apro la chat…</p>';
    modal.style.display = 'flex';
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
    _chatChiudiMenuFuori();
    const modal = document.getElementById('chatModal');
    if (modal) modal.style.display = 'none';
    _chatConversazioneId = null;
    _chatAltroId = null;
    _chatRichiestaAllegata = null;
    if (typeof _aggiornaBadgeChat === 'function') _aggiornaBadgeChat();
}

function _chatAvviaPolling() {
    _chatFermaPolling();
    _chatPollingHandle = setInterval(async () => {
        if (!_chatConversazioneId) return;
        if (document.hidden) return;
        await _chatRenderMessaggi();
        await chatSegnaLetti(_chatConversazioneId);
    }, 6000);
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

let _chatMessaggiRenderatiIds = new Set();

function _chatFormattaOra(iso) {
    try { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
}

function _chatEtichettaGiorno(iso) {
    const d = new Date(iso);
    const oggi = new Date();
    const ieri = new Date(oggi);
    ieri.setDate(oggi.getDate() - 1);
    const stessoGiorno = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (stessoGiorno(d, oggi)) return 'Oggi';
    if (stessoGiorno(d, ieri)) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: d.getFullYear() !== oggi.getFullYear() ? 'numeric' : undefined });
}

function _chatLinkifyTesto(testoEscaped) {
    return testoEscaped.replace(/(?:https?:\/\/|www\.)[^\s<]+/gi, (url) => {
        if (!_CHAT_RE_URL_INTERNO.test(url)) return url;
        const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline;">${url}</a>`;
    });
}

function _chatSpuntaHtml(m) {
    if (m.mittente_id !== _chatUserId) return '';
    const letto = !!m.letto_il;
    return `<span class="chat-spunta ${letto ? 'letto' : ''}" title="${letto ? 'Letto' : 'Inviato'}"><i class="fa-solid ${letto ? 'fa-check-double' : 'fa-check'}"></i></span>`;
}

function _chatBubbleHtml(m, isPrimo, isUltimo, isNuovo) {
    const mio = m.mittente_id === _chatUserId;
    const lato = mio ? 'mio' : 'altro';
    const rEsternoAlto = isPrimo ? '16px' : '4px';
    const rEsternoBasso = isUltimo ? '16px' : '4px';
    const radius = mio
        ? `16px ${rEsternoAlto} ${rEsternoBasso} 16px`
        : `${rEsternoAlto} 16px 16px ${rEsternoBasso}`;
    const margine = isPrimo ? '8px' : '2px';
    const testoHtml = _chatLinkifyTesto(escapeHtml(m.testo));
    return `
    <div class="chat-bubble-wrap ${lato}" style="margin-top:${margine};">
        <div class="chat-bubble ${lato}" style="border-radius:${radius};" ${isNuovo ? 'data-nuovo' : ''}>
            ${m.richiesta_etichetta ? `<span class="chat-richiesta"><i class="fa-solid fa-handshake"></i> ${escapeHtml(m.richiesta_etichetta)}</span>` : ''}
            <span>${testoHtml}</span>
            <span class="chat-ora">${_chatFormattaOra(m.creato_il)}</span>
            ${_chatSpuntaHtml(m)}
        </div>
    </div>`;
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
        box.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding-top:1.5rem;"><i class="fa-regular fa-comment-dots" style="font-size:1.6rem; display:block; margin-bottom:0.4rem; opacity:.5;"></i>Nessun messaggio ancora — scrivi il primo.</p>';
        _chatMessaggiRenderatiIds = new Set();
        return;
    }

    const eraVicinoAlFondo = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 60);
    const primaApertura = _chatMessaggiRenderatiIds.size === 0;

    let html = '';
    let giornoCorrente = null;
    data.forEach((m, i) => {
        const etichetta = _chatEtichettaGiorno(m.creato_il);
        if (etichetta !== giornoCorrente) {
            html += `<div class="chat-date-sep">${etichetta}</div>`;
            giornoCorrente = etichetta;
        }
        const prec = data[i - 1];
        const succ = data[i + 1];
        const precStessoGruppo = prec && _chatEtichettaGiorno(prec.creato_il) === etichetta && prec.mittente_id === m.mittente_id;
        const succStessoGruppo = succ && _chatEtichettaGiorno(succ.creato_il) === etichetta && succ.mittente_id === m.mittente_id;
        const isNuovo = !_chatMessaggiRenderatiIds.has(m.id);
        html += _chatBubbleHtml(m, !precStessoGruppo, !succStessoGruppo, isNuovo);
    });
    box.innerHTML = html;
    _chatMessaggiRenderatiIds = new Set(data.map(m => m.id));

    if (primaApertura || eraVicinoAlFondo) box.scrollTop = box.scrollHeight;
}

function _chatToggleMenu(evt) {
    if (evt) evt.stopPropagation();
    const dd = document.getElementById('chatMenuDropdown');
    if (!dd) return;
    const aperto = dd.classList.toggle('aperto');
    if (aperto) setTimeout(() => document.addEventListener('click', _chatChiudiMenuFuori, { once: true }), 0);
}

function _chatChiudiMenuFuori() {
    const dd = document.getElementById('chatMenuDropdown');
    if (dd) dd.classList.remove('aperto');
}

async function _chatInviaMessaggioClick() {
    const input = document.getElementById('chatInput');
    const avviso = document.getElementById('chatAvviso');
    if (!input || !_chatConversazioneId) return;
    const testo = input.value.trim();
    if (!testo) return;

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
    _chatSuInputCambiato();
    const allegata = (_chatRichiestaAllegata && _chatRichiestaAllegata.altro === _chatAltroId) ? _chatRichiestaAllegata.id : null;
    const { error } = await chatInviaMessaggio(_chatConversazioneId, testo, allegata);
    if (error) { mostraAvviso('Errore invio: ' + error.message); return; }
    if (allegata) _chatRichiestaAllegata = null;
    await _chatRenderMessaggi();
}

function _chatInviaFrase(testo) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.value = testo;
    _chatSuInputCambiato();
    _chatInviaMessaggioClick();
}

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
    if (avviso && avviso.style.display !== 'none') avviso.style.display = 'none';
}

async function _chatBloccaUtenteClick() {
    _chatChiudiMenuFuori();
    if (!_chatAltroId) return;
    if (!(await chiediConferma({ titolo: 'Bloccare questo utente?', testo: 'Non potrete più scrivervi in chat.', conferma: 'Blocca', pericolo: true }))) return;
    const { error } = await chatBloccaUtente(_chatAltroId);
    if (error) { mostraAvviso('Errore: ' + error.message); return; }
    chiudiChat();
}

async function _chatSegnalaClick() {
    _chatChiudiMenuFuori();
    if (!_chatConversazioneId) return;
    const scritto = await chiediTesto({ titolo: 'Segnala la conversazione', testo: 'Motivo della segnalazione (facoltativo):', conferma: 'Segnala', maxLength: 500 });
    if (scritto === null) return;
    const motivo = scritto.trim() || null;
    const { error } = await chatSegnalaConversazione(_chatConversazioneId, motivo);
    if (error) { mostraAvviso('Errore: ' + error.message); return; }
    mostraAvviso('Segnalazione inviata.');
}

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
    if (error) { mostraAvviso('Errore salvataggio: ' + error.message); return; }
    mostraAvviso('Nome salvato.');
}

let _numChatNonLetti = 0;
let _chatUltimeConversazioni = [];
let _chatLetturaFallita = false;
const _chatGiaNotificati = new Set();

async function _aggiornaBadgeChat() {
    const userId = await authGetUserId();
    if (!userId) return;

    if (await _chatVerificaAccessoConsentito()) { _numChatNonLetti = 0; _chatUltimeConversazioni = []; return; }

    const { data: conversazioni, error: errC } = await chatConversazioniList(userId);
    if (errC) { _chatLetturaFallita = true; console.error('_aggiornaBadgeChat: errore conversazioni:', errC.message); return; }
    if (!conversazioni || conversazioni.length === 0) { _chatLetturaFallita = false; _numChatNonLetti = 0; _chatUltimeConversazioni = []; return; }

    const ids = conversazioni.map(c => c.id);
    const { data: nonLetti, error: errM } = await chatMessaggiNonLettiList(ids, userId);
    if (errM) { _chatLetturaFallita = true; console.error('_aggiornaBadgeChat: errore messaggi:', errM.message); return; }

    _chatLetturaFallita = false;
    _numChatNonLetti = (nonLetti || []).length;

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

    const perConvNuovi = {};
    nuovi.forEach(m => { (perConvNuovi[m.conversazione_id] ||= []).push(m); });

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

    if (convIdsNuovi.length >= 3) {
        const nomi = [...new Set(convIdsNuovi.map(id => nicknameMapNuovi[proprietarioPerConvNuovi[id]] || 'Utente'))];
        const chi = nomi.length <= 2 ? nomi.join(' e ') : nomi.slice(0, 2).join(', ') + ` e ${nomi.length - 2 === 1 ? 'un altro' : 'altri ' + (nomi.length - 2)}`;
        const totale = convIdsNuovi.reduce((somma, id) => somma + perConvNuovi[id].length, 0);
        CSBar.avvisa('chat-messaggio', { text: `${totale} nuovi messaggi da ${chi}`, group: 'chat-msg-riepilogo' });
        return;
    }
    convIdsNuovi.forEach(convId => {
        const ownerAltro = proprietarioPerConvNuovi[convId];
        const label = nicknameMapNuovi[ownerAltro] || 'Utente';
        const numero = perConvNuovi[convId].length;
        CSBar.avvisa('chat-messaggio', {
            text: numero === 1 ? `${label}: nuovo messaggio` : `${label}: ${numero} nuovi messaggi`,
            group: 'chat-msg-' + convId,
            data: { conversazioneId: convId, ownerAltro, label },
        });
    });
}
