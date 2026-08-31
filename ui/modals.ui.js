// ── ui/modals.ui.js ────────────────────────────────────────────────────
// Visualizzatore immagine generico (usato da più sezioni del sito).


        // A15: prima apriva solo l'immagine statica; ora richiama lo stesso
        // flip-modal di apriFlipCardHome, su richiesta di Claudio, così il
        // comportamento è identico ovunque nel sito (tabella, vista
        // compatta mobile, Binder, Home). Tutti i punti che chiamavano
        // questa funzione restano invariati, cambia solo cosa succede
        // dentro. Nota: se la carta non ha immagine, prima il click non
        // faceva nulla (guardia bloccante) — ora il modale si apre lo
        // stesso e mostra direttamente il retro con le statistiche, senza
        // fronte (comportamento più utile, non un difetto).
        function apriImmagineIngrandita(id) {
            apriFlipCardHome(id);
        }


        function chiudiImmagineIngrandita() {
            document.getElementById('immagineModal').style.display = 'none';
            // A10: azzera anche l'eventuale scena flip, per non lasciarla a
            // metà rotazione o con il timer di auto-flip ancora in corsa
            // la prossima volta che il modale si apre in modalità semplice.
            document.getElementById('flipCardScene').style.display = 'none';
            if (_flipCardTimeout) { clearTimeout(_flipCardTimeout); _flipCardTimeout = null; }
            // Modale fullscreen (2026-08-31): rimossa qui, non solo in
            // apriUrlIngrandito — è il punto di chiusura comune a
            // entrambe le modalità, evita che una prossima apertura in
            // modalità immagine semplice erediti per un frame le misure
            // fullscreen della modalità flip.
            document.getElementById('immagineModalContent').classList.remove('modal-content-flip-fullscreen');
        }


        // ── RETRO CARTA "OWNER" — sleeve personalizzata del binder ──────
        // OPUS 2026-08-25. Questa funzione era CHIAMATA da apriFlipCardHome
        // (ui/home.ui.js) ma non era definita in nessuno dei 29 script
        // caricati da index.html né nello script inline: verificato con grep
        // su tutti i file e con `typeof renderRetroCartaOwner` → undefined
        // sul sito reale. Effetto: ReferenceError alla riga della chiamata,
        // due righe PRIMA di quella che apre il modale — quindi il click su
        // una carta, da QUALUNQUE punto del sito, non apriva più niente.
        // Riscritta qui da zero: il markup (#cbdStage, #cbdField-*,
        // #cbdText-*) e il CSS esistevano già in index.html, mancava solo la
        // logica che li popola.
        //
        // Sta in modals.ui.js e non in home.ui.js perché riguarda il modale
        // condiviso, non la Home: l'ordine di caricamento non conta, la
        // chiamata avviene a runtime, non al parsing.

        // Cache delle sleeve già risolte in questa sessione (binder_id → url
        // + posizioni): evita di chiedere una signed URL nuova ad ogni
        // singolo click su una carta. Le signed URL durano 1h, qui teniamo
        // 50 minuti di margine.
        const _cacheSleeveBinder = new Map();
        const _TTL_SLEEVE_MS = 50 * 60 * 1000;

        async function _sleeveDelBinder(userId, binderId) {
            const inCache = _cacheSleeveBinder.get(binderId);
            if (inCache && inCache.scadenza > Date.now()) return inCache;

            const { data: media, error } = await userMediaGet(userId, binderId, 'card_back');
            if (error || !media) {
                const vuota = { url: null, metadata: null, scadenza: Date.now() + _TTL_SLEEVE_MS };
                _cacheSleeveBinder.set(binderId, vuota);
                return vuota;
            }

            let url = null;
            if (media.source === 'default') {
                const { data: pub } = storageDefaultAssetPublicUrl(media.storage_path);
                url = pub?.publicUrl || null;
            } else {
                const { data: signed } = await storageSignedUrlUserMedia(media.storage_path);
                url = signed?.signedUrl || null;
            }

            const risolta = { url, metadata: media.metadata || null, scadenza: Date.now() + _TTL_SLEEVE_MS };
            _cacheSleeveBinder.set(binderId, risolta);
            return risolta;
        }


        // Ripiego quando il chiamante non passa un binderId (es. la Home, che
        // non ha un binder "corrente"): se l'elenco dei binder è già stato
        // caricato almeno una volta in questa sessione, ricava il binder di
        // appartenenza dalla carta stessa. Se non lo trova ritorna null e si
        // mostra il retro di sistema — mai una lettura di user_media con
        // binder_id null (righe orfane pre-migrazione, vedi il commento in
        // data/binder.repository.js).
        function _binderDiAppartenenzaSeNoto(card) {
            if (!Array.isArray(_bindersElenco) || _bindersElenco.length === 0) return null;
            if (card.stato === 'wishlist') {
                const wl = _bindersElenco.find(b => b.tipo === 'wishlist');
                return wl ? wl.id : null;
            }
            if (!card.location) return null;
            const loc = _bindersElenco.find(b => b.tipo === 'location' && b.location_valore === card.location);
            return loc ? loc.id : null;
        }


        function _cbdScriviTesto(chiave, testo) {
            const el = document.getElementById('cbdText-' + chiave);
            if (el) el.textContent = testo;
        }


        // Lo stage è disegnato a dimensioni fisse (900×1260, le stesse
        // dell'editor: CARD_BACK_W/CARD_BACK_H) e poi scalato sul contenitore
        // reale, così le posizioni salvate in percentuale dall'editor
        // combaciano al pixel con quello che si vede qui.
        function _cbdAdattaScala() {
            const wrap = document.getElementById('cbdWrap');
            const stage = document.getElementById('cbdStage');
            if (!wrap || !stage || wrap.clientWidth === 0) return;
            stage.style.transform = `scale(${wrap.clientWidth / CARD_BACK_W})`;
        }

        window.addEventListener('resize', () => {
            const wrap = document.getElementById('cbdWrap');
            if (wrap && wrap.style.display !== 'none') _cbdAdattaScala();
        });


        async function renderRetroCartaOwner(card, binderId) {
            const wrap = document.getElementById('cbdWrap');
            const infoWrap = document.getElementById('flipCardInfoWrap');
            if (!wrap || !card) return;

            // Punto di partenza: retro di sistema (l'immagine di sfondo di
            // .flip-card-back in index.html). Se una sleeve c'è la scopriamo
            // qui sotto; altrimenti resta questo.
            wrap.style.display = 'none';
            // Blocco info testuale (nome/codice/location/prezzo/condizione,
            // restyle pg-* del 2026-08-31): visibile di default (retro di
            // sistema, nessun dato già mostrato altrove). Nascosto più sotto
            // SOLO se la sleeve personalizzata è davvero caricata — i campi
            // pokemon/condizione/prezzo sarebbero doppioni, la sleeve li
            // mostra già lei (vedi cbdField-* qui sotto). Codice/location
            // non fanno parte dei 4 campi della sleeve e restano quindi
            // visibili SOLO quando non c'è sleeve (decisione di Claudio,
            // 2026-08-31: quando la sleeve c'è, nessuno dei 5 campi va
            // ripetuto fuori da essa).
            if (infoWrap) infoWrap.style.display = 'flex';

            const idBinder = binderId || _binderDiAppartenenzaSeNoto(card);
            if (!idBinder) return;

            const userId = await authGetUserId();
            if (!userId) return;

            const sleeve = await _sleeveDelBinder(userId, idBinder);
            if (!sleeve.url) return;

            document.getElementById('cbdBgImg').src = sleeve.url;

            _cbdScriviTesto('pokemon', card.name || '');
            _cbdScriviTesto('condition', card.cond || '');
            _cbdScriviTesto('variazione', card.variation || '—');
            _cbdScriviTesto('price', (card.price != null ? Number(card.price) : 0).toFixed(2) + ' €');

            // Posizioni/scale dei 4 campi: quelle salvate dall'editor sulla
            // riga user_media (metadata), con i default come rete di sicurezza
            // campo per campo — un metadata vecchio o parziale non deve mai
            // far sparire un campo.
            const posizioni = (sleeve.metadata && typeof sleeve.metadata === 'object') ? sleeve.metadata : DEFAULT_STATE_CARD_BACK;
            Object.keys(DEFAULT_STATE_CARD_BACK).forEach(chiave => {
                const campo = document.getElementById('cbdField-' + chiave);
                if (!campo) return;
                const s = posizioni[chiave] || DEFAULT_STATE_CARD_BACK[chiave];
                campo.style.left = s.left + '%';
                campo.style.top = s.top + '%';
                const contenuto = campo.querySelector('.cbd-field-content');
                if (contenuto) contenuto.style.transform = `scale(${s.scale != null ? s.scale : 1})`;
            });

            wrap.style.display = 'block';
            if (infoWrap) infoWrap.style.display = 'none';
            _cbdAdattaScala();
            // Il modale può essere ancora in apertura quando arriviamo qui (la
            // risoluzione della sleeve è asincrona): al primo giro
            // clientWidth può valere 0, quindi rimisuriamo al frame dopo.
            requestAnimationFrame(_cbdAdattaScala);
        }


        // Stesso modale di apriImmagineIngrandita, ma per un URL diretto
        // (usato dalla galleria foto dettaglio, che non ha bisogno di
        // cercare la carta in carteReali dato che ha già l'URL pronto).
        function apriUrlIngrandito(url) {
            document.getElementById('immagineErroreMsg').style.display = 'none';
            document.getElementById('flipCardScene').style.display = 'none'; // A10: mai insieme alla scena flip
            // Modale fullscreen (2026-08-31): questa modalità (immagine
            // diretta da URL) non è mai fullscreen, solo apriFlipCardHome
            // la attiva — rimossa qui per sicurezza anche se il modale non
            // era stato chiuso "pulito" da chiudiImmagineIngrandita prima.
            document.getElementById('immagineModalContent').classList.remove('modal-content-flip-fullscreen');
            const img = document.getElementById('immagineIngranditaImg');
            img.style.display = '';
            img.src = url;
            document.getElementById('immagineModal').style.display = 'flex';
        }
