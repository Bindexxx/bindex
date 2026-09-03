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
        // 1. Link a Supabase Storage (nuovo, leggero — riconoscibile dal
        //    dominio) → si usa direttamente.
        // 2. Data URI base64 (vecchio formato, prima che passassimo a
        //    Storage) → si usa direttamente, funziona comunque.
        // 3. URL esterno grezzo di Cardmarket (carte processate PRIMA di
        //    qualunque correzione) → Cardmarket lo blocca se richiesto da
        //    un altro dominio, tentiamo il proxy come ripiego (funziona
        //    solo per alcune, meglio di niente per lo storico).
        //
        // SICUREZZA (2026-09-01) — questa funzione è la sola cosa che sta
        // tra il contenuto del campo 'immagine' e un attributo src="..."
        // scritto via innerHTML in una decina di punti del sito. Prima
        // restituiva il valore GREZZO nei casi 1 e 2, quindi un valore
        // salvato come:
        //     data:image/png;base64,x" onerror="...codice..."
        // chiudeva l'attributo src e ne apriva un altro: il codice veniva
        // eseguito nel browser di chi apriva la pagina. Sulle pagine
        // pubbliche la vittima è il VISITATORE, non il proprietario dei
        // dati, e visto che index.html sta sullo stesso dominio quel codice
        // può leggere il token di sessione di un utente loggato.
        //
        // Tre difese, in ordine:
        //   a) i data URI passano solo se hanno la forma esatta di
        //      un'immagine base64 — quella forma non può contenere
        //      virgolette, spazi o parentesi, quindi non può uscire
        //      dall'attributo;
        //   b) gli URL Supabase vengono riconosciuti dal VERO nome host
        //      (new URL().hostname), non più con includes('supabase.co')
        //      che accettava anche https://sito-cattivo.com/?x=supabase.co;
        //   c) rete di sicurezza finale: le virgolette vengono comunque
        //      neutralizzate su ogni valore restituito, così anche un caso
        //      non previsto non può rompere l'attributo.
        // Se niente combacia si restituisce null: i chiamanti gestiscono
        // già questo caso mostrando il segnaposto.
        function _urlImmagineSicura(url) {
            return String(url).replace(/"/g, '&quot;');
        }

        function _urlImmagineVisualizzabile(immagine, larghezza) {
            if (!immagine) return null;
            const valore = String(immagine).trim();

            // (a) Data URI: solo immagini, solo base64, solo caratteri
            // dell'alfabeto base64. Nessuna virgoletta possibile.
            if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(valore)) {
                return _urlImmagineSicura(valore);
            }

            // (b) URL http(s) veri. Solo https, e solo host che finisce
            // davvero per .supabase.co viene usato diretto; tutto il resto
            // passa dal proxy, che riceve il valore già codificato.
            let indirizzo;
            try {
                indirizzo = new URL(valore);
            } catch (_) {
                return null; // né data URI valido né URL valido: non lo mostriamo
            }
            if (indirizzo.protocol !== 'http:' && indirizzo.protocol !== 'https:') return null;

            const host = indirizzo.hostname.toLowerCase();
            if (indirizzo.protocol === 'https:' && (host === 'supabase.co' || host.endsWith('.supabase.co'))) {
                return _urlImmagineSicura(indirizzo.href);
            }

            return _urlImmagineSicura(`https://images.weserv.nl/?url=${encodeURIComponent(indirizzo.href)}&w=${larghezza || 64}`);
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
