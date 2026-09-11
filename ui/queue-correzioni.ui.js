// ═══════════════════════════════════════════════════════════════════════
// QUEUE-CORREZIONI.UI.JS — pannello "Carte con problemi" (correzione
// manuale) — CardSync Pro
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11. Estratto da ui/queue.ui.js. NESSUNA riscrittura del
// codice esistente: solo spostamento, zero cambi di comportamento per
// l'utente finale.
//
// Contiene: caricaCarteConProblemi, _filtraOpzioniDisambiguazione,
// _rimettiInCodaDaCorrezioneManuale, sceglieOpzioneDisambiguazione,
// riprovaCartaFallita, modificaERiprovaCartaFallita, eliminaCartaFallita.
//
// Chiama cross-file _aggiornaPallinoMenu() (ui/queue.ui.js) dopo alcune
// azioni sulla coda. Nessuna istruzione qui gira a tempo di caricamento
// script — l'ordine tra i due file è indifferente.
// ───────────────────────────────────────────────────────────────────────

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


