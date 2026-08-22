// ── ui/entry.ui.js ─────────────────────────────────────────────────────
// Form di Inserimento: bozza (salvata/ripristinata), righe editabili della
// tabella di inserimento, invio alla coda_carte.


        // ── LOCATION COMUNE (sezione Inserimento) ────────────────────────────────
        // Stessa tabella 'location' già usata per le checkbox della sezione
        // Prezzi — qui in più permettiamo di aggiungerne una nuova al volo,
        // così non serve aprire l'estensione solo per registrare una location
        // che ancora non esiste.

        async function caricaSelectLocationComune() {
            const userId = await authGetUserId();
            const select = document.getElementById('selectLocationComune');
            if (!userId || !select) return;

            const { data, error } = await locationsList(userId);
            if (error) { console.error('Errore caricamento location:', error.message); return; }

            const valorePrecedente = select.value;
            select.innerHTML = '<option value="">— nessuna, usa quella di ogni riga —</option>';
            (data || []).forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.nome;
                opt.textContent = r.nome;
                select.appendChild(opt);
            });
            if (valorePrecedente) select.value = valorePrecedente;
            _locationComuneCaricata = true;
        }


        async function aggiungiNuovaLocationComune() {
            const userId = await authGetUserId();
            if (!userId) { await assicuraLoginSupabase(); return; }

            const input = document.getElementById('inputNuovaLocationComune');
            const nome = input.value.trim();
            if (!nome) return;

            const { data: esistenti } = await locationExists(userId, nome);
            if (!esistenti || esistenti.length === 0) {
                const { error } = await locationInsert(userId, nome);
                if (error) { alert('❌ Errore nell\'aggiungere la location: ' + error.message); return; }
            }

            input.value = '';
            await caricaSelectLocationComune();
            document.getElementById('selectLocationComune').value = nome;
        }


        // ── INSERIMENTO CARTE — collegato alla coda UNICA coda_carte ─────────────
        // Ogni riga della tabella diventa UNA riga in 'coda_carte' con il suo
        // qty — prima veniva "spacchettata" in N righe separate (N ricerche
        // identiche su Cardmarket per la stessa carta): inutile e più lenta.
        // 'destinazione' (collezione/wishlist) e 'tipo' (carta/sealed) sono
        // due scelte indipendenti — la STESSA coda le gestisce entrambe, non
        // più due tabelle/motori separati (vedi coda_unificata.sql).
        function _rigaEntryToRigheDb(row, userId, tipo = null, destinazione = 'collezione') {
            const nome = (row.name || '').trim();
            if (!nome) return [];
            const qty = Math.max(1, parseInt(row.qty, 10) || 1);
            return [{
                owner_id: userId,
                nome,
                lingua: row.lang || 'IT',
                condizione: row.cond || 'NM',
                reverse: !!row.rev,
                first_ed: !!row.first,
                nota: (row.notes || '').trim() || null,
                location: (row.loc && row.loc !== '?') ? row.loc : null,
                destinazione,
                qty,
                ...(tipo ? { tipo } : {}),
            }];
        }


        // ── TOGGLE INSERIMENTO — due dimensioni indipendenti ─────────────────────
        // Prima era un'unica scelta a 3 vie (Colleziona/Wishlist/Sealed), che
        // non permetteva di mettere un prodotto sealed IN wishlist (una cosa
        // che vuoi comprare potrebbe benissimo essere un ETB, non solo una
        // carta). Ora sono due scelte indipendenti che si combinano:
        // destinazione (dove finisce) × tipo (come viene cercato su
        // Cardmarket — le carte singole e i prodotti sealed vivono in
        // sezioni diverse del sito).

        function impostaDestinazioneInserimento(dest) {
            _destinazioneInserimento = dest;
            document.getElementById('btnDestCollezione').classList.toggle('active', dest === 'collezione');
            document.getElementById('btnDestWishlist').classList.toggle('active', dest === 'wishlist');
            _aggiornaLocationEBottoneInserimento();
        }


        function impostaTipoInserimento(tipo) {
            _tipoInserimento = tipo;
            document.getElementById('btnTipoCarta').classList.toggle('active', tipo === 'carta');
            document.getElementById('btnTipoSealed').classList.toggle('active', tipo === 'sealed');
            _aggiornaLocationEBottoneInserimento();
        }


        function _aggiornaLocationEBottoneInserimento() {
            // Wishlist e Sealed non hanno (per ora) location diverse da riga
            // a riga come la collezione di carte singole — la tendina resta
            // comunque visibile e modificabile (in caso servisse in futuro),
            // ma parte già impostata su un valore fisso, senza dover
            // scegliere nulla. La destinazione conta più del tipo: qualunque
            // cosa vada in Wishlist prende quella location, a prescindere se
            // è una carta o un sealed.
            document.getElementById('pannelloLocationComune').style.display = 'flex';
            const selectLoc = document.getElementById('selectLocationComune');
            if (_destinazioneInserimento === 'wishlist') _impostaLocationComuneFissa(selectLoc, 'WISHLIST');
            else if (_tipoInserimento === 'sealed') _impostaLocationComuneFissa(selectLoc, 'SEALED');
            else selectLoc.value = '';

            const btn = document.getElementById('btnSalvaCarte');
            if (_destinazioneInserimento === 'wishlist') btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Salva in Wishlist';
            else if (_tipoInserimento === 'sealed') btn.innerHTML = '<i class="fa-solid fa-box-archive"></i> Salva Sealed';
            else btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Salva Carte';
        }


        // Imposta la location comune su un valore fisso (WISHLIST/SEALED),
        // aggiungendolo alla tendina se non è già tra le opzioni presenti
        // (non serve registrarlo nella tabella 'location' vera e propria —
        // qui basta che sia selezionabile e venga inviato correttamente).
        function _impostaLocationComuneFissa(select, valore) {
            if (![...select.options].some(o => o.value === valore)) {
                const opt = document.createElement('option');
                opt.value = valore;
                opt.textContent = valore;
                select.appendChild(opt);
            }
            select.value = valore;
        }


        async function salvaCarteReali() {
            const userId = await authGetUserId();
            if (!userId) {
                await assicuraLoginSupabase();
                return;
            }

            const righe = document.querySelectorAll('#entryTableBody tr');
            const righeValide = [];
            righe.forEach(tr => {
                const inputs = tr.querySelectorAll('input, select');
                if (inputs.length < 7) return;
                const name = tr.querySelector('td:nth-child(1) input').value.trim();
                if (!name) return;
                righeValide.push({
                    name,
                    lang: tr.querySelector('td:nth-child(2) select').value,
                    cond: tr.querySelector('td:nth-child(3) select').value,
                    rev: tr.querySelector('td:nth-child(4) input').checked,
                    first: tr.querySelector('td:nth-child(5) input').checked,
                    qty: tr.querySelector('.qty-input').value,
                    loc: tr.querySelector('td:nth-child(7) select').value,
                    notes: tr.querySelector('td:nth-child(8) input').value
                });
            });

            if (righeValide.length === 0) {
                alert('Non ci sono carte da salvare — scrivi almeno un nome o un codice.');
                return;
            }

            const locationComune = document.getElementById('selectLocationComune')?.value.trim() || '';
            const btn = document.getElementById('btnSalvaCarte');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio in corso...';

            // Coda UNICA: qualunque combinazione di destinazione/tipo passa
            // sempre da 'coda_carte' — un solo motore (aggiungi_carta_popup.js)
            // la elabora una riga alla volta, mai due ricerche in parallelo
            // anche con più dispositivi online insieme.
            const righeDb = righeValide.flatMap(r => _rigaEntryToRigheDb(
                locationComune ? { ...r, loc: locationComune } : r,
                userId,
                _tipoInserimento === 'sealed' ? 'sealed' : null,
                _destinazioneInserimento
            ));

            const { error } = await queueInsertRighe(righeDb);

            btn.disabled = false;
            btn.innerHTML = originalHtml;

            if (error) {
                alert('❌ Errore nell\'invio delle carte: ' + error.message);
                return;
            }

            clearEntryDraft();
            alert(`✅ ${righeDb.length} cart${righeDb.length === 1 ? 'a inviata' : 'e inviate'} nella coda persistente!\n\nApri l'estensione sulla sezione "Aggiungi Carte" per farle processare — non si perdono, restano lì in attesa finché qualcuno non le lavora.`);
        }


        // ── SEGNALAZIONE BUG (EASTER EGG: il bug è un Caterpie) ───────────────────
        function segnalaCaterpie() {
            const descrizione = prompt('🐛 Un Caterpie selvatico appare! Descrivi cosa hai visto (cosa NON funzionava come dovrebbe):');
            if (!descrizione || !descrizione.trim()) return;
            const corpo = encodeURIComponent(
                `Ho catturato un Caterpie!\n\nDescrizione: ${descrizione.trim()}\n\nPagina: ${window.location.href}\nData: ${new Date().toLocaleString('it-IT')}`
            );
            window.location.href = `mailto:admin@cardsyncpro.local?subject=${encodeURIComponent('🐛 Caterpie catturato — CardSync Pro')}&body=${corpo}`;
        }

        /* AVVISO DI USCITA/REFRESH SE CI SONO DATI NON SALVATI */
        window.addEventListener('beforeunload', (e) => {
            const draft = prefEntryDraftGet();
            if (draft && draftHasContent(draft)) {
                e.preventDefault();
                e.returnValue = '';
            }
        });


        function draftHasContent(draftJson) {
            try {
                const rows = JSON.parse(draftJson);
                return rows.some(r => r.name.trim().length > 0 || r.notes.trim().length > 0);
            } catch(e) { return false; }
        }

        /* GESTIONE BOZZA AUTO-SAVE */

        function saveEntryDraft() {
            const rows = document.querySelectorAll('#entryTableBody tr');
            const draft = [];
            rows.forEach(tr => {
                const inputs = tr.querySelectorAll('input, select');
                if(inputs.length >= 7) {
                    draft.push({
                        name: tr.querySelector('td:nth-child(1) input').value,
                        lang: tr.querySelector('td:nth-child(2) select').value,
                        cond: tr.querySelector('td:nth-child(3) select').value,
                        rev: tr.querySelector('td:nth-child(4) input').checked,
                        first: tr.querySelector('td:nth-child(5) input').checked,
                        qty: tr.querySelector('.qty-input').value,
                        loc: tr.querySelector('td:nth-child(7) select').value,
                        notes: tr.querySelector('td:nth-child(8) input').value
                    });
                }
            });
            prefEntryDraftSet(JSON.stringify(draft));
            
            const label = document.getElementById('autosaveLabel');
            if(label) {
                label.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success)"></i> Salvato`;
                setTimeout(() => {
                    label.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salva automatico attivo`;
                }, 1200);
            }
        }


        function restoreEntryDraft() {
            const saved = prefEntryDraftGet();
            if (!saved) return false;
            try {
                const draft = JSON.parse(saved);
                if (!Array.isArray(draft) || draft.length === 0) return false;

                const tbody = document.getElementById('entryTableBody');
                tbody.innerHTML = '';
                draft.forEach(item => addNewEntryRow(item));
                return true;
            } catch(e) {
                return false;
            }
        }


        function clearEntryDraft() {
            prefEntryDraftClear();
            initEntryTable();
        }

        /* INSERIMENTO CARTE CON PULSANTI + E - */

        function initEntryTable() {
            const tbody = document.getElementById('entryTableBody');
            tbody.innerHTML = '';
            addNewEntryRow();
            addNewEntryRow();
        }


        function addNewEntryRow(data = null) {
            const tbody = document.getElementById('entryTableBody');
            const tr = document.createElement('tr');

            const nameVal = data ? (data.name || '') : '';
            const langVal = data ? (data.lang || 'IT') : 'IT';
            const condVal = data ? (data.cond || 'NM') : 'NM';
            const revVal = data ? (data.rev ? 'checked' : '') : '';
            const firstVal = data ? (data.first ? 'checked' : '') : '';
            const qtyVal = data ? (data.qty || 1) : 1;
            const locVal = data ? (data.loc || '?') : '?';
            const notesVal = data ? (data.notes || '') : '';

            tr.innerHTML = `
                <td data-label="Nome/Codice"><input type="text" placeholder="Nome/Codice" value="${escapeHtml(nameVal)}" oninput="handleEntryInput(this)" onkeydown="handleEntryCodiceKeydown(event, this)"></td>
                <td data-label="Lingua">
                    <select onchange="handleEntryInput(this)">
                        <option value="IT" ${langVal === 'IT' ? 'selected' : ''}>IT</option>
                        <option value="EN" ${langVal === 'EN' ? 'selected' : ''}>EN</option>
                        <option value="KOR" ${langVal === 'KOR' ? 'selected' : ''}>KOR</option>
                        <option value="JP" ${langVal === 'JP' ? 'selected' : ''}>JP</option>
                    </select>
                </td>
                <td data-label="Cond.">
                    <select onchange="handleEntryInput(this)">
                        <option value="NM" ${condVal === 'NM' ? 'selected' : ''}>NM</option>
                        <option value="EX" ${condVal === 'EX' ? 'selected' : ''}>EX</option>
                        <option value="GD" ${condVal === 'GD' ? 'selected' : ''}>GD</option>
                    </select>
                </td>
                <td data-label="REV" style="text-align: center;"><input type="checkbox" ${revVal} onchange="handleEntryInput(this)"></td>
                <td data-label="1st" style="text-align: center;"><input type="checkbox" ${firstVal} onchange="handleEntryInput(this)"></td>
                <td data-label="Quantità">
                    <div class="qty-control">
                        <button type="button" class="qty-btn" onclick="stepEntryQty(this, -1)">-</button>
                        <input type="number" value="${qtyVal}" min="1" class="qty-input" oninput="handleEntryInput(this)">
                        <button type="button" class="qty-btn" onclick="stepEntryQty(this, 1)">+</button>
                    </div>
                </td>
                <td data-label="Location">
                    <select onchange="handleEntryInput(this)">
                        <option value="?" ${locVal === '?' ? 'selected' : ''}>?</option>
                        <option value="BULK" ${locVal === 'BULK' ? 'selected' : ''}>BULK</option>
                        <option value="1025" ${locVal === '1025' ? 'selected' : ''}>1025</option>
                        <option value="TOPLOADER" ${locVal === 'TOPLOADER' ? 'selected' : ''}>TOPLOADER</option>
                        <option value="BINDER" ${locVal === 'BINDER' ? 'selected' : ''}>BINDER</option>
                        <option value="SCAMBIO" ${locVal === 'SCAMBIO' ? 'selected' : ''}>SCAMBIO</option>
                        <option value="WISHLIST" ${locVal === 'WISHLIST' ? 'selected' : ''}>WISHLIST</option>
                    </select>
                </td>
                <td data-label="Note"><input type="text" placeholder="Note" value="${escapeHtml(notesVal)}" oninput="handleEntryInput(this)"></td>
                <td style="text-align: center;">
                    <button type="button" class="btn-danger" onclick="removeEntryRow(this)"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

            tbody.appendChild(tr);
        }


        function stepEntryQty(btn, delta) {
            const input = btn.parentElement.querySelector('.qty-input');
            let val = parseInt(input.value) || 1;
            val = Math.max(1, val + delta);
            input.value = val;
            handleEntryInput(input);
        }


        function handleEntryInput(element) {
            const row = element.closest('tr');
            const tbody = document.getElementById('entryTableBody');
            if (row === tbody.lastElementChild) {
                addNewEntryRow();
            }
            saveEntryDraft();
        }


        // Invio nel campo Nome/Codice sposta subito il focus sulla riga
        // successiva (quella nuova già aggiunta da handleEntryInput mentre
        // si digitava, oppure quella già esistente sotto) — comodo per
        // inserire tante carte una via l'altra senza staccare le mani dalla
        // tastiera.
        function handleEntryCodiceKeydown(e, input) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const tr = input.closest('tr');
            const nextRow = tr.nextElementSibling;
            if (nextRow) {
                const nextInput = nextRow.querySelector('input[type="text"]');
                if (nextInput) nextInput.focus();
            }
        }


        function removeEntryRow(btn) {
            const tbody = document.getElementById('entryTableBody');
            if (tbody.children.length > 1) {
                btn.closest('tr').remove();
            } else {
                const inputs = tbody.querySelectorAll('input[type="text"]');
                inputs.forEach(i => i.value = '');
            }
            saveEntryDraft();
        }

        /* RENDERING E SELEZIONE DELLA RIGA */


        function saveDataMock() {
            clearEntryDraft();
            alert("Carte salvate con successo e bozza ripulita!");
        }
