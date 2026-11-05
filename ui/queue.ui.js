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
                        <i class="fa-solid fa-paper-plane"></i> Richiedi</button>`;
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

        let _matchRichiestaPendente = null;

        function apriRichiediMatch(ownerId, oggettoId, tipo, nomeOggetto, nomeAltro, prezzo) {
            apriRichiediMatchMulti(ownerId, nomeAltro, [{
                chiave: `pannello_${oggettoId}`, tipo, oggettoId,
                nome: nomeOggetto || '', code: '', img: null, prezzo: Number(prezzo) || 0,
            }]);
        }

        function apriRichiediMatchMulti(ownerId, nomeAltro, voci) {
            if (!ownerId || !voci || !voci.length) return;
            _matchRichiestaPendente = { ownerId, nomeAltro, voci: voci.map(v => ({ ...v, qty: 1 })) };
            _renderRichiediMatch();
            document.getElementById('richiediMatchModal').style.display = 'flex';
        }

        function _renderRichiediMatch() {
            const p = _matchRichiestaPendente;
            if (!p) return;
            const n = p.voci.length;
            document.getElementById('richiediMatchAvatar').textContent = (p.nomeAltro || '?').trim().charAt(0).toUpperCase() || '?';
            document.getElementById('richiediMatchTitolo').textContent = `Richiedi a ${p.nomeAltro}`;
            document.getElementById('richiediMatchSotto').textContent = n === 1 ? 'una sola richiesta con 1 oggetto' : `una sola richiesta con ${n} oggetti`;
            document.getElementById('richiediMatchLista').innerHTML = p.voci.map((v, i) => {
                const src = _urlImmagineVisualizzabile(v.img, 96);
                const miniatura = src
                    ? `<img class="match-img" src="${src}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'match-img match-img-vuota',innerHTML:'<i class=&quot;fa-solid fa-image&quot;></i>'}))">`
                    : `<span class="match-img match-img-vuota"><i class="fa-solid ${v.tipo === 'sealed' ? 'fa-box' : 'fa-image'}"></i></span>`;
                return `
                    <div class="richiedi-riga">
                        ${miniatura}
                        <div class="richiedi-testo">
                            <div class="match-riga-nome">${escapeHtml(v.nome || '(senza nome)')}</div>
                            ${v.code ? `<div class="match-riga-meta">${escapeHtml(v.code)}</div>` : ''}
                        </div>
                        <div class="richiedi-prezzo">${formattaEuro(v.prezzo)}</div>
                        <div class="richiedi-qty">
                            <button type="button" ${v.qty <= 1 ? 'disabled' : ''} onclick="_richiediMatchQty(${i}, -1)" aria-label="Meno">−</button>
                            <span>${v.qty}</span>
                            <button type="button" onclick="_richiediMatchQty(${i}, 1)" aria-label="Più">+</button>
                        </div>
                    </div>`;
            }).join('');
            const totale = p.voci.reduce((t, v) => t + v.prezzo * v.qty, 0);
            document.getElementById('richiediMatchTotale').textContent = formattaEuro(totale);
            document.getElementById('richiediMatchNota').textContent = `I prezzi restano fissati a oggi. ${p.nomeAltro} la trova in Richieste → Ricevute, tu in Richieste → Inviate.`;
            const btn = document.getElementById('btnConfermaRichiediMatch');
            btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Invia richiesta (${n} oggett${n === 1 ? 'o' : 'i'})`;
        }

        function _richiediMatchQty(i, delta) {
            const p = _matchRichiestaPendente;
            if (!p || !p.voci[i]) return;
            p.voci[i].qty = Math.max(1, p.voci[i].qty + delta);
            _renderRichiediMatch();
        }

        function chiudiRichiediMatch() {
            document.getElementById('richiediMatchModal').style.display = 'none';
            _matchRichiestaPendente = null;
        }

        async function confermaRichiediMatch() {
            if (!_matchRichiestaPendente) return;
            const { ownerId, voci } = _matchRichiestaPendente;

            const btn = document.getElementById('btnConfermaRichiediMatch');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio...';

            const righe = voci.map(v => ({ tipo: v.tipo, oggetto_id: v.oggettoId, quantita: v.qty }));
            const { error } = await inviaRichiestaScambio(ownerId, righe);

            btn.disabled = false;
            if (error) { _renderRichiediMatch(); mostraAvviso('❌ ' + error.message); return; }

            const chiavi = voci.map(v => v.chiave);
            chiudiRichiediMatch();
            if (typeof _widgetRichiesteSvuotaCache === 'function') _widgetRichiesteSvuotaCache();
            if (typeof _matchRichiestaInviata === 'function') _matchRichiestaInviata(chiavi);
            mostraAvviso('✅ Richiesta inviata! La trovi nella pagina Richieste, tab Inviate.');
        }
