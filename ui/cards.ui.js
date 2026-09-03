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


        function toggleMenuCompatto(id) {
            const menu = document.getElementById('menuCompatto-' + id);
            if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
        }


        // Stesso concetto di toggleMenuCompatto ma per il menu azioni della
        // tabella desktop — chiude sempre eventuali altri menu aperti prima,
        // mai due aperti insieme, e si chiude da solo cliccando fuori.
        function toggleMenuAzioniTabella(id) {
            const menu = document.getElementById('menuAzioniTabella-' + id);
            if (!menu) return;
            const eraAperto = menu.style.display === 'flex';
            document.querySelectorAll('.menu-azioni-tabella').forEach(m => { m.style.display = 'none'; });
            menu.style.display = eraAperto ? 'none' : 'flex';
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-azioni-tabella') && !e.target.closest('[onclick*="toggleMenuAzioniTabella"]')) {
                document.querySelectorAll('.menu-azioni-tabella').forEach(m => { m.style.display = 'none'; });
            }
        });

        // Ricalcola la vista compatta se lo schermo cambia larghezza
        // attraversando la soglia (es. ruotando il telefono, o ridimensionando
        // la finestra da desktop) — filterTable() richiama renderViewTable
        // con i dati già filtrati, senza rileggere dal database.
        //
        // FIX (2026-09-01): la condizione controllava SOLO 'visualizzazione',
        // ma la vista compatta si applica a quattro tab (vedi
        // modalitaCompatta in renderViewTable, che elenca visualizzazione/
        // scambio/wishlist/sealed). Su Scambio, Wishlist e Sealed il layout
        // restava quindi bloccato su tabella o su schedine finché non si
        // cambiava tab e si tornava indietro. Stesso elenco usato in
        // renderViewTable, tenuto in una costante condivisa (dichiarata in
        // cima al file) così i due punti non possono più scollarsi.
        window.addEventListener('resize', () => {
            clearTimeout(_resizeTimeout);
            _resizeTimeout = setTimeout(() => {
                if (MODI_CON_VISTA_COMPATTA.includes(currentMode)) filterTable();
            }, 200);
        });


        // ── MODIFICA / ELIMINAZIONE CARTA ────────────────────────────────────────

        function apriModificaCarta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;
            _cartaInModifica = card;

            document.getElementById('editNome').value = card.name;
            document.getElementById('editCodice').value = card.code;
            document.getElementById('editLingua').value = card.lang;
            document.getElementById('editCondizione').value = card.cond;
            document.getElementById('editQty').value = card.qty;
            document.getElementById('editPrezzo').value = card.price || '';
            document.getElementById('editNote').value = card.notes;

            // La wishlist non ha una Location (non possiedi ancora la carta)
            // — il campo viene disabilitato invece di rimosso, così il resto
            // del modale (layout, id dei campi) resta identico per entrambe.
            const inputLocation = document.getElementById('editLocation');
            const isWishlist = card.tabella === 'wishlist';
            inputLocation.value = isWishlist ? '' : card.location;
            inputLocation.disabled = isWishlist;
            inputLocation.placeholder = isWishlist ? 'Non applicabile alla wishlist' : '';

            // Prezzo obiettivo — opposto di Location: ha senso SOLO in
            // Wishlist (quanto sei disposto a spendere per una carta che
            // non hai ancora), non sulle carte già in collezione. Il campo
            // viene nascosto del tutto (non solo disabilitato) quando non
            // pertinente, per non confondere.
            const campoObiettivo = document.getElementById('campoEditObiettivo');
            campoObiettivo.style.display = isWishlist ? '' : 'none';
            if (isWishlist) {
                document.getElementById('editObiettivo').value = card.prezzoObiettivo != null ? card.prezzoObiettivo : '';
            }

            const datalist = document.getElementById('datalistEditLocation');
            datalist.innerHTML = [...new Set(carteReali.map(c => c.location).filter(Boolean))]
                .map(loc => `<option value="${loc}"></option>`).join('');

            document.getElementById('editCardModal').style.display = 'flex';
        }


        function chiudiModificaCarta() {
            document.getElementById('editCardModal').style.display = 'none';
            _cartaInModifica = null;
        }


        async function salvaModificaCarta() {
            if (!_cartaInModifica) return;
            const isWishlist = _cartaInModifica.tabella === 'wishlist';
            // Catturati PRIMA di chiudiModificaCarta(), che azzera
            // _cartaInModifica — servono dopo per il feedback A14.
            const idCartaModificata = _cartaInModifica.id;
            const prezzoPrecedente = _cartaInModifica.price;

            const aggiornamento = {
                nome: document.getElementById('editNome').value.trim(),
                codice: document.getElementById('editCodice').value.trim(),
                lingua: document.getElementById('editLingua').value,
                condizione: document.getElementById('editCondizione').value,
                qty: Math.max(1, parseInt(document.getElementById('editQty').value, 10) || 1),
                prezzo: document.getElementById('editPrezzo').value !== '' ? parseFloat(document.getElementById('editPrezzo').value) : null,
                note: document.getElementById('editNote').value.trim() || null,
            };
            // La colonna 'location' esiste solo su 'carte', non su 'wishlist'.
            if (!isWishlist) {
                aggiornamento.location = document.getElementById('editLocation').value.trim() || null;
            } else {
                // Speculare: 'prezzo_obiettivo' esiste solo su 'wishlist'.
                // Campo facoltativo — vuoto significa "nessun obiettivo
                // impostato", non "zero euro".
                const valoreObiettivo = document.getElementById('editObiettivo').value;
                aggiornamento.prezzo_obiettivo = valoreObiettivo !== '' ? parseFloat(valoreObiettivo) : null;
            }

            const btn = document.getElementById('btnSalvaModificaCarta');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';

            const { error } = await cardsUpdateRecord(isWishlist, _cartaInModifica.id, aggiornamento);

            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Salva Modifiche';

            if (error) {
                alert('❌ Errore nel salvare le modifiche: ' + error.message);
                return;
            }

            // A14: feedback visivo solo se il prezzo è stato toccato
            // (campo lasciato/impostato non-vuoto) e risulta davvero
            // salito o sceso rispetto a prima.
            const direzionePrezzo = (aggiornamento.prezzo != null && prezzoPrecedente != null)
                ? (aggiornamento.prezzo > prezzoPrecedente ? 'su' : (aggiornamento.prezzo < prezzoPrecedente ? 'giu' : null))
                : null;

            chiudiModificaCarta();
            await caricaCarteReali();
            if (direzionePrezzo) _animaPrezzoCarta(idCartaModificata, direzionePrezzo);
        }


        async function segnaOttenuta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card || card.tabella !== 'wishlist') return;

            const userId = await authGetUserId();
            if (!userId) return;

            const location = prompt(`In che Location metti "${card.name}"? (lascia vuoto per "?")`, '');
            if (location === null) return; // annullato

            const { error: errInsert } = await cardsInsertNellaCollezione({
                owner_id: userId,
                nome: card.name,
                codice: card.code || null,
                location: location.trim() || '?',
                qty: card.qty,
                lingua: card.lang,
                condizione: card.cond,
                url: card.link !== '#' ? card.link : null,
                prezzo: card.price || null,
                note: card.notes || null,
                stato: 'collezione',
            });
            if (errInsert) {
                alert('❌ Errore nello spostare la carta in collezione: ' + errInsert.message);
                return;
            }

            const { error: errDelete } = await wishlistDelete(card.id);
            if (errDelete) {
                alert('⚠️ Carta aggiunta alla collezione, ma non rimossa dalla wishlist: ' + errDelete.message + '\n\nRimuovila a mano dalla wishlist per evitare doppioni.');
            }

            await caricaCarteReali();
        }


        async function eliminaCarta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;
            const isWishlist = card.tabella === 'wishlist';
            if (!confirm(`Eliminare definitivamente "${card.name}" dalla${isWishlist ? ' wishlist' : ' collezione'}?\n\nQuesta azione non si può annullare.`)) return;

            const { error } = await cardsDeleteById(isWishlist, id);
            if (error) {
                alert('❌ Errore nell\'eliminazione: ' + error.message);
                return;
            }
            await caricaCarteReali();
        }


        // ── LOCATION / LINGUA / CONDIZIONE — tendine in linea ────────────────────
        // A differenza di Nome/Codice/Q.tà/Prezzo (testo libero via prompt),
        // questi tre campi hanno un set di valori noti — si sostituisce il
        // badge con una vera <select> al click, niente testo libero digitato
        // a mano che potrebbe non corrispondere a un valore valido.
        async function _locationDisponibili() {
            if (_locationDisponibiliCache) return _locationDisponibiliCache;
            const userId = await authGetUserId();
            if (!userId) return [];
            const { data } = await locationsList(userId);
            _locationDisponibiliCache = (data || []).map(r => r.nome);
            return _locationDisponibiliCache;
        }


        async function modificaLocationInline(event, id, tabella, valoreAttuale) {
            const span = event.target.closest('span');
            let opzioni = await _locationDisponibili();
            if (valoreAttuale && !opzioni.includes(valoreAttuale)) opzioni = [valoreAttuale, ...opzioni];
            _apriSelectInline(span, id, tabella, 'location', valoreAttuale, opzioni);
        }


        function modificaLinguaInline(event, id, tabella, valoreAttuale) {
            const span = event.target.closest('span');
            // Stesso elenco di LINGUA_MAP_SHARED nell'estensione — prima ne
            // mostravo solo 4 (IT/EN/KOR/JP), non erano "quelle del database"
            // ma un sottoinsieme scritto a mano incompleto.
            _apriSelectInline(span, id, tabella, 'lingua', valoreAttuale,
                ['IT', 'EN', 'DE', 'FR', 'ES', 'PT', 'JP', 'KOR', 'CHN', 'CHN-T', 'IND', 'THAI', 'RU']);
        }


        function modificaCondizioneInline(event, id, tabella, valoreAttuale) {
            const span = event.target.closest('span');
            // Scala completa Cardmarket (7 livelli), non solo i 3 usati nella
            // tabella rapida di Inserimento.
            _apriSelectInline(span, id, tabella, 'condizione', valoreAttuale,
                ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO']);
        }


        function _apriSelectInline(elemento, id, tabella, campo, valoreAttuale, opzioni) {
            const select = document.createElement('select');
            select.style.cssText = 'font-size:0.75rem; padding:0.25rem; border-radius:6px; border:1px solid var(--primary); font-weight:700;';
            opzioni.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === valoreAttuale) o.selected = true;
                select.appendChild(o);
            });
            select.onclick = (e) => e.stopPropagation();
            // Click fuori dalla tendina senza scegliere nulla → ripristina la
            // vista normale senza salvare (nessuna conferma richiesta, dato
            // che non è stata fatta nessuna scelta).
            select.onblur = () => filterTable();
            select.onchange = async () => {
                const nuovo = select.value;
                if (nuovo === valoreAttuale) { filterTable(); return; }
                if (!confirm(`Salvare "${campo}" = "${nuovo}"?`)) { filterTable(); return; }
                const { error } = await cardsUpdateCampo(tabella, id, campo, nuovo);
                if (error) { alert(`❌ Errore nel salvare: ` + error.message); filterTable(); return; }
                await caricaCarteReali();
            };
            elemento.replaceWith(select);
            select.focus();
        }


        // Stesso meccanismo di modificaLocationInline ma generico — usato per
        // Nome, Codice, Quantità e Prezzo (click sulla cella → chiede il
        // nuovo valore → conferma → salva). 'tipo' converte e valida
        // l'input: 'intero' per la quantità, 'numero' per il prezzo,
        // altrimenti testo libero.
        async function modificaCampoInline(id, tabella, campo, valoreAttuale, etichetta, tipo) {
            const nuovo = prompt(`Nuovo valore per "${etichetta}":`, valoreAttuale ?? '');
            if (nuovo === null) return; // annullato
            let valore = nuovo.trim();

            if (tipo === 'intero') {
                valore = parseInt(valore, 10);
                if (isNaN(valore) || valore < 1) { alert('Inserisci un numero intero maggiore di zero.'); return; }
            } else if (tipo === 'numero') {
                valore = parseFloat(valore.replace(',', '.'));
                if (isNaN(valore) || valore < 0) { alert('Inserisci un prezzo valido (es. 12.50).'); return; }
            } else if (tipo === 'facoltativo') {
                // Campi come le Note possono essere lasciati vuoti
                // (per cancellarli) — salvati come null, non stringa vuota.
                if (valore === '') valore = null;
            } else if (valore === '') {
                alert(`"${etichetta}" non può essere vuoto.`); return;
            }

            // FIX (2026-09-01): il confronto era String(valore) contro
            // String(valoreAttuale) sui valori GREZZI. Sul campo Note (tipo
            // 'facoltativo') un campo già vuoto arriva qui come '' e viene
            // convertito a null poco sopra: 'null' !== '' , quindi il
            // controllo "nessuna modifica reale" non scattava e compariva la
            // conferma «Salvare "Note" = "null"?» seguita da una scrittura
            // inutile. Normalizzando vuoto/null/undefined allo stesso valore
            // il caso si chiude da solo, e per i numeri il confronto resta
            // identico a prima (12 e "12" continuano a coincidere).
            const _normalizza = (v) => (v === null || v === undefined) ? '' : String(v);
            if (_normalizza(valore) === _normalizza(valoreAttuale)) return; // nessuna modifica reale
            if (!confirm(`Salvare "${etichetta}" = "${valore === null ? '(vuoto)' : valore}"?`)) return;

            const { error } = await cardsUpdateCampo(tabella, id, campo, valore);
            if (error) { alert(`❌ Errore nel salvare "${etichetta}": ` + error.message); return; }

            // A14: feedback visivo solo quando il campo modificato è il
            // prezzo e il valore è davvero salito/sceso (il controllo
            // sopra ha già escluso il caso "nessuna modifica reale").
            const direzionePrezzo = campo === 'prezzo'
                ? (valore > valoreAttuale ? 'su' : (valore < valoreAttuale ? 'giu' : null))
                : null;

            await caricaCarteReali();
            if (direzionePrezzo) _animaPrezzoCarta(id, direzionePrezzo);
        }


        // ── SELEZIONE MULTIPLA ────────────────────────────────────────────────────
        function toggleSelezionaTutte(checked) {
            document.querySelectorAll('.riga-checkbox').forEach(cb => { cb.checked = checked; });
            aggiornaSelezioneMultipla();
        }


        function _righeSelezionate() {
            return [...document.querySelectorAll('.riga-checkbox:checked')].map(cb => ({
                id: cb.dataset.id, tabella: cb.dataset.tabella,
            }));
        }


        function aggiornaSelezioneMultipla() {
            _aggiornaBarraSelezioneMultipla();
        }


        function _aggiornaBarraSelezioneMultipla() {
            const selezionate = document.querySelectorAll('.riga-checkbox:checked').length;
            const barra = document.getElementById('barraSelezioneMultipla');
            barra.style.display = selezionate > 0 ? 'flex' : 'none';
            document.getElementById('conteggioSelezioneMultipla').textContent =
                `${selezionate} cart${selezionate === 1 ? 'a selezionata' : 'e selezionate'}`;
        }


        async function eliminaSelezionate() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;
            if (!confirm(`Eliminare definitivamente ${righe.length} cart${righe.length === 1 ? 'a' : 'e'}?\n\nQuesta azione non si può annullare.`)) return;

            // Raggruppa per tabella (carte/wishlist) — un batch delete per
            // tabella invece di N chiamate singole.
            const idsPerTabella = {};
            righe.forEach(r => { (idsPerTabella[r.tabella] ||= []).push(r.id); });

            for (const [tabella, ids] of Object.entries(idsPerTabella)) {
                const { error } = await cardsDeleteBatch(tabella, ids);
                if (error) { alert(`❌ Errore nell'eliminazione (${tabella}): ` + error.message); return; }
            }
            await caricaCarteReali();
        }


        // A6, punto 3 — azione bulk "Aggiungi al Binder" sulla barra di
        // selezione multipla esistente. Solo ADD (nessuna rimozione da qui:
        // per togliere si usa il toggle singolo o il modale del punto 2) —
        // stesso motivo per cui l'aggiunta singola non chiede conferma.
        // Righe non eleggibili (wishlist, o già presenti nel Binder) vengono
        // saltate silenziosamente dal conteggio inserito, ma segnalate a
        // parte se TUTTE le righe selezionate erano non eleggibili.
        async function aggiungiSelezionateAlBinder() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;

            if (!_binderExtraId) {
                alert('❌ Il tuo binder personale non è ancora pronto — riprova tra un istante.');
                return;
            }

            const idsEleggibili = righe
                .filter(r => r.tabella === 'carte')
                .map(r => r.id)
                .filter(id => !_idsNelBinder.has(String(id)));

            if (idsEleggibili.length === 0) {
                alert('Nessuna carta selezionata da aggiungere: erano già tutte nel Binder, oppure erano righe di Wishlist (non aggiungibili al Binder).');
                return;
            }

            const userId = await authGetUserId();
            if (!userId) return;

            const { error } = await binderCarteInsert(idsEleggibili.map(id => ({ owner_id: userId, binder_id: _binderExtraId, carta_id: id })));
            if (error) { alert('❌ Errore nell\'aggiungere le carte al Binder: ' + error.message); return; }

            idsEleggibili.forEach(id => {
                _idsNelBinder.add(String(id));
                _aggiornaBottoniBinderToggle(id);
            });

            // Deseleziona tutto e nasconde la barra — stessa sensazione di
            // "azione completata" delle altre azioni bulk (che invece
            // deselezionano indirettamente ricaricando la tabella).
            document.querySelectorAll('.riga-checkbox:checked').forEach(cb => { cb.checked = false; });
            _aggiornaBarraSelezioneMultipla();
        }


        async function spostaLocationSelezionate() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;
            const nuovo = prompt(`Sposta ${righe.length} cart${righe.length === 1 ? 'a' : 'e'} in quale Location?`, '');
            if (nuovo === null) return;
            const valore = nuovo.trim();
            if (!confirm(`Spostare ${righe.length} cart${righe.length === 1 ? 'a' : 'e'} in "${valore || '(vuota)'}"?`)) return;

            const idsPerTabella = {};
            righe.forEach(r => { (idsPerTabella[r.tabella] ||= []).push(r.id); });

            for (const [tabella, ids] of Object.entries(idsPerTabella)) {
                const { error } = await cardsUpdateLocationBatch(tabella, ids, valore);
                if (error) { alert(`❌ Errore nello spostare la location (${tabella}): ` + error.message); return; }
            }
            await caricaCarteReali();
        }


        // ── FILTRO TIPO (Carte / Sealed / Wishlist) — solo in Visualizzazione ────
        // Multi-selezione: tutti e tre attivi insieme = vedi tutto quanto,
        // uno solo attivo = vedi solo quello. Wishlist parte disattivata di
        // default, per non alterare le statistiche (Carte Totali/Valore Est.
        // rappresentano concettualmente solo ciò che possiedi davvero).

        function toggleFiltroTipo(tipo) {
            _filtriTipo[tipo] = !_filtriTipo[tipo];
            document.getElementById('toggleTipo' + tipo.charAt(0).toUpperCase() + tipo.slice(1))
                .classList.toggle('active', _filtriTipo[tipo]);
            filterTable();
        }


        function toggleRowHighlight(id) {
            highlightedRowId = (highlightedRowId === id) ? null : id;
            filterTable();
        }


        function filterTable() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase();
            let locVal = document.getElementById('filterLocation').value;
            const langVal = document.getElementById('filterLang').value;

            if (currentMode === 'scambio') locVal = 'SCAMBIO';

            const filtered = carteReali.filter(card => {
                const matchesSearch = card.name.toLowerCase().includes(searchVal) || card.code.toLowerCase().includes(searchVal);
                const matchesLang = langVal === "" || card.lang === langVal;
                if (!matchesSearch || !matchesLang) return false;

                // Wishlist, Scambio e Sealed filtrano su cose DIVERSE: la
                // wishlist è uno stato a parte nel database, "SCAMBIO" è solo
                // una location come le altre dentro la collezione, "sealed"
                // è il campo 'tipo' (stessa tabella, non una location).
                if (currentMode === 'wishlist') return card.stato === 'wishlist';
                if (currentMode === 'sealed') {
                    if (card.stato !== 'collezione' || card.tipo !== 'sealed') return false;
                    return locVal === "" || card.location === locVal;
                }
                if (currentMode === 'visualizzazione') {
                    // Multi-selezione indipendente dei tre "tipi" di riga —
                    // vedi _filtriTipo e toggleFiltroTipo più sotto.
                    if (card.stato === 'wishlist') { if (!_filtriTipo.wishlist) return false; }
                    else if (card.tipo === 'sealed') { if (!_filtriTipo.sealed) return false; }
                    else { if (!_filtriTipo.carte) return false; }
                    return locVal === "" || card.location === locVal;
                }
                if (card.stato !== 'collezione') return false;
                return locVal === "" || card.location === locVal;
            });

            renderViewTable(filtered);
        }


        // Flash colorato breve sulla cella prezzo (verde se sale, rosso se
        // scende). Scatta SOLO dalle due funzioni che rappresentano una
        // modifica diretta dell'utente su questo sito (modificaCampoInline
        // e salvaModificaCarta) — MAI dal ricaricamento innescato da
        // Realtime (_pianificaRicaricaCarte), che copre anche gli
        // aggiornamenti automatici/di massa della coda prezzi: farla
        // scattare lì avrebbe animato decine di righe in sequenza durante
        // un controllo prezzi, risultando fastidiosa invece che utile.
        function _animaPrezzoCarta(id, direzione) {
            if (!direzione || _animazioniRidotte()) return;
            const classe = direzione === 'su' ? 'prezzo-flash-su' : 'prezzo-flash-giu';
            ['prezzoCella-' + id, 'prezzoCellaCompatta-' + id].forEach(elId => {
                const el = document.getElementById(elId);
                if (!el) return;
                el.classList.remove('prezzo-flash-su', 'prezzo-flash-giu');
                void el.offsetWidth; // forza il reflow, per far ripartire l'animazione se era già in corso
                el.classList.add(classe);
                el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
            });
        }
