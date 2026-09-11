// ── ui/queue.ui.js ─────────────────────────────────────────────────────
// Match automatico tra amici (scambio/wishlist) e relativo badge.
//
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. La coda "Carte con problemi" (correzione manuale) è stata
// spostata in ui/queue-correzioni.ui.js — NESSUNA riscrittura del codice
// esistente in nessuna delle due parti: solo spostamento, zero cambi di
// comportamento.
//
// Contiene: _numNuoviMatchScambio/_numNuoviMatchWishlist, _chiaveMatch,
// _matchVisti, _segnaMatchVisti, _notificaUnaVolta, aggiornaBadgeMatch,
// _aggiornaPallinoMenu, caricaMatch.
//
// NOTA: subito dopo l'header originale c'è un frammento di commento
// orfano ("Sposta una carta dalla wishlist alla collezione..." + header
// "GRAFICO ANDAMENTO PREZZO") che non corrisponde a nessuna funzione qui —
// relitto di uno spostamento precedente (probabile riferimento a codice
// ora in ui/prices.ui.js/widget-prezzi.ui.js), lasciato invariato come
// tutto il resto (zero riscrittura), segnalato qui per completezza.
//
// _aggiornaPallinoMenu() qui sotto è chiamata cross-file da
// ui/queue-correzioni.ui.js dopo alcune azioni sulla coda. Nessuna
// istruzione qui gira a tempo di caricamento script — l'ordine tra i due
// file è indifferente.

        // Sposta una carta dalla wishlist alla collezione vera e propria —
        // equivalente sul sito del bottone "✓ Comprata" dell'estensione.
        // Due passaggi separati (insert poi delete), non una transazione SQL
        // unica: se il secondo fallisse dopo il primo, la carta resterebbe
        // duplicata in entrambe le tabelle invece che sparire da tutte e due
        // — un doppione visibile è facile da sistemare a mano, una carta
        // persa no.
        // ── GRAFICO ANDAMENTO PREZZO ──────────────────────────────────────────────

        // ── MATCH AUTOMATICO TRA AMICI ────────────────────────────────────────────
        // Due funzioni "security definer" sul database confrontano le tue
        // carte con quelle di TUTTI gli altri senza esporre le liste intere
        // altrui — restituiscono solo i match trovati (vedi
        // match_e_immagini.sql per i dettagli).

        // Letti da ui/phone.ui.js (widget Home "Match trovati", sbloccato
        // 2026-08-27) — scritti SOLO da aggiornaBadgeMatch() qui sotto, mai
        // interrogati direttamente dal widget: una query in meno ogni 15s,
        // scelta esplicita di Claudio pensando alla scalabilità con più
        // utenti nel gruppo.
        let _numNuoviMatchScambio = 0;
        let _numNuoviMatchWishlist = 0;

        // Sistema "letto/non letto": ogni match ha una chiave stabile
        // (coppia di id che non cambia tra un controllo e l'altro) —
        // salviamo su localStorage quali abbiamo già visto, così il
        // pallino sul menu sparisce dopo aver aperto la tab, e ricompare
        // solo per corrispondenze DAVVERO nuove.
        function _chiaveMatch(m, tipo) {
            return tipo === 'scambio' ? `${m.mia_carta_id}_${m.altra_wishlist_id}` : `${m.mia_wishlist_id}_${m.altra_carta_id}`;
        }

        function _matchVisti() {
            return prefMatchVistiGet();
        }

        function _segnaMatchVisti(chiavi) {
            const visti = _matchVisti();
            chiavi.forEach(c => visti.add(c));
            prefMatchVistiSet(visti);
        }


        // [SEZIONI SPOSTATE in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


        // ── ANTI-RIPETIZIONE DELLE NOTIFICHE (2026-09-01) ────────────────────────
        // Solo in memoria, per-scheda: si azzera ad ogni ricaricamento della
        // pagina, esattamente come _daFareUltimoStato e
        // _contatoriNotifichePrecedenti in ui/phone.ui.js (stesso identico
        // pattern già usato nel progetto per non ripetere un avviso). NON è
        // il sistema "letto/non letto" del badge, che vive su localStorage
        // (prefMatchVistiGet) ed è una cosa diversa: quello dice "l'utente ha
        // aperto la tab", questo dice "l'avviso è già comparso a schermo".
        //
        // Conseguenza voluta: dopo un F5, se ci sono ancora match o obiettivi
        // non visti, l'avviso ricompare una volta sola. Se preferisci che non
        // ricompaia MAI più dopo la prima volta, va salvato su localStorage
        // con una coppia prefNotificheGiaViste Get/Set in
        // data/preferences.repository.js — scelta rimandata a te, questa
        // versione non tocca nessun altro file.
        const _giaNotificati = new Set();

        // Manda a CSBar un avviso per ogni elemento mai notificato prima in
        // questa sessione. chiaveDi() deve restituire una chiave stabile tra
        // un giro di polling e l'altro (per i match è la stessa
        // _chiaveMatch del badge), avvisoDi() la coppia [tipo, extra] da
        // passare a CSBar.avvisa().
        function _notificaUnaVolta(elementi, chiaveDi, avvisoDi) {
            (elementi || []).forEach(el => {
                const chiave = chiaveDi(el);
                if (!chiave || _giaNotificati.has(chiave)) return;
                _giaNotificati.add(chiave);
                const [tipo, extra] = avvisoDi(el);
                CSBar.avvisa(tipo, extra);
            });
        }

        // [SEZIONI SPOSTATE in ui/widget-prezzi.ui.js — STEP 16 ristrutturazione file widget, 2026-09-11. Vedi Roadmap_Ristrutturazione_Widget_Home_2026-09-11.md]


        // Controlla i match SENZA aprire nessuna tab — usata all'avvio per
        // sapere subito se mostrare i pallini sul menu, senza dover
        // aspettare che l'utente clicchi su Scambio o Wishlist.
        // ── CARTE CON PROBLEMI ─────────────────────────────────────────────────────
        // Righe di coda_carte finite in stato 'errore' (l'estensione non è
        // riuscita a trovarle su Cardmarket) — prima l'errore restava
        // scritto nel database ma nessuno lo vedeva mai.
        // FIX (sessione dedicata "correzione manuale per-utente"): legge ora
        // da 'correzioni_manuali_carte' (owner_id = vero proprietario
        // originale, spostata lì dal worker autonomo dell'estensione dopo 3
        // tentativi falliti) invece che da 'coda_carte'/stato='errore' — la
        // RLS owner_id=auth.uid() di questa nuova tabella garantisce comunque
        // che ognuno veda SOLO le proprie, da qualsiasi dispositivo, esattamente
        // come prima.
        async function aggiornaBadgeMatch() {
            const userId = await authGetUserId();
            if (!userId) return;

            const [{ data: dataScambio }, { data: dataWishlist }] = await Promise.all([
                trovaMatch('trova_match_scambio_wishlist', userId),
                trovaMatch('trova_match_wishlist_scambio', userId),
            ]);

            // Traguardi #46-55 "Match" (Fase 2, 2026-09-01): registra le
            // chiavi di TUTTI i match attualmente trovati — non solo quelli
            // "non visti" del badge locale qui sotto, sono due concetti
            // diversi ("visto" è per-dispositivo/localStorage; il traguardo
            // è cumulativo per-utente sul DB, dedup lato server). Agganciato
            // qui e non in ui/phone.ui.js:renderPaginaMatch() perché questa
            // funzione gira SEMPRE all'avvio (vedi commento sopra), mentre
            // quella pagina solo se l'utente la apre manualmente — copertura
            // più ampia, un solo punto invece di due.
            (async () => {
                try {
                    const chiavi = [
                        ...(dataScambio || []).map(m => _chiaveMatch(m, 'scambio')),
                        ...(dataWishlist || []).map(m => _chiaveMatch(m, 'wishlist')),
                    ];
                    await missioniMatchTrovatiRegistraNuovi(userId, chiavi);
                } catch (e) { console.error('[missioni] registrazione match trovati:', e); }
            })();

            const visti = _matchVisti();
            const nuoviScambio = (dataScambio || []).filter(m => !visti.has(_chiaveMatch(m, 'scambio')));
            const nuoviWishlist = (dataWishlist || []).filter(m => !visti.has(_chiaveMatch(m, 'wishlist')));
            const { count: alertPrezzoNonVisti, nonVistiCarte: carteAlertPrezzo } = _contaAlertPrezzoNonVisti();

            // Notifiche di sistema (2026-09-01): riuso ESATTAMENTE i "non
            // visti" del badge (stesso concetto — non i match cumulativi
            // registrati sopra per il traguardo, che sono un'altra cosa).
            // Un avviso per elemento, raggruppati per tipo (group) così più
            // notifiche ravvicinate si accorpano invece di spammare.
            //
            // FIX (2026-09-01), due problemi corretti insieme:
            //
            // 1) RIPETIZIONE OGNI 60 SECONDI. aggiornaBadgeMatch() gira nel
            //    ciclo di polling lento (_pollingWidgetIntervalLento in
            //    ui/phone.ui.js), ma "visto" viene segnato SOLO quando
            //    l'utente apre davvero la tab (_segnaMatchVisti /
            //    _segnaAlertPrezzoVisti, chiamate da caricaMatch). Finché
            //    non la apre, gli stessi elementi restavano "non visti" e
            //    l'avviso ripartiva ad ogni giro: il raggruppamento di
            //    statusbar.js non lo impediva, perché su gruppo già presente
            //    richiama comunque enqueue() e quindi rimostra il popup.
            //    _giaNotificati (in memoria, vedi sopra) fa notificare ogni
            //    elemento UNA volta sola per sessione. Il badge numerico
            //    resta invariato: continua a contare tutti i non visti, non
            //    solo quelli appena notificati.
            //
            // 2) NOME CARTA "undefined". Le righe di carteReali usano il
            //    campo 'name' (il rename da 'nome' del database avviene in
            //    caricaCarteReali, ui/cards.ui.js) — 'c.nome' era sempre
            //    undefined e la notifica diceva "undefined ha raggiunto il
            //    tuo prezzo obiettivo".
            //
            // Email: mostrato solo il nome prima della chiocciola, come già
            // fa tutto il resto del sito (renderPaginaMatch, caricaMatch).
            if (typeof CSBar !== 'undefined') {
                const _nomeUtenteMatch = (email) => (email || '').split('@')[0] || 'qualcuno del gruppo';
                _notificaUnaVolta(nuoviScambio, m => _chiaveMatch(m, 'scambio'), m =>
                    ['match-trovato', { text: `Hai una carta che interessa a ${_nomeUtenteMatch(m.altra_email)}.` }]);
                _notificaUnaVolta(nuoviWishlist, m => _chiaveMatch(m, 'wishlist'), m =>
                    ['match-trovato', { text: `${_nomeUtenteMatch(m.altra_email)} ha una carta della tua Wishlist.` }]);
                _notificaUnaVolta(carteAlertPrezzo, c => 'prezzo-' + c.id, c =>
                    ['prezzo-obiettivo', { text: `${c.name || 'Una carta della tua Wishlist'} ha raggiunto il tuo prezzo obiettivo.` }]);
            }

            _numNuoviMatchScambio = nuoviScambio.length;
            _numNuoviMatchWishlist = nuoviWishlist.length;

            _aggiornaPallinoMenu('scambio', nuoviScambio.length);
            // Il pallino Wishlist conta ENTRAMBE le cose: match trovati +
            // carte scese sotto il prezzo obiettivo — un solo numero, non
            // due pallini diversi a confondere.
            _aggiornaPallinoMenu('wishlist', nuoviWishlist.length + alertPrezzoNonVisti);
        }


        function _aggiornaPallinoMenu(tabId, conteggio) {
            document.querySelectorAll(`[data-badge-tab="${tabId}"]`).forEach(el => {
                el.textContent = conteggio > 9 ? '9+' : conteggio;
                el.style.display = conteggio > 0 ? 'flex' : 'none';
            });
        }


        async function caricaMatch(tabId) {
            const userId = await authGetUserId();
            const container = document.getElementById('pannelloMatch');
            if (!userId) { container.innerHTML = ''; return; }

            container.innerHTML = '<div class="card-panel" style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cerco corrispondenze...</div>';

            const funzione = tabId === 'scambio' ? 'trova_match_scambio_wishlist' : 'trova_match_wishlist_scambio';
            const { data, error } = await trovaMatch(funzione, userId);

            if (error) {
                container.innerHTML = `<div class="card-panel" style="padding:1rem; color:var(--danger); font-size:0.85rem;">Errore nella ricerca match: ${error.message}</div>`;
                return;
            }
            if (!data || data.length === 0) {
                container.innerHTML = '';
                if (tabId === 'wishlist') _segnaAlertPrezzoVisti(_contaAlertPrezzoNonVisti().chiavi);
                _aggiornaPallinoMenu(tabId, 0);
                return;
            }

            // Aprire questa tab equivale ad "aver visto" tutti i match
            // mostrati qui — li segniamo visti e azzeriamo il pallino.
            // Per Wishlist, segniamo visti anche gli avvisi prezzo (stesso
            // pallino, mostra la somma di entrambi).
            _segnaMatchVisti(data.map(m => _chiaveMatch(m, tabId)));
            if (tabId === 'wishlist') _segnaAlertPrezzoVisti(_contaAlertPrezzoNonVisti().chiavi);
            _aggiornaPallinoMenu(tabId, 0);

            const righe = data.map(m => {
                if (tabId === 'scambio') {
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:0.85rem;"><strong>${escapeHtml(m.mio_nome)}</strong> (tuo, ${Number(m.mio_prezzo || 0).toFixed(2)} €) — cercato da <strong>${escapeHtml((m.altra_email || '').split('@')[0])}</strong>${m.altro_prezzo_obiettivo != null ? ` (fino a ${Number(m.altro_prezzo_obiettivo).toFixed(2)} €)` : ''}</span>
                    </div>`;
                }
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color);">
                    <span style="font-size:0.85rem;"><strong>${escapeHtml(m.mio_nome)}</strong> (in wishlist${m.mio_prezzo_obiettivo != null ? `, fino a ${Number(m.mio_prezzo_obiettivo).toFixed(2)} €` : ''}) — in scambio da <strong>${escapeHtml((m.altra_email || '').split('@')[0])}</strong> a ${Number(m.altro_prezzo || 0).toFixed(2)} €</span>
                </div>`;
            }).join('');

            container.innerHTML = `
                <div class="card-panel" style="padding:1rem;">
                    <div style="font-weight:800; font-size:0.9rem; margin-bottom:0.5rem; color:var(--primary);">
                        <i class="fa-solid fa-handshake"></i> ${data.length} corrispondenz${data.length === 1 ? 'a trovata' : 'e trovate'} nel gruppo!
                    </div>
                    ${righe}
                </div>
            `;
        }
