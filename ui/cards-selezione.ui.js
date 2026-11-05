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

            document.querySelectorAll('.riga-checkbox:checked').forEach(cb => { cb.checked = false; });
            _aggiornaBarraSelezioneMultipla();
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
            const valore = nuovo.trim();
            if (!(await chiediConferma({ titolo: 'Spostare le carte?', testo: `${righe.length} cart${righe.length === 1 ? 'a' : 'e'} in "${valore || '(vuota)'}".`, conferma: 'Sposta' }))) return;

            const primaDi = righe.map(r => {
                const c = carteReali.find(x => String(x.id) === String(r.id) && x.tabella === r.tabella);
                return { tabella: r.tabella, id: r.id, location: c ? (c.location || '') : '' };
            });

            const idsPerTabella = {};
            righe.forEach(r => { (idsPerTabella[r.tabella] ||= []).push(r.id); });

            for (const [tabella, ids] of Object.entries(idsPerTabella)) {
                const { error } = await cardsUpdateLocationBatch(tabella, ids, valore);
                if (error) { mostraAvviso(`❌ Errore nello spostare la location (${tabella}): ` + error.message); await caricaCarteReali(); return; }
            }
            await caricaCarteReali();
            avvisoBreve(`${righe.length} cart${righe.length === 1 ? 'a spostata' : 'e spostate'} in "${valore || '(vuota)'}".`, {
                tipo: 'ok', durata: 6000,
                azione: { etichetta: 'Annulla', fn: () => _annullaSpostamentoLocation(primaDi) },
            });
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
            await caricaCarteReali();
            if (errore) mostraAvviso('❌ Annullamento non riuscito: ' + errore.message);
            else avvisoBreve('Spostamento annullato.', { tipo: 'ok' });
        }
