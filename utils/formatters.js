// ── utils/formatters.js ────────────────────────────────────────────────
// Funzioni pure di formattazione/utilità, senza DOM né accesso dati.



        // ── CARTE REALI (tabella 'carte' su Supabase) ────────────────────────────
        // Prima questa pagina mostrava dati finti di esempio (mockCardsView) — mai
        // collegata al database vero. 'stato' distingue collezione da wishlist
        // (due cose diverse, non solo una location chiamata "WISHLIST"); la
        // location "SCAMBIO" invece è solo un valore di location come un altro,
        // scelto liberamente per marcare le carte in scambio dentro la collezione.
        // Fase A0/A3: id delle carte che l'utente ha esplicitamente scelto
        // di mettere nel Binder (tabella binder_carte). L'aggiunta vera e
        // propria è ancora nella Fase A6 (non implementata) — per ora il
        // Set resta vuoto finché non esiste una UI per popolarlo, ed è
        // normale che il Binder appaia vuoto fino ad allora.

        function _mappaVariazione(r) {
            let variation = '—';
            if (r.prezzo_precedente != null && r.prezzo != null) {
                const diff = Number(r.prezzo) - Number(r.prezzo_precedente);
                if (Math.abs(diff) >= 0.005) { // ignora rumore di arrotondamento
                    const segno = diff > 0 ? '▲' : '▼';
                    variation = `${segno} ${diff > 0 ? '+' : '−'}${formattaEuro(Math.abs(diff))}`; // formato unico, audit 2026-09-25 C2
                }
            }
            return variation;
        }


        // formattaEuro, escapeHtml, escapeJsAttr, _urlImmagineSicura e
        // _urlImmagineVisualizzabile: SPOSTATE in utils/comuni.js il 2026-09-25
        // (una sola copia per sito e pagine pubbliche).


        function versioneMaggioreSito(a, b) {
            const pa = String(a).split('.').map(Number);
            const pb = String(b).split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const na = pa[i] || 0, nb = pb[i] || 0;
                if (na > nb) return true;
                if (na < nb) return false;
            }
            return false;
        }
