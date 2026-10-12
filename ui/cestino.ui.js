// ── ui/cestino.ui.js ─────────────────────────────────────────────────────
// Cestino (S8, 2026-10-12; sql/98) in Impostazioni → Account e dati: le carte
// e i prodotti sealed eliminati negli ultimi 30 giorni, con "Ripristina" ed
// "Elimina per sempre". Le righe le crea solo il database (trigger): qui si
// leggono, si ripristinano (RPC ripristina_dal_cestino) o si tolgono.
// Finché sql/98 non è eseguito la tabella non esiste: la card resta nascosta.
//
// Si aggiorna all'apertura delle Impostazioni (_impostazioniTornaHub), al
// clic su "Account e dati" (PC) e all'apertura della voce (telefono).
// Eliminazioni definitive: secondo tocco di conferma sul bottone stesso,
// niente finestre del browser.
//
// Dipende da: data/cestino.repository.js, authGetUserId (data/auth.repository.js),
// _urlImmagineVisualizzabile (utils/comuni.js); dopo un ripristino ricarica
// con caricaCarteReali (ui/cards.ui.js) o caricaProdottiSealedReali
// (ui/widget-sealed.ui.js).

const CESTINO_GIORNI = 30;
let _cestinoVoci = [];
let _cestinoInCorso = null; // lettura in corso: aperture ravvicinate = una sola lettura

function cestinoAggiorna() {
    if (_cestinoInCorso) return _cestinoInCorso;
    _cestinoInCorso = _cestinoCarica().finally(() => { _cestinoInCorso = null; });
    return _cestinoInCorso;
}

async function _cestinoCarica() {
    const card = document.getElementById('impCestinoCard');
    if (!card) return;
    let risposta;
    try {
        risposta = await cestinoLista(100);
    } catch (e) {
        risposta = { data: null, error: e };
    }
    const { data, error } = risposta || {};
    if (error) {
        if (_cestinoTabellaAssente(error)) { card.style.display = 'none'; return; }
        console.error('[cestino] lettura:', error.message || error);
        card.style.display = '';
        _cestinoMessaggio('Non riesco a leggere il cestino: riprova tra poco.', true);
        return;
    }
    card.style.display = '';
    // Oltre i 30 giorni la riga sparisce alla prossima eliminazione: qui
    // non si mostra già più.
    const limite = Date.now() - CESTINO_GIORNI * 86400000;
    _cestinoVoci = (data || []).filter(v => {
        const t = new Date(v.eliminato_il).getTime();
        return isNaN(t) || t > limite;
    });
    _cestinoRender();
}

// Tabella non ancora creata (sql/98 non eseguito).
function _cestinoTabellaAssente(error) {
    const codice = String(error && error.code || '');
    const testo = String(error && error.message || '');
    return codice === 'PGRST205' || codice === '42P01' || (/cestino/i.test(testo) && /schema cache|does not exist/i.test(testo));
}

function _cestinoMessaggio(testo, errore) {
    const el = document.getElementById('impCestinoMsg');
    if (!el) return;
    el.textContent = testo || '';
    el.classList.toggle('imp-cestino-msg-errore', !!errore);
    el.style.display = testo ? '' : 'none';
}

function _cestinoRender() {
    const lista = document.getElementById('impCestinoLista');
    const riassunto = document.getElementById('impCestinoRiassunto');
    const svuota = document.getElementById('impCestinoSvuota');
    if (!lista) return;
    const n = _cestinoVoci.length;
    if (riassunto) {
        riassunto.textContent = n
            ? `${n} ${n === 1 ? 'elemento' : 'elementi'}: ognuno resta qui ${CESTINO_GIORNI} giorni, poi sparisce`
            : `Le carte e i sealed che elimini restano qui ${CESTINO_GIORNI} giorni`;
    }
    if (svuota) {
        _cestinoAzzeraConferma(svuota);
        svuota.style.display = n ? '' : 'none';
    }
    lista.textContent = '';
    if (!n) {
        const vuoto = document.createElement('p');
        vuoto.className = 'imp-nota';
        vuoto.textContent = 'Nessun elemento eliminato negli ultimi ' + CESTINO_GIORNI + ' giorni.';
        lista.appendChild(vuoto);
        return;
    }
    const frammento = document.createDocumentFragment();
    _cestinoVoci.forEach(v => frammento.appendChild(_cestinoRiga(v)));
    lista.appendChild(frammento);
}

function _cestinoIcona(tabella) {
    const i = document.createElement('i');
    i.className = tabella === 'carte' ? 'fa-solid fa-clone' : 'fa-solid fa-box';
    return i;
}

function _cestinoNome(v) {
    return v.nome || (v.tabella === 'carte' ? 'Carta senza nome' : 'Prodotto senza nome');
}

function _cestinoDettagli(v) {
    const carta = v.tabella === 'carte';
    const parti = [carta ? 'Carta' : 'Sealed'];
    if (!carta && v.set_espansione) parti.push(v.set_espansione);
    if (v.codice) parti.push(v.codice);
    const qty = Number(v.qty);
    if (qty > 1) parti.push('×' + qty);
    const quando = new Date(v.eliminato_il);
    if (!isNaN(quando.getTime())) {
        parti.push((carta ? 'eliminata' : 'eliminato') + ' il '
            + quando.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
            + ' alle ' + quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
        const restano = CESTINO_GIORNI - Math.floor((Date.now() - quando.getTime()) / 86400000);
        parti.push(restano > 1 ? `ancora ${restano} giorni` : (restano === 1 ? 'ancora 1 giorno' : 'ultimo giorno'));
    }
    return parti.join(' · ');
}

function _cestinoRiga(v) {
    const riga = document.createElement('div');
    riga.className = 'imp-cestino-riga';

    const mini = document.createElement('span');
    mini.className = 'imp-cestino-mini';
    const src = (v.immagine && typeof _urlImmagineVisualizzabile === 'function') ? _urlImmagineVisualizzabile(v.immagine, 80) : null;
    if (src) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => { img.remove(); mini.appendChild(_cestinoIcona(v.tabella)); };
        img.src = src;
        mini.appendChild(img);
    } else {
        mini.appendChild(_cestinoIcona(v.tabella));
    }

    const testo = document.createElement('div');
    testo.className = 'imp-cestino-testo';
    const nome = document.createElement('b');
    nome.textContent = _cestinoNome(v);
    const info = document.createElement('small');
    info.textContent = _cestinoDettagli(v);
    testo.append(nome, info);

    const azioni = document.createElement('div');
    azioni.className = 'imp-cestino-azioni';
    const ripristina = document.createElement('button');
    ripristina.type = 'button';
    ripristina.className = 'btn-main imp-btn';
    ripristina.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Ripristina';
    ripristina.addEventListener('click', () => _cestinoRipristina(v, ripristina));
    const elimina = document.createElement('button');
    elimina.type = 'button';
    elimina.className = 'btn-secondary imp-btn imp-cestino-elimina';
    elimina.title = 'Elimina per sempre';
    elimina.setAttribute('aria-label', 'Elimina per sempre');
    elimina.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    elimina.addEventListener('click', () => _cestinoEliminaUno(v, elimina));
    azioni.append(ripristina, elimina);

    riga.append(mini, testo, azioni);
    return riga;
}

// Primo tocco: il bottone chiede conferma per 4 secondi; secondo tocco: via.
function _cestinoChiediConferma(bottone, testoConferma) {
    if (bottone.dataset.conferma === '1') { _cestinoAzzeraConferma(bottone); return true; }
    bottone._htmlOriginale = bottone.innerHTML;
    bottone.dataset.conferma = '1';
    bottone.classList.add('imp-cestino-conferma');
    bottone.textContent = testoConferma;
    clearTimeout(bottone._timerConferma);
    bottone._timerConferma = setTimeout(() => _cestinoAzzeraConferma(bottone), 4000);
    return false;
}

function _cestinoAzzeraConferma(bottone) {
    clearTimeout(bottone._timerConferma);
    if (bottone.dataset.conferma === '1' && bottone._htmlOriginale != null) bottone.innerHTML = bottone._htmlOriginale;
    delete bottone.dataset.conferma;
    bottone.classList.remove('imp-cestino-conferma');
}

// Rifiuti previsti dalla funzione del database (oggetto già presente o già
// tolto dal cestino): si mostrano così come sono, senza errore in console.
function _cestinoRifiutoPrevisto(error) {
    return /già nella collezione|non trovato nel cestino/i.test(String(error && error.message || ''));
}

async function _cestinoRipristina(v, bottone) {
    if (bottone.disabled) return;
    bottone.disabled = true;
    _cestinoMessaggio('', false);
    let risposta;
    try {
        risposta = await cestinoRipristina(v.id);
    } catch (e) {
        risposta = { error: e };
    }
    const { error } = risposta || {};
    if (error) {
        bottone.disabled = false;
        if (_cestinoRifiutoPrevisto(error)) {
            _cestinoMessaggio(String(error.message) + '.', true);
        } else {
            console.error('[cestino] ripristino:', error.message || error);
            _cestinoMessaggio('Ripristino non riuscito: riprova tra poco.', true);
        }
        return;
    }
    _cestinoVoci = _cestinoVoci.filter(x => x.id !== v.id);
    _cestinoRender();
    _cestinoMessaggio('✓ ' + _cestinoNome(v) + (v.tabella === 'carte' ? ' è tornata dov\'era.' : ' è tornato dov\'era.'), false);
    try {
        if (v.tabella === 'carte' && typeof caricaCarteReali === 'function') await caricaCarteReali();
        if (v.tabella === 'prodotti_sealed' && typeof caricaProdottiSealedReali === 'function') await caricaProdottiSealedReali();
    } catch (e) {
        console.error('[cestino] ricarica dopo il ripristino:', e);
    }
}

async function _cestinoEliminaUno(v, bottone) {
    if (bottone.disabled) return;
    if (!_cestinoChiediConferma(bottone, 'Elimina')) return;
    bottone.disabled = true;
    _cestinoMessaggio('', false);
    let risposta;
    try {
        risposta = await cestinoEliminaDefinitivo(v.id);
    } catch (e) {
        risposta = { error: e };
    }
    const { error } = risposta || {};
    if (error) {
        bottone.disabled = false;
        console.error('[cestino] eliminazione:', error.message || error);
        _cestinoMessaggio('Eliminazione non riuscita: riprova tra poco.', true);
        return;
    }
    _cestinoVoci = _cestinoVoci.filter(x => x.id !== v.id);
    _cestinoRender();
    _cestinoMessaggio('Eliminato per sempre: ' + _cestinoNome(v) + '.', false);
}

async function cestinoSvuotaChiedi() {
    const bottone = document.getElementById('impCestinoSvuota');
    if (!bottone || bottone.disabled) return;
    if (!_cestinoChiediConferma(bottone, 'Tocca di nuovo per svuotare')) return;
    const userId = await authGetUserId();
    if (!userId) return;
    bottone.disabled = true;
    _cestinoMessaggio('', false);
    let risposta;
    try {
        risposta = await cestinoSvuota(userId);
    } catch (e) {
        risposta = { error: e };
    }
    bottone.disabled = false;
    const { error } = risposta || {};
    if (error) {
        console.error('[cestino] svuota:', error.message || error);
        _cestinoMessaggio('Non riesco a svuotare il cestino: riprova tra poco.', true);
        return;
    }
    _cestinoVoci = [];
    _cestinoRender();
    _cestinoMessaggio('Cestino svuotato.', false);
}
