// ═══════════════════════════════════════════════════════════════════════
// CARDS-FILTRO.UI.JS — filtro tipo, ricerca, evidenziazione riga,
// animazione prezzo (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/cards.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: toggleFiltroTipo, toggleRowHighlight, filterTable,
// _animaPrezzoCarta.
//
// filterTable() e _animaPrezzoCarta() sono chiamate cross-file da
// ui/cards.ui.js, ui/cards-modifica.ui.js e ui/cards-selezione.ui.js —
// stesso meccanismo già in uso ovunque nel progetto. Nessuna istruzione
// qui gira a tempo di caricamento script — l'ordine rispetto agli altri
// file cards-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

        // ── FILTRO TIPO (Carte / Sealed / Wishlist) — solo in Visualizzazione ────
        // Multi-selezione: tutti e tre attivi insieme = vedi tutto quanto,
        // uno solo attivo = vedi solo quello. Wishlist parte disattivata di
        // default, per non alterare le statistiche (Carte Totali/Valore Est.
        // rappresentano concettualmente solo ciò che possiedi davvero).

        function toggleFiltroTipo(tipo) {
            _filtriTipo[tipo] = !_filtriTipo[tipo];
            document.getElementById('toggleTipo' + tipo.charAt(0).toUpperCase() + tipo.slice(1))
                .classList.toggle('active', _filtriTipo[tipo]);
            filterTable();
        }


        function toggleRowHighlight(id) {
            highlightedRowId = (highlightedRowId === id) ? null : id;
            filterTable();
        }


        function filterTable() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase();
            let locVal = document.getElementById('filterLocation').value;
            const langVal = document.getElementById('filterLang').value;

            if (currentMode === 'scambio') locVal = 'SCAMBIO';

            const filtered = carteReali.filter(card => {
                const matchesSearch = card.name.toLowerCase().includes(searchVal) || card.code.toLowerCase().includes(searchVal);
                const matchesLang = langVal === "" || card.lang === langVal;
                if (!matchesSearch || !matchesLang) return false;

                // Wishlist, Scambio e Sealed filtrano su cose DIVERSE: la
                // wishlist è uno stato a parte nel database, "SCAMBIO" è solo
                // una location come le altre dentro la collezione, "sealed"
                // è il campo 'tipo' (stessa tabella, non una location).
                if (currentMode === 'wishlist') return card.stato === 'wishlist';
                if (currentMode === 'sealed') {
                    if (card.stato !== 'collezione' || card.tipo !== 'sealed') return false;
                    return locVal === "" || card.location === locVal;
                }
                if (currentMode === 'visualizzazione') {
                    // Multi-selezione indipendente dei tre "tipi" di riga —
                    // vedi _filtriTipo e toggleFiltroTipo più sotto.
                    if (card.stato === 'wishlist') { if (!_filtriTipo.wishlist) return false; }
                    else if (card.tipo === 'sealed') { if (!_filtriTipo.sealed) return false; }
                    else { if (!_filtriTipo.carte) return false; }
                    return locVal === "" || card.location === locVal;
                }
                if (card.stato !== 'collezione') return false;
                return locVal === "" || card.location === locVal;
            });

            renderViewTable(filtered);
        }


        // Flash colorato breve sulla cella prezzo (verde se sale, rosso se
        // scende). Scatta SOLO dalle due funzioni che rappresentano una
        // modifica diretta dell'utente su questo sito (modificaCampoInline
        // e salvaModificaCarta) — MAI dal ricaricamento innescato da
        // Realtime (_pianificaRicaricaCarte), che copre anche gli
        // aggiornamenti automatici/di massa della coda prezzi: farla
        // scattare lì avrebbe animato decine di righe in sequenza durante
        // un controllo prezzi, risultando fastidiosa invece che utile.
        function _animaPrezzoCarta(id, direzione) {
            if (!direzione || _animazioniRidotte()) return;
            const classe = direzione === 'su' ? 'prezzo-flash-su' : 'prezzo-flash-giu';
            ['prezzoCella-' + id, 'prezzoCellaCompatta-' + id].forEach(elId => {
                const el = document.getElementById(elId);
                if (!el) return;
                el.classList.remove('prezzo-flash-su', 'prezzo-flash-giu');
                void el.offsetWidth; // forza il reflow, per far ripartire l'animazione se era già in corso
                el.classList.add(classe);
                el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
            });
        }
