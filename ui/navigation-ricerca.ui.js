// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION-RICERCA.UI.JS — ricerca globale (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/navigation.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: apriRicercaGlobale, chiudiRicercaGlobale, _etichettaSezione,
// eseguiRicercaGlobale, vaiARisultatoRicerca.
//
// Dipende da (rimasto in ui/navigation.ui.js): closeDrawer(), switchTab()
// — chiamate dopo aver scelto un risultato di ricerca. Nessuna istruzione
// qui gira a tempo di caricamento script — l'ordine tra i quattro file
// navigation-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

        function apriRicercaGlobale() {
            closeDrawer(); // stesso pattern di switchTab(): su mobile il drawer si richiude dopo la scelta
            document.getElementById('ricercaGlobaleModal').style.display = 'flex';
            document.getElementById('ricercaGlobaleInput').value = '';
            document.getElementById('ricercaGlobaleRisultati').innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi per cercare tra tutte le tue carte.</p>';
            setTimeout(() => document.getElementById('ricercaGlobaleInput').focus(), 50);
        }


        function chiudiRicercaGlobale() {
            document.getElementById('ricercaGlobaleModal').style.display = 'none';
        }


        // Determina l'etichetta e il colore in base a dove vive la carta —
        // priorità: wishlist, poi sealed, poi scambio, altrimenti collezione.
        function _etichettaSezione(card) {
            if (card.tabella === 'wishlist') return { testo: 'Wishlist', bg: 'var(--bg-success)', colore: 'var(--success)' };
            if (card.tipo === 'sealed') return { testo: 'Sealed', bg: 'var(--primary-light)', colore: 'var(--primary)' };
            if (card.location === 'SCAMBIO') return { testo: 'Scambio', bg: 'var(--bg-accent, var(--primary-light))', colore: 'var(--primary)' };
            return { testo: 'Collezione', bg: 'var(--bg-color)', colore: 'var(--text-muted)' };
        }


        function eseguiRicercaGlobale(query) {
            const container = document.getElementById('ricercaGlobaleRisultati');
            const q = query.trim().toLowerCase();
            if (q.length < 2) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Scrivi almeno 2 caratteri.</p>';
                return;
            }

            const risultati = carteReali
                .filter(c => c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
                .slice(0, 40);

            if (risultati.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem 0;">Nessuna carta trovata.</p>';
                return;
            }

            container.innerHTML = risultati.map(c => {
                const et = _etichettaSezione(c);
                const idAttr = String(c.id).replace(/'/g, "\\'");
                return `
                    <div class="risultato-ricerca-globale" onclick="vaiARisultatoRicerca('${idAttr}', '${c.tabella}')">
                        <span class="risultato-ricerca-globale-nome">${escapeHtml(c.name)}${c.code ? ` <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(c.code)})</span>` : ''}</span>
                        <span class="risultato-ricerca-globale-pill" style="background-color:${et.bg}; color:${et.colore};">${et.testo}</span>
                    </div>
                `;
            }).join('');
        }


        // Chiude il modale, salta nella tab giusta, e evidenzia la riga.
        function vaiARisultatoRicerca(id, tabella) {
            chiudiRicercaGlobale();
            const card = carteReali.find(c => String(c.id) === String(id));
            if (!card) return;

            // Missioni/Traguardi Fase 2 — ricerche eseguite (2026-08-29).
            // Fire-and-forget: un fallimento qui non deve mai bloccare la
            // navigazione al risultato, che è la parte importante di questa
            // funzione.
            (async () => {
                try {
                    const userId = await authGetUserId();
                    if (userId) await missioniRicercaRegistra(userId, card.name);
                } catch (e) { console.error('[missioni] registrazione ricerca:', e); }
            })();

            const et = _etichettaSezione(card);
            const tabDiDestinazione = tabella === 'wishlist' ? 'wishlist' : (et.testo === 'Sealed' ? 'sealed' : 'visualizzazione');
            // Assicura che i toggle Carte/Sealed/Wishlist in Visualizzazione
            // non nascondano il risultato appena trovato.
            if (tabDiDestinazione === 'visualizzazione') {
                _filtriTipo.carte = true; _filtriTipo.sealed = true;
                document.getElementById('toggleTipoCarte')?.classList.add('active');
                document.getElementById('toggleTipoSealed')?.classList.add('active');
            }

            const navBtn = document.querySelector(`nav .nav-item[onclick*="'${tabDiDestinazione}'"]`);
            switchTab(tabDiDestinazione, navBtn);

            setTimeout(() => {
                toggleRowHighlight(card.id);
                const riga = document.querySelector(`[data-id="${id}"]`)?.closest('tr, .riga-compatta');
                if (riga) riga.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }


