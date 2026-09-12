// ═══════════════════════════════════════════════════════════════════════
// CARDS-MODIFICA.UI.JS — menu riga, modale modifica/elimina carta,
// dropdown inline (location/lingua/condizione) — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/cards.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: toggleMenuCompatto/toggleMenuAzioniTabella (menu riga),
// apriModificaCarta/chiudiModificaCarta/salvaModificaCarta,
// segnaOttenuta, eliminaCarta, dropdown inline location/lingua/
// condizione (modificaLocationInline/modificaLinguaInline/
// modificaCondizioneInline/_apriSelectInline/modificaCampoInline).
//
// Dipende da (rimasti in ui/cards.ui.js): caricaCarteReali (ricarica dopo
// ogni modifica/eliminazione), filterTable (ui/cards-filtro.ui.js, dopo
// alcune modifiche inline); da ui/cards-filtro.ui.js: _animaPrezzoCarta
// (flash colorato sulla cella prezzo dopo modifica diretta). Nessuna
// istruzione qui gira a tempo di caricamento script — l'ordine rispetto
// agli altri file cards-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

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

            // FASE 1 (2026-09-12): sigillata_originale esiste solo su
            // 'carte', non su 'wishlist' (non possiedi ancora l'oggetto) —
            // stesso trattamento di Location sopra: nascosta del tutto,
            // non solo disabilitata (a differenza di Location, qui non c'è
            // nessun valore sensato da mostrare disabilitato).
            const campoSigillata = document.getElementById('campoEditSigillata');
            campoSigillata.style.display = isWishlist ? 'none' : 'flex';
            document.getElementById('editSigillata').checked = !isWishlist && !!card.sigillataOriginale;

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
                aggiornamento.sigillata_originale = document.getElementById('editSigillata').checked;
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

