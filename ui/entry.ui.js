// ── ui/entry.ui.js ─────────────────────────────────────────────────────
// Form di Inserimento: bozza (salvata/ripristinata), righe editabili della
// tabella di inserimento, invio alla coda_carte.


        // ── LOCATION COMUNE (sezione Inserimento) ────────────────────────────────
        // Stessa tabella 'location' già usata per le checkbox della sezione
        // Prezzi — qui in più permettiamo di aggiungerne una nuova al volo,
        // così non serve aprire l'estensione solo per registrare una location
        // che ancora non esiste.

        // FASE 1: la tendina mostra le location del dominio giusto —
        // 'carta' o 'sealed' a seconda di _tipoInserimento. Richiamata anche
        // da impostaTipoInserimento() ogni volta che si cambia toggle, non
        // solo all'apertura della pagina.
        async function caricaSelectLocationComune() {
            const userId = await authGetUserId();
            const select = document.getElementById('selectLocationComune');
            if (!userId || !select) return;

            const tipoLocation = _tipoInserimento === 'sealed' ? 'sealed' : 'carta';
            const { data, error } = await locationsList(userId, tipoLocation);
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

            const tipoLocation = _tipoInserimento === 'sealed' ? 'sealed' : 'carta';
            const { data: esistenti } = await locationExists(userId, nome, tipoLocation);
            if (!esistenti || esistenti.length === 0) {
                const { error } = await locationInsert(userId, nome, tipoLocation);
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
                sigillata_originale: !!row.sig,
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

            // FASE 1: la Wishlist per prodotti sealed non esiste ancora
            // (prevista dalla Fase 6 della roadmap, tabella dedicata non
            // creata in questa fase). Se si passa a Wishlist mentre "Sealed"
            // è selezionato, si torna a "Carta" per non provare a inserire
            // in un posto che non esiste ancora.
            if (dest === 'wishlist' && _tipoInserimento === 'sealed') {
                impostaTipoInserimento('carta');
                return; // impostaTipoInserimento richiama già _aggiornaLocationEBottoneInserimento()
            }

            _aggiornaLocationEBottoneInserimento();
        }


        // FASE 1 (2026-09-12): "Sealed" non marca più una carta con
        // carte.tipo='sealed' (meccanismo ritirato — vedi
        // Compilato_2026-09-12, mai popolato in produzione). Ora scambia la
        // tabella visibile: carte singole → coda_carte come sempre; prodotti
        // sealed → inserimento DIRETTO nella nuova tabella prodotti_sealed
        // (niente ricerca Cardmarket automatica in questa fase, prezzo
        // manuale/opzionale — vedi Fase 1.2 per il controllo prezzi di
        // gruppo, non ancora collegato qui).
        function impostaTipoInserimento(tipo) {
            _tipoInserimento = tipo;
            document.getElementById('btnTipoCarta').classList.toggle('active', tipo === 'carta');
            document.getElementById('btnTipoSealed').classList.toggle('active', tipo === 'sealed');

            document.getElementById('tabellaInserimento').style.display = tipo === 'sealed' ? 'none' : '';
            const tabellaSealed = document.getElementById('tabellaInserimentoSealed');
            if (tabellaSealed) tabellaSealed.style.display = tipo === 'sealed' ? '' : 'none';

            _aggiornaLocationEBottoneInserimento();
            caricaSelectLocationComune(); // ricarica con il tipo di location giusto (carta/sealed)
        }


        function _aggiornaLocationEBottoneInserimento() {
            // Wishlist non ha (per ora) location diversa da riga a riga come
            // la collezione — la tendina resta comunque visibile e
            // modificabile (in caso servisse in futuro), ma parte già
            // impostata su un valore fisso, senza dover scegliere nulla.
            document.getElementById('pannelloLocationComune').style.display = 'flex';
            const selectLoc = document.getElementById('selectLocationComune');
            if (_destinazioneInserimento === 'wishlist') _impostaLocationComuneFissa(selectLoc, 'WISHLIST');
            else selectLoc.value = '';

            const btn = document.getElementById('btnSalvaCarte');
            if (_destinazioneInserimento === 'wishlist') btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Salva in Wishlist';
            else if (_tipoInserimento === 'sealed') btn.innerHTML = '<i class="fa-solid fa-box-archive"></i> Salva Prodotti Sealed';
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
            // FASE 1: il bottone "Salva" è unico (onclick fisso in
            // index.html) — smista qui invece di duplicare il markup HTML.
            if (_tipoInserimento === 'sealed') {
                return salvaProdottiSealedReali();
            }

            const userId = await authGetUserId();
            if (!userId) {
                await assicuraLoginSupabase();
                return;
            }

            const righe = document.querySelectorAll('#entryTableBody tr');
            const righeValide = [];
            righe.forEach(tr => {
                const inputs = tr.querySelectorAll('input, select');
                if (inputs.length < 8) return;
                const name = tr.querySelector('td:nth-child(1) input').value.trim();
                if (!name) return;
                righeValide.push({
                    name,
                    lang: tr.querySelector('td:nth-child(2) select').value,
                    cond: tr.querySelector('td:nth-child(3) select').value,
                    rev: tr.querySelector('td:nth-child(4) input').checked,
                    first: tr.querySelector('td:nth-child(5) input').checked,
                    sig: tr.querySelector('td:nth-child(6) input').checked,
                    qty: tr.querySelector('.qty-input').value,
                    loc: tr.querySelector('td:nth-child(8) select').value,
                    notes: tr.querySelector('td:nth-child(9) input').value
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
                if(inputs.length >= 8) {
                    draft.push({
                        name: tr.querySelector('td:nth-child(1) input').value,
                        lang: tr.querySelector('td:nth-child(2) select').value,
                        cond: tr.querySelector('td:nth-child(3) select').value,
                        rev: tr.querySelector('td:nth-child(4) input').checked,
                        first: tr.querySelector('td:nth-child(5) input').checked,
                        sig: tr.querySelector('td:nth-child(6) input').checked,
                        qty: tr.querySelector('.qty-input').value,
                        loc: tr.querySelector('td:nth-child(8) select').value,
                        notes: tr.querySelector('td:nth-child(9) input').value
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
            const sigVal = data ? (data.sig ? 'checked' : '') : '';
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
                <td data-label="SIG" style="text-align: center;" title="Ancora sigillata nella bustina originale"><input type="checkbox" ${sigVal} onchange="handleEntryInput(this)"></td>
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


        // ═══════════════════════════════════════════════════════════════════
        // FASE 1 (2026-09-12) — INSERIMENTO PRODOTTI SEALED
        // ═══════════════════════════════════════════════════════════════════
        // A differenza delle carte, NON passa da coda_carte/estensione: è un
        // insert diretto su prodotti_sealed (RLS "propria collezione sealed"
        // già lo protegge). Nessuna ricerca automatica su Cardmarket in
        // questa fase — prezzo facoltativo, inseribile a mano. Il controllo
        // prezzi di gruppo automatico arriverà con la Fase 1.2 (RPC gemelle
        // + modifiche estensione, non ancora fatte).

        const INTEGRITA_PACKAGING_OPZIONI = [
            { value: 'sigillato_integro', label: 'Sigillato integro' },
            { value: 'sigillo_danneggiato', label: 'Sigillo danneggiato' },
            { value: 'confezione_danneggiata', label: 'Confezione danneggiata' },
            { value: 'aperto_non_sealed', label: 'Aperto (non sealed)' },
        ];
        // Nessun CHECK a database su questi valori (decisione Fase 1: deve
        // essere facile aggiungerne/modificarne senza migration) — questo
        // array è l'UNICA fonte, aggiungere una voce qui basta.

        function initEntryTableSealed() {
            const tbody = document.getElementById('entryTableBodySealed');
            if (!tbody) return;
            tbody.innerHTML = '';
            addNewEntryRowSealed();
            addNewEntryRowSealed();
        }


        function addNewEntryRowSealed(data = null) {
            const tbody = document.getElementById('entryTableBodySealed');
            if (!tbody) return;
            const tr = document.createElement('tr');

            const nameVal = data ? (data.name || '') : '';
            const langVal = data ? (data.lang || 'IT') : 'IT';
            const integritaVal = data ? (data.integrita || 'sigillato_integro') : 'sigillato_integro';
            const qtyVal = data ? (data.qty || 1) : 1;
            const prezzoVal = data ? (data.prezzo || '') : '';
            const notesVal = data ? (data.notes || '') : '';

            const opzioniIntegrita = INTEGRITA_PACKAGING_OPZIONI.map(o =>
                `<option value="${o.value}" ${integritaVal === o.value ? 'selected' : ''}>${o.label}</option>`
            ).join('');

            tr.innerHTML = `
                <td data-label="Nome"><input type="text" placeholder="es. Booster Box Obsidian Flames" value="${escapeHtml(nameVal)}" oninput="handleEntryInputSealed(this)"></td>
                <td data-label="Lingua">
                    <select onchange="handleEntryInputSealed(this)">
                        <option value="IT" ${langVal === 'IT' ? 'selected' : ''}>IT</option>
                        <option value="EN" ${langVal === 'EN' ? 'selected' : ''}>EN</option>
                        <option value="KOR" ${langVal === 'KOR' ? 'selected' : ''}>KOR</option>
                        <option value="JP" ${langVal === 'JP' ? 'selected' : ''}>JP</option>
                    </select>
                </td>
                <td data-label="Integrità">
                    <select onchange="handleEntryInputSealed(this)">${opzioniIntegrita}</select>
                </td>
                <td data-label="Quantità">
                    <div class="qty-control">
                        <button type="button" class="qty-btn" onclick="stepEntryQtySealed(this, -1)">-</button>
                        <input type="number" value="${qtyVal}" min="1" class="qty-input" oninput="handleEntryInputSealed(this)">
                        <button type="button" class="qty-btn" onclick="stepEntryQtySealed(this, 1)">+</button>
                    </div>
                </td>
                <td data-label="Prezzo"><input type="number" step="0.01" min="0" placeholder="€" value="${escapeHtml(String(prezzoVal))}" oninput="handleEntryInputSealed(this)"></td>
                <td data-label="Note"><input type="text" placeholder="Note" value="${escapeHtml(notesVal)}" oninput="handleEntryInputSealed(this)"></td>
                <td style="text-align: center;">
                    <button type="button" class="btn-danger" onclick="removeEntryRowSealed(this)"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

            tbody.appendChild(tr);
        }


        function stepEntryQtySealed(btn, delta) {
            const input = btn.parentElement.querySelector('.qty-input');
            let val = parseInt(input.value) || 1;
            val = Math.max(1, val + delta);
            input.value = val;
            handleEntryInputSealed(input);
        }


        // Nessuna bozza salvata per questa tabella (semplificazione
        // dichiarata) — aggiunge solo una riga nuova in fondo quando si
        // digita nell'ultima riga esistente, stesso comportamento della
        // tabella carte per la comodità di inserimento continuo.
        function handleEntryInputSealed(element) {
            const row = element.closest('tr');
            const tbody = document.getElementById('entryTableBodySealed');
            if (row === tbody.lastElementChild) {
                addNewEntryRowSealed();
            }
        }


        function removeEntryRowSealed(btn) {
            const tbody = document.getElementById('entryTableBodySealed');
            if (tbody.children.length > 1) {
                btn.closest('tr').remove();
            } else {
                const inputs = tbody.querySelectorAll('input[type="text"]');
                inputs.forEach(i => i.value = '');
            }
        }


        function _rigaEntrySealedToRigaDb(row, userId, locationComune) {
            const nome = (row.name || '').trim();
            if (!nome) return null;
            const qty = Math.max(1, parseInt(row.qty, 10) || 1);
            const prezzo = row.prezzo !== '' && row.prezzo != null ? parseFloat(row.prezzo) : null;
            return {
                owner_id: userId,
                nome,
                lingua: row.lang || 'IT',
                integrita_packaging: row.integrita || 'sigillato_integro',
                qty,
                prezzo: (prezzo != null && !isNaN(prezzo)) ? prezzo : null,
                note: (row.notes || '').trim() || null,
                location: (locationComune && locationComune !== '?') ? locationComune : null,
            };
        }


        async function salvaProdottiSealedReali() {
            const userId = await authGetUserId();
            if (!userId) {
                await assicuraLoginSupabase();
                return;
            }

            const righe = document.querySelectorAll('#entryTableBodySealed tr');
            const righeValide = [];
            righe.forEach(tr => {
                const name = tr.querySelector('td:nth-child(1) input')?.value.trim();
                if (!name) return;
                righeValide.push({
                    name,
                    lang: tr.querySelector('td:nth-child(2) select')?.value,
                    integrita: tr.querySelector('td:nth-child(3) select')?.value,
                    qty: tr.querySelector('.qty-input')?.value,
                    prezzo: tr.querySelector('td:nth-child(5) input')?.value,
                    notes: tr.querySelector('td:nth-child(6) input')?.value,
                });
            });

            if (righeValide.length === 0) {
                alert('Non ci sono prodotti sealed da salvare — scrivi almeno un nome.');
                return;
            }

            const locationComune = document.getElementById('selectLocationComune')?.value.trim() || '';
            const btn = document.getElementById('btnSalvaCarte');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';

            const righeDb = righeValide
                .map(r => _rigaEntrySealedToRigaDb(r, userId, locationComune))
                .filter(Boolean);

            const { error } = await sealedInsertRighe(righeDb);

            btn.disabled = false;
            btn.innerHTML = originalHtml;

            if (error) {
                alert('❌ Errore nel salvataggio dei prodotti sealed: ' + error.message);
                return;
            }

            initEntryTableSealed();
            alert(`✅ ${righeDb.length} prodott${righeDb.length === 1 ? 'o sealed salvato' : 'i sealed salvati'} in collezione!`);
        }
