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
                    variation = `${segno} ${diff > 0 ? '+' : ''}${diff.toFixed(2)}€`;
                }
            }
            return variation;
        }


        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str == null ? '' : String(str);
            return div.innerHTML;
        }


        // Il campo 'immagine' può contenere tre formati diversi, a seconda
        // di quando la carta è stata processata:
        // 1. Link a Supabase Storage (nuovo, leggero — riconoscibile da
        //    "supabase.co") → si usa direttamente.
        // 2. Data URI base64 (vecchio formato, prima che passassimo a
        //    Storage) → si usa direttamente, funziona comunque.
        // 3. URL esterno grezzo di Cardmarket (carte processate PRIMA di
        //    qualunque correzione) → Cardmarket lo blocca se richiesto da
        //    un altro dominio, tentiamo il proxy come ripiego (funziona
        //    solo per alcune, meglio di niente per lo storico).
        function _urlImmagineVisualizzabile(immagine, larghezza) {
            if (!immagine) return null;
            if (immagine.startsWith('data:') || immagine.includes('supabase.co')) return immagine;
            return `https://images.weserv.nl/?url=${encodeURIComponent(immagine)}&w=${larghezza || 64}`;
        }


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
