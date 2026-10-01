// ═══════════════════════════════════════════════════════════════════════
// RICHIESTA-OSPITE.UI.JS — "Richiedi" senza profilo Bindex (pagine pubbliche)
// ═══════════════════════════════════════════════════════════════════════
// RESTYLE BINDEX FASE 8b (2026-10-01, tavole "Richiedi · scegli",
// "Richiesta come ospite", "Richiesta inviata", "Di persona"). Caricato da
// binder-pubblico.html e scaffali-pubblico.html DOPO utils/shared-public.js.
//
// Flusso: Richiedi (senza sessione) → foglio "Ho un profilo Bindex" (login
// di sempre, apriLoginPubblico) | "Continua come ospite" → modulo (nome,
// contatto o "Di persona", messaggio, consenso) → RPC invia_richiesta_ospite
// (sql/88) → codice RQ-XXXX. Con il codice si controlla lo stato dalla
// stessa pagina (leggi_richiesta_ospite: solo vedere, niente annulla).
//
// Il foglio si costruisce al volo dentro #phoneScreen (posizione assoluta,
// come #loginPubblicoModal) e si rimuove alla chiusura: nessun HTML nuovo
// nelle due pagine. Stili in utils/cornice-pubblica.css (.og-*).
//
// Dipende da: carte/selezioni/_tipoOggettoRichiesta/apriLoginPubblico
// (utils/shared-public.js), pubblicoInviaRichiestaOspite/
// pubblicoLeggiRichiestaOspite (data/pubblico.repository.js), escapeHtml/
// formattaEuro/_urlImmagineVisualizzabile (utils/comuni.js).

let _ospiteProprietarioId = null;
let _ospiteContattoTipo = 'whatsapp';

const _OSPITE_CONTATTI = {
    whatsapp:  { etichetta: 'WhatsApp',  icona: 'fa-brands fa-whatsapp',  segnaposto: '+39 333 123 4567', campo: 'fa-solid fa-phone' },
    telegram:  { etichetta: 'Telegram',  icona: 'fa-brands fa-telegram',  segnaposto: '@nomeutente',       campo: 'fa-solid fa-at' },
    instagram: { etichetta: 'Instagram', icona: 'fa-brands fa-instagram', segnaposto: '@nomeutente',       campo: 'fa-solid fa-at' },
    email:     { etichetta: 'Email',     icona: 'fa-solid fa-envelope',   segnaposto: 'nome@esempio.it',   campo: 'fa-solid fa-envelope' },
    persona:   { etichetta: 'Di persona', icona: 'fa-solid fa-handshake', segnaposto: '',                  campo: '' },
};

// ── Utilità ─────────────────────────────────────────────────────────────
function _ospiteNomeProprietario() {
    if (typeof _binderInfo !== 'undefined' && _binderInfo && _binderInfo.nickname) return _binderInfo.nickname;
    if (typeof _scaffaleInfo !== 'undefined' && _scaffaleInfo && _scaffaleInfo.nickname) return _scaffaleInfo.nickname;
    return '';
}
function _ospiteChi() { return _ospiteNomeProprietario() || 'il proprietario'; }
function _ospiteChiMaiuscolo() { const n = _ospiteChi(); return n.charAt(0).toUpperCase() + n.slice(1); }

// Identificativo casuale del dispositivo (solo per i limiti anti-spam e per
// Blocca; non contiene nulla di personale). Se lo storage non c'è, ne usa
// uno per la sola pagina aperta.
let _ospiteDispositivoMemoria = null;
function _ospiteDispositivo() {
    const nuovo = () => {
        try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, ''); } catch (_) { /* sotto */ }
        let s = ''; for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
    };
    try {
        let id = localStorage.getItem('bindexOspiteDispositivo');
        if (!id || id.length < 16) { id = nuovo(); localStorage.setItem('bindexOspiteDispositivo', id); }
        return id;
    } catch (_) {
        if (!_ospiteDispositivoMemoria) _ospiteDispositivoMemoria = nuovo();
        return _ospiteDispositivoMemoria;
    }
}
function _ospiteUltimoCodice() { try { return localStorage.getItem('bindexOspiteUltimoCodice') || ''; } catch (_) { return ''; } }
function _ospiteSalvaCodice(c) { try { localStorage.setItem('bindexOspiteUltimoCodice', c); } catch (_) { /* niente */ } }

// Righe selezionate (stesso calcolo di _richiediScambioDopoLogin) + riepilogo.
function _ospiteSelezione() {
    const righe = [], voci = [], immagini = [];
    let totale = 0;
    carte.forEach(p => {
        const q = selezioni[p.id] || 0;
        if (q > 0) {
            righe.push({ tipo: _tipoOggettoRichiesta, oggetto_id: p.id, quantita: q });
            voci.push(`${p.name || p.code || 'Oggetto'} ×${q}`);
            if (p.immagine && immagini.length < 2) immagini.push(p.immagine);
            totale += q * (Number(p.price) || 0);
        }
    });
    return { righe, voci, immagini, totale };
}

function _ospiteRiepilogoHtml(sel) {
    const mini = sel.immagini.map(src => {
        const u = _urlImmagineVisualizzabile(src, 96);
        return u ? `<img class="og-mini" src="${u}" alt="" onerror="this.remove()">` : '';
    }).join('');
    return `<div class="og-riepilogo">${mini}<span class="og-riep-testo">${escapeHtml(sel.voci.join(', '))}</span>${sel.totale > 0 ? `<b class="og-riep-tot">${formattaEuro(sel.totale)}</b>` : ''}</div>`;
}

// ── Foglio (overlay) ───────────────────────────────────────────────────
function _ospiteFoglio(html) {
    let velo = document.getElementById('ogVelo');
    if (!velo) {
        velo = document.createElement('div');
        velo.id = 'ogVelo';
        velo.className = 'og-velo';
        velo.addEventListener('click', (e) => { if (e.target === velo) chiudiFoglioOspite(); });
        (document.getElementById('phoneScreen') || document.body).appendChild(velo);
        document.addEventListener('keydown', _ospiteSuTasto);
    }
    velo.innerHTML = `<div class="og-foglio" role="dialog" aria-modal="true">${html}</div>`;
    velo.style.display = 'flex';
    return velo;
}
function _ospiteSuTasto(e) { if (e.key === 'Escape') chiudiFoglioOspite(); }
function chiudiFoglioOspite() {
    const velo = document.getElementById('ogVelo');
    if (velo) velo.remove();
    document.removeEventListener('keydown', _ospiteSuTasto);
}
function _ospiteTesta(titolo, indietro) {
    return `<div class="og-testa">
        ${indietro ? `<button type="button" class="og-icobtn" onclick="${indietro}" aria-label="Indietro"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
        <h3>${titolo}</h3>
        <button type="button" class="og-icobtn" onclick="chiudiFoglioOspite()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

// ── 1. Scelta: profilo o ospite ────────────────────────────────────────
// Chiamata da avviaRichiestaScambio (utils/shared-public.js) quando non c'è
// una sessione attiva.
function apriSceltaRichiesta(proprietarioId) {
    _ospiteProprietarioId = proprietarioId;
    const sel = _ospiteSelezione();
    if (!sel.righe.length) { alert('Seleziona almeno un elemento prima di richiedere.'); return; }
    const chi = escapeHtml(_ospiteChi());
    _ospiteFoglio(`
        ${_ospiteTesta(`Invia la richiesta a ${chi}`)}
        ${_ospiteRiepilogoHtml(sel)}
        <button type="button" class="og-scelta" onclick="chiudiFoglioOspite(); apriLoginPubblico();">
            <span class="og-scelta-ico"><i class="fa-solid fa-right-to-bracket"></i></span>
            <span class="og-scelta-testo"><b>Ho un profilo Bindex</b><span>Accedi: la richiesta arriva col tuo nome e la segui dal sito</span></span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="og-scelta og-scelta-forte" onclick="_ospiteApriModulo()">
            <span class="og-scelta-ico"><i class="fa-solid fa-user-clock"></i></span>
            <span class="og-scelta-testo"><b>Continua come ospite</b><span>Senza profilo: lasci un nome e un contatto, ${chi} ti scrive lui</span></span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="og-link" onclick="apriControlloRichiestaOspite()">Hai già un codice RQ? Controlla la tua richiesta</button>`);
}

// ── 2. Modulo ospite ───────────────────────────────────────────────────
function _ospiteApriModulo() {
    const sel = _ospiteSelezione();
    if (!sel.righe.length) { chiudiFoglioOspite(); return; }
    const chi = escapeHtml(_ospiteChi());
    const chips = Object.entries(_OSPITE_CONTATTI).map(([k, c]) =>
        `<button type="button" class="og-chip${k === _ospiteContattoTipo ? ' attivo' : ''}" data-tipo="${k}" onclick="_ospiteScegliContatto('${k}')"><i class="${c.icona}"></i> ${c.etichetta}</button>`).join('');
    _ospiteFoglio(`
        ${_ospiteTesta('Richiesta come ospite', `apriSceltaRichiesta(_ospiteProprietarioId)`)}
        ${_ospiteRiepilogoHtml(sel)}
        <label class="og-etichetta" for="ogNome">Come ti chiami</label>
        <div class="og-campo"><i class="fa-solid fa-user"></i><input type="text" id="ogNome" maxlength="40" autocomplete="given-name" placeholder="Il tuo nome"></div>
        <p class="og-etichetta">Dove ti contatta ${chi}</p>
        <div class="og-chips">${chips}</div>
        <div class="og-campo" id="ogCampoContatto"><i id="ogContattoIco"></i><input type="text" id="ogContatto" maxlength="100" autocomplete="off"></div>
        <div class="og-info" id="ogInfoPersona"><i class="fa-solid fa-circle-info"></i><span>Niente contatto: vi vedete di persona (es. in fumetteria). Dopo l’invio ricevi un codice da mostrare a ${chi}.</span></div>
        <label class="og-etichetta" for="ogMessaggio">Messaggio (facoltativo)</label>
        <textarea id="ogMessaggio" class="og-area" maxlength="300" rows="2" placeholder="Ciao! Posso passare sabato…"></textarea>
        <label class="og-consenso"><input type="checkbox" id="ogConsenso"><span id="ogConsensoTesto"></span></label>
        <p class="og-errore" id="ogErrore" style="display:none;"></p>
        <button type="button" class="og-invia" id="ogInvia" onclick="_ospiteInvia()"><i class="fa-solid fa-paper-plane"></i> Invia richiesta</button>`);
    _ospiteScegliContatto(_ospiteContattoTipo);
    const n = document.getElementById('ogNome'); if (n) n.focus();
}

function _ospiteScegliContatto(tipo) {
    if (!_OSPITE_CONTATTI[tipo]) return;
    _ospiteContattoTipo = tipo;
    document.querySelectorAll('#ogVelo .og-chip').forEach(b => b.classList.toggle('attivo', b.dataset.tipo === tipo));
    const persona = tipo === 'persona';
    const campo = document.getElementById('ogCampoContatto');
    const info = document.getElementById('ogInfoPersona');
    if (campo) campo.style.display = persona ? 'none' : '';
    if (info) info.style.display = persona ? '' : 'none';
    const input = document.getElementById('ogContatto');
    if (input) {
        input.placeholder = _OSPITE_CONTATTI[tipo].segnaposto;
        input.type = tipo === 'email' ? 'email' : (tipo === 'whatsapp' ? 'tel' : 'text');
    }
    const ico = document.getElementById('ogContattoIco');
    if (ico) ico.className = _OSPITE_CONTATTI[tipo].campo;
    const chi = escapeHtml(_ospiteChiMaiuscolo());
    const cons = document.getElementById('ogConsensoTesto');
    if (cons) cons.innerHTML = persona
        ? `${chi} vedrà il tuo nome solo per rispondere a questa richiesta. Si cancella da solo quando la richiesta si chiude.`
        : `${chi} vedrà nome e contatto solo per rispondere a questa richiesta. Si cancellano da soli quando la richiesta si chiude.`;
}

async function _ospiteInvia() {
    const errEl = document.getElementById('ogErrore');
    const mostra = (t) => { if (errEl) { errEl.textContent = t; errEl.style.display = ''; } };
    const nome = (document.getElementById('ogNome')?.value || '').trim();
    const contatto = (document.getElementById('ogContatto')?.value || '').trim();
    const messaggio = (document.getElementById('ogMessaggio')?.value || '').trim();
    const consenso = !!document.getElementById('ogConsenso')?.checked;
    if (!nome) { mostra('Scrivi il tuo nome.'); return; }
    if (_ospiteContattoTipo !== 'persona' && !contatto) { mostra('Scrivi il contatto, oppure scegli "Di persona".'); return; }
    if (_ospiteContattoTipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contatto)) { mostra('Controlla l’indirizzo email.'); return; }
    if (!consenso) { mostra('Spunta la casella per inviare la richiesta.'); return; }
    const sel = _ospiteSelezione();
    if (!sel.righe.length) { mostra('Seleziona almeno un elemento.'); return; }

    const btn = document.getElementById('ogInvia');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio…'; }
    let esito;
    try {
        esito = await pubblicoInviaRichiestaOspite(_ospiteProprietarioId, sel.righe, nome, _ospiteContattoTipo,
            _ospiteContattoTipo === 'persona' ? '' : contatto, messaggio, _ospiteDispositivo());
    } catch (e) {
        esito = { error: { message: e && e.message ? e.message : 'Errore di rete' } };
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Invia richiesta'; }
    if (esito.error || !esito.data) { mostra('❌ ' + ((esito.error && esito.error.message) || 'Invio non riuscito, riprova.')); return; }

    const codice = String(esito.data);
    _ospiteSalvaCodice(codice);
    // Come dopo una richiesta col profilo: selezione svuotata sul posto.
    Object.keys(selezioni).forEach(k => { delete selezioni[k]; });
    if (typeof _refreshVistaCorrente === 'function') _refreshVistaCorrente(); else if (typeof renderLista === 'function') renderLista();
    if (typeof aggiornaTotale === 'function') aggiornaTotale();
    _ospiteMostraInviata(codice, contatto);
    ospiteMostraControllo();
}

// ── 3. Inviata: codice RQ ──────────────────────────────────────────────
function _ospiteMostraInviata(codice, contatto) {
    const chi = escapeHtml(_ospiteChiMaiuscolo());
    const persona = _ospiteContattoTipo === 'persona';
    const dove = persona ? '' : `<b>${escapeHtml(_OSPITE_CONTATTI[_ospiteContattoTipo].etichetta)} ${escapeHtml(contatto)}</b>`;
    const oggetti = _tipoOggettoRichiesta === 'sealed' ? 'i prodotti restano' : 'le carte restano';
    const torna = _tipoOggettoRichiesta === 'sealed' ? 'Torna allo scaffale' : 'Torna al binder';
    _ospiteFoglio(`
        <div class="og-ok">
            <div class="og-ok-segno"><i class="fa-solid fa-check"></i></div>
            <h3>Richiesta inviata!</h3>
            <p>${chi} la vede subito. Se accetta, ${oggetti} da parte per te e ${persona ? 've le scambiate di persona: <b>mostragli questo codice</b>.' : `ti scrive su ${dove}.`}</p>
            <p class="og-ok-etichetta">Il tuo codice richiesta</p>
            <button type="button" class="og-codice" onclick="_ospiteCopiaCodice('${escapeHtml(codice)}', this)" aria-label="Copia il codice">${escapeHtml(codice)} <i class="fa-regular fa-copy"></i></button>
            <p class="og-nota">Con il codice puoi controllare se è stata accettata, da questa stessa pagina.</p>
            <button type="button" class="og-invia" onclick="chiudiFoglioOspite()">${torna}</button>
        </div>`);
}

async function _ospiteCopiaCodice(codice, btn) {
    try { await navigator.clipboard.writeText(codice); if (btn) { btn.classList.add('copiato'); setTimeout(() => btn.classList.remove('copiato'), 1200); } }
    catch (_) { prompt('Copia il codice:', codice); }
}

// ── 4. Controlla con il codice ─────────────────────────────────────────
const _OSPITE_STATI = {
    in_attesa: { testo: 'In attesa', cls: 'att' },
    accettata: { testo: 'Riservata per te', cls: 'ris' },
    rifiutata: { testo: 'Rifiutata', cls: 'ko' },
    annullata: { testo: 'Annullata', cls: 'ko' },
    conclusa:  { testo: 'Conclusa', cls: 'ok' },
};
const _OSPITE_MOTIVI = {
    scaduta: 'scaduta dopo 7 giorni senza risposta',
    bloccato: 'non più disponibile',
    non_piu_disponibile: 'non più disponibile',
    accordo_non_concluso: 'accordo non concluso',
    ho_cambiato_idea: 'il proprietario ha cambiato idea',
    errore_prenotazione: 'errore nella prenotazione',
    sostituito_altro_accordo: 'sostituita da un altro accordo',
    intervento_amministrativo: 'intervento amministrativo',
};

function apriControlloRichiestaOspite() {
    _ospiteFoglio(`
        ${_ospiteTesta('Controlla la tua richiesta')}
        <label class="og-etichetta" for="ogCodice">Codice richiesta</label>
        <div class="og-campo"><i class="fa-solid fa-hashtag"></i><input type="text" id="ogCodice" maxlength="8" autocomplete="off" placeholder="RQ-XXXX" value="${escapeHtml(_ospiteUltimoCodice())}" onkeydown="if(event.key==='Enter') _ospiteControlla()"></div>
        <p class="og-errore" id="ogErrore" style="display:none;"></p>
        <button type="button" class="og-invia" id="ogControllaBtn" onclick="_ospiteControlla()"><i class="fa-solid fa-magnifying-glass"></i> Controlla</button>
        <div id="ogStato"></div>`);
}

async function _ospiteControlla() {
    const input = document.getElementById('ogCodice');
    const out = document.getElementById('ogStato');
    const errEl = document.getElementById('ogErrore');
    if (!input || !out) return;
    const codice = input.value.trim().toUpperCase();
    if (errEl) errEl.style.display = 'none';
    if (!codice) return;
    out.innerHTML = '<p class="og-nota"><i class="fa-solid fa-spinner fa-spin"></i> Controllo…</p>';
    let esito;
    try { esito = await pubblicoLeggiRichiestaOspite(codice); } catch (e) { esito = { error: { message: e.message } }; }
    if (esito.error) { out.innerHTML = ''; if (errEl) { errEl.textContent = '❌ ' + esito.error.message; errEl.style.display = ''; } return; }
    const righe = esito.data || [];
    if (!righe.length) { out.innerHTML = '<p class="og-nota">Nessuna richiesta con questo codice. Controlla di averlo scritto bene (es. RQ-7F3K).</p>'; return; }
    _ospiteSalvaCodice(codice.startsWith('RQ-') ? codice : 'RQ-' + codice.replace(/^RQ/, ''));
    const chi = righe[0].proprietario_nickname ? escapeHtml(righe[0].proprietario_nickname) : 'il proprietario';
    const data = new Date(righe[0].creato_il);
    out.innerHTML = `
        <p class="og-nota">Richiesta a <b>${chi}</b>${isNaN(data) ? '' : ` del ${data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`}</p>
        <div class="og-stato-lista">${righe.map(r => {
            const st = _OSPITE_STATI[r.stato_riga] || { testo: r.stato_riga, cls: '' };
            const motivo = r.motivo_chiusura && _OSPITE_MOTIVI[r.motivo_chiusura] ? ` · ${_OSPITE_MOTIVI[r.motivo_chiusura]}` : '';
            const u = _urlImmagineVisualizzabile(r.immagine, 96);
            return `<div class="og-stato-riga">${u ? `<img class="og-mini" src="${u}" alt="" onerror="this.remove()">` : '<span class="og-mini og-mini-vuota"><i class="fa-solid fa-image"></i></span>'}
                <span class="og-stato-nome"><b>${escapeHtml(r.nome || 'Oggetto')}</b><span>×${r.quantita}${r.prezzo != null ? ` · ${formattaEuro(r.prezzo)} cad.` : ''}${motivo}</span></span>
                <span class="og-pill ${st.cls}">${st.testo}</span></div>`;
        }).join('')}</div>
        <p class="og-nota">Le richieste non accettate entro 7 giorni scadono da sole.</p>`;
}

// Link "Hai un codice RQ? Controlla" sotto il titolo delle pagine Scambio.
// Chiamata dalle pagine quando il bottone Richiedi è visibile, e dopo un invio.
function ospiteMostraControllo() {
    if (document.getElementById('ogLinkControllo')) return;
    const dopo = document.getElementById('statRiepilogo');
    if (!dopo || !dopo.parentNode) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'ogLinkControllo';
    b.className = 'og-link og-link-testata';
    b.innerHTML = '<i class="fa-solid fa-receipt"></i> Hai un codice richiesta? Controlla';
    b.onclick = apriControlloRichiestaOspite;
    dopo.parentNode.insertBefore(b, dopo.nextSibling);
}
