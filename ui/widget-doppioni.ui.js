// ═══════════════════════════════════════════════════════════════════════
// WIDGET-DOPPIONI.UI.JS — tessera + pagina "Doppioni" (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// RISCRITTO (sessione 2026-09-18, "doppioni-split"). Cambio di modello
// dalla versione precedente (riga singola con qty>1, mai spostata
// davvero): oggi una carta/box può esistere su PIÙ righe fisiche nella
// stessa tabella (dopo uno split di questa stessa pagina), quindi un
// "doppione" è un GRUPPO di righe con la stessa identità la cui qty
// sommata è > 1 — non più una riga singola.
//
// Bug corretto in questa sessione (mai risolto prima): "Sposta in
// Scambio" non spostava/splittava nulla, si limitava a taggare una
// quantità offerta sulla riga condivisa (_quantitaOfferteScambio) senza
// mai toccare carteReali — la pagina Doppioni continuava quindi a
// mostrare la qty intera. Ora lo split è reale (righe fisiche separate,
// vedi _doppioniSplitCarta/_doppioniSplitBox sotto).
//
// COSA RESTA FUORI (non toccato):
// - apriFlipCardHome/toggleFlipCard/vaiAllaCartaNelBinder (ui/flip-card-
//   detail.ui.js) — usata QUI SENZA opzioni.doppione (quindi il vecchio
//   bottone "Gestisci doppione"/_mostraSceltaGestisciDoppione nell'overlay
//   del flip non compare più da questa pagina: sostituito dal pannello
//   dedicato #doppioniControlliContainer, affiancato via CSS). Il vecchio
//   flusso resta comunque nel file condiviso, intatto, per compatibilità:
//   se in futuro qualche altro punto d'ingresso chiamasse ancora
//   apriFlipCardHome(id,{doppione:true}), continuerebbe a funzionare come
//   prima — semplicemente Doppioni non lo usa più.
// - apriModificaCarta/apriModificaSealed: chiamate as-is dal pannello
//   controlli, nessuna modifica ai loro file.
// - #immagineModal/#flipCardScene: nessuna modifica al markup/JS —
//   l'affiancamento in orizzontale/impilamento in verticale è ottenuto
//   SOLO con una classe CSS aggiuntiva (.doppioni-affiancato) applicata e
//   rimossa da qui, mai presente per gli altri punti d'ingresso del flip.
// ───────────────────────────────────────────────────────────────────────

// ── CHIAVI DI IDENTITÀ (raggruppamento righe → "stessa carta/box") ─────
// Carte: nome+codice+lingua+condizione+reverseHolo+firstEd — i soli campi
// copiati identici dallo split (vedi _doppioniSplitCarta) che definiscono
// la variante esatta. Confermato con Claudio: reverseHolo/firstEd erano
// assenti da carteReali prima di questa sessione (aggiunti in
// ui/cards.ui.js apposta per questo raggruppamento).
function _doppioniChiaveCarta(c) {
    return [c.name, c.code, c.lang, c.cond, !!c.reverseHolo, !!c.firstEd].join('||');
}

// Box: non esiste un campo "condizione" per i sealed — integrita
// (integrita_packaging) è il campo più vicino per significato (stato
// fisico della confezione), stesso trattamento voluto da Claudio
// ("facciamole uguali" alle carte). ASSUNZIONE che non ho fatto
// confermare esplicitamente: se due prodotti sealed hanno lo stesso nome/
// codice/set/lingua ma integrità diversa, oggi vengono trattati come
// varianti distinte (non sommati nello stesso gruppo) — segnalo qui
// perché è una scelta di design, non un dato verificato con Claudio.
function _doppioniChiaveBox(p) {
    return [p.name, p.codice, p.setEspansione, p.lingua, p.integrita].join('||');
}

// ── STATO (indipendente tra Carte e Box, come richiesto) ────────────────
let _doppioniModalita = 'carte'; // 'carte' | 'box'
let _doppioniOrdinamentoCarte = 'quantita';
let _doppioniRicercaCarte = '';
let _doppioniOrdinamentoBox = 'quantita';
let _doppioniRicercaBox = '';
let _doppioniGruppiCarte = [];
let _doppioniGruppiBox = [];
let _doppioniGruppoApertoIndice = null; // indice nell'array della modalità aperta
let _doppioniRigaSorgenteScelta = null; // riga fisica scelta per lo split, nel pannello controlli
let _doppioniDestinazioniCache = null;  // location/scaffali caricati alla prima apertura del pannello sposta


// ── VOCE DI CATALOGO (tile Home — resta leggera, solo carte, nessuna
// query extra, stesso principio della versione precedente) ─────────────
CATALOGO_WIDGET.doppioni = {
        titolo: 'Doppioni', icona: 'fa-clone',
        preview: () => {
            const gruppi = _doppioniRaggruppaCarte();
            if (gruppi.length === 0) return { righe: ['Nessun doppione'], stato: 'ok', dati: { titoli: 0, copieExtra: 0, valoreExtra: 0, lista: [] } };
            const copieExtra = gruppi.reduce((t, g) => t + (g.qtyTotale - 1), 0);
            const valoreExtra = gruppi.reduce((t, g) => t + g.prezzoUnitario * (g.qtyTotale - 1), 0);
            return {
                righe: [`${gruppi.length} carte in più copie`],
                dati: {
                    titoli: gruppi.length, copieExtra, valoreExtra,
                    lista: gruppi.slice(0, 3).map(g => ({ nome: g.nome, qty: g.qtyTotale, id: g.righe[0].id, immagine: g.immagine, rarita: g.righe[0].rarita }))
                }
            };
        },
        tab: 'doppioni',
};


// ── RAGGRUPPAMENTO ───────────────────────────────────────────────────
function _doppioniRaggruppaCarte() {
    const fonte = carteReali.filter(c => c.tabella === 'carte' && c.stato === 'collezione');
    const mappa = new Map();
    fonte.forEach(c => {
        const chiave = _doppioniChiaveCarta(c);
        if (!mappa.has(chiave)) mappa.set(chiave, []);
        mappa.get(chiave).push(c);
    });
    const gruppi = [];
    mappa.forEach((righe, chiave) => {
        const qtyTotale = righe.reduce((t, r) => t + (Number(r.qty) || 1), 0);
        if (qtyTotale <= 1) return; // non è un doppione
        const prima = righe[0];
        gruppi.push({
            chiave, tipo: 'carte',
            nome: prima.name || '—', immagine: prima.immagine || null,
            qtyTotale, prezzoUnitario: Number(prima.price) || 0,
            valoreStack: (Number(prima.price) || 0) * qtyTotale,
            righe,
        });
    });
    return gruppi;
}

function _doppioniRaggruppaBox() {
    const fonte = prodottiSealedReali; // già filtrato stato='collezione' da sealedListMie
    const mappa = new Map();
    fonte.forEach(p => {
        const chiave = _doppioniChiaveBox(p);
        if (!mappa.has(chiave)) mappa.set(chiave, []);
        mappa.get(chiave).push(p);
    });
    const gruppi = [];
    mappa.forEach((righe, chiave) => {
        const qtyTotale = righe.reduce((t, r) => t + (Number(r.qty) || 1), 0);
        if (qtyTotale <= 1) return;
        const prima = righe[0];
        gruppi.push({
            chiave, tipo: 'box',
            nome: prima.name || '—', immagine: prima.immagine || null,
            qtyTotale, prezzoUnitario: Number(prima.price) || 0,
            valoreStack: (Number(prima.price) || 0) * qtyTotale,
            righe,
        });
    });
    return gruppi;
}


// ── PAGINA "DOPPIONI" ────────────────────────────────────────────────
async function renderPaginaDoppioni() {
    const container = document.getElementById('doppioniContenuto');
    if (!container) return;

    _doppioniModalita = 'carte';
    _doppioniGruppiCarte = _doppioniRaggruppaCarte();
    _doppioniGruppiBox = _doppioniRaggruppaBox();

    container.innerHTML = `
        <div class="page-header">
            <span class="page-title">Doppioni</span>
        </div>
        <div class="pg-pagina">
            <div class="pg-filtri" id="doppioniToggleModalita">
                <span class="pg-filtro attivo" data-mod="carte" onclick="_doppioniCambiaModalita('carte')"><i class="fa-solid fa-id-card"></i> Carte</span>
                <span class="pg-filtro" data-mod="box" onclick="_doppioniCambiaModalita('box')"><i class="fa-solid fa-box-archive"></i> Box</span>
            </div>
            <div id="doppioniCorpo"></div>
        </div>
    `;
    _doppioniRenderCorpo();
}

function _doppioniCambiaModalita(modalita) {
    if (modalita !== 'carte' && modalita !== 'box') return;
    _doppioniModalita = modalita;
    document.querySelectorAll('#doppioniToggleModalita .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.mod === modalita);
    });
    _doppioniRenderCorpo();
}

// Ricostruisce ricerca+filtri+griglia per la modalità attiva — stato
// (ricerca/ordinamento) INDIPENDENTE tra Carte e Box, come richiesto.
function _doppioniRenderCorpo() {
    const corpo = document.getElementById('doppioniCorpo');
    if (!corpo) return;

    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const ordinamento = _doppioniModalita === 'carte' ? _doppioniOrdinamentoCarte : _doppioniOrdinamentoBox;

    if (gruppi.length === 0) {
        corpo.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem 0;">Nessun doppione tra i ${_doppioniModalita === 'carte' ? 'le carte' : 'i box'} al momento.</p>`;
        return;
    }

    const titoli = gruppi.length;
    const copieExtra = gruppi.reduce((t, g) => t + (g.qtyTotale - 1), 0);
    const valoreExtra = gruppi.reduce((t, g) => t + g.prezzoUnitario * (g.qtyTotale - 1), 0);
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    corpo.innerHTML = `
        <div class="pg-intro">
            <div class="pg-grande">${titoli}</div>
            <div class="pg-sotto">${copieExtra} copie extra · valore ${eur(valoreExtra)}</div>
        </div>
        <div class="pg-stat">
            <div><b>${titoli}</b><span>Doppioni</span></div>
            <div><b>${copieExtra}</b><span>Copie extra</span></div>
            <div><b>${eur(valoreExtra)}</b><span>Valore extra</span></div>
        </div>
        <input type="text" class="pg-cerca" placeholder="Cerca tra i doppioni..." oninput="_doppioniCercaInput(this.value)" value="${escapeHtml(_doppioniModalita === 'carte' ? _doppioniRicercaCarte : _doppioniRicercaBox)}">
        <div class="pg-filtri">
            <span class="pg-filtro ${ordinamento === 'quantita' ? 'attivo' : ''}" data-ord="quantita" onclick="_doppioniImpostaOrdinamento('quantita')">Quantità</span>
            <span class="pg-filtro ${ordinamento === 'valore' ? 'attivo' : ''}" data-ord="valore" onclick="_doppioniImpostaOrdinamento('valore')">Valore</span>
            <span class="pg-filtro ${ordinamento === 'alfabetico' ? 'attivo' : ''}" data-ord="alfabetico" onclick="_doppioniImpostaOrdinamento('alfabetico')">Alfabetico</span>
        </div>
        <div class="doppioni-grid" id="doppioniGriglia"></div>
    `;
    _doppioniRenderGriglia();
}

function _doppioniImpostaOrdinamento(ordine) {
    if (_doppioniModalita === 'carte') _doppioniOrdinamentoCarte = ordine;
    else _doppioniOrdinamentoBox = ordine;
    document.querySelectorAll('#doppioniCorpo > .pg-filtri .pg-filtro').forEach(el => {
        el.classList.toggle('attivo', el.dataset.ord === ordine);
    });
    _doppioniRenderGriglia();
}

function _doppioniCercaInput(valore) {
    if (_doppioniModalita === 'carte') _doppioniRicercaCarte = (valore || '').toLowerCase();
    else _doppioniRicercaBox = (valore || '').toLowerCase();
    _doppioniRenderGriglia();
}

// Tessera compatta: formula 58.2%/63:88 di .binders-contenitori-grid
// (stessa dimensione delle carte nei Binder, come richiesto), classe
// dedicata .doppioni-grid/.doppioni-tile (CSS in index.html) — non riusa
// .binders-contenitori-grid direttamente, stesso principio già scelto per
// Condividi/Achievement nella sessione precedente (non aggiungere un
// terzo/quarto consumer a una classe condivisa, Regola d'Oro #1).
function _doppioniRenderGriglia() {
    const griglia = document.getElementById('doppioniGriglia');
    if (!griglia) return;

    let gruppi = _doppioniModalita === 'carte' ? [..._doppioniGruppiCarte] : [..._doppioniGruppiBox];
    const ricerca = _doppioniModalita === 'carte' ? _doppioniRicercaCarte : _doppioniRicercaBox;
    const ordinamento = _doppioniModalita === 'carte' ? _doppioniOrdinamentoCarte : _doppioniOrdinamentoBox;

    if (ricerca) gruppi = gruppi.filter(g => g.nome.toLowerCase().includes(ricerca));
    if (ordinamento === 'quantita') gruppi.sort((a, b) => b.qtyTotale - a.qtyTotale);
    else if (ordinamento === 'valore') gruppi.sort((a, b) => b.valoreStack - a.valoreStack);
    else gruppi.sort((a, b) => a.nome.localeCompare(b.nome));

    if (gruppi.length === 0) {
        griglia.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1.2rem 0; grid-column:1/-1;">Nessuna carta corrisponde alla ricerca.</p>';
        return;
    }

    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    // L'indice è nell'array ORIGINALE (non filtrato/ordinato) della
    // modalità attiva, non nella lista visualizzata qui — così il click
    // resta valido anche se ricerca/ordinamento cambiano dopo l'apertura.
    const arrayOriginale = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;

    griglia.innerHTML = gruppi.map(g => {
        const indiceReale = arrayOriginale.indexOf(g);
        const immagineSrc = g.immagine ? (_urlImmagineVisualizzabile(g.immagine, 200) || '') : '';
        const fig = immagineSrc
            ? `<img class="doppioni-cover" src="${immagineSrc}" alt="" onerror="this.style.display='none';">`
            : '<div class="doppioni-cover doppioni-cover-vuota"><i class="fa-solid fa-image"></i></div>';
        return `
            <div class="doppioni-tile" onclick="_doppioniApriDettaglio(${indiceReale})">
                ${fig}
                <div class="doppioni-moltiplicatore">×${g.qtyTotale}</div>
                <div class="doppioni-nome">${escapeHtml(g.nome)}</div>
                <div class="doppioni-valori"><span>${eur(g.prezzoUnitario)} cad.</span><b>${eur(g.valoreStack)}</b></div>
            </div>`;
    }).join('');
}


// ── DETTAGLIO GRUPPO — due contenitori a schermo intero ─────────────────
// Carte: il primo contenitore è il modale flip già esistente
// (#immagineModal, via apriFlipCardHome SENZA opzioni.doppione — vedi
// nota in testa al file), affiancato via classe CSS. Box: niente flip
// (i sealed non hanno fronte/retro), contenitore statico dedicato
// #doppioniBoxVisualContainer che copia la stessa struttura visiva.
// In entrambi i casi, #doppioniControlliContainer è il pannello nuovo con
// il breakdown posizioni + il flusso di split.
async function _doppioniApriDettaglio(indice) {
    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const gruppo = gruppi[indice];
    if (!gruppo) return;

    _doppioniGruppoApertoIndice = indice;
    _doppioniRigaSorgenteScelta = null;
    _doppioniDestinazioniCache = null;

    const controlli = document.getElementById('doppioniControlliContainer');
    controlli.classList.add('doppioni-affiancato');
    controlli.style.display = 'flex';
    controlli.innerHTML = `<div class="doppioni-controlli-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carico le posizioni...</div>`;

    if (gruppo.tipo === 'carte') {
        apriFlipCardHome(gruppo.righe[0].id, { nascondiVaiAlBinder: true });
        document.getElementById('immagineModal').classList.add('doppioni-affiancato');
    } else {
        _doppioniMostraVisualStaticoBox(gruppo);
    }

    const posizioni = await _doppioniCaricaPosizioni(gruppo);
    // Il gruppo potrebbe essere stato chiuso nel frattempo (utente rapido) —
    // non ridisegnare un pannello ormai non più aperto.
    if (_doppioniGruppoApertoIndice !== indice) return;
    _doppioniRenderControlli(gruppo, posizioni);
}

// Contenitore statico per i Box — stessa struttura del back-overlay del
// flip (pg-riga/pg-stat, sleeve niente perché i sealed non hanno sleeve),
// nessuna animazione. Markup nuovo, id propri: nessuna interferenza con
// #flipCardScene.
function _doppioniMostraVisualStaticoBox(gruppo) {
    const contenitore = document.getElementById('doppioniBoxVisualContainer');
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
    const immagineSrc = gruppo.immagine ? (_urlImmagineVisualizzabile(gruppo.immagine, 500) || '') : '';
    contenitore.innerHTML = `
        <button class="close-modal-btn" onclick="_doppioniChiudiDettaglio()"><i class="fa-solid fa-xmark"></i></button>
        <div class="doppioni-box-visual">
            ${immagineSrc ? `<img src="${immagineSrc}" alt="">` : '<div class="doppioni-cover-vuota" style="width:100%; aspect-ratio:3/4;"><i class="fa-solid fa-box-archive"></i></div>'}
            <div class="pg-stat">
                <div><b>${gruppo.qtyTotale}</b><span>Copie totali</span></div>
                <div><b>${eur(gruppo.valoreStack)}</b><span>Valore stack</span></div>
            </div>
        </div>`;
    contenitore.classList.add('doppioni-affiancato');
    contenitore.style.display = 'flex';
}

function _doppioniChiudiDettaglio() {
    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const gruppo = _doppioniGruppoApertoIndice != null ? gruppi[_doppioniGruppoApertoIndice] : null;

    if (gruppo && gruppo.tipo === 'carte') {
        chiudiImmagineIngrandita(); // esistente, ui/modals.ui.js — ripristina overflow/classi come per ogni altra chiusura del flip
        document.getElementById('immagineModal').classList.remove('doppioni-affiancato');
    } else {
        const contenitore = document.getElementById('doppioniBoxVisualContainer');
        contenitore.style.display = 'none';
        contenitore.classList.remove('doppioni-affiancato');
    }

    const controlli = document.getElementById('doppioniControlliContainer');
    controlli.style.display = 'none';
    controlli.classList.remove('doppioni-affiancato');

    _doppioniGruppoApertoIndice = null;
    _doppioniRigaSorgenteScelta = null;
    _doppioniDestinazioniCache = null;
}

// Breakdown "dove si trovano le copie" — SOLO al momento dell'apertura del
// dettaglio, mai nella tessera/preview (per non appesantire il
// caricamento Home con una query per doppione). Per le carte non serve
// nessuna query aggiuntiva: _idsInScambio/_quantitaOfferteScambio sono già
// caricati globalmente da caricaCarteReali(). Per i box serve un'unica
// query (scaffaleProdottiTuttiUtente) — non ci si appoggia a
// _quantitaOfferteScambioSealed perché quella variabile, per come
// documentato in widget-sealed.ui.js, potrebbe non essere ancora stata
// caricata se l'utente non ha mai aperto la pagina Scaffali in questa
// sessione.
async function _doppioniCaricaPosizioni(gruppo) {
    if (gruppo.tipo === 'carte') {
        return gruppo.righe.map(r => {
            const inScambio = _idsInScambio.has(String(r.id));
            const etichetta = inScambio
                ? 'In Scambio'
                : (r.location ? `In "${r.location}"` : 'In Collezione (nessuna location)');
            const qty = inScambio ? (_quantitaOfferteScambio[String(r.id)] ?? r.qty) : r.qty;
            return { rigaId: r.id, qty: Number(r.qty) || 1, etichetta, posizioneQty: qty };
        });
    }

    // Box: un giro solo per tutte le associazioni scaffale↔prodotto
    // dell'utente, poi filtro sui soli id di questo gruppo.
    const userId = await authGetUserId();
    let mappaScaffali = new Map(); // scaffaleId -> {nome, tipo}
    let associazioniPerProdotto = new Map(); // prodottoId -> [{scaffaleId, quantitaOfferta}]
    if (userId) {
        const [{ data: scaffali, error: errScaffali }, { data: associazioni, error: errAssoc }] = await Promise.all([
            scaffaliList(userId),
            scaffaleProdottiTuttiUtente(userId),
        ]);
        if (errScaffali) console.error('_doppioniCaricaPosizioni (scaffaliList):', errScaffali.message);
        if (errAssoc) console.error('_doppioniCaricaPosizioni (scaffaleProdottiTuttiUtente):', errAssoc.message);
        (scaffali || []).forEach(s => mappaScaffali.set(String(s.id), s));
        (associazioni || []).forEach(a => {
            const k = String(a.prodotto_id);
            if (!associazioniPerProdotto.has(k)) associazioniPerProdotto.set(k, []);
            associazioniPerProdotto.get(k).push(a);
        });
    }

    return gruppo.righe.map(r => {
        const associazioni = associazioniPerProdotto.get(String(r.id)) || [];
        if (associazioni.length === 0) {
            return { rigaId: r.id, qty: Number(r.qty) || 1, etichetta: 'In Collezione (nessuno scaffale)', posizioneQty: r.qty };
        }
        const etichette = associazioni.map(a => {
            const scaffale = mappaScaffali.get(String(a.scaffale_id));
            if (!scaffale) return null;
            return scaffale.tipo === 'scambio' ? 'In Scambio' : `In "${scaffale.nome}"`;
        }).filter(Boolean);
        return { rigaId: r.id, qty: Number(r.qty) || 1, etichetta: etichette.join(', ') || 'In Collezione (nessuno scaffale)', posizioneQty: r.qty };
    });
}

// Disegna il pannello controlli: lista posizioni con "Sposta da qui" +
// bottone Modifica, invariato nella sua funzione (apre il modale di
// modifica già esistente, carte o box) come confermato da Claudio.
function _doppioniRenderControlli(gruppo, posizioni) {
    const controlli = document.getElementById('doppioniControlliContainer');
    if (!controlli || _doppioniGruppoApertoIndice == null) return;
    const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });

    const righePosizioni = posizioni.map(p => `
        <div class="pg-riga" data-tocca>
            <div class="pg-testo"><b>${p.qty} ${p.qty === 1 ? 'copia' : 'copie'}</b><span>${escapeHtml(p.etichetta)}</span></div>
            <button class="pg-filtro" onclick="_doppioniSelezionaSorgente('${String(p.rigaId).replace(/'/g, "\\'")}')">Sposta da qui</button>
        </div>`).join('');

    controlli.innerHTML = `
        <button class="close-modal-btn" onclick="_doppioniChiudiDettaglio()"><i class="fa-solid fa-xmark"></i></button>
        <div class="doppioni-controlli-corpo">
            <div class="page-header" style="padding:0 0 0.6rem;"><span class="page-title" style="font-size:1rem;">${escapeHtml(gruppo.nome)}</span></div>
            <div class="pg-stat">
                <div><b>${gruppo.qtyTotale}</b><span>Copie totali</span></div>
                <div><b>${eur(gruppo.valoreStack)}</b><span>Valore stack</span></div>
            </div>
            <div class="pg-elenco" id="doppioniPosizioniElenco">${righePosizioni}</div>
            <div id="doppioniSpostaFlusso"></div>
            <div class="pg-bottoni">
                <button class="primario" onclick="${gruppo.tipo === 'carte' ? `_doppioneApriModifica('${gruppo.righe[0].id}')` : `apriModificaSealed('${gruppo.righe[0].id}')`}"><i class="fa-solid fa-pen"></i> Modifica</button>
            </div>
        </div>
    `;
}

// Step 2 del flusso "sposta": scelta quantità per la riga selezionata.
function _doppioniSelezionaSorgente(rigaId) {
    _doppioniRigaSorgenteScelta = rigaId;
    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const gruppo = gruppi[_doppioniGruppoApertoIndice];
    const riga = gruppo.righe.find(r => String(r.id) === String(rigaId));
    if (!riga) return;

    const qtyDisponibile = Number(riga.qty) || 1;
    const flusso = document.getElementById('doppioniSpostaFlusso');
    flusso.innerHTML = `
        <div class="pg-pagina" style="padding-top:0.6rem;">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.4rem;">Quante ne sposti? Ne hai ${qtyDisponibile} in questa posizione.</p>
            <input type="number" id="doppioniQuantitaSposta" min="1" max="${qtyDisponibile}" value="${qtyDisponibile}" style="width:100%; padding:0.6rem 0.8rem; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-dark); font-size:1rem; font-weight:700; margin-bottom:0.8rem;">
            <button class="primario" style="width:100%; justify-content:center;" onclick="_doppioniMostraDestinazioni()">Avanti — scegli dove</button>
        </div>
    `;
}

// Step 3: destinazioni disponibili (Scambio + Location per carte,
// Scambio + Scaffali per box) — caricate on-demand, una sola volta per
// apertura del dettaglio (cache in _doppioniDestinazioniCache).
async function _doppioniMostraDestinazioni() {
    const flusso = document.getElementById('doppioniSpostaFlusso');
    const inputQty = document.getElementById('doppioniQuantitaSposta');
    const quantita = Math.max(1, parseInt(inputQty.value, 10) || 1);

    flusso.innerHTML += `<p style="text-align:center; padding:0.6rem 0;"><i class="fa-solid fa-spinner fa-spin"></i></p>`;

    const userId = await authGetUserId();
    if (!userId) return;

    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const gruppo = gruppi[_doppioniGruppoApertoIndice];
    const riga = gruppo.righe.find(r => String(r.id) === String(_doppioniRigaSorgenteScelta));
    if (!riga) return;

    if (!_doppioniDestinazioniCache) {
        if (gruppo.tipo === 'carte') {
            const { data, error } = await locationsList(userId);
            if (error) console.error('_doppioniMostraDestinazioni (locationsList):', error.message);
            _doppioniDestinazioniCache = (data || []).map(r => ({ tipo: 'location', valore: r.nome, etichetta: r.nome }));
        } else {
            const { data, error } = await scaffaliList(userId);
            if (error) console.error('_doppioniMostraDestinazioni (scaffaliList):', error.message);
            _doppioniDestinazioniCache = (data || [])
                .filter(s => s.tipo !== 'scambio')
                .map(s => ({ tipo: 'scaffale', scaffaleId: s.id, etichetta: s.nome }));
        }
    }

    // Scambio sempre come prima opzione, esclusa se la riga è già
    // interamente lì (per le carte, via _idsInScambio; per i box andrebbe
    // verificato nelle posizioni già mostrate — qui, più semplicemente,
    // resta sempre proposta: spostarne ancora in Scambio da una riga già
    // parzialmente lì è comunque un'azione valida).
    const opzioni = [{ tipo: 'scambio', etichetta: 'Scambio' }, ..._doppioniDestinazioniCache];

    const bottoni = opzioni.map((o, i) => `<button class="pg-filtro" onclick="_doppioniConfermaSposta(${i}, ${quantita})">${escapeHtml(o.etichetta)}</button>`).join('');
    // Le opzioni vengono ricostruite ad ogni chiamata: le tengo su una
    // variabile globale temporanea per indice, così il bottone sopra può
    // richiamarle senza reincollare oggetti interi negli attributi HTML.
    _doppioniOpzioniDestinazioneCorrenti = opzioni;

    flusso.innerHTML = `
        <div class="pg-pagina" style="padding-top:0.6rem;">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.4rem;">Dove le sposti?</p>
            <div class="pg-bottoni" style="flex-wrap:wrap;">${bottoni}</div>
        </div>
    `;
}
let _doppioniOpzioniDestinazioneCorrenti = [];

// Step 4: conferma e scrittura reale (split).
async function _doppioniConfermaSposta(indiceOpzione, quantita) {
    const opzione = _doppioniOpzioniDestinazioneCorrenti[indiceOpzione];
    if (!opzione) return;

    const gruppi = _doppioniModalita === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const gruppo = gruppi[_doppioniGruppoApertoIndice];
    const riga = gruppo.righe.find(r => String(r.id) === String(_doppioniRigaSorgenteScelta));
    if (!riga) return;

    const flusso = document.getElementById('doppioniSpostaFlusso');
    flusso.innerHTML = `<p style="text-align:center; padding:0.6rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Sposto...</p>`;

    const risultato = gruppo.tipo === 'carte'
        ? await _doppioniSplitCarta(riga, quantita, opzione)
        : await _doppioniSplitBox(riga, quantita, opzione);

    if (risultato.error) {
        alert('❌ Errore nello spostamento: ' + risultato.error.message);
        flusso.innerHTML = '';
        return;
    }

    // Ricarico i dati reali e ridisegno da capo il dettaglio (il gruppo
    // potrebbe non esistere più come "doppione" se questo split ha portato
    // la qty totale a 1, o la riga sorgente potrebbe essere sparita se lo
    // spostamento era "tutto").
    if (gruppo.tipo === 'carte') await caricaCarteReali();
    else await caricaProdottiSealedReali();

    _doppioniGruppiCarte = _doppioniRaggruppaCarte();
    _doppioniGruppiBox = _doppioniRaggruppaBox();
    _doppioniRenderGriglia(); // aggiorna anche la griglia sotto, se il pannello resta aperto

    const gruppiAggiornati = gruppo.tipo === 'carte' ? _doppioniGruppiCarte : _doppioniGruppiBox;
    const stessoGruppo = gruppiAggiornati.find(g => g.chiave === gruppo.chiave);
    if (!stessoGruppo) {
        // Non è più un doppione (o è sparito del tutto) — chiudo.
        _doppioniChiudiDettaglio();
        return;
    }
    const nuovoIndice = gruppiAggiornati.indexOf(stessoGruppo);
    _doppioniGruppoApertoIndice = nuovoIndice;
    _doppioniRigaSorgenteScelta = null;
    const posizioni = await _doppioniCaricaPosizioni(stessoGruppo);
    _doppioniRenderControlli(stessoGruppo, posizioni);
}


// ── SPLIT REALE — CARTE ──────────────────────────────────────────────
// Se N = qty totale della riga sorgente: nessuna riga nuova, aggiorno solo
// quella esistente (più economico, coerente con "riduci le entry al
// minimo"). Se N < qty totale: leggo la riga grezza (cardsSelectById,
// già esistente per questo scopo esatto, vedi commento nel file), creo la
// riga nuova con qty=N, decremento l'originale, poi applico la
// destinazione SOLO alla riga nuova.
async function _doppioniSplitCarta(rigaOriginale, quantitaRichiesta, destinazione) {
    const userId = await authGetUserId();
    if (!userId) return { error: { message: 'Utente non autenticato.' } };

    const qtyOriginale = Number(rigaOriginale.qty) || 1;
    const N = Math.max(1, Math.min(quantitaRichiesta, qtyOriginale));
    const spostaTutto = N >= qtyOriginale;

    if (spostaTutto) {
        return _doppioniApplicaDestinazioneCarta(userId, rigaOriginale.id, qtyOriginale, destinazione);
    }

    const { data: grezza, error: errLettura } = await cardsSelectById(rigaOriginale.id);
    if (errLettura) return { error: errLettura };

    const nuovaRiga = { ...grezza };
    delete nuovaRiga.id;
    delete nuovaRiga.updated_at;
    nuovaRiga.owner_id = userId;
    nuovaRiga.qty = N;
    // Punto confermato da Claudio: la riga nuova tiene lo STESSO
    // created_at dell'originale (concettualmente è la stessa carta, solo
    // spostata) — già presente in "grezza", nessuna modifica necessaria.

    const { data: inserite, error: errInsert } = await cardsInsertNellaCollezione(nuovaRiga);
    if (errInsert) return { error: errInsert };
    const nuovoId = inserite && inserite[0] && inserite[0].id;
    if (!nuovoId) return { error: { message: 'Riga inserita ma id non restituito dal database.' } };

    const { error: errDecremento } = await cardsUpdateCampo('carte', rigaOriginale.id, 'qty', qtyOriginale - N);
    if (errDecremento) return { error: errDecremento };

    return _doppioniApplicaDestinazioneCarta(userId, nuovoId, N, destinazione);
}

async function _doppioniApplicaDestinazioneCarta(userId, cartaId, quantitaSullaRiga, destinazione) {
    if (destinazione.tipo === 'location') {
        const { error } = await cardsUpdateCampo('carte', cartaId, 'location', destinazione.valore);
        return { error };
    }
    if (destinazione.tipo === 'scambio') {
        if (!_binderScambioId) return { error: { message: 'Binder Scambio non ancora pronto — riprova tra un istante.' } };
        const { error } = await binderCarteImpostaQuantitaScambio(userId, _binderScambioId, cartaId, quantitaSullaRiga);
        return { error };
    }
    return { error: { message: 'Destinazione non riconosciuta.' } };
}


// ── SPLIT REALE — BOX ────────────────────────────────────────────────
// Stesso motore delle carte, tabella/repository diversi (prodotti_sealed,
// mai carte). Differenza chiave: la destinazione "scaffale" è
// un'appartenenza (scaffale_prodotti), non un campo sulla riga — un box
// può restare membro di PIÙ scaffali insieme (deliberato, non toccato:
// nessuna rimozione dalle appartenenze precedenti della riga nuova).
async function _doppioniSplitBox(rigaOriginale, quantitaRichiesta, destinazione) {
    const userId = await authGetUserId();
    if (!userId) return { error: { message: 'Utente non autenticato.' } };

    const qtyOriginale = Number(rigaOriginale.qty) || 1;
    const N = Math.max(1, Math.min(quantitaRichiesta, qtyOriginale));
    const spostaTutto = N >= qtyOriginale;

    if (spostaTutto) {
        return _doppioniApplicaDestinazioneBox(userId, rigaOriginale.id, qtyOriginale, destinazione);
    }

    const { data: grezza, error: errLettura } = await sealedSelectById(rigaOriginale.id);
    if (errLettura) return { error: errLettura };

    const nuovaRiga = { ...grezza };
    delete nuovaRiga.id;
    delete nuovaRiga.updated_at;
    nuovaRiga.owner_id = userId;
    nuovaRiga.qty = N;

    const { data: inserite, error: errInsert } = await sealedInsertRighe(nuovaRiga);
    if (errInsert) return { error: errInsert };
    const nuovoId = inserite && inserite[0] && inserite[0].id;
    if (!nuovoId) return { error: { message: 'Riga inserita ma id non restituito dal database.' } };

    const { error: errDecremento } = await sealedUpdate(rigaOriginale.id, { qty: qtyOriginale - N });
    if (errDecremento) return { error: errDecremento };

    return _doppioniApplicaDestinazioneBox(userId, nuovoId, N, destinazione);
}

async function _doppioniApplicaDestinazioneBox(userId, prodottoId, quantitaSullaRiga, destinazione) {
    if (destinazione.tipo === 'scaffale') {
        const { error } = await scaffaleProdottoAggiungi(userId, destinazione.scaffaleId, prodottoId);
        return { error };
    }
    if (destinazione.tipo === 'scambio') {
        const { data: scaffaleScambio, error: errGarantisci } = await scaffaleScambioGarantisci(userId);
        if (errGarantisci) return { error: errGarantisci };
        const { error } = await scaffaleProdottoImpostaQuantitaScambio(userId, scaffaleScambio.id, prodottoId, quantitaSullaRiga);
        return { error };
    }
    return { error: { message: 'Destinazione non riconosciuta.' } };
}
