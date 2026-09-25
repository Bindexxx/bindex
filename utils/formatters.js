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


        // AGGIUNTA (2026-09-24): mancava — ui/richieste-scambio.ui.js la
        // dava per scontata fin dall'header ("utils condivisi: escapeHtml,
        // formattaEuro") ma non era mai stata scritta, causava
        // ReferenceError non appena una riga aveva prezzo_congelato
        // valorizzato (scoperto solo ora, primo test con un prezzo reale
        // sulla pagina Richieste). Stessa convenzione già usata inline nel
        // resto del sito (Number(x).toFixed(2) + ' €') — nessun formato
        // nuovo inventato, solo resa condivisa.
        // FORMATO UNICO (audit 2026-09-25, C2 — decisione Claudio: "1.234,50 €"
        // ovunque). Prima qui "1234.50 €" e nelle pagine pubbliche
        // "1234,50 €": lo stesso prezzo appariva diverso tra sito e pagine
        // condivise. useGrouping 'always': l'italiano standard NON mette il
        // punto delle migliaia sotto 10.000 ("1234,50") — 'always' lo forza.
        // Browser vecchi che non conoscono 'always' ricadono sul comportamento
        // standard (nessun errore). Tollera null/undefined/stringhe (→ 0,00 €).
        // Copia IDENTICA in utils/shared-public.js: tenerle allineate.
        function formattaEuro(v) {
            return (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
        }


        // FIX (audit 2026-09-25, A2): textContent→innerHTML escapa solo
        // & < > — NON le virgolette doppie. Dentro un attributo
        // (value="${escapeHtml(x)}", alt="...", title="...") una " nel
        // testo chiudeva l'attributo: nomi/note tipo 'box 10"' venivano
        // troncati al ripristino della bozza di Inserimento. Ora escapa
        // anche " (→ &quot;), che nel testo normale si vede identica.
        // L'apostrofo resta invariato APPOSTA: diversi punti fanno
        // escapeHtml(x).replace(/'/g, "\\'") per metterlo dentro un
        // onclick — convertirlo in &#39; romperebbe quei punti. Per gli
        // argomenti stringa degli onclick usare escapeJsAttr() qui sotto.
        // Copia IDENTICA in utils/shared-public.js (pagine pubbliche):
        // tenerle allineate.
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str == null ? '' : String(str);
            return div.innerHTML.replace(/"/g, '&quot;');
        }

        // Testo da mettere come argomento stringa TRA APICI SINGOLI dentro
        // un attributo HTML a virgolette doppie, es.
        //   onclick="apri('${escapeJsAttr(nome)}')"
        // Prima escapa per la stringa JS (\ ' a-capo), poi per l'attributo
        // HTML (& " < >): il browser decodifica l'attributo e poi esegue il
        // JS, quindi il valore arriva alla funzione IDENTICO all'originale,
        // qualunque carattere contenga. Sostituisce il vecchio
        // .replace(/'/g, "\\'") che gestiva solo l'apostrofo (una " o un
        // a-capo in un nome/nota rompevano il click). Audit 2026-09-25, M2.
        function escapeJsAttr(str) {
            return String(str == null ? '' : str)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r\n|\r|\n/g, '\\n')
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
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
