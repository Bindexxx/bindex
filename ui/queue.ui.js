// Match automatico tra amici e relativo badge.

let _numNuoviMatchScambio = 0;
        let _numNuoviMatchWishlist = 0;
        let _matchLetturaFallita = false;

        function _chiaveMatch(m, tipo) {
            if (m.categoria === 'sealed') {
                return tipo === 'scambio' ? `s_${m.mio_prodotto_id}_${m.altra_wishlist_sealed_id}` : `s_${m.mia_wishlist_sealed_id}_${m.altro_prodotto_id}`;
            }
            return tipo === 'scambio' ? `${m.mia_carta_id}_${m.altra_wishlist_id}` : `${m.mia_wishlist_id}_${m.altra_carta_id}`;
        }

        function _matchVisti() {
            return prefMatchVistiGet();
        }

        function _segnaMatchVisti(chiavi) {
            const visti = _matchVisti();
            chiavi.forEach(c => visti.add(c));
            prefMatchVistiSet(visti);
        }

        const _giaNotificati = new Set();

        const _SOGLIA_RIEPILOGO_AVVISI = 3;
        function _notificaUnaVolta(elementi, chiaveDi, avvisoDi, riepilogoDi) {
            const nuovi = [];
            (elementi || []).forEach(el => {
                const chiave = chiaveDi(el);
                if (!chiave || _giaNotificati.has(chiave)) return;
                _giaNotificati.add(chiave);
                nuovi.push(el);
            });
            if (!nuovi.length) return;
            if (typeof riepilogoDi === 'function' && nuovi.length >= _SOGLIA_RIEPILOGO_AVVISI) {
                const [tipo, extra] = riepilogoDi(nuovi);
                CSBar.avvisa(tipo, extra);
                return;
            }
            nuovi.forEach(el => {
                const [tipo, extra] = avvisoDi(el);
                CSBar.avvisa(tipo, extra);
            });
        }

        function _elencoNomiAvviso(nomi) {
            const unici = [...new Set((nomi || []).filter(Boolean))];
            if (unici.length <= 2) return unici.join(' e ');
            return unici.slice(0, 2).join(', ') + ` e ${unici.length - 2 === 1 ? 'un altro' : 'altri ' + (unici.length - 2)}`;
        }

        async function aggiornaBadgeMatch() {
            const userId = await authGetUserId();
            if (!userId) return;

            const [{ data: dataScambio, error: errMatchScambio }, { data: dataWishlist, error: errMatchWishlist }] = await Promise.all([
                trovaMatch('trova_match_scambio_wishlist', userId),
                trovaMatch('trova_match_wishlist_scambio', userId),
            ]);
            _matchLetturaFallita = !!(errMatchScambio || errMatchWishlist);
            if (errMatchScambio && errMatchWishlist) {
                console.error('aggiornaBadgeMatch:', errMatchScambio.message, '|', errMatchWishlist.message);
                return;
            }

            (async () => {
                try {
                    const chiavi = [
                        ...(dataScambio || []).map(m => _chiaveMatch(m, 'scambio')),
                        ...(dataWishlist || []).map(m => _chiaveMatch(m, 'wishlist')),
                    ];
                    await missioniMatchTrovatiRegistraNuovi(userId, chiavi);
                } catch (e) { console.error('[missioni] registrazione match trovati:', e); }
            })();

            const visti = _matchVisti();
            const nuoviScambio = (dataScambio || []).filter(m => !visti.has(_chiaveMatch(m, 'scambio')));
            const nuoviWishlist = (dataWishlist || []).filter(m => !visti.has(_chiaveMatch(m, 'wishlist')));
            const { count: alertPrezzoNonVisti, nonVistiCarte: carteAlertPrezzo } = _contaAlertPrezzoNonVisti();

            if (typeof CSBar !== 'undefined') {
                const _nomeUtenteMatch = (nick) => (nick || '').trim() || 'qualcuno del gruppo';
                _notificaUnaVolta(nuoviScambio, m => _chiaveMatch(m, 'scambio'),
                    m => ['match-trovato', { text: `Hai una carta che interessa a ${_nomeUtenteMatch(m.altro_nickname)}.` }],
                    nuovi => ['match-trovato', { text: `${nuovi.length} tue carte interessano a ${_elencoNomiAvviso(nuovi.map(m => _nomeUtenteMatch(m.altro_nickname)))}.` }]);
                _notificaUnaVolta(nuoviWishlist, m => _chiaveMatch(m, 'wishlist'),
                    m => ['match-trovato', { text: `${_nomeUtenteMatch(m.altro_nickname)} ha una carta della tua Wishlist.` }],
                    nuovi => ['match-trovato', { text: `${nuovi.length} carte della tua Wishlist sono nel gruppo (${_elencoNomiAvviso(nuovi.map(m => _nomeUtenteMatch(m.altro_nickname)))}).` }]);
                _notificaUnaVolta(carteAlertPrezzo, c => 'prezzo-' + c.id,
                    c => ['prezzo-obiettivo', { text: `${c.name || 'Una carta della tua Wishlist'} ha raggiunto il tuo prezzo obiettivo.` }],
                    nuove => ['prezzo-obiettivo', { text: `${nuove.length} carte della tua Wishlist hanno raggiunto il prezzo obiettivo: ${_elencoNomiAvviso(nuove.map(c => c.name))}.` }]);
            }

            _numNuoviMatchScambio = nuoviScambio.length;
            _numNuoviMatchWishlist = nuoviWishlist.length;

            _aggiornaPallinoMenu('scambio', nuoviScambio.length);
            _aggiornaPallinoMenu('wishlist', nuoviWishlist.length + alertPrezzoNonVisti);
        }

        function _aggiornaPallinoMenu(tabId, conteggio) {
            document.querySelectorAll(`[data-badge-tab="${tabId}"]`).forEach(el => {
                el.textContent = conteggio > 9 ? '9+' : conteggio;
                el.style.display = conteggio > 0 ? 'flex' : 'none';
            });
        }

        async function caricaMatch(tabId) {
            const userId = await authGetUserId();
            const container = document.getElementById('pannelloMatch');
            if (!userId) { container.innerHTML = ''; return; }

            container.innerHTML = '<div class="card-panel" style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze...</div>';

            const funzioneCarte = tabId === 'scambio' ? 'trova_match_scambio_wishlist' : 'trova_match_wishlist_scambio';
            const funzioneSealed = tabId === 'scambio' ? 'trova_match_scambio_wishlist_sealed' : 'trova_match_wishlist_scambio_sealed';
            const [{ data: dataCarte, error: errCarte }, { data: dataSealed, error: errSealed }] = await Promise.all([
                trovaMatch(funzioneCarte, userId),
                trovaMatch(funzioneSealed, userId),
            ]);

            if (errCarte && errSealed) {
                container.innerHTML = `<div class="card-panel" style="padding:1rem; color:var(--danger); font-size:0.85rem;">Errore nella ricerca match: ${errCarte.message}</div>`;
                return;
            }
            if (errCarte) console.error('Errore match carte:', errCarte.message);
            if (errSealed) console.error('Errore match sealed:', errSealed.message);

            const data = [
                ...(dataCarte || []).map(m => ({ ...m, categoria: 'carta' })),
                ...(dataSealed || []).map(m => ({ ...m, categoria: 'sealed' })),
            ];

            if (data.length === 0) {
                container.innerHTML = '';
                if (tabId === 'wishlist') _segnaAlertPrezzoVisti(_contaAlertPrezzoNonVisti().chiavi);
                _aggiornaPallinoMenu(tabId, 0);
                return;
            }

            _segnaMatchVisti(data.map(m => _chiaveMatch(m, tabId)));
            if (tabId === 'wishlist') _segnaAlertPrezzoVisti(_contaAlertPrezzoNonVisti().chiavi);
            _aggiornaPallinoMenu(tabId, 0);

            const righe = data.map(m => {
                const persona = escapeHtml((m.altro_nickname || '').trim() || 'qualcuno del gruppo');
                let bottone = '';
                if (tabId === 'wishlist') {
                    const oggettoId = m.categoria === 'sealed' ? m.altro_prodotto_id : m.altra_carta_id;
                    const tipoRichiesta = m.categoria === 'sealed' ? 'sealed' : 'carta';
                    const nomeAttr = escapeJsAttr(m.mio_nome || '');
                    const personaAttr = escapeJsAttr((m.altro_nickname || '').trim() || 'qualcuno del gruppo');
                    bottone = `<button class="btn-secondary" style="padding:0.35rem 0.7rem; font-size:0.78rem; white-space:nowrap;"
                        onclick="apriRichiediMatch('${m.altro_owner_id}', '${oggettoId}', '${tipoRichiesta}', '${nomeAttr}', '${personaAttr}', ${Number(m.altro_prezzo) || 0})">
                        <i class="fa-solid fa-right-left"></i> Proponi</button>`;
                }

                if (tabId === 'scambio') {
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color); gap:0.5rem;">
                        <span style="font-size:0.85rem;"><strong>${escapeHtml(m.mio_nome)}</strong> (tuo${m.categoria === 'sealed' ? ' sealed' : ''}, ${formattaEuro(m.mio_prezzo || 0)}) — cercato da <strong>${persona}</strong>${m.altro_prezzo_obiettivo != null ? ` (fino a ${formattaEuro(m.altro_prezzo_obiettivo)})` : ''}</span>
                    </div>`;
                }
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color); gap:0.5rem;">
                    <span style="font-size:0.85rem;"><strong>${escapeHtml(m.mio_nome)}</strong> (in wishlist${m.categoria === 'sealed' ? ' sealed' : ''}${m.mio_prezzo_obiettivo != null ? `, fino a ${formattaEuro(m.mio_prezzo_obiettivo)}` : ''}) — in scambio da <strong>${persona}</strong> a ${formattaEuro(m.altro_prezzo || 0)}</span>
                    ${bottone}
                </div>`;
            }).join('');

            container.innerHTML = `
                <div class="card-panel" style="padding:1rem;">
                    <div style="font-weight:800; font-size:0.9rem; margin-bottom:0.5rem; color:var(--primary);">
                        <i class="fa-solid fa-handshake"></i> ${data.length} corrispondenz${data.length === 1 ? 'a trovata' : 'e trovate'} nel gruppo!
                    </div>
                    ${righe}
                </div>
            `;
        }

        // Dal pannello dei match di Scambio/Wishlist: la proposta di scambio (ui/proposta-scambio.ui.js),
        // già con quell'oggetto tra quelli che ricevi.
        function apriRichiediMatch(ownerId, oggettoId, tipo, nomeOggetto, nomeAltro, prezzo) {
            if (!ownerId || !oggettoId) return;
            apriPropostaScambio({ altroId: ownerId, nomeAltro, ricevi: [{ tipo: tipo || 'carta', oggettoId, quantita: 1 }] });
        }
