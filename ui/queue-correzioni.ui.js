// "Carte con problemi": correzione a mano delle carte che l'estensione non ha trovato.

const _correzioniRighe = new Map();   // id → riga, per "Indovino la tua carta"

async function caricaCarteConProblemi() {
            const userId = await authGetUserId();
            if (!userId) return;

            const { data, error } = await correzioniManualiLista(userId);

            const pannello = document.getElementById('pannelloCarteProblemi');
            const lista = document.getElementById('listaCarteProblemi');
            if (error) { console.error('Errore caricamento carte con problemi:', error.message); return; }

            const conteggio = (data || []).length;
            _aggiornaPallinoMenu('inserimento', conteggio);
            if (typeof insAggiornaPagina === 'function') insAggiornaPagina();
            pannello.style.display = conteggio > 0 ? 'block' : 'none';
            _correzioniRighe.clear();
            if (conteggio === 0) return;

            const conIndovino = typeof selApriIndovino === 'function';
            const conSceltaSealed = typeof apriSceltaSealed === 'function';
            lista.innerHTML = data.map(r => {
                _correzioniRighe.set(r.id, r);
                // sealed (Sealed fase C): si sceglie dal catalogo sealed invece che con l'Indovino delle carte
                const sealed = r.tipo === 'sealed';
                const conScelta = sealed ? conSceltaSealed : conIndovino;
                const apriScelta = sealed ? 'correzioneApriSceltaSealed' : 'correzioneApriIndovino';
                const cosa = sealed ? ['prodotto possibile', 'prodotti possibili'] : ['carta possibile', 'carte possibili'];
                const opzioni = Array.isArray(r.opzioni_disambiguazione) ? r.opzioni_disambiguazione : [];
                const nomeAttr = escapeJsAttr(r.nome);
                const idOpzioni = 'opz-' + r.id;
                const filtroHtml = opzioni.length > 8 ? `
                    <input type="text" placeholder="Filtra tra le ${opzioni.length} opzioni..." oninput="_filtraOpzioniDisambiguazione('${idOpzioni}', this.value)" style="margin-bottom:0.3rem; font-size:0.75rem; padding:0.4rem 0.6rem;">
                ` : '';
                const opzioniHtml = opzioni.length > 0 ? `
                    <div class="prob-scelta">
                        <span class="prob-scelta-titolo">${opzioni.length} ${opzioni.length === 1 ? cosa[0] : cosa[1]}: scegli ${sealed ? 'quello giusto' : 'quella giusta'}</span>
                        ${opzioni.length > 25 ? `<span style="font-size:0.68rem; color:var(--danger);">⚠️ Cardmarket mostra i risultati su più pagine — se non vedi la carta giusta qui sotto, usa "Correggi e riprova" con un nome più specifico (non solo il codice del set).</span>` : ''}
                        ${filtroHtml}
                        <div id="${idOpzioni}" class="sel-griglia prob-griglia">
                            ${opzioni.map(o => `
                                <div class="prob-opzione" data-filtro-testo="${escapeHtml((o.label || '').toLowerCase())}" data-link="${escapeHtml(String(o.urlSingles || '').split('?')[0])}"${sealed ? ' data-sealed="1"' : ''}>
                                    <button type="button" class="sel-carta" onclick="sceglieOpzioneDisambiguazione('${r.id}', '${escapeJsAttr(o.label || '')}', '${escapeJsAttr(o.urlSingles || '')}')">
                                        ${sealed && typeof _ssMiniHtml === 'function' ? _ssMiniHtml(null) : typeof _selMiniaturaHtml === 'function' ? _selMiniaturaHtml(null) : ''}
                                        <span class="sel-testo"><b>${escapeHtml(o.label || o.urlSingles || 'opzione senza nome')}</b><span class="sel-set">È questa</span></span>
                                    </button>
                                    ${urlEsternoSicuro(o.urlSingles) ? `<a href="${urlEsternoSicuro(o.urlSingles)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="btn-secondary prob-apri" title="Apri su Cardmarket per vederla prima di scegliere" aria-label="Apri su Cardmarket"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
                                </div>
                            `).join('')}
                            ${conScelta ? `<button type="button" class="sel-carta prob-nessuna" onclick="${apriScelta}('${r.id}')"><i class="fa-regular fa-circle-question"></i><span class="sel-testo"><b>${sealed ? 'Nessuno di questi' : 'Nessuna di queste'}</b><span class="sel-versione">${sealed ? 'Cercalo nel catalogo sealed col nome già scritto' : 'Apri “Indovino la tua carta” con i dati già scritti'}</span></span></button>` : ''}
                        </div>
                    </div>
                ` : '';
                return `
                    <div style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0; border-bottom:1px solid var(--border-color); flex-wrap:wrap;">
                        <div style="flex:1; min-width:160px;">
                            <strong style="font-size:0.85rem;">${escapeHtml(r.nome)}</strong>
                            <div style="font-size:0.72rem; color:var(--danger);">${escapeHtml(r.errore_msg || 'Errore sconosciuto')}</div>
                        </div>
                        ${conScelta && !opzioni.length ? `<button class="btn-main" onclick="${apriScelta}('${r.id}')" style="font-size:0.75rem; padding:0.4rem 0.7rem; margin:0;"><i class="fa-solid fa-wand-magic-sparkles"></i> ${sealed ? 'Scegli il prodotto' : 'Scegli la carta'}</button>` : ''}
                        <button class="btn-secondary" onclick="modificaERiprovaCartaFallita('${r.id}', '${nomeAttr}')" style="font-size:0.75rem; padding:0.4rem 0.7rem;"><i class="fa-solid fa-pen"></i> Correggi e riprova</button>
                        <button class="btn-secondary" onclick="riprovaCartaFallita('${r.id}')" style="font-size:0.75rem; padding:0.4rem 0.7rem;"><i class="fa-solid fa-rotate-right"></i> Riprova</button>
                        <button class="btn-secondary" style="color:var(--danger); background-color:var(--danger-bg); font-size:0.75rem; padding:0.4rem 0.7rem;" onclick="eliminaCartaFallita('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                        ${opzioniHtml}
                    </div>
                `;
            }).join('');
            _correzioniCaricaMiniature();
            _correzioniCaricaMiniatureSealed();
        }

        // Le foto delle opzioni sealed, per i prodotti che il catalogo sealed conosce (Sealed fase C).
        async function _correzioniCaricaMiniatureSealed() {
            if (typeof sealedCatalogoPerUrl !== 'function' || typeof _ssMiniHtml !== 'function') return;
            const caselle = [...document.querySelectorAll('#listaCarteProblemi .prob-opzione[data-sealed][data-link]')].filter(el => el.dataset.link);
            if (!caselle.length) return;
            const { data, error } = await sealedCatalogoPerUrl(caselle.map(el => el.dataset.link));
            if (error || !data || !data.length) return;
            const perLink = new Map(data.map(r => [r.url, r.foto ? sealedCatalogoFotoUrl(r.foto) : r.foto_cm]));
            caselle.forEach(el => {
                const immagine = perLink.get(el.dataset.link);
                const mini = el.querySelector('.sel-mini');
                if (immagine && mini) mini.outerHTML = _ssMiniHtml(immagine);
            });
        }

        // Sealed: "Scegli il prodotto" / "Nessuno di questi" → finestra del catalogo sealed col nome della riga.
        function correzioneApriSceltaSealed(id) {
            const r = _correzioniRighe.get(id);
            if (!r || typeof apriSceltaSealed !== 'function') return;
            const rimetti = async (cambi) => {
                const ok = await _rimettiInCodaDaCorrezioneManuale(id, cambi);
                if (ok) await caricaCarteConProblemi();
            };
            apriSceltaSealed({
                titolo: 'Scegli il prodotto',
                sottotitolo: `L'estensione non l'ha trovato${r.errore_msg ? ` (${r.errore_msg})` : ''}. Sceglilo dal catalogo: riparte col suo link.`,
                testo: r.nome,
                alScelta: (p) => rimetti({ nome: p.nome, url_diretto: p.url }),
                alTesto: (testo) => rimetti({ nome: testo, url_diretto: null }),
                testoBottone: 'Riprova con il nome scritto',
            });
        }

        // Le miniature delle opzioni, per le pagine Cardmarket che il catalogo conosce già.
        async function _correzioniCaricaMiniature() {
            if (typeof catalogoMiniaturePerLink !== 'function' || typeof _selMiniaturaHtml !== 'function') return;
            const caselle = [...document.querySelectorAll('#listaCarteProblemi .prob-opzione[data-link]:not([data-sealed])')].filter(el => el.dataset.link);
            if (!caselle.length) return;
            const { data, error } = await catalogoMiniaturePerLink(caselle.map(el => el.dataset.link));
            if (error || !data || !data.length) return;
            const perLink = new Map(data.map(r => [r.cardmarket_url, r.immagine]));
            caselle.forEach(el => {
                const immagine = perLink.get(el.dataset.link);
                const mini = el.querySelector('.sel-mini');
                if (immagine && mini) mini.outerHTML = _selMiniaturaHtml(immagine, 160);
            });
        }

        // "Nessuna di queste" / "Scegli la carta": Indovino la tua carta con i dati della riga.
        function correzioneApriIndovino(id) {
            const r = _correzioniRighe.get(id);
            if (!r || typeof selApriIndovino !== 'function') return;
            const rimetti = async (cambi) => {
                const ok = await _rimettiInCodaDaCorrezioneManuale(id, cambi);
                if (ok) await caricaCarteConProblemi();
            };
            selApriIndovino({
                testo: r.nome, lingua: r.lingua,
                alScelta: (c, lingua) => rimetti({ nome: _selTestoCoda(c), url_diretto: c.link || null, lingua }),
                alTesto: (testo, lingua) => rimetti({ nome: testo, url_diretto: null, lingua }),
            });
        }

        function _filtraOpzioniDisambiguazione(idContenitore, query) {
            const q = query.trim().toLowerCase();
            document.querySelectorAll('#' + idContenitore + ' [data-filtro-testo]').forEach(el => {
                el.style.display = el.getAttribute('data-filtro-testo').includes(q) ? '' : 'none';
            });
        }

        async function _rimettiInCodaDaCorrezioneManuale(id, overrides = {}) {
            const { data: riga, error: errLettura } = await correzioniManualiLeggiRiga(id);
            if (errLettura || !riga) { mostraAvviso('❌ Errore: ' + (errLettura?.message || 'riga non trovata')); return false; }

            const nuovaRiga = {
                owner_id: riga.owner_id, nome: overrides.nome ?? riga.nome, lingua: overrides.lingua || riga.lingua,
                condizione: riga.condizione, qty: riga.qty, reverse: riga.reverse, first_ed: riga.first_ed,
                nota: riga.nota, location: riga.location, tipo: riga.tipo, destinazione: riga.destinazione,
                prezzo_obiettivo: riga.prezzo_obiettivo,
                url_diretto: overrides.url_diretto !== undefined ? overrides.url_diretto : riga.url_diretto,
                opzioni_disambiguazione: null, stato: 'pending', tentativi_falliti: 0,
                claimed_by: null, claimed_at: null, completato_il: null, errore_msg: null,
            };
            const { error: errInsert } = await queueInsertRighe(nuovaRiga);
            if (errInsert) { mostraAvviso('❌ Errore: ' + errInsert.message); return false; }

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
            const nuovo = await chiediTesto({ titolo: 'Correggi la carta', testo: 'Nome della carta:', valore: nomeAttuale, conferma: 'Riprova con questo nome' });
            if (nuovo === null || !nuovo.trim()) return;
            const ok = await _rimettiInCodaDaCorrezioneManuale(id, { nome: nuovo.trim() });
            if (ok) await caricaCarteConProblemi();
        }

        async function eliminaCartaFallita(id) {
            if (!(await chiediConferma({ titolo: 'Eliminare la richiesta?', testo: 'Questa azione non si può annullare.', conferma: 'Elimina', pericolo: true }))) return;
            const { error } = await correzioniManualiElimina(id);
            if (error) { mostraAvviso('❌ Errore: ' + error.message); return; }
            await caricaCarteConProblemi();
        }
