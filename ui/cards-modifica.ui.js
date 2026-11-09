// Collezione: menu della riga, modifica ed eliminazione della carta, tendine nella riga.

function toggleMenuCompatto(id) {
            const menu = document.getElementById('menuCompatto-' + id);
            if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
        }

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

        window.addEventListener('resize', () => {
            clearTimeout(_resizeTimeout);
            _resizeTimeout = setTimeout(() => {
                if (MODI_CON_VISTA_COMPATTA.includes(currentMode)) filterTable();
            }, 200);
        });

        function apriModificaCarta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;
            _cartaInModifica = card;

            document.getElementById('editNome').value = card.name;
            document.getElementById('editCodice').value = card.code;

            const isWishlist = card.tabella === 'wishlist';
            const LINGUE = ['IT', 'EN', 'DE', 'FR', 'ES', 'PT', 'JP', 'KOR', 'CHN', 'CHN-T', 'IND', 'THAI', 'RU'];
            const selLingua = document.getElementById('editLingua');
            selLingua.innerHTML = (isWishlist ? '<option value="">Qualsiasi lingua</option>' : '') +
                LINGUE.map(l => `<option value="${l}">${l}</option>`).join('');
            if (card.lang && !LINGUE.includes(card.lang)) selLingua.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(card.lang)}">${escapeHtml(card.lang)}</option>`);
            selLingua.value = card.lang || '';

            const CONDIZIONI = ['MT', 'NM+', 'NM', 'NM-', 'EX+', 'EX', 'EX-', 'GD+', 'GD', 'GD-', 'LP+', 'LP', 'LP-', 'PL+', 'PL', 'PL-', 'PO+', 'PO'];
            if (card.cond && !CONDIZIONI.includes(card.cond)) CONDIZIONI.unshift(card.cond);
            const selCondizione = document.getElementById('editCondizione');
            selCondizione.innerHTML = CONDIZIONI.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
            selCondizione.value = card.cond;
            document.getElementById('labelEditCondizione').textContent = isWishlist ? 'Condizione minima accettata' : 'Condizione';
            document.getElementById('editQty').value = card.qty;
            document.getElementById('editPrezzo').value = card.price || '';
            document.getElementById('editNote').value = card.notes;
            document.getElementById('editLink').value = card.link && card.link !== '#' ? card.link : '';

            const inputLocation = document.getElementById('editLocation');
            inputLocation.value = isWishlist ? '' : card.location;
            inputLocation.disabled = isWishlist;
            inputLocation.placeholder = isWishlist ? 'Non applicabile alla wishlist' : '';

            const campoSigillata = document.getElementById('campoEditSigillata');
            campoSigillata.style.display = isWishlist ? 'none' : 'flex';
            document.getElementById('editSigillata').checked = !isWishlist && !!card.sigillataOriginale;

            const campoObiettivo = document.getElementById('campoEditObiettivo');
            campoObiettivo.style.display = isWishlist ? '' : 'none';
            if (isWishlist) {
                document.getElementById('editObiettivo').value = card.prezzoObiettivo != null ? card.prezzoObiettivo : '';
            }

            const datalist = document.getElementById('datalistEditLocation');
            datalist.innerHTML = [...new Set(carteReali.map(c => c.location).filter(Boolean))]
                .map(loc => `<option value="${escapeHtml(loc)}"></option>`).join('');

            document.getElementById('editCardModal').style.display = 'flex';
        }

        function chiudiModificaCarta() {
            document.getElementById('editCardModal').style.display = 'none';
            _cartaInModifica = null;
        }

        async function salvaModificaCarta() {
            if (!_cartaInModifica) return;
            const isWishlist = _cartaInModifica.tabella === 'wishlist';
            const idCartaModificata = _cartaInModifica.id;
            const prezzoPrecedente = _cartaInModifica.price;
            const qtyPrecedente = _cartaInModifica.qty;
            const nomePrecedente = _cartaInModifica.name;

            const aggiornamento = {
                nome: document.getElementById('editNome').value.trim(),
                codice: document.getElementById('editCodice').value.trim(),
                lingua: document.getElementById('editLingua').value,
                condizione: document.getElementById('editCondizione').value,
                qty: Math.max(1, parseInt(document.getElementById('editQty').value, 10) || 1),
                prezzo: document.getElementById('editPrezzo').value !== '' ? parseFloat(document.getElementById('editPrezzo').value) : null,
                note: document.getElementById('editNote').value.trim() || null,
            };
            const linkScritto = document.getElementById('editLink').value.trim();
            const linkPrecedente = _cartaInModifica.link && _cartaInModifica.link !== '#' ? _cartaInModifica.link : '';
            if (linkScritto !== linkPrecedente) {
                let linkPulito = null;
                try {
                    const indirizzo = new URL(linkScritto);
                    if (indirizzo.protocol === 'https:' && /(^|\.)cardmarket\.com$/i.test(indirizzo.hostname)) linkPulito = indirizzo.href;
                } catch (_) {}
                if (linkScritto && !linkPulito) {
                    mostraAvviso('Il link deve essere una pagina di cardmarket.com.');
                    return;
                }
                aggiornamento.url = linkPulito;
                if (!isWishlist && _cartaInModifica.esitoControllo) {
                    aggiornamento.esito_controllo = null;
                    aggiornamento.esito_controllo_il = null;
                }
            }
            if (!isWishlist) {
                aggiornamento.location = document.getElementById('editLocation').value.trim() || null;
                aggiornamento.sigillata_originale = document.getElementById('editSigillata').checked;
                if (_cartaInModifica.esitoControllo
                    && (aggiornamento.lingua !== _cartaInModifica.lang || aggiornamento.condizione !== _cartaInModifica.cond)) {
                    aggiornamento.esito_controllo = null;
                    aggiornamento.esito_controllo_il = null;
                }
            } else {
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
                mostraAvviso('❌ Errore nel salvare le modifiche: ' + error.message);
                return;
            }

            if (!isWishlist) {
                (async () => {
                    const userId = await authGetUserId();
                    if (!userId) return;
                    const righe = [];
                    if (aggiornamento.prezzo != null && prezzoPrecedente != null && aggiornamento.prezzo !== prezzoPrecedente) {
                        righe.push({
                            owner_id: userId, tipo_evento: 'prezzo_manuale', oggetto_tipo: 'carta',
                            oggetto_id: idCartaModificata, nome_snapshot: aggiornamento.nome || nomePrecedente || '',
                            quantita_delta: null, prezzo_unitario: aggiornamento.prezzo,
                            valore_delta: (aggiornamento.prezzo - prezzoPrecedente) * (Number(aggiornamento.qty) || 1),
                            fonte: 'sito',
                        });
                    }
                    if (aggiornamento.qty !== qtyPrecedente) {
                        righe.push({
                            owner_id: userId, tipo_evento: 'variazione_quantita', oggetto_tipo: 'carta',
                            oggetto_id: idCartaModificata, nome_snapshot: aggiornamento.nome || nomePrecedente || '',
                            quantita_delta: aggiornamento.qty - qtyPrecedente, prezzo_unitario: aggiornamento.prezzo,
                            valore_delta: (aggiornamento.qty - qtyPrecedente) * (Number(aggiornamento.prezzo) || 0),
                            fonte: 'sito',
                        });
                    }
                    if (righe.length) {
                        const { error: errMov } = await movimentiCollezioneInsertRighe(righe);
                        if (errMov) console.error('Log movimenti (modifica carta, modale):', errMov.message);
                    }
                })();
            }

            const direzionePrezzo = (aggiornamento.prezzo != null && prezzoPrecedente != null)
                ? (aggiornamento.prezzo > prezzoPrecedente ? 'su' : (aggiornamento.prezzo < prezzoPrecedente ? 'giu' : null))
                : null;

            chiudiModificaCarta();
            await caricaCarteReali();
            if (typeof _pzDisegnaEsiti === 'function') _pzDisegnaEsiti();
            if (direzionePrezzo) _animaPrezzoCarta(idCartaModificata, direzionePrezzo);
        }

        async function segnaOttenuta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card || card.tabella !== 'wishlist') return;

            const userId = await authGetUserId();
            if (!userId) return;

            const location = await chiediTesto({
                titolo: 'Carta ottenuta',
                testo: `In che Location metti "${card.name}"? Lascia vuoto per "?".`,
                segnaposto: '?',
                opzioni: await _locationDisponibili(),
                conferma: 'Sposta in collezione',
            });
            if (location === null) return;

            const { error: errInsert, data: righeInserite } = await cardsInsertNellaCollezione({
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
                mostraAvviso('❌ Errore nello spostare la carta in collezione: ' + errInsert.message);
                return;
            }

            const nuovaCarta = righeInserite && righeInserite[0];
            if (nuovaCarta) {
                movimentiCollezioneInsertRighe([{
                    owner_id: userId, tipo_evento: 'aggiunta', oggetto_tipo: 'carta',
                    oggetto_id: nuovaCarta.id, nome_snapshot: card.name || '',
                    quantita_delta: card.qty, prezzo_unitario: card.price || null,
                    valore_delta: card.price != null ? card.price * (Number(card.qty) || 1) : null,
                    fonte: 'sito',
                }]).then(({ error: errMov }) => {
                    if (errMov) console.error('Log movimenti (segna ottenuta):', errMov.message);
                });
            }

            const { error: errDelete } = await wishlistDelete(card.id);
            if (errDelete) {
                mostraAvviso('⚠️ Carta aggiunta alla collezione, ma non rimossa dalla wishlist: ' + errDelete.message + '\n\nRimuovila a mano dalla wishlist per evitare doppioni.');
            }

            await caricaCarteReali();
        }

        async function eliminaCarta(id) {
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;
            const isWishlist = card.tabella === 'wishlist';
            const nelCestino = !isWishlist && typeof cestinoAttivo === 'function' && await cestinoAttivo();
            const sicuro = await chiediConferma({
                titolo: isWishlist ? 'Togliere dalla wishlist?' : 'Eliminare la carta?',
                testo: `"${card.name}" esce dalla${isWishlist ? ' wishlist' : ' collezione'}.\n\n` + (isWishlist ? 'Questa azione non si può annullare.' : cestinoTestoConferma(nelCestino)),
                conferma: 'Elimina',
                pericolo: true,
            });
            if (!sicuro) return;

            const { error } = await cardsDeleteById(isWishlist, id);
            if (error) {
                mostraAvviso('❌ Errore nell\'eliminazione: ' + error.message);
                return;
            }

            if (!isWishlist) {
                (async () => {
                    const userId = await authGetUserId();
                    if (!userId) return;
                    const { error: errMov } = await movimentiCollezioneInsertRighe([{
                        owner_id: userId, tipo_evento: 'rimozione', oggetto_tipo: 'carta',
                        oggetto_id: id, nome_snapshot: card.name || '',
                        quantita_delta: -(Number(card.qty) || 1), prezzo_unitario: card.price || null,
                        valore_delta: card.price != null ? -(card.price * (Number(card.qty) || 1)) : null,
                        fonte: 'sito',
                    }]);
                    if (errMov) console.error('Log movimenti (eliminazione carta):', errMov.message);
                })();
            }

            await caricaCarteReali();
            if (isWishlist) avvisoBreve(`"${card.name}" tolta dalla wishlist.`, { tipo: 'ok' });
            else cestinoOffriAnnulla('carte', [{ id, nome: card.name }], `"${card.name}" eliminata.`);
        }

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
            const opzioni = ['IT', 'EN', 'DE', 'FR', 'ES', 'PT', 'JP', 'KOR', 'CHN', 'CHN-T', 'IND', 'THAI', 'RU'];
            if (tabella === 'wishlist') opzioni.unshift('');
            _apriSelectInline(span, id, tabella, 'lingua', valoreAttuale, opzioni);
        }

        function modificaCondizioneInline(event, id, tabella, valoreAttuale) {
            const span = event.target.closest('span');
            _apriSelectInline(span, id, tabella, 'condizione', valoreAttuale,
                ['MT', 'NM+', 'NM', 'NM-', 'EX+', 'EX', 'EX-', 'GD+', 'GD', 'GD-', 'LP+', 'LP', 'LP-', 'PL+', 'PL', 'PL-', 'PO+', 'PO']);
        }

        function _apriSelectInline(elemento, id, tabella, campo, valoreAttuale, opzioni) {
            if (valoreAttuale && !opzioni.includes(valoreAttuale)) opzioni = [valoreAttuale, ...opzioni];
            const select = document.createElement('select');
            select.style.cssText = 'font-size:0.75rem; padding:0.25rem; border-radius:6px; border:1px solid var(--primary); font-weight:700;';
            opzioni.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt === '' ? 'Qualsiasi' : opt;
                if (opt === valoreAttuale) o.selected = true;
                select.appendChild(o);
            });
            select.onclick = (e) => e.stopPropagation();
            select.onblur = () => filterTable();
            select.onchange = async () => {
                const nuovo = select.value;
                if (nuovo === valoreAttuale) { filterTable(); return; }
                if (!(await chiediConferma({ titolo: 'Salvare la modifica?', testo: `"${campo}" = "${nuovo || 'Qualsiasi'}"`, conferma: 'Salva' }))) { filterTable(); return; }
                const { error } = await cardsUpdateCampo(tabella, id, campo, nuovo);
                if (error) { mostraAvviso(`❌ Errore nel salvare: ` + error.message); filterTable(); return; }
                const carta = carteReali.find(c => String(c.id) === String(id));
                if (tabella === 'carte' && (campo === 'lingua' || campo === 'condizione') && carta && carta.esitoControllo) {
                    const { error: errEsito } = await cardsAzzeraEsitoControllo(id);
                    if (errEsito) console.error('[esito controllo] azzeramento:', errEsito.message);
                }
                await caricaCarteReali();
                if (typeof _pzDisegnaEsiti === 'function') _pzDisegnaEsiti();
            };
            elemento.replaceWith(select);
            select.focus();
        }

        async function modificaCampoInline(id, tabella, campo, valoreAttuale, etichetta, tipo) {
            const nuovo = await chiediTesto({
                titolo: etichetta,
                testo: 'Nuovo valore:',
                valore: valoreAttuale ?? '',
                numerico: tipo === 'intero' || tipo === 'numero',
                conferma: 'Avanti',
            });
            if (nuovo === null) return;
            let valore = nuovo.trim();

            if (tipo === 'intero') {
                valore = parseInt(valore, 10);
                if (isNaN(valore) || valore < 1) { mostraAvviso('⚠️ Inserisci un numero intero maggiore di zero.'); return; }
            } else if (tipo === 'numero') {
                valore = parseFloat(valore.replace(',', '.'));
                if (isNaN(valore) || valore < 0) { mostraAvviso('⚠️ Inserisci un prezzo valido (es. 12.50).'); return; }
            } else if (tipo === 'facoltativo') {
                if (valore === '') valore = null;
            } else if (valore === '') {
                mostraAvviso(`⚠️ "${etichetta}" non può essere vuoto.`); return;
            }

            const _normalizza = (v) => (v === null || v === undefined) ? '' : String(v);
            if (_normalizza(valore) === _normalizza(valoreAttuale)) return;
            if (!(await chiediConferma({ titolo: 'Salvare la modifica?', testo: `"${etichetta}" = "${valore === null ? '(vuoto)' : valore}"`, conferma: 'Salva' }))) return;

            const cardPrima = carteReali.find(c => String(c.id) === String(id));

            const { error } = await cardsUpdateCampo(tabella, id, campo, valore);
            if (error) { mostraAvviso(`❌ Errore nel salvare "${etichetta}": ` + error.message); return; }

            if (tabella === 'carte' && (campo === 'prezzo' || campo === 'qty') && cardPrima) {
                (async () => {
                    const userId = await authGetUserId();
                    if (!userId) return;
                    const riga = campo === 'prezzo' ? {
                        tipo_evento: 'prezzo_manuale',
                        quantita_delta: null,
                        prezzo_unitario: valore,
                        valore_delta: (Number(valore) - Number(valoreAttuale || 0)) * (Number(cardPrima.qty) || 1),
                    } : {
                        tipo_evento: 'variazione_quantita',
                        quantita_delta: Number(valore) - Number(valoreAttuale || 0),
                        prezzo_unitario: cardPrima.price,
                        valore_delta: (Number(valore) - Number(valoreAttuale || 0)) * (Number(cardPrima.price) || 0),
                    };
                    const { error: errMov } = await movimentiCollezioneInsertRighe([{
                        owner_id: userId,
                        oggetto_tipo: 'carta',
                        oggetto_id: id,
                        nome_snapshot: cardPrima.name || '',
                        fonte: 'sito',
                        ...riga,
                    }]);
                    if (errMov) console.error('Log movimenti (modifica campo inline):', errMov.message);
                })();
            }

            const direzionePrezzo = campo === 'prezzo'
                ? (valore > valoreAttuale ? 'su' : (valore < valoreAttuale ? 'giu' : null))
                : null;

            await caricaCarteReali();
            if (direzionePrezzo) _animaPrezzoCarta(id, direzionePrezzo);
        }
