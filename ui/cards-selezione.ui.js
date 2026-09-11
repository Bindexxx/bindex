// ═══════════════════════════════════════════════════════════════════════
// CARDS-SELEZIONE.UI.JS — selezione multipla righe tabella (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/cards.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: toggleSelezionaTutte, _righeSelezionate, aggiornaSelezioneMultipla,
// _aggiornaBarraSelezioneMultipla, eliminaSelezionate,
// aggiungiSelezionateAlBinder, spostaLocationSelezionate.
//
// Dipende da (rimasto in ui/cards.ui.js): caricaCarteReali (ricarica dopo
// azioni di massa). Nessuna istruzione qui gira a tempo di caricamento
// script — l'ordine rispetto agli altri file cards-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────


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


