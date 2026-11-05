// Tabella di Collezione e Wishlist: caricamento, aggiornamenti in tempo reale, disegno.

const MODI_CON_VISTA_COMPATTA = ['visualizzazione', 'scambio', 'wishlist', 'sealed'];

        function _rigaCarteDaDb(r, idsEsclusiValore) {
            return {
                id: r.id,
                tabella: 'carte',
                stato: 'collezione',
                esclusoValore: idsEsclusiValore.has(String(r.id)),
                tipo: r.tipo || null,
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '',
                qty: r.qty || 1,
                lang: r.lingua || 'IT',
                cond: r.condizione || 'NM',
                reverseHolo: !!r.reverse_holo,
                firstEd: !!r.first_ed,
                variante: r.variante || null,
                sigillataOriginale: !!r.sigillata_originale,
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                variazioneNumerica: (r.prezzo_precedente != null && r.prezzo != null) ? (Number(r.prezzo) - Number(r.prezzo_precedente)) : null,
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                createdAt: r.created_at || null,
                ultimoControllo: r.ultimo_controllo || null,
                esitoControllo: r.esito_controllo || null,
                esitoControlloIl: r.esito_controllo_il || null,
            };
        }

        function _rigaWishlistDaDb(r) {
            return {
                id: r.id,
                tabella: 'wishlist',
                stato: 'wishlist',
                name: r.nome || '',
                code: r.codice || '',
                location: r.location || '',
                qty: r.qty || 1,
                lang: r.lingua || '',
                cond: r.condizione || 'NM',
                price: r.prezzo != null ? Number(r.prezzo) : 0,
                variation: _mappaVariazione(r),
                link: r.url || '#',
                notes: r.note || '',
                immagine: r.immagine || null,
                prezzoObiettivo: r.prezzo_obiettivo != null ? Number(r.prezzo_obiettivo) : null,
                variazioneNumerica: (r.prezzo_precedente != null && r.prezzo != null) ? (Number(r.prezzo) - Number(r.prezzo_precedente)) : null,
            };
        }

        const _CACHE_CARTE_PREFISSO = 'bindex_cache_carte_v1:';
        const _CACHE_CARTE_MAX_ETA_MS = 14 * 24 * 60 * 60 * 1000;
        let _carteCacheProvata = false;
        let _carteDaCache = false;
        let _carteCacheSalvataIl = null;
        let _carteUltimoErrore = null;
        let _cacheCarteTimer = null;

        function _storageCacheCarte() {
            try { return (typeof _authStoragePreferito === 'function') ? _authStoragePreferito() : window.localStorage; } catch (_) { return null; }
        }

        function _idrataCarteDaCache(userId) {
            const st = _storageCacheCarte();
            if (!st) return false;
            let dati = null;
            try { dati = JSON.parse(st.getItem(_CACHE_CARTE_PREFISSO + userId) || 'null'); } catch (_) { return false; }
            if (!dati || dati.userId !== userId || !Array.isArray(dati.carte)) return false;
            if (!dati.salvato || Date.now() - dati.salvato > _CACHE_CARTE_MAX_ETA_MS) return false;
            carteReali = dati.carte;
            _idsNelBinder = new Set(dati.idsNelBinder || []);
            _idsInScambio = new Set(dati.idsInScambio || []);
            _quantitaOfferteScambio = dati.quantitaOfferteScambio || {};
            _carteDaCache = true;
            _carteCacheSalvataIl = dati.salvato;
            return true;
        }

        const _CACHE_CARTE_MAX_IMMAGINE = 2000;
        const _CACHE_CARTE_MAX_TOTALE = 3 * 1024 * 1024;
        function _salvaCacheCarte(userId) {
            clearTimeout(_cacheCarteTimer);
            _cacheCarteTimer = setTimeout(() => {
                const st = _storageCacheCarte();
                if (!st) return;
                try {
                    const carte = carteReali.map(c => (c.immagine && c.immagine.length > _CACHE_CARTE_MAX_IMMAGINE) ? { ...c, immagine: null } : c);
                    const testo = JSON.stringify({
                        userId, salvato: Date.now(), carte,
                        idsNelBinder: [..._idsNelBinder], idsInScambio: [..._idsInScambio],
                        quantitaOfferteScambio: _quantitaOfferteScambio,
                    });
                    if (testo.length > _CACHE_CARTE_MAX_TOTALE) { st.removeItem(_CACHE_CARTE_PREFISSO + userId); return; }
                    st.setItem(_CACHE_CARTE_PREFISSO + userId, testo);
                    const altro = st === window.localStorage ? window.sessionStorage : window.localStorage;
                    altro.removeItem(_CACHE_CARTE_PREFISSO + userId);
                } catch (_) {   }
            }, 2000);
        }

        function cacheCarteSvuota() {
            clearTimeout(_cacheCarteTimer);
            [window.localStorage, window.sessionStorage].forEach(st => {
                try {
                    Object.keys(st).filter(k => k.startsWith('bindex_cache_carte_')).forEach(k => st.removeItem(k));
                } catch (_) {   }
            });
        }

        const _CARTE_ATTESE_TENTATIVO = [10000, 30000, 60000, 120000];
        let _carteTentativi = 0;
        let _carteTimerTentativo = null;

        function _carteNonCaricate() {
            return !!_carteUltimoErrore && !_carteDaCache && carteReali.length === 0;
        }

        function _carteSegnalaErrore() {
            let testo;
            if (_carteDaCache) {
                const quando = _carteCacheSalvataIl ? new Date(_carteCacheSalvataIl) : null;
                testo = 'Nessun collegamento al database: stai vedendo la collezione salvata'
                    + (quando ? ' il ' + quando.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' alle ' + quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '') + '.';
            } else if (carteReali.length) {
                testo = 'Aggiornamento della collezione non riuscito: quello che vedi potrebbe non essere aggiornato.';
            } else {
                testo = 'Collezione non caricata: controlla la connessione.';
            }
            if (typeof avvisoFisso === 'function') {
                avvisoFisso('carte', testo, { tipo: 'errore', azione: { etichetta: 'Riprova', fn: () => { _carteTentativi = 0; caricaCarteReali(); } } });
            }
            clearTimeout(_carteTimerTentativo);
            const attesa = _CARTE_ATTESE_TENTATIVO[Math.min(_carteTentativi, _CARTE_ATTESE_TENTATIVO.length - 1)];
            _carteTentativi++;
            _carteTimerTentativo = setTimeout(() => {
                _carteTimerTentativo = null;
                if (document.hidden) { _ricaricaCarteAlRitorno = true; return; }
                caricaCarteReali();
            }, attesa);
            if (_carteNonCaricate() && typeof renderWidgetHome === 'function' && typeof _editModeWidget !== 'undefined' && !_editModeWidget
                && !document.body.classList.contains('phone-detail-open')) {
                renderWidgetHome();
            }
        }

        function _carteErroreRisolto() {
            clearTimeout(_carteTimerTentativo);
            _carteTimerTentativo = null;
            _carteTentativi = 0;
            if (typeof avvisoFissoTogli === 'function') avvisoFissoTogli('carte');
        }

        window.addEventListener('online', () => {
            if (!_carteUltimoErrore) return;
            _carteTentativi = 0;
            caricaCarteReali();
        });

        let _caricamentoCarteInCorso = false;

        async function caricaCarteReali() {
            const userId = await authGetUserId();
            if (!userId) return;

            if (!_carteCacheProvata) {
                _carteCacheProvata = true;
                if (!carteReali.length && _idrataCarteDaCache(userId)) _aggiornaVisteDopoCarte({ daCache: true });
            }

            _caricamentoCarteInCorso = true;
            try {
                await _caricaCarteRealiDalDb(userId);
            } catch (e) {
                console.error('Errore caricamento carte:', e);
                _carteUltimoErrore = (e && e.message) || 'errore sconosciuto';
                _carteSegnalaErrore();
            } finally {
                _caricamentoCarteInCorso = false;
            }
        }

        async function _caricaCarteRealiDalDb(userId) {
            if (!_binderExtraId || !_binderScambioId) {
                const [esitoExtra, esitoScambio] = await Promise.all([
                    _binderExtraId ? null : binderExtraGarantisci(userId, 'Il mio binder'),
                    _binderScambioId ? null : binderScambioGarantisci(userId),
                ]);
                if (esitoExtra) {
                    if (esitoExtra.error) console.error('Errore nel garantire il binder extra:', esitoExtra.error.message);
                    else if (esitoExtra.data) _binderExtraId = esitoExtra.data.id;
                }
                if (esitoScambio) {
                    if (esitoScambio.error) console.error('Errore nel garantire il binder Scambio:', esitoScambio.error.message);
                    else if (esitoScambio.data) _binderScambioId = esitoScambio.data.id;
                }
            }

            const [{ data: dataCarte, error: errCarte }, { data: dataWishlist, error: errWishlist }, { data: dataBinder, error: errBinder }, { data: dataScambio, error: errScambio }, { data: dataTuttiBinder }, { data: dataAppartenenze }] = await Promise.all([
                _selectTuttePagine(cardsQueryCollezione(userId)),
                _selectTuttePagine(wishlistQueryOrdinata(userId)),
                _binderExtraId ? _selectTuttePagine(binderCarteQuery(userId, _binderExtraId)) : Promise.resolve({ data: [], error: null }),
                _binderScambioId ? _selectTuttePagine(binderCarteQueryConQuantita(userId, _binderScambioId)) : Promise.resolve({ data: [], error: null }),
                bindersQueryTutti(userId),
                _selectTuttePagine(binderCarteQueryTutteAppartenenze(userId)),
            ]);

            if (errCarte || errWishlist) {
                console.error('Errore caricamento carte:', (errCarte || errWishlist).message);
                _carteUltimoErrore = (errCarte || errWishlist).message || 'errore sconosciuto';
                _carteSegnalaErrore();
                return;
            }

            if (errBinder) {
                console.error('Errore caricamento binder_carte:', errBinder.message);
                _idsNelBinder = new Set();
            } else {
                _idsNelBinder = new Set((dataBinder || []).map(r => String(r.carta_id)));
            }

            if (errScambio) {
                console.error('Errore caricamento binder Scambio:', errScambio.message);
                _idsInScambio = new Set();
                _quantitaOfferteScambio = {};
            } else {
                _idsInScambio = new Set((dataScambio || []).map(r => String(r.carta_id)));
                _quantitaOfferteScambio = {};
                (dataScambio || []).forEach(r => { _quantitaOfferteScambio[String(r.carta_id)] = r.quantita_offerta; });
            }

            const _idsEsclusiValore = (typeof calcolaIdsEsclusiValore === 'function')
                ? calcolaIdsEsclusiValore((dataCarte || []).map(r => ({ id: r.id, location: r.location })), dataTuttiBinder, dataAppartenenze)
                : new Set();

            const righeCarte = (dataCarte || []).map(r => _rigaCarteDaDb(r, _idsEsclusiValore));
            const righeWishlist = (dataWishlist || []).map(_rigaWishlistDaDb);

            carteReali = [...righeCarte, ...righeWishlist];
            _carteDaCache = false;
            _carteUltimoErrore = null;
            _carteErroreRisolto();

            if (typeof raritaAggiorna === 'function') raritaAggiorna();
            _aggiornaVisteDopoCarte({});
            _salvaCacheCarte(userId);
        }

        function _popolaFiltroLocationCarte() {
            const selectLoc = document.getElementById('filterLocation');
            if (!selectLoc) return;
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
        }

        let _avvisiHomeLeggeriTimer = null;
        function _aggiornaVisteDopoCarte({ daCache = false, leggero = false } = {}) {
            _popolaFiltroLocationCarte();
            filterTable();
            aggiornaStatCardHome();
            if (!daCache) {
                if (leggero) {
                    if (!_avvisiHomeLeggeriTimer) {
                        _avvisiHomeLeggeriTimer = setTimeout(() => {
                            _avvisiHomeLeggeriTimer = null;
                            caricaAvvisiHome();
                            caricaUltimaSincronizzazioneHome();
                            caricaAttivitaRecentiHome();
                        }, 15000);
                    }
                } else {
                    clearTimeout(_avvisiHomeLeggeriTimer);
                    _avvisiHomeLeggeriTimer = null;
                    caricaAvvisiHome();
                    caricaUltimaSincronizzazioneHome();
                    caricaAttivitaRecentiHome();
                }
            }
            renderBinderInPrimoPianoHome();
            if (typeof renderWidgetHome === 'function' && typeof _editModeWidget !== 'undefined' && !_editModeWidget
                && !document.body.classList.contains('phone-detail-open')) {
                renderWidgetHome();
            }
        }

        let _eventiRealtimeCarte = [];
        let _ricaricaCarteAlRitorno = false;

        function _pianificaRicaricaCarte(evento) {
            if (document.hidden) {
                _ricaricaCarteAlRitorno = true;
                _eventiRealtimeCarte = [];
                if (_debounceRicaricaCarte) { clearTimeout(_debounceRicaricaCarte); _debounceRicaricaCarte = null; }
                return;
            }
            _eventiRealtimeCarte.push(evento || null);
            if (_debounceRicaricaCarte) clearTimeout(_debounceRicaricaCarte);
            _debounceRicaricaCarte = setTimeout(_applicaEventiRealtimeCarte, 600);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden || !_ricaricaCarteAlRitorno) return;
            _ricaricaCarteAlRitorno = false;
            _eventiRealtimeCarte = [];
            caricaCarteReali();
        });

        async function _applicaEventiRealtimeCarte() {
            _debounceRicaricaCarte = null;
            if (_caricamentoCarteInCorso) {
                _debounceRicaricaCarte = setTimeout(_applicaEventiRealtimeCarte, 600);
                return;
            }
            const eventi = _eventiRealtimeCarte;
            _eventiRealtimeCarte = [];
            if (!eventi.length) return;
            if (_carteDaCache || !_applicaEventiInMemoria(eventi)) {
                await caricaCarteReali();
                return;
            }
            if (typeof raritaAggiorna === 'function') raritaAggiorna();
            _aggiornaVisteDopoCarte({ leggero: true });
            const userId = await authGetUserId();
            if (userId) _salvaCacheCarte(userId);
        }

        function _applicaEventiInMemoria(eventi) {
            const sostituzioni = new Map();
            for (const ev of eventi) {
                if (!ev || ev.eventType !== 'UPDATE' || !ev.new || ev.new.id == null) return false;
                if (ev.table !== 'carte' && ev.table !== 'wishlist') return false;
                const r = ev.new;
                if (!('nome' in r) || !('prezzo' in r) || !('location' in r)) return false;
                const i = carteReali.findIndex(c => c.tabella === ev.table && String(c.id) === String(r.id));
                if (i < 0) return false;
                const vecchia = carteReali[i];
                if ((r.nome || '') !== vecchia.name) return false;
                if ((r.location || '') !== vecchia.location) return false;
                if (ev.table === 'carte') {
                    if (r.stato !== 'collezione') return false;
                    const esclusa = vecchia.esclusoValore ? new Set([String(r.id)]) : new Set();
                    sostituzioni.set(i, _rigaCarteDaDb(r, esclusa));
                } else {
                    sostituzioni.set(i, _rigaWishlistDaDb(r));
                }
            }
            sostituzioni.forEach((riga, i) => { carteReali[i] = riga; });
            return true;
        }

        async function _avviaRealtimeCarte() {
            const userId = await authGetUserId();
            if (!userId) return;

            cardsRealtimeSubscribe(userId, _pianificaRicaricaCarte);
        }

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
            const sezioneTabella = document.getElementById('visualizzazione');
            if (sezioneTabella && !sezioneTabella.classList.contains('active')) return;

            const tbody = document.getElementById('viewTableBody');
            const theadRow = document.getElementById('tableHeaderRow');
            const pannelloTabella = document.getElementById('pannelloTabella');
            const contenitoreCompatto = document.getElementById('viewCardsCompact');
            tbody.innerHTML = '';

            if (currentMode === 'visualizzazione' && typeof collezioneRender === 'function') {
                collezioneRender(data);
                return;
            }
            if (typeof collezioneDisattiva === 'function') collezioneDisattiva();

            if (_sortColonna) {
                data = [...data].sort((a, b) => {
                    let va = a[_sortColonna], vb = b[_sortColonna];
                    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
                    if (va < vb) return _sortAsc ? -1 : 1;
                    if (va > vb) return _sortAsc ? 1 : -1;
                    return 0;
                });
            }

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
                const locAttr = escapeJsAttr(card.location || '');
                const immagineSrc = _urlImmagineVisualizzabile(card.immagine);
                const thumb = immagineSrc
                    ? `<img src="${immagineSrc}" alt="" style="width:32px; height:44px; object-fit:cover; border-radius:4px; vertical-align:middle; margin-right:0.5rem; box-shadow:0 1px 4px rgba(0,0,0,0.15); cursor:pointer;" loading="lazy" title="Ingrandisci" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                    : '';
                const obiettivoRaggiunto = card.tabella === 'wishlist' && card.prezzoObiettivo != null && card.price > 0 && card.price <= card.prezzoObiettivo;
                if (obiettivoRaggiunto) tr.style.backgroundColor = 'var(--success-bg)';

                const nomeAttr = escapeJsAttr(card.name);
                const codeAttr = escapeJsAttr(card.code || '');
                const notesAttr = escapeJsAttr(card.notes || '');
                const linkSicuro = urlEsternoSicuro(card.link);

                if (modalitaCompatta) {
                    htmlCompatto += _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto);
                    return;
                }

                tr.innerHTML = `
                    <td><input type="checkbox" class="riga-checkbox" data-id="${idAttr}" data-tabella="${card.tabella}" onclick="event.stopPropagation(); aggiornaSelezioneMultipla();"></td>
                    <td data-label="Q.tà" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'qty', ${card.qty}, 'Quantità', 'intero')"><strong>${card.qty}</strong></td>
                    <td data-label="Nome" class="cella-editabile" title="${card.name.replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'nome', '${nomeAttr}', 'Nome')" style="max-width:170px; overflow:hidden; text-overflow:ellipsis;">${thumb}<strong>${escapeHtml(card.name)}</strong>${obiettivoRaggiunto ? ` <span class="badge" style="background-color:var(--success-bg); color:var(--success);" title="Prezzo sceso al di sotto del tuo obiettivo (${card.prezzoObiettivo.toFixed(2)} €)">🎯 obiettivo!</span>` : ''}${card.sigillataOriginale ? ` <span class="badge" style="background-color:var(--primary-light); color:var(--primary);" title="Ancora sigillata nella bustina originale">📦 sigillata</span>` : ''}</td>
                    <td data-label="Codice" class="cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'codice', '${codeAttr}', 'Codice')"><code>${escapeHtml(card.code)}</code></td>
                    <td data-label="Location"><span class="badge badge-location" title="${(card.location || '').replace(/"/g, '&quot;')} — clicca per modificare" onclick="event.stopPropagation(); modificaLocationInline(event, '${idAttr}', '${card.tabella}', '${locAttr}')">${escapeHtml(card.location || '—')}</span></td>
                    <td data-label="Lingua"><span class="badge ${langClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaLinguaInline(event, '${idAttr}', '${card.tabella}', '${escapeJsAttr(card.lang || '')}')">${card.lang ? escapeHtml(card.lang) : 'Qualsiasi'}</span></td>
                    <td data-label="Cond."><span class="badge ${condClass} cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCondizioneInline(event, '${idAttr}', '${card.tabella}', '${escapeJsAttr(card.cond || '')}')">${escapeHtml(card.cond)}</span></td>
                    <td data-label="Prezzo" id="prezzoCella-${idAttr}" class="price cella-editabile" title="Clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'prezzo', ${card.price}, 'Prezzo (€)', 'numero')">${formattaEuro(card.price)}${card.esitoControllo ? ` <i class="fa-solid fa-triangle-exclamation" style="color:var(--danger); font-size:0.75rem;" title="${escapeHtml(card.esitoControllo)} — da sistemare in Controlla prezzi"></i>` : ''}</td>
                    <td data-label="Var." class="${varClass}">${escapeHtml(card.variation)}</td>
                    <td data-label="Link">
                        ${linkSicuro ? `<a href="${linkSicuro}" target="_blank" rel="noopener noreferrer" class="link-icon">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>` : ''}
                    </td>
                    <td data-label="Note" class="cella-editabile" title="${card.notes ? card.notes.replace(/"/g, '&quot;') + ' — ' : ''}clicca per modificare" onclick="event.stopPropagation(); modificaCampoInline('${idAttr}', '${card.tabella}', 'note', '${notesAttr}', 'Note', 'facoltativo')" style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted); font-size:0.75rem;">${card.notes ? escapeHtml(card.notes) : '—'}</td>
                    <td style="text-align:center;">
                        <div style="position:relative; display:inline-block;">
                            <button class="btn-danger" style="color:var(--text-muted);" onclick="event.stopPropagation(); toggleMenuAzioniTabella('${idAttr}')" title="Azioni"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div id="menuAzioniTabella-${idAttr}" class="menu-azioni-tabella" style="display:none;">
                                <button onclick="apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                                ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')" style="color:var(--success);"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-scambio-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); apriModaleQuantitaScambio('${idAttr}')"><i class="fa-solid fa-right-left"></i> ${_idsInScambio.has(String(card.id)) ? `In Scambio: ${_quantitaOfferteScambio[String(card.id)] ?? 0}` : 'Offri in Scambio'}</button>` : ''}
                                <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-chart-line"></i> Andamento prezzo</button>
                                ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button onclick="fotoApriCarta('${idAttr}')"><i class="fa-solid fa-camera"></i> Foto reali</button>` : ''}
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
            document.getElementById('stat-value').innerText = formattaEuro(totalSum);
            const uniqueLocs = [...new Set(data.map(item => item.location))].length;
            document.getElementById('stat-locations').innerText = uniqueLocs;

            _aggiornaBarraSelezioneMultipla();
        }

        function _rigaCompattaHtml(card, idAttr, locAttr, nomeAttr, langClass, condClass, varClass, immagineSrc, obiettivoRaggiunto) {
            const thumbCompatta = immagineSrc
                ? `<img src="${immagineSrc}" alt="" class="riga-compatta-thumb" loading="lazy" onclick="event.stopPropagation(); apriImmagineIngrandita('${idAttr}')" onerror="this.style.display='none';">`
                : '';
            const iconaVariazione = varClass === 'variation-up'
                ? '<i class="fa-solid fa-arrow-up" style="color:var(--success); font-size:0.7rem;"></i>'
                : (varClass === 'variation-down' ? '<i class="fa-solid fa-arrow-down" style="color:var(--danger); font-size:0.7rem;"></i>' : '');
            const linkSicuro = urlEsternoSicuro(card.link);
            const linkIcona = linkSicuro
                ? `<a href="${linkSicuro}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:var(--primary); flex-shrink:0;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.68rem;"></i></a>`
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
                        <span class="riga-compatta-prezzo" id="prezzoCellaCompatta-${idAttr}">${formattaEuro(card.price)}</span>
                        <button class="riga-compatta-menu-btn" onclick="event.stopPropagation(); toggleMenuCompatto('${idAttr}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <div class="riga-compatta-meta">
                        <span class="riga-compatta-meta-testo">${escapeHtml(metaTesto)}</span>
                        <span class="pill-location">${escapeHtml(card.location || '—')}</span>
                        ${obiettivoRaggiunto ? `<span class="pill-location" style="background-color:var(--success-bg); color:var(--success);">🎯 obiettivo</span>` : ''}
                        ${card.sigillataOriginale ? `<span class="pill-location" style="background-color:var(--primary-light); color:var(--primary);">📦 sigillata</span>` : ''}
                    </div>
                    <div class="riga-compatta-azioni" id="menuCompatto-${idAttr}" style="display:none;">
                        <button onclick="event.stopPropagation(); apriModificaCarta('${idAttr}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        ${card.tabella === 'wishlist' ? `<button onclick="segnaOttenuta('${card.id}')"><i class="fa-solid fa-check"></i> Ottenuta</button>` : ''}
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-binder-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); toggleBinderMembership('${idAttr}')"><i class="fa-solid fa-layer-group"></i> ${_idsNelBinder.has(String(card.id)) ? 'Rimuovi dal Binder' : 'Aggiungi al Binder'}</button>` : ''}
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button class="btn-scambio-toggle" data-id="${idAttr}" onclick="event.stopPropagation(); apriModaleQuantitaScambio('${idAttr}')"><i class="fa-solid fa-right-left"></i> ${_idsInScambio.has(String(card.id)) ? `In Scambio: ${_quantitaOfferteScambio[String(card.id)] ?? 0}` : 'Offri in Scambio'}</button>` : ''}
                        <button onclick="apriGraficoPrezzo('${idAttr}', '${card.tabella}', '${nomeAttr}')"><i class="fa-solid fa-chart-line"></i> Andamento</button>
                        ${card.tabella === 'carte' && card.stato === 'collezione' ? `<button onclick="fotoApriCarta('${idAttr}')"><i class="fa-solid fa-camera"></i> Foto</button>` : ''}
                        <button onclick="eliminaCarta('${card.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Elimina</button>
                    </div>
                </div>
            `;
        }
