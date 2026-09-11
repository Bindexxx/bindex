// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION-TEMA.UI.JS — dark mode, temi, riduci animazioni (CardSync
// Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/navigation.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: toggleDarkMode, _animazioniRidotte, toggleRiduciAnimazioni,
// setSiteTheme.
//
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine
// tra i quattro file navigation-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

        function toggleDarkMode(isDark) {
            prefDarkModeSet(isDark);
            if (isDark) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }


        // ── A14 — TOGGLE "RIDUCI ANIMAZIONI" + FEEDBACK VISIVO SUL PREZZO ───────
        // Preferenza per-dispositivo (localStorage, stesso pattern di
        // "Aiuta il gruppo" e del layout Binder), NON legata all'account:
        // ogni PC/telefono la sceglie per sé.
        function _animazioniRidotte() {
            return prefRiduciAnimazioniGet();
        }

        function toggleRiduciAnimazioni(ridotte) {
            prefRiduciAnimazioniSet(ridotte);
        }


        function setSiteTheme(themeName) {
            prefSiteThemeSet(themeName);
            document.body.classList.remove('theme-verde', 'theme-pokemon');
            // FIX (Colleziona/Carta singola sembravano "mai attivi"): questa
            // funzione girava document.querySelectorAll('.theme-btn') senza
            // restringere ai soli bottoni del selettore tema — ma la STESSA
            // classe CSS è riusata anche dai toggle di Inserimento
            // (Destinazione/Tipo Prodotto), che quindi perdevano "active" ad
            // ogni caricamento pagina (questa funzione gira sempre, per
            // applicare il tema salvato). Elenco esplicito dei 3 id invece
            // di un selettore generico che finiva per toccare bottoni non suoi.
            ['themeBtn-viola', 'themeBtn-verde', 'themeBtn-pokemon'].forEach(id => document.getElementById(id)?.classList.remove('active'));

            if (themeName === 'verde') {
                document.body.classList.add('theme-verde');
                document.getElementById('themeBtn-verde').classList.add('active');
            } else if (themeName === 'pokemon') {
                document.body.classList.add('theme-pokemon');
                document.getElementById('themeBtn-pokemon').classList.add('active');
            } else {
                document.getElementById('themeBtn-viola').classList.add('active');
            }
        }


