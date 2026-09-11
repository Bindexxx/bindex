// ── ui/cards.ui.js ─────────────────────────────────────────────────────
// Tabella Collezione/Wishlist: caricamento dati, realtime, rendering
// (vista desktop + vista compatta mobile).
//
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Le altre responsabilità di questo file (menu riga/modale
// modifica/elimina/dropdown inline, selezione multipla, filtro/ricerca)
// sono state spostate in ui/cards-modifica.ui.js, ui/cards-selezione.ui.js,
// ui/cards-filtro.ui.js — NESSUNA riscrittura del codice esistente in
// nessuno dei quattro file: solo spostamento, zero cambi di comportamento.
//
// Contiene: MODI_CON_VISTA_COMPATTA, caricaCarteReali, aggiornamento
// realtime, ordinaTabella, renderViewTable (+ _rigaCompattaHtml per la
// vista compatta).
//
// Chiamato cross-file da ui/cards-modifica.ui.js, ui/cards-selezione.ui.js
// e ui/cards-filtro.ui.js: caricaCarteReali() (ricarica dopo una modifica/
// eliminazione/selezione). Nessuna istruzione qui gira a tempo di
// caricamento script — l'ordine tra i quattro file cards-*.ui.js
// nei <script> tag di index.html è indifferente.

// ── ui/cards.ui.js ─────────────────────────────────────────────────────
// Tabella Collezione/Wishlist: caricamento, rendering, ordinamento, ricerca
// e filtro, modifica (modale e inline), selezione multipla, eliminazione,
// aggiornamento in tempo reale.


        // Le quattro tab che condividono la stessa tabella e possono quindi
        // passare alla vista compatta mobile. Unica fonte per i due punti che
        // ne hanno bisogno: renderViewTable (decide quale layout disegnare) e
        // il listener di resize in fondo al file (decide quando ridisegnare).
        // Prima erano due elenchi scritti a mano in posti diversi, e infatti
        // si erano scollati — vedi il FIX del 2026-09-01 sul resize.
        const MODI_CON_VISTA_COMPATTA = ['visualizzazione', 'scambio', 'wishlist', 'sealed'];


        async function caricaCarteReali() {
            const userId = await authGetUserId();
            if (!userId) return;

            // Multi-Binder (2026-08-25): binder_carte ora è per-binder, non più
            // globale per utente — serve l'id del binder 'extra' PRIMA di
            // interrogare binder_carte. Get-or-create idempotente (vedi
            // data/binder.repository.js), fatto qui perché caricaCarteReali()
            // gira ad ogni apertura del sito, non solo aprendo il widget
            // Binders — _idsNelBinder deve essere corretto comunque (i
            // pulsanti "Aggiungi al Binder" in Visualizzazione/Wishlist non
            // dipendono dal widget Binders essendo mai stato aperto).
            if (!_binderExtraId) {
                const { data: binderExtra, error: errBinderExtra } = await binderExtraGarantisci(userId, 'Il mio binder');
                if (errBinderExtra) {
                    console.error('Errore nel garantire il binder extra:', errBinderExtra.message);
                } else if (binderExtra) {
                    _binderExtraId = binderExtra.id;
                }
            }

            // Collezione e wishlist ora vivono in DUE TABELLE separate (non
            // più stato='wishlist' dentro 'carte') — le leggiamo insieme e le
            // uniamo in un solo array per riusare la stessa tabella/filtri sul
            // sito. 'tabella' su ogni riga ricorda da dove viene, così
            // modifica/eliminazione sanno su quale tabella agire dopo.
            const [{ data: dataCarte, error: errCarte }, { data: dataWishlist, error: errWishlist }, { data: dataBinder, error: errBinder }] = await Promise.all([
                _selectTuttePagine(cardsQueryCollezione(userId)),
                _selectTuttePagine(wishlistQueryOrdinata(userId)),
                _binderExtraId ? _selectTuttePagine(binderCarteQuery(userId, _binderExtraId)) : Promise.resolve({ data: [], error: null }),
            ]);

            if (errCarte || errWishlist) {
                console.error('Errore caricamento carte:', (errCarte || errWishlist).message);
                return;
            }

            // Fase A0/A3: non blocchiamo il caricamento della collezione se
            // la lettura del Binder fallisce (tabella nuova) — logghiamo e
            // procediamo con Set vuoto, il resto del sito resta usabile.
            if (errBinder) {
                console.error('Errore caricamento binder_carte:', errBinder.message);
                _idsNelBinder = new Set();
            } else {
                _idsNelBinder = new Set((dataBinder || []).map(r => String(r.carta_id)));
            }

            const righeCarte = (dataCarte || []).map(r => ({
                id: r.id,
                tabella: 'carte',
                stato: 'collezione',
                tipo: r.tipo || null,
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '',
                qty: r.qty || 1,
                lang: r.lingua || 'IT',
                cond: r.condizione || 'NM',
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                // A10 (Dashboard/Home) — stesso diff già calcolato dentro
                // _mappaVariazione, ma come numero puro invece che stringa
                // formattata: serve per ordinare le carte per oscillazione
                // nel blocco "Binder in primo piano". Duplicazione minima
                // voluta, non un refactor di _mappaVariazione.
                variazioneNumerica: (r.prezzo_precedente != null && r.prezzo != null) ? (Number(r.prezzo) - Number(r.prezzo_precedente)) : null,
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                createdAt: r.created_at || null, // usato per l'ordine automatico nel Binder (Stage 1)
            }));

            const righeWishlist = (dataWishlist || []).map(r => ({
                id: r.id,
                tabella: 'wishlist',
                stato: 'wishlist',
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '', // FIX: prima era sempre vuota per errore — la wishlist ha una location vera dalla migrazione wishlist_location.sql
                qty: r.qty || 1,
                lang: r.lingua || 'IT',
                cond: r.condizione || 'NM',
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
            }));

            carteReali = [...righeCarte, ...righeWishlist];

            // Popola la tendina filtro con le location REALMENTE presenti nei
            // tuoi dati, invece del vecchio elenco fisso scritto a mano.
            const selectLoc = document.getElementById('filterLocation');
            const locationPresenti = [...new Set(carteReali.map(c => c.location).filter(Boolean))].sort();
            const valorePrecedente = selectLoc.value;
            selectLoc.innerHTML = '<option value="">Tutte le Location</option>';
            locationPresenti.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc;
                opt.textContent = loc;
                selectLoc.appendChild(opt);
            });
            if (valorePrecedente) selectLoc.value = valorePrecedente;

            filterTable();
            aggiornaStatCardHome();
            caricaAvvisiHome();
            caricaUltimaSincronizzazioneHome();
            caricaAttivitaRecentiHome();
            renderBinderInPrimoPianoHome();
        }


        // ── AGGIORNAMENTO IN TEMPO REALE ──────────────────────────────────────────
        // Prima questa pagina caricava 'carte'/'wishlist' una sola volta,
        // all'apertura — carte aggiunte dopo (dall'estensione, magari su un
        // altro PC) restavano invisibili finché non si premeva F5. Supabase
        // Realtime avvisa il browser in tempo reale a ogni insert/update/
        // delete sulle tabelle sottoscritte, senza bisogno di ricaricare né
        // di ripetuti controlli manuali (polling).
        //
        // Debounce di 600ms: durante un controllo prezzi che aggiorna decine
        // di righe una via l'altra, altrimenti ricaricheremmo l'intera
        // collezione ad ogni singola riga — aspettiamo che gli eventi si
        // "calmino" prima di ricaricare una volta sola.
        function _pianificaRicaricaCarte() {
            if (_debounceRicaricaCarte) clearTimeout(_debounceRicaricaCarte);
            _debounceRicaricaCarte = setTimeout(() => { caricaCarteReali(); }, 600);
        }


        async function _avviaRealtimeCarte() {
            const userId = await authGetUserId();
            if (!userId) return;

            cardsRealtimeSubscribe(userId, _pianificaRicaricaCarte);
        }

        /* LOGICA EASTER EGG CHANGELOG */


        function ordinaTabella(colonna) {
            if (_sortColonna === colonna) _sortAsc = !_sortAsc;
            else { _sortColonna = colonna; _sortAsc = true; }
            filterTable();
        }


        function _freccettaOrdinamento(colonna) {
            if (_sortColonna !== colonna) return '';
            return ` <i class="fa-solid fa-${_sortAsc ? 'arrow-up' : 'arrow-down'}" style="font-size:0.65rem;"></i>`;
        }


        function renderViewTable(data) {
            const tbody = document.getElementById('viewTableBody');
            const theadRow = document.getElementById('tableHeaderRow');
            const pannelloTabella = document.getElementById('pannelloTabella');
            const contenitoreCompatto = document.getElementById('viewCardsCompact');
            tbody.innerHTML = '';

            if (_sortColonna) {
                data = [...data].sort((a, b) => {
                    let va = a[_sortColonna], vb = b[_sortColonna];
                    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
                    if (va < vb) return _sortAsc ? -1 : 1;
                    if (va > vb) return _sortAsc ? 1 : -1;
                    return 0;
                });
            }

            // Vista compatta: solo tab Visualizzazione, solo telefono vero
            // (sotto i 640px) — non su finestre desktop ridotte, dove invece
            // vogliamo che la tabella classica entri semplicemente tutta
            // senza scorrimento (vedi CSS più stretto qui sotto).
            // FIX: Scambio/Wishlist/Sealed usavano ancora la conversione
            // generica "tabella → schedine con etichette" — che non gestisce
            // bene la combinazione miniatura+nome (si sovrapponevano,
            // mostrando frammenti tipo "Ra"/"V9" invece del nome intero). La
            // vista compatta "vera", già pensata apposta per questo, ora si
            // applica a tutte le tab con la tabella condivisa, non solo a
            // Visualizzazione.
            const modalitaCompatta = MODI_CON_VISTA_COMPATTA.includes(currentMode) && window.innerWidth <= 640;
            pannelloTabella.style.display = modalitaCompatta ? 'none' : '';
            contenitoreCompatto.style.display = modalitaCompatta ? '' : 'none';

            const th = (label, colonna) => colonna
                ? `<th style="cursor:pointer; user-select:none;" onclick="ordinaTabella('${colonna}')">${label}${_freccettaOrdinamento(colonna)}</th>`
                : `<th>${label}</th>`;

            theadRow.innerHTML = `
                <th><input type="checkbox" id="checkAllRows" onchange="toggleSelezionaTutte(this.checked)" title="Seleziona tutte (quelle filtrate)"></th>
                ${th('Q.TÀ', 'qty')}
                ${th('NOME CARTA', 'name')}
                ${th('CODICE', 'code')}
                ${th('LOCATION', 'location')}
                ${th('LINGUA', 'lang')}
                ${th('COND.', 'cond')}
                ${th('PREZZO CAD.', 'price')}
                <th>VAR.</th>
                <th>LINK</th>
                <th>NOTE</th>
                <th>AZIONI</th>
            `;

            let totalSum = 0;
            let totalQty = 0;
            let htmlCompatto = '';

            data.forEach(card => {
                const tr = document.createElement('tr');
                tr.classList.add('interactive-row');
                if (highlightedRowId === card.id) {
                    tr.classList.add('highlighted-row');
                }

                tr.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                    toggleRowHighlight(card.id);
                };

                const langClass = card.lang === 'KOR' ? 'badge-lang-kor' : 'badge-lang';
                const condClass = card.cond === 'EX' ? 'badge-cond-ex' : 'badge-cond';
                const varClass = card.variation.includes('▲') ? 'variation-up' : (card.variation.includes('▼') ? 'variation-down' : 'variation-none');

                totalSum += card.price * card.qty;
                totalQty += card.qty;

                const idAttr = String(card.id).replace(/'/g, "\\'");
                const locAttr = (card.location || '').replace(/'/g, "\\'");
                // FIX: Cardmarket blocca l'hotlinking diretto delle proprie
                // immagini (per questo il <img src> mostrava l'icona rotta) —
                // images.weserv.nl le recupera lato server e le riserve dal
                // proprio dominio, stesso proxy già usato in sidebar.html.
                // Da ora l'estensione salva l'immagine come "data URI"
                // (incorporata, scaricata direttamente dalla pagina
                // Cardmarket vera) invece di un semplice link esterno — che
                // Cardmarket blocca se richiesto da un dominio diverso (da
                // qui il problema delle miniature sempre rotte). Se il
                // valore è già un data URI (inizia con "data:") lo uso
                // direttamente; se invece è ancora un vecchio URL esterno
                // (carte aggiunte prima di questa correzione), tento il
                // proxy come ripiego — funziona per alcune immagini, non per
                // tutte, ma è meglio di niente per lo storico.
                const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
                const thumb = immagineSrc
                    ? `<img src="${immagineSrc}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; vertical-align:middle; margin-right:0.5rem; box-shadow:0 1px 4px rgba(0,0,0,0.15); cursor:pointer;" loading="lazy" title="Ingrandisci" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                    : '';
                const obiettivoRaggiunto = card.tabella === 'wishlist' && card.prezzoObiettivo != null && card.price > 0 && card.price <= card.prezzoObiettivo;
                if (obiettivoRaggiunto) tr.style.backgroundColor = 'var(--success-bg)';

                const nomeAttr = card.name.replace(/'/g, "\\'");
                const codeAttr = (card.code || '').replace(/'/g, "\\'");
                const notesAttr = (card.notes || '').replace(/'/g, "\\'");

                if (modalitaCompatta) {
                    htmlCompatto += _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto);
                    return; // niente <tr>, questa carta esiste solo nella vista compatta
                }

                tr.innerHTML = `
                    <td><input type="checkbox" class="riga-checkbox" data-id="${idAttr}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();"></td>
                    <td data-label="Q.tà" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'qty', ${card.qty}, 'Quantità', 'intero')"><strong>${card.qty}</strong></td>
                    <td data-label="Nome" class="cella-editabile" title="${card.name.replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'nome', '${nomeAttr}', 'Nome')" style="max-width:170px; overflow:hidden; text-overflow:ellipsis;">${thumb}<strong>${escapeHtml(card.name)}</strong>${obiettivoRaggiunto ? ` <span class="badge" style="background-color:var(--success-bg); color:var(--success);" title="Prezzo sceso al di sotto del tuo obiettivo (${card.prezzoObiettivo.toFixed(2)} €)">🎯 obiettivo!</span>` : ''}</td>
                    <td data-label="Codice" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'codice', '${codeAttr}', 'Codice')"><code>${escapeHtml(card.code)}</code></td>
                    <td data-label="Location"><span class="badge badge-location" title="${(card.location || '').replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaLocationInline(event, '${idAttr}', '${card.tabella}', '${locAttr}')">${escapeHtml(card.location || '—')}</span></td>
                    <td data-label="Lingua"><span class="badge ${langClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaLinguaInline(event, '${idAttr}', '${card.tabella}', '${card.lang}')">${escapeHtml(card.lang)}</span></td>
                    <td data-label="Cond."><span class="badge ${condClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCondizioneInline(event, '${idAttr}', '${card.tabella}', '${card.cond}')">${escapeHtml(card.cond)}</span></td>
                    <td data-label="Prezzo" id="prezzoCella-${idAttr}" class="price cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'prezzo', ${card.price}, 'Prezzo (€)', 'numero')">${card.price.toFixed(2)} €</td>
                    <td data-label="Var." class="${varClass}">${escapeHtml(card.variation)}</td>
                    <td data-label="Link">
                        <a href="${card.link}" target="_blank" class="link-icon">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </td>
                    <td data-label="Note" class="cella-editabile" title="${card.notes ? card.notes.replace(/"/g, '&quot;') + ' — ' : ''}clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'note', '${notesAttr}', 'Note', 'facoltativo')" style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted); font-size:0.75rem;">${card.notes ? escapeHtml(card.notes) : '—'}</td>
                    <td style="text-align:center;">
                        <div style="position:relative; display:inline-block;">
                            <button class="btn-danger" style="color:var(--text-muted);" onclick="event.stopPropagation(); toggleMenuAzioniTabella('${idAttr}')" title="Azioni"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div id="menuAzioniTabella-${idAttr}" class="menu-azioni-tabella" style="display:none;">
                                <button onclick="apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                                ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')" style="color:var(--success);"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                                <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${card.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-chart-line"></i> Andamento prezzo</button>
                                <button onclick="apriFotoDettaglio('${idAttr}', '${card.tabella}', '${card.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-camera"></i> Foto dettaglio</button>
                                <button onclick="eliminaCarta('${card.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina</button>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (modalitaCompatta) {
                contenitoreCompatto.innerHTML = htmlCompatto || '<p style="text-align:center; color:var(--text-muted); padding:2rem 0;">Nessuna carta trovata.</p>';
            }

            document.getElementById('stat-count').innerText = totalQty;
            document.getElementById('stat-value').innerText = `€ ${totalSum.toFixed(2)}`;
            const uniqueLocs = [...new Set(data.map(item => item.location))].length;
            document.getElementById('stat-locations').innerText = uniqueLocs;

            // La selezione multipla non sopravvive a un nuovo render (cambio
            // filtro, refresh realtime...) — semplifica la logica ed evita
            // di tenere "selezionate" righe che magari non sono più visibili.
            _aggiornaBarraSelezioneMultipla();
        }


        // Costruisce l'HTML di una singola schedina per la vista compatta
        // mobile — nome+link+prezzo+variazione in cima, meta condensati
        // (quantità/codice/lingua/condizione) e pill Location sotto, azioni
        // in un pannello a comparsa per non affollare la card.
        function _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto) {
            const thumbCompatta = immagineSrc
                ? `<img src="${immagineSrc}" alt="" class="riga-compatta-thumb" loading="lazy" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                : '';
            const iconaVariazione = varClass === 'variation-up'
                ? '<i class="fa-solid fa-arrow-up" style="color:var(--success); font-size:0.7rem;"></i>'
                : (varClass === 'variation-down' ? '<i class="fa-solid fa-arrow-down" style="color:var(--danger); font-size:0.7rem;"></i>' : '');
            const linkIcona = (card.link && card.link !== '#')
                ? `<a href="${card.link}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary); flex-shrink:0;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.68rem;"></i></a>`
                : '';
            const metaTesto = [
                `x${card.qty}`,
                card.code || null,
                card.lang,
                card.cond,
            ].filter(Boolean).join(' · ');

            return `
                <div class="riga-compatta">
                    <div class="riga-compatta-top">
                        <input type="checkbox" class="riga-checkbox" data-id="${idAttr}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();">
                        ${thumbCompatta}
                        <span class="riga-compatta-nome">
                            <span class="riga-compatta-nome-testo">${escapeHtml(card.name)}</span>
                            ${linkIcona}
                        </span>
                        ${iconaVariazione}
                        <span class="riga-compatta-prezzo" id="prezzoCellaCompatta-${idAttr}">${card.price.toFixed(2)}€</span>
                        <button class="riga-compatta-menu-btn" onclick="event.stopPropagation(); toggleMenuCompatto('${idAttr}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <div class="riga-compatta-meta">
                        <span class="riga-compatta-meta-testo">${escapeHtml(metaTesto)}</span>
                        <span class="pill-location">${escapeHtml(card.location || '—')}</span>
                        ${obiettivoRaggiunto ? `<span class="pill-location" style="background-color:var(--success-bg); color:var(--success);">🎯 obiettivo</span>` : ''}
                    </div>
                    <div class="riga-compatta-azioni" id="menuCompatto-${idAttr}" style="display:none;">
                        <button onclick="event.stopPropagation(); apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                        <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-chart-line"></i> Andamento</button>
                        <button onclick="apriFotoDettaglio('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-camera"></i> Foto</button>
                        <button onclick="eliminaCarta('${card.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina</button>
                    </div>
                </div>
            `;
        }


