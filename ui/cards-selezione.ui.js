// Collezione: selezione di più righe.

function toggleSelezionaTutte(checked) {
            document.querySelectorAll('.riga-checkbox').forEach(cb => { cb.checked = checked; });
            aggiornaSelezioneMultipla();
        }

        function _righeSelezionate() {
            return [...document.querySelectorAll('.riga-checkbox:checked')].map(cb => ({
                id: cb.dataset.id, tabella: cb.dataset.tabella,
            }));
        }

        function svuotaSelezioneMultipla() {
            document.querySelectorAll('.riga-checkbox:checked').forEach(cb => { cb.checked = false; });
            if (typeof collSvuotaSelezioneTel === 'function') collSvuotaSelezioneTel();
            _aggiornaBarraSelezioneMultipla();
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
            const nCarte = righe.filter(r => r.tabella === 'carte').length;
            const nelCestino = nCarte > 0 && typeof cestinoAttivo === 'function' && await cestinoAttivo();
            const sicuro = await chiediConferma({
                titolo: `Eliminare ${righe.length} cart${righe.length === 1 ? 'a' : 'e'}?`,
                testo: nCarte === righe.length ? cestinoTestoConferma(nelCestino)
                    : (nCarte ? cestinoTestoConferma(nelCestino) + '\nLe righe della wishlist invece no.' : 'Questa azione non si può annullare.'),
                conferma: 'Elimina',
                pericolo: true,
            });
            if (!sicuro) return;

            const idsPerTabella = {};
            righe.forEach(r => { (idsPerTabella[r.tabella] ||= []).push(r.id); });

            for (const [tabella, ids] of Object.entries(idsPerTabella)) {
                const { error } = await cardsDeleteBatch(tabella, ids);
                if (error) { mostraAvviso(`❌ Errore nell'eliminazione (${tabella}): ` + error.message); await caricaCarteReali(); return; }
            }
            svuotaSelezioneMultipla();
            await caricaCarteReali();
            const testo = `${righe.length} cart${righe.length === 1 ? 'a eliminata' : 'e eliminate'}.`;
            if (nCarte) cestinoOffriAnnulla('carte', (idsPerTabella.carte || []).map(id => ({ id })), testo);
            else avvisoBreve(testo, { tipo: 'ok' });
        }

        async function aggiungiSelezionateAlBinder() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;

            if (!_binderExtraId) {
                mostraAvviso('❌ Il tuo binder personale non è ancora pronto — riprova tra un istante.');
                return;
            }

            const idsEleggibili = righe
                .filter(r => r.tabella === 'carte')
                .map(r => r.id)
                .filter(id => !_idsNelBinder.has(String(id)));

            if (idsEleggibili.length === 0) {
                mostraAvviso('Nessuna carta selezionata da aggiungere: erano già tutte nel Binder, oppure erano righe di Wishlist (non aggiungibili al Binder).');
                return;
            }

            const userId = await authGetUserId();
            if (!userId) return;

            const { error } = await binderCarteInsert(idsEleggibili.map(id => ({ owner_id: userId, binder_id: _binderExtraId, carta_id: id })));
            if (error) { mostraAvviso('❌ Errore nell\'aggiungere le carte al Binder: ' + error.message); return; }

            idsEleggibili.forEach(id => {
                _idsNelBinder.add(String(id));
                _aggiornaBottoniBinderToggle(id);
            });

            svuotaSelezioneMultipla();
        }

        async function mettiSelezionateIn() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;
            const scelta = await _scegliDestinazioneSelezionate(righe.length);
            if (!scelta) return;
            if (scelta.tipo === 'extra') return aggiungiSelezionateAlBinder();
            if (scelta.tipo === 'scambio') return _mettiSelezionateInScambio();
            if (scelta.tipo === 'nuova') return spostaLocationSelezionate();
            if (scelta.tipo === 'location') return _spostaLocationSelezionateIn(righe, scelta.valore);
            if (scelta.tipo === 'location2') return _impostaLocationSecondariaSelezionate(righe, scelta.valore);
        }

        async function _scegliDestinazioneSelezionate(n) {
            const extra = (_bindersElenco || []).find(b => b.tipo === 'extra');
            const nomeExtra = (extra && extra.nome) || 'Il mio binder';
            const locations = typeof _locationDisponibili === 'function' ? await _locationDisponibili() : [];
            return _avvisoFinestra((box, chiudi) => {
                _avvisoTitolo(box, `Metti ${n} cart${n === 1 ? 'a' : 'e'} in…`, null);
                const lista = document.createElement('div');
                lista.className = 'metti-in-lista';
                const voce = (icona, testo, nota, valore) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'metti-in-voce';
                    const i = document.createElement('i');
                    i.className = 'fa-solid ' + icona;
                    i.setAttribute('aria-hidden', 'true');
                    const t = document.createElement('span');
                    t.textContent = testo;
                    b.append(i, t);
                    if (nota) { const s = document.createElement('small'); s.textContent = nota; b.appendChild(s); }
                    b.addEventListener('click', () => chiudi(valore));
                    lista.appendChild(b);
                    return b;
                };
                const sezione = (testo) => { const h = document.createElement('div'); h.className = 'metti-in-sezione'; h.textContent = testo; lista.appendChild(h); };
                sezione('Binder');
                const primo = voce('fa-star', nomeExtra, 'restano nella loro location', { tipo: 'extra' });
                voce('fa-right-left', 'Scambio', 'tutte le copie, restano nella loro location', { tipo: 'scambio' });
                sezione('Location (sposta le carte)');
                locations.filter(l => l && l !== '?').forEach(l => voce('fa-warehouse', l, '', { tipo: 'location', valore: l }));
                voce('fa-plus', 'Nuova location…', '', { tipo: 'nuova' });
                // sql/158: etichetta in più, le carte restano dove sono
                sezione('Location secondaria (le carte restano dove sono)');
                locations.filter(l => l && l !== '?').forEach(l => voce('fa-bookmark', l, '', { tipo: 'location2', valore: l }));
                voce('fa-eraser', 'Togli la location secondaria', '', { tipo: 'location2', valore: '' });
                box.appendChild(lista);
                _avvisoBottoni(box, [{ etichetta: 'Annulla', classe: 'btn-secondary avviso-annulla', fn: () => chiudi(null) }]);
                return { conferma: () => null, annulla: () => null, fuoco: primo };
            });
        }

        async function _mettiSelezionateInScambio() {
            const righe = _righeSelezionate();
            const userId = await authGetUserId();
            if (!userId) return;
            if (!_binderScambioId) { mostraAvviso('❌ Il tuo binder Scambio non è ancora pronto — riprova tra un istante.'); return; }
            const carte = righe
                .filter(r => r.tabella === 'carte')
                .map(r => carteReali.find(c => String(c.id) === String(r.id) && c.tabella === 'carte'))
                .filter(c => c && c.stato === 'collezione');
            const daMettere = carte.filter(c => _quantitaOfferteScambio[String(c.id)] !== (Number(c.qty) || 1));
            if (daMettere.length === 0) {
                mostraAvviso(carte.length ? 'Le carte selezionate erano già tutte in Scambio con tutte le copie.' : 'Nessuna carta da mettere in Scambio: le righe della Wishlist non si possono offrire.');
                return;
            }
            const { error } = await binderCarteImpostaQuantitaScambioBatch(userId, _binderScambioId,
                daMettere.map(c => ({ cartaId: c.id, quantita: Number(c.qty) || 1 })));
            if (error) { mostraAvviso('❌ Errore nel mettere le carte in Scambio: ' + error.message); return; }
            daMettere.forEach(c => {
                _idsInScambio.add(String(c.id));
                _quantitaOfferteScambio[String(c.id)] = Number(c.qty) || 1;
                _aggiornaBottoniScambioToggle(c.id);
            });
            svuotaSelezioneMultipla();
            if (typeof filterTable === 'function') filterTable();
            const copie = daMettere.reduce((t, c) => t + (Number(c.qty) || 1), 0);
            const saltate = righe.length - daMettere.length;
            avvisoBreve(`${daMettere.length} cart${daMettere.length === 1 ? 'a' : 'e'} in Scambio (${copie} copi${copie === 1 ? 'a' : 'e'})${saltate ? ` · ${saltate} già dentro o non offribil${saltate === 1 ? 'e' : 'i'}` : ''}.`, { tipo: 'ok' });
        }

        async function spostaLocationSelezionate() {
            const righe = _righeSelezionate();
            if (righe.length === 0) return;
            const nuovo = await chiediTesto({
                titolo: `Sposta ${righe.length} cart${righe.length === 1 ? 'a' : 'e'}`,
                testo: 'In quale Location?',
                opzioni: typeof _locationDisponibili === 'function' ? await _locationDisponibili() : [],
                conferma: 'Avanti',
            });
            if (nuovo === null) return;
            return _spostaLocationSelezionateIn(righe, nuovo.trim());
        }

        async function _spostaLocationSelezionateIn(righe, valore) {
            if (!(await chiediConferma({ titolo: 'Spostare le carte?', testo: `${righe.length} cart${righe.length === 1 ? 'a' : 'e'} in "${valore || '(vuota)'}".`, conferma: 'Sposta' }))) return;

            const primaDi = righe.map(r => {
                const c = carteReali.find(x => String(x.id) === String(r.id) && x.tabella === r.tabella);
                return { tabella: r.tabella, id: r.id, location: c ? (c.location || '') : '', locationSecondaria: c ? (c.locationSecondaria || '') : '' };
            });

            const idsPerTabella = {};
            righe.forEach(r => { (idsPerTabella[r.tabella] ||= []).push(r.id); });

            for (const [tabella, ids] of Object.entries(idsPerTabella)) {
                const { error } = await cardsUpdateLocationBatch(tabella, ids, valore);
                if (error) { mostraAvviso(`❌ Errore nello spostare la location (${tabella}): ` + error.message); await caricaCarteReali(); return; }
            }
            svuotaSelezioneMultipla();
            await caricaCarteReali();
            avvisoBreve(`${righe.length} cart${righe.length === 1 ? 'a spostata' : 'e spostate'} in "${valore || '(vuota)'}".`, {
                tipo: 'ok', durata: 6000,
                azione: { etichetta: 'Annulla', fn: () => _annullaSpostamentoLocation(primaDi) },
            });
        }

        // sql/158: location secondaria alle carte selezionate ('' = la tolgo). La wishlist non ce l'ha.
        async function _impostaLocationSecondariaSelezionate(righe, valore) {
            const carte = righe
                .filter(r => r.tabella === 'carte')
                .map(r => carteReali.find(c => String(c.id) === String(r.id) && c.tabella === 'carte'))
                .filter(Boolean);
            if (carte.length === 0) { mostraAvviso('Le righe della Wishlist non hanno la location secondaria.'); return; }
            const n = carte.length;
            const quante = `${n} cart${n === 1 ? 'a' : 'e'}`;
            const uguali = valore ? carte.filter(c => String(c.location || '').toLowerCase() === valore.toLowerCase()).length : 0;
            const testo = (valore
                ? `Location secondaria "${valore}" per ${quante}. Restano nella loro location: è solo un'etichetta in più.`
                : `Tolgo la location secondaria da ${quante}.`)
                + (uguali ? `\n\n${uguali} ${uguali === 1 ? 'è già' : 'sono già'} in "${valore}" come location principale: lì non serve e resta vuota.` : '')
                + (righe.length > n ? `\n\n${righe.length - n} righe della Wishlist saltate.` : '');
            if (!(await chiediConferma({ titolo: valore ? 'Location secondaria' : 'Togliere la location secondaria?', testo, conferma: valore ? 'Imposta' : 'Togli' }))) return;

            const primaDi = carte.map(c => ({ id: c.id, valore: c.locationSecondaria || '' }));
            const { error } = await cardsUpdateLocationSecondariaBatch(carte.map(c => c.id), valore);
            if (error) { mostraAvviso('❌ Errore nel salvare la location secondaria: ' + error.message); await caricaCarteReali(); return; }
            svuotaSelezioneMultipla();
            await caricaCarteReali();
            avvisoBreve(valore ? `${quante}: location secondaria "${valore}".` : `${quante}: location secondaria tolta.`, {
                tipo: 'ok', durata: 6000,
                azione: { etichetta: 'Annulla', fn: () => _annullaLocationSecondaria(primaDi) },
            });
        }

        async function _annullaLocationSecondaria(primaDi) {
            const gruppi = new Map();
            primaDi.forEach(r => { if (!gruppi.has(r.valore)) gruppi.set(r.valore, []); gruppi.get(r.valore).push(r.id); });
            let errore = null;
            for (const [valore, ids] of gruppi) {
                const { error } = await cardsUpdateLocationSecondariaBatch(ids, valore);
                if (error) { errore = error; break; }
            }
            await caricaCarteReali();
            if (errore) mostraAvviso('❌ Annullamento non riuscito: ' + errore.message);
            else avvisoBreve('Location secondaria ripristinata.', { tipo: 'ok' });
        }

        async function _annullaSpostamentoLocation(primaDi) {
            const gruppi = new Map();
            primaDi.forEach(r => {
                const k = r.tabella + '|' + r.location;
                if (!gruppi.has(k)) gruppi.set(k, { tabella: r.tabella, location: r.location, ids: [] });
                gruppi.get(k).ids.push(r.id);
            });
            let errore = null;
            for (const g of gruppi.values()) {
                const { error } = await cardsUpdateLocationBatch(g.tabella, g.ids, g.location);
                if (error) { errore = error; break; }
            }
            // sql/158: la secondaria uguale alla nuova location il DB l'aveva tolta: torna com'era
            const secondarie = new Map();
            primaDi.forEach(r => { if (r.tabella === 'carte' && r.locationSecondaria) { if (!secondarie.has(r.locationSecondaria)) secondarie.set(r.locationSecondaria, []); secondarie.get(r.locationSecondaria).push(r.id); } });
            for (const [valore, ids] of secondarie) {
                if (errore) break;
                const { error } = await cardsUpdateLocationSecondariaBatch(ids, valore);
                if (error) errore = error;
            }
            await caricaCarteReali();
            if (errore) mostraAvviso('❌ Annullamento non riuscito: ' + errore.message);
            else avvisoBreve('Spostamento annullato.', { tipo: 'ok' });
        }
