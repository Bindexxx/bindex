// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION-CONDIVISIONE.UI.JS — link pubblico, QR (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/navigation.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: _paginaPubblicaBinderAttivo, _linkPubblicoCondivisione,
// copyShareLink, openQrModal, closeQrModal, apriAnteprimaLinkCondiviso,
// condividiLinkNativo.
//
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine
// tra i quattro file navigation-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

        // Costruisce il link pubblico alla pagina condivisa giusta per la tab
        // attiva (scambio.html o wishlist.html), usando l'id utente come
        // riferimento. Entrambe le pagine sono pensate per chi NON ha e non
        // avrà mai un account CardSync Pro: nessun login richiesto — solo i
        // dati previsti dalla rispettiva RLS pubblica su Supabase.
        // Multi-Binder (2026-08-25): quando si condivide da dentro il
        // dettaglio di un binder, currentMode vale 'binder' (impostato da
        // switchTab) — non basta più a scegliere la pagina, serve sapere
        // QUALE binder è aperto. Wishlist e Scambio mappano alle pagine
        // pubbliche reali già esistenti (stesso link di sempre). Per
        // qualunque altro tipo pubblico (location diversa da SCAMBIO,
        // extra) ora punta a binder-pubblico.html, la nuova pagina generica
        // (22_binder_pubblico_generico.sql + leggi_binder_pubblico(p_binder_id)).
        function _paginaPubblicaBinderAttivo() {
            const binder = (typeof _bindersElenco !== 'undefined' && Array.isArray(_bindersElenco))
                ? _bindersElenco.find(b => String(b.id) === String(_binderAttivo))
                : null;
            if (!binder) return null;
            // FASE 2 CONSOLIDAMENTO (26/08/2026): rimosso anche il caso
            // speciale per Wishlist -> wishlist.html, stesso trattamento
            // di SCAMBIO in Fase 1. leggi_binder_pubblico ora copre anche
            // tipo='wishlist' (27_leggi_binder_pubblico_wishlist.sql) —
            // trg_binders_forza_condivisione forza SEMPRE
            // stato_pubblicazione='pubblico' anche per questo tipo, quindi
            // la condizione sotto è sempre vera anche per Wishlist.
            // 'tipo' esposto nel risultato: serve a _linkPubblicoCondivisione
            // per decidere se aggiungere il parametro ?nome= (prima
            // decideva guardando solo pagina==='wishlist.html').
            if (binder.stato_pubblicazione === 'pubblico') return { pagina: 'binder-pubblico.html', binderId: binder.id, tipo: binder.tipo };
            return null;
        }

        async function _linkPubblicoCondivisione() {
            const sessione = await authGetSession();
            const userId = sessione?.user?.id;
            if (!userId) return null;
            let pagina, binderIdExtra, tipoBinderExtra;
            if (currentMode === 'binder') {
                const target = _paginaPubblicaBinderAttivo();
                if (!target) return null; // binder senza pagina pubblica dedicata, vedi sopra
                pagina = target.pagina;
                binderIdExtra = target.binderId;
                tipoBinderExtra = target.tipo;
            } else {
                pagina = currentMode === 'wishlist' ? 'wishlist.html' : (currentMode === 'sealed' ? 'sealed.html' : 'scambio.html');
            }
            const url = new URL(pagina + '?u=' + encodeURIComponent(userId), window.location.href);
            if (binderIdExtra) url.searchParams.set('binder', binderIdExtra);
            // Chi apre il link vede lo stesso tema che hai scelto tu sul tuo
            // dispositivo — non c'è login per chi riceve il link, quindi
            // niente localStorage da leggere: il tema viaggia nell'URL.
            const temaSalvato = prefSiteThemeGet();
            if (temaSalvato) url.searchParams.set('tema', temaSalvato);
            if (prefDarkModeGet()) url.searchParams.set('scuro', '1');
            // A16: solo per la Wishlist, passa anche il nome del proprietario
            // (riusa _nomeDaEmail già esistente) — serve a personalizzare il
            // testo di "Copia riepilogo" su wishlist.html ("Carte che potrei
            // procurare a [Nome]"), senza nessuna nuova chiamata a Supabase
            // né esporre l'email completa, solo un nome leggibile.
            // FASE 2 CONSOLIDAMENTO (26/08/2026): condizione estesa da
            // "pagina === 'wishlist.html'" (solo la vecchia pagina
            // dedicata) a includere anche il nuovo percorso generico
            // binder-pubblico.html quando il binder aperto è di tipo
            // wishlist — altrimenti il nome del proprietario non
            // arriverebbe più a copiaRiepilogo() sul nuovo percorso.
            if ((pagina === 'wishlist.html' || tipoBinderExtra === 'wishlist') && sessione?.user?.email) {
                url.searchParams.set('nome', _nomeDaEmail(sessione.user.email));
            }
            return url.href;
        }


        async function copyShareLink() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare il link.'); return; }
            try {
                await navigator.clipboard.writeText(link);
                alert('Link copiato negli appunti!');
            } catch (e) {
                prompt('Copia questo link:', link);
            }
        }


        async function openQrModal() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare il QR.'); return; }
            const modal = document.getElementById('qrModal');
            const container = document.getElementById('qrcodeContainer');
            container.innerHTML = '';
            new QRCode(container, {
                text: link,
                width: 180,
                height: 180,
                colorDark : "#2a2438",
                colorLight : "#ffffff"
            });
            // A16: il pulsante di condivisione nativa (foglio di condivisione
            // del telefono) compare solo dove il browser lo supporta
            // davvero (navigator.share) — niente pulsante rotto altrove.
            document.getElementById('btnCondividiNativo').style.display = navigator.share ? 'flex' : 'none';
            modal.style.display = 'flex';
        }


        function closeQrModal() {
            document.getElementById('qrModal').style.display = 'none';
        }


        // A16: apre la pagina pubblica reale (con i dati veri di quel
        // proprietario) in una nuova scheda — scelta di Claudio al posto di
        // una mini-anteprima dentro il modale, più semplice e affidabile.
        async function apriAnteprimaLinkCondiviso() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per generare l\'anteprima.'); return; }
            window.open(link, '_blank');
        }


        // A16: foglio di condivisione nativo del sistema (WhatsApp/Messaggi/
        // Email a scelta dell'utente) — IN AGGIUNTA a "Copia Link", non al
        // posto. Bottone visibile solo dove il browser lo supporta.
        async function condividiLinkNativo() {
            const link = await _linkPubblicoCondivisione();
            if (!link) { alert('Devi essere loggato per condividere il link.'); return; }
            try {
                await navigator.share({ title: 'CardSync Pro', url: link });
            } catch (e) {
                // L'utente ha annullato la condivisione, o il browser l'ha
                // bloccata — nessun errore da mostrare, è un'azione normale.
            }
        }
