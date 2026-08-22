// ── ui/queue.ui.js ─────────────────────────────────────────────────────
// Pannello "Carte con problemi" (correzione manuale), match automatico tra
// amici (scambio/wishlist) e relativo badge, allerta prezzo wishlist.


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


        // ── ALLERTA PREZZO WISHLIST — stesso sistema letto/non letto ──────────────
        // Una carta in wishlist "scatta" quando il prezzo attuale scende al
        // di sotto (o è uguale) al prezzo obiettivo che hai impostato —
        // stesso calcolo già usato per il badge "🎯 obiettivo!" nelle righe.
        function _alertPrezzoVisti() {
            return prefAlertPrezzoVistiGet();
        }

        function _segnaAlertPrezzoVisti(chiavi) {
            const visti = _alertPrezzoVisti();
            chiavi.forEach(c => visti.add(c));
            prefAlertPrezzoVistiSet(visti);
        }

        function _cardeConAllertaPrezzo() {
            return carteReali.filter(c => c.tabella === 'wishlist' && c.prezzoObiettivo != null && c.price > 0 && c.price <= c.prezzoObiettivo);
        }

        function _contaAlertPrezzoNonVisti() {
            const visti = _alertPrezzoVisti();
            const conCard = _cardeConAllertaPrezzo();
            const nonVisti = conCard.filter(c => !visti.has(String(c.id)));
            return { count: nonVisti.length, chiavi: conCard.map(c => String(c.id)) };
        }


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
        async function caricaCarteConProblemi() {
            const userId = await authGetUserId();
            if (!userId) return;

            const { data, error } = await correzioniManualiLista(userId);

            const pannello = document.getElementById('pannelloCarteProblemi');
            const lista = document.getElementById('listaCarteProblemi');
            if (error) { console.error('Errore caricamento carte con problemi:', error.message); return; }

            const conteggio = (data || []).length;
            _aggiornaPallinoMenu('inserimento', conteggio);
            pannello.style.display = conteggio > 0 ? 'block' : 'none';
            if (conteggio === 0) return;

            lista.innerHTML = data.map(r => {
                const opzioni = Array.isArray(r.opzioni_disambiguazione) ? r.opzioni_disambiguazione : [];
                const nomeAttr = r.nome.replace(/'/g, "\\'");
                const idOpzioni = 'opz-' + r.id;
                const filtroHtml = opzioni.length > 8 ? `
                    <input type="text" placeholder="Filtra tra le ${opzioni.length} opzioni..." oninput="_filtraOpzioniDisambiguazione('${idOpzioni}', this.value)" style="margin-bottom:0.3rem; font-size:0.75rem; padding:0.4rem 0.6rem;">
                ` : '';
                const opzioniHtml = opzioni.length > 0 ? `
                    <div style="width:100%; margin-top:0.4rem; display:flex; flex-direction:column; gap:0.3rem;">
                        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">${opzioni.length} corrispondenz${opzioni.length === 1 ? 'a possibile' : 'e possibili'} trovate — scegli quella giusta:</span>
                        ${opzioni.length > 25 ? `<span style="font-size:0.68rem; color:var(--danger);">⚠️ Cardmarket mostra i risultati su più pagine — se non vedi la carta giusta qui sotto, usa "Correggi e riprova" con un nome più specifico (non solo il codice del set).</span>` : ''}
                        ${filtroHtml}
                        <div id="${idOpzioni}" style="display:flex; flex-direction:column; gap:0.3rem; max-height:280px; overflow-y:auto;">
                            ${opzioni.map(o => `
                                <div data-filtro-testo="${(o.label || '').toLowerCase()}" style="display:flex; align-items:stretch; gap:0.3rem;">
                                    <button class="btn-secondary" style="flex:1; text-align:left; font-size:0.75rem; padding:0.4rem 0.6rem;" onclick="sceglieOpzioneDisambiguazione('${r.id}', '${(o.label || '').replace(/'/g, "\\'")}', '${(o.urlSingles || '').replace(/'/g, "\\'")}')">▸ ${escapeHtml(o.label || o.urlSingles || 'opzione senza nome')}</button>
                                    ${o.urlSingles ? `<a href="${o.urlSingles}" target="_blank" onclick="event.stopPropagation()" class="btn-secondary" style="flex-shrink:0; padding:0.4rem 0.6rem;" title="Apri su Cardmarket per vederla prima di scegliere"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '';
                return `
                    <div style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0; border-bottom:1px solid var(--border-color); flex-wrap:wrap;">
                        <div style="flex:1; min-width:160px;">
                            <strong style="font-size:0.85rem;">${escapeHtml(r.nome)}</strong>
                            <div style="font-size:0.72rem; color:var(--danger);">${escapeHtml(r.errore_msg || 'Errore sconosciuto')}</div>
                        </div>
                        <button class="btn-secondary" onclick="modificaERiprovaCartaFallita('${r.id}', '${nomeAttr}')" style="font-size:0.75rem; padding:0.4rem 0.7rem;"><i class="fa-solid fa-pen"></i> Correggi e riprova</button>
                        <button class="btn-secondary" onclick="riprovaCartaFallita('${r.id}')" style="font-size:0.75rem; padding:0.4rem 0.7rem;"><i class="fa-solid fa-rotate-right"></i> Riprova</button>
                        <button class="btn-secondary" style="color:var(--danger); background-color:var(--danger-bg); font-size:0.75rem; padding:0.4rem 0.7rem;" onclick="eliminaCartaFallita('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                        ${opzioniHtml}
                    </div>
                `;
            }).join('');
        }


        // Sceglie una delle opzioni trovate durante la disambiguazione:
        // salva il link ESATTO di quella carta (url_diretto) — l'estensione
        // la leggerà direttamente da lì, saltando del tutto una nuova
        // ricerca per nome (che può risultare ancora ambigua se il nome
        // scelto non è abbastanza specifico da solo — è successo).
        // Filtra le opzioni di disambiguazione mentre scrivi — utile quando
        // ce ne sono tante (es. set con carte che condividono lo stesso
        // codice, tipo "My First Battle").
        function _filtraOpzioniDisambiguazione(idContenitore, query) {
            const q = query.trim().toLowerCase();
            document.querySelectorAll('#' + idContenitore + ' [data-filtro-testo]').forEach(el => {
                el.style.display = el.getAttribute('data-filtro-testo').includes(q) ? '' : 'none';
            });
        }


        // FIX (sessione dedicata "correzione manuale per-utente"): le tre
        // funzioni sotto ("scegli opzione" / "riprova" / "correggi e
        // riprova") prima facevano un semplice UPDATE su 'coda_carte' (la
        // riga non si era mai spostata da lì). Ora la riga vive in
        // 'correzioni_manuali_carte' — "rimetterla in coda" significa quindi
        // leggerla da lì, reinserirla in 'coda_carte' come nuova riga
        // 'pending' (tentativi_falliti azzerato: si riparte da zero), e
        // infine toglierla da 'correzioni_manuali_carte'. Nessuna RPC
        // necessaria: A sta agendo sulle PROPRIE righe in entrambe le
        // tabelle, la RLS owner_id=auth.uid() lo consente direttamente.
        async function _rimettiInCodaDaCorrezioneManuale(id, overrides = {}) {
            const { data: riga, error: errLettura } = await correzioniManualiLeggiRiga(id);
            if (errLettura || !riga) { alert('❌ Errore: ' + (errLettura?.message || 'riga non trovata')); return false; }

            const nuovaRiga = {
                owner_id: riga.owner_id, nome: overrides.nome ?? riga.nome, lingua: riga.lingua,
                condizione: riga.condizione, qty: riga.qty, reverse: riga.reverse, first_ed: riga.first_ed,
                nota: riga.nota, location: riga.location, tipo: riga.tipo, destinazione: riga.destinazione,
                prezzo_obiettivo: riga.prezzo_obiettivo,
                url_diretto: overrides.url_diretto !== undefined ? overrides.url_diretto : riga.url_diretto,
                opzioni_disambiguazione: null, stato: 'pending', tentativi_falliti: 0,
                claimed_by: null, claimed_at: null, completato_il: null, errore_msg: null,
            };
            const { error: errInsert } = await queueInsertRighe(nuovaRiga);
            if (errInsert) { alert('❌ Errore: ' + errInsert.message); return false; }

            const { error: errDelete } = await correzioniManualiElimina(id);
            if (errDelete) console.error('[correzioni manuali] riga reinserita ma non rimossa dalla lista errori:', errDelete.message);
            return true;
        }


        async function sceglieOpzioneDisambiguazione(id, etichetta, urlDiretto) {
            const ok = await _rimettiInCodaDaCorrezioneManuale(id, { nome: etichetta, url_diretto: urlDiretto || null });
            if (ok) await caricaCarteConProblemi();
        }


        async function riprovaCartaFallita(id) {
            const ok = await _rimettiInCodaDaCorrezioneManuale(id);
            if (ok) await caricaCarteConProblemi();
        }


        async function modificaERiprovaCartaFallita(id, nomeAttuale) {
            const nuovo = prompt('Correggi il nome della carta:', nomeAttuale);
            if (nuovo === null || !nuovo.trim()) return;
            const ok = await _rimettiInCodaDaCorrezioneManuale(id, { nome: nuovo.trim() });
            if (ok) await caricaCarteConProblemi();
        }


        async function eliminaCartaFallita(id) {
            if (!confirm('Eliminare definitivamente questa richiesta?')) return;
            const { error } = await correzioniManualiElimina(id);
            if (error) { alert('❌ Errore: ' + error.message); return; }
            await caricaCarteConProblemi();
        }


        async function aggiornaBadgeMatch() {
            const userId = await authGetUserId();
            if (!userId) return;

            const [{ data: dataScambio }, { data: dataWishlist }] = await Promise.all([
                trovaMatch('trova_match_scambio_wishlist', userId),
                trovaMatch('trova_match_wishlist_scambio', userId),
            ]);

            const visti = _matchVisti();
            const nuoviScambio = (dataScambio || []).filter(m => !visti.has(_chiaveMatch(m, 'scambio')));
            const nuoviWishlist = (dataWishlist || []).filter(m => !visti.has(_chiaveMatch(m, 'wishlist')));
            const { count: alertPrezzoNonVisti } = _contaAlertPrezzoNonVisti();

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
