// Contenuto di ogni widget nelle tessere grandi.

function _ballFilaCarte(titolo, carte, origine) {
    if (!carte || !carte.length) return '';
    return '<div class="ball-gruppo">' +
        `<span class="ball-k-lab">${titolo}</span>` +
        '<div class="ball-strip">' + carte.map(c => _ballMiniCarta(c, undefined, origine)).join('') + '</div>' +
        '</div>';
}

function _ballElencoRighe(voci) {
    if (!voci || !voci.length) return '';
    return voci.map(v => `
        <div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'carta','${String(v.id).replace(/'/g, "\\'")}','${v.origine || ''}')">
            <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.dato}</span>
        </div>`).join('');
}

const _ballCORPI = {
    variazione_valore: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => formattaEuro(Math.abs(Number(v) || 0));
        const segno = (v) => (Number(v) >= 0 ? '+' : '−');

        if (d.soloUnGiorno) {
            return {
                inline: `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
                        '<span class="ball-k-lab">primo giorno misurato</span>',
                blocco: '<span class="ball-k-lab ball-attesa">La variazione compare domani, quando ci sara' + "'" + ' un secondo giorno da confrontare.</span>',
            };
        }

        if (d.settimana) {
            const s = d.settimana;
            const col = (v) => (v >= 0 ? 'var(--success)' : 'var(--danger)');
            const inl =
                '<p class="ball-k-tit">Variazione</p>' +
                `<div class="ball-k-big ball-k-mono" style="color:${col(s.variazione)}">${formattaEuroVariazione(s.variazione)}</div>` +
                `<span class="ball-k-lab">in ${s.giorni} giorn${s.giorni === 1 ? 'o' : 'i'} · ${formattaEuro(d.valoreOggi)} oggi</span>`;
            const base = Math.max(Math.abs(s.mercato || 0), Math.abs(s.aggiunte), 0.01);
            const riga = (nome, v) =>
                `<div class="ball-riga-set"><div class="ball-riga"><span class="ball-nome">${nome}</span><span class="ball-dato" style="color:${col(v)};font-weight:700">${formattaEuroVariazione(v)}</span></div>` +
                `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${Math.max(2, (Math.abs(v) / base) * 100)}%;background:${col(v)}"></div></div></div>`;
            let blk = '';
            if (s.mercato != null) blk += riga('Mercato', s.mercato);
            if (s.aggiunte) blk += riga(`Aggiunte${s.carteAggiunte ? ` (${s.carteAggiunte})` : ''}`, s.aggiunte);
            if (s.mercato == null) blk += `<span class="ball-k-lab ball-attesa">${s.pezziInMeno} pezz${s.pezziInMeno === 1 ? 'o uscito' : 'i usciti'}: il movimento dei prezzi non si può separare.</span>`;
            return { inline: inl, blocco: blk };
        }

        const colore = d.variazione >= 0 ? 'var(--success)' : 'var(--danger)';
        const inline =
            `<div class="ball-k-big ball-k-mono" style="color:${colore}">${segno(d.variazione)}${eur(d.variazione)}</div>` +
            `<span class="ball-k-lab">${eur(d.valoreOggi)} in totale</span>`;

        const voci = [];
        if (d.carteAggiunte > 0) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.carteAggiunte} cart${d.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}</span>
                <span class="ball-dato">${segno(d.daAggiunte)}${eur(d.daAggiunte)}</span>
            </div>`);
        }
        if (d.rimozioniSospette) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.pezziInMeno} pezz${d.pezziInMeno === 1 ? 'o uscito' : 'i usciti'} dalla collezione</span>
                <span class="ball-dato">—</span>
            </div>`);
            voci.push('<span class="ball-k-lab ball-attesa">Con dei pezzi in uscita non si puo' + "'" + ' distinguere quanto sia movimento dei prezzi.</span>');
        } else if (d.daPrezzi != null && Math.abs(d.daPrezzi) >= 0.01) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">movimento dei prezzi</span>
                <span class="ball-dato">${segno(d.daPrezzi)}${eur(d.daPrezzi)}</span>
            </div>`);
        }

        const grafico = (d.serie && d.serie.length > 1) ? _ballSparkline(d.serie, colore) : '';
        const nota = `<span class="ball-k-lab">${d.giorniMisurati} giorn${d.giorniMisurati === 1 ? 'o' : 'i'} misurat${d.giorniMisurati === 1 ? 'o' : 'i'}</span>`;

        return { inline, blocco: grafico + voci.join('') + nota };
    },

    contributi: (d) => {
        if (!d) {
            return {
                inline: '<div class="ball-k-mid">\u2014</div><span class="ball-k-lab">dati non disponibili</span>',
                blocco: '',
            };
        }

        const percTop = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
        const inline =
            '<p class="ball-k-tit">Contributi</p>' +
            `<div class="ball-k-big ball-k-mono">${percTop != null ? percTop + '%' : d.miei}</div>` +
            `<span class="ball-k-lab">${percTop != null ? 'dei controlli prezzi del gruppo' : 'carte controllate per il gruppo'}</span>`;
        const righeNumeri =
            _ballRigaBarra('I tuoi controlli', String(d.miei), percTop || 0) +
            _ballRigaBarra('Persone aiutate', `${d.personeAiutate} di 4`, (d.personeAiutate / 4) * 100);

        if (!d.gruppo) {
            return {
                inline,
                blocco: '<div class="ball-quota">' +
                        '<div class="ball-barra-out"><div class="ball-barra-in" style="width:0%"></div></div>' +
                        '<span class="ball-k-lab ball-attesa">Primi contributi in arrivo.</span>' +
                        '</div>',
            };
        }

        return { inline, blocco: righeNumeri };
    },

    primo_piano: (d) => {
        if (typeof _primoPianoCorpo === 'function') return _primoPianoCorpo(d);
        if (!d) return { inline: '', blocco: '' };
        const top = (d.perValore && d.perValore[0]) || null;
        const eur = (v) => formattaEuro(v);
        const inline = top
            ? `<div class="ball-k-big ball-k-mono">${eur(top.prezzo)}</div><span class="ball-k-lab">${escapeHtml(top.nome)}</span>`
            : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';
        const blocco = '<div class="ball-gruppi">' +
            _ballFilaCarte('Valore più alto', d.perValore, 'top_valore') +
            _ballFilaCarte('Oscillazione +', d.su, 'oscillazione_su') +
            _ballFilaCarte('Oscillazione −', d.giu, 'oscillazione_giu') +
            '</div>';
        return { inline, blocco };
    },

    carte_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>', blocco: '' };
        }
        const inline =
            '<p class="ball-k-tit">Ultime aggiunte</p>' +
            `<div class="ball-k-big ball-k-mono">${d.in7 || 0}</div>` +
            '<span class="ball-k-lab">negli ultimi 7 giorni</span>';
        const blocco = '<div class="ball-ul">' + d.lista.map(c => {
            const url = c.immagine ? (_urlImmagineVisualizzabile(c.immagine, 64) || '') : '';
            return `<div class="ball-clic" onclick="_ballAzioneRiga(event,'carta','${escapeJsAttr(String(c.id))}','ultime_aggiunte')">` +
                (url ? `<img src="${url}" alt="" onerror="this.outerHTML='<span class=&quot;vuota&quot;></span>'">` : '<span class="vuota"></span>') +
                `<span class="n"><b>${escapeHtml(c.nome || '—')}</b><small>${c.creataIl ? _ballQuando(c.creataIl) : c.quando}</small></span>` +
                `<b>${formattaEuro(c.prezzo)}</b></div>`;
        }).join('') + '</div>';
        return { inline, blocco };
    },

    prezzi_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessun controllo ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${escapeHtml(d.lista[0].nome)}</div>` +
            `<span class="ball-k-lab">controllata il ${escapeHtml(d.lista[0].quando)}</span>`;
        const blocco = _ballElencoRighe(d.lista.map(c => ({
            id: c.id,
            nome: escapeHtml(c.nome) + (c.variante ? ` <span class="ball-k-lab">${escapeHtml(c.variante)}</span>` : ''),
            dato: c.quando,
            origine: 'prezzi_recenti',
        })));
        return { inline, blocco };
    },

    set_completamento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const esc = (t) => (typeof escapeHtml === 'function' ? escapeHtml(t) : String(t));
        const apri = "_ballAzioneRiga(event,'tab','set')";

        if (d.vuoto) {
            return {
                inline: '<p class="ball-k-tit">Set</p><div class="ball-k-mid">—</div><span class="ball-k-lab">libreria set vuota</span>',
                blocco: ''
            };
        }

        let inline;
        if (d.notifica) {
            inline =
                '<p class="ball-k-tit">Set</p>' +
                `<div class="ball-k-big ball-k-mono su">${d.notifica.soglia}%</div>` +
                `<span class="ball-k-lab">${esc(d.notifica.nome)}</span>` +
                _ballPill('nuova soglia', true);
        } else if (d.prima) {
            inline =
                '<p class="ball-k-tit">Set</p>' +
                `<div class="ball-k-big ball-k-mono">${setPercentuale(d.prima.perc)}</div>` +
                `<span class="ball-k-lab">il più avanti: ${esc(d.prima.nome)} · ${d.prima.hai} di ${d.prima.totale}</span>`;
        } else {
            inline =
                '<p class="ball-k-tit">Set</p><div class="ball-k-mid">—</div>' +
                `<span class="ball-k-lab">${d.nCompletati ? d.nCompletati + ' completati' : 'nessun set in corso'}</span>`;
        }

        const blocco = (d.top || []).slice(0, 3).map(v =>
            _ballRigaBarra(esc(v.nome), `${v.hai}/${v.totale}`, Math.max(v.perc, v.hai > 0 ? 2 : 0), apri)
        ).join('') +
            (d.senzaCatalogo ? '<span class="ball-k-lab ball-attesa">Catalogo per carta da caricare: avanzamento sul set base</span>' : '');

        return { inline, blocco };
    },

    bustina: (d) => {
        if (!d || d.placeholder || d.giornaliera_disponibile == null) return { inline: '', blocco: '' };
        const giornaliera = !!d.giornaliera_disponibile;
        const guadagnate = Math.max(0, Number(d.saldo_guadagnate) || 0);
        const daAprire = guadagnate + (giornaliera ? 1 : 0);
        const aperte = Math.max(0, Number(d.aperte_totali) || 0);
        const inline = '<p class="ball-k-tit">Bustina</p>' + (daAprire > 0
            ? `<div class="ball-k-big ball-k-mono su">${daAprire.toLocaleString('it-IT')}</div>` +
              `<span class="ball-k-lab">${daAprire === 1 ? 'bustina da aprire' : 'bustine da aprire'}</span>`
            : '<div class="ball-k-mid">Torna domani</div>' +
              '<span class="ball-k-lab">nessuna bustina da aprire</span>');
        const blocco = _ballPill(giornaliera ? 'giornaliera pronta' : 'giornaliera già aperta', giornaliera) +
            `<span class="ball-k-lab">${aperte.toLocaleString('it-IT')} apert${aperte === 1 ? 'a' : 'e'} finora</span>`;
        return { inline, blocco };
    },
    foto: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const perc = d.totale ? Math.round((d.fatte / d.totale) * 100) : 0;
        const inline = '<p class="ball-k-tit">Foto carte</p>' +
            `<div class="ball-k-big ball-k-mono">${d.fatte}<small class="ball-k-tot"> / ${d.totale}</small></div>` +
            `<span class="ball-k-lab">carte con foto vere${d.daFare ? ` · ${d.daFare} da fare` : ''}</span>` +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc}%"></div></div>`;
        if (!d.daFare) return { inline, blocco: '<span class="ball-k-lab">Tutte le carte hanno almeno una foto.</span>' };
        const pill = (testo, corto, acceso) => `<span class="ball-pill${acceso ? ' acceso' : ''}" data-corto="${corto}" title="${testo}">${testo}</span>`;
        const righe = (d.prossime || []).map(c => `
            <div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','foto')">
                <span class="ball-nome">${escapeHtml(c.name || '')}</span>
                <span class="ball-dato">${pill('Fronte', 'F', c.fronte)}${pill('Retro', 'R', c.retro)}${c.scambio ? pill('Scambio', 'S', false) : ''}</span>
            </div>`).join('');
        return {
            inline,
            blocco: '<div class="ball-gruppo"><span class="ball-k-lab">Prossime da fotografare</span>' + righe + '</div>' +
                _ballPulsante('<i class="fa-solid fa-camera"></i> Inizia sessione foto', 'fotoAvviaSessioneDaTessera(event)'),
        };
    },
    polvere: (d) => {
        if (!d || d.saldo == null) return { inline: '', blocco: '' };
        return {
            inline: '<p class="ball-k-tit">Polvere</p>' +
                `<div class="ball-k-big ball-k-mono">${d.saldo.toLocaleString('it-IT')} ✧</div>` +
                (d.settimana > 0
                    ? `<span class="ball-k-lab">+${d.settimana.toLocaleString('it-IT')} ✧ questa settimana</span>`
                    : '<span class="ball-k-lab">il tuo saldo</span>'),
            blocco: '<span class="ball-k-lab">Si guadagna con missioni, traguardi e doppioni della bustina</span>',
        };
    },
    missioni: (d) => {
        if (!d || d.placeholder || !d.totali) return { inline: '', blocco: '' };
        const tutte = d.fatte >= d.totali;
        const inline =
            '<p class="ball-k-tit">Missioni di oggi</p>' +
            `<div class="ball-k-big ball-k-mono${tutte ? ' su' : ''}">${d.fatte}/${d.totali}</div>` +
            `<span class="ball-k-lab">${tutte ? 'tutte completate oggi' : 'completate oggi'}</span>` +
            (tutte ? _ballPill('tutte fatte', true) : '');
        const premio = (r) => {
            if (!r) return '';
            const q = r.quantita || 1;
            if (r.tipo === 'polvere') return `+${q} ✧`;
            if (r.tipo === 'bustina') return `+${q} bustin${q === 1 ? 'a' : 'e'}`;
            if (r.tipo === 'stampino') return '+1 stampino';
            return '';
        };
        const blocco = (d.voci || []).map(v =>
            `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','missioni')">` +
            `<span class="ball-nome">${v.fatta ? '✓ ' : ''}${escapeHtml(v.titolo)}</span>` +
            `<span class="ball-dato">${v.fatta ? 'fatta' : premio(v.ricompensa)}</span></div>`
        ).join('');
        return { inline, blocco };
    },

    valore_collezione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => formattaEuroTondo(v);
        const inline =
            '<p class="ball-k-tit">Valore collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
            `<span class="ball-k-lab">${d.pezzi} pezzi · media ${eur(d.media)}</span>`;
        let blocco = '';
        if (d.top && d.top.length) {
            blocco = '<div class="ball-strip">' + d.top.map(c => _ballMiniCarta(c, undefined, 'top_valore')).join('') + '</div>' +
                '<span class="ball-k-lab">Le più preziose</span>';
        }
        return { inline, blocco };
    },

    doppioni: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Doppioni</p>' +
            `<div class="ball-k-big ball-k-mono">${d.copieExtra || 0}</div>` +
            `<span class="ball-k-lab">copie in più su ${d.titoli || 0} carte</span>` +
            (d.valoreExtra > 0 ? `<span class="ball-k-lab su">${formattaEuroTondo(d.valoreExtra)} scambiabili</span>` : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, '×' + c.qty)).join('') + '</div>' +
                '<span class="ball-k-lab">Le carte doppie</span>';
        }
        return { inline, blocco };
    },

    wishlist_obiettivi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Wishlist</p>' +
            `<div class="ball-k-big ball-k-mono${d.raggiunte > 0 ? ' su' : ''}">${d.raggiunte > 0 ? d.raggiunte : (d.totale || 0)}</div>` +
            `<span class="ball-k-lab">${d.raggiunte > 0 ? 'sotto il prezzo obiettivo' : 'carte desiderate'}</span>` +
            (d.raggiunte > 0 ? _ballPill('da comprare', true) : '');
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = d.lista.map(c => {
                const perc = c.prezzo > 0 ? Math.min(100, (c.obiettivo / c.prezzo) * 100) : 0;
                return _ballRigaBarra(escapeHtml(c.nome), `${formattaEuroTondo(c.prezzo)} / ${formattaEuroTondo(c.obiettivo)}`, perc,
                    `_ballAzioneRiga(event,'carta','${escapeJsAttr(String(c.id))}')`);
            }).join('');
        }
        return { inline, blocco };
    },

    traguardi: (d) => {
        if (!d || !d.carte) return { inline: '', blocco: '' };
        const manca = d.carte.soglia - d.carte.valore;
        const inline =
            '<p class="ball-k-tit">Traguardi</p>' +
            `<div class="ball-k-big ball-k-mono">${manca > 0 ? manca : 0}</div>` +
            `<span class="ball-k-lab">carte al traguardo di ${d.carte.soglia}</span>`;
        const blocco =
            _ballRigaBarra('Carte', `${d.carte.valore}/${d.carte.soglia}`, d.carte.perc) +
            _ballRigaBarra('Valore', `${formattaEuroTondo(d.euro.valore)} / ${formattaEuroTondo(d.euro.soglia)}`, d.euro.perc) +
            _ballRigaBarra('Location', `${d.luoghi.valore}/${d.luoghi.soglia}`, d.luoghi.perc);
        return { inline, blocco };
    },

    lingue: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const prima = d.voci[0];
        const quota = d.totale ? Math.round((prima[1] / d.totale) * 100) : 0;
        const inline =
            '<p class="ball-k-tit">Lingue</p>' +
            `<div class="ball-k-big ball-k-mono">${prima[0]}</div>` +
            `<span class="ball-k-lab">${quota}% della collezione</span>`;
        const blocco = '<div class="ball-stat-griglia">' + d.voci.slice(0, 3).map(([lang, n]) =>
            `<div class="ball-stat"><b>${n}</b><span>${lang}</span></div>`).join('') + '</div>';
        return { inline, blocco };
    },

    inserimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.daCorreggere || 0, q = d.inCoda || 0;
        const inline =
            '<p class="ball-k-tit">Inserimento</p>' +
            (n > 0
                ? `<div class="ball-k-big ball-k-mono" style="color:#d32f2f">${n}</div><span class="ball-k-lab">da correggere${q ? ` · ${q} in coda` : ''}</span>`
                : `<div class="ball-k-big ball-k-mono">${q}</div><span class="ball-k-lab">in coda · ${q ? 'in lavorazione' : 'tutto inviato'}</span>`);
        const u = d.ultimoInvio;
        let ultimo = '<span class="ball-k-lab">Nessun invio recente</span>';
        let pista = '';
        if (u) {
            const esito = u.inCorso ? `${u.inCorso} ancora in coda`
                : (u.errori ? `${u.errori} da correggere` : (u.quante === 1 ? 'trovata' : 'tutte trovate'));
            ultimo = `<span class="ball-k-lab ball-ins-ultimo">Ultimo invio: ${u.quante} cart${u.quante === 1 ? 'a' : 'e'} ${_ballQuando(u.quando)}, ${esito}</span>`;
            const perc = u.quante ? Math.round((u.trovate / u.quante) * 100) : 0;
            pista = `<div class="ball-ins-pista"><div style="width:${perc}%"></div></div>`;
        }
        const stat = (v, et) => `<div class="ball-stat"><b>${v}</b><span>${et}</span></div>`;
        const griglia = '<div class="ball-stat-griglia">' + stat(q, 'in coda') + stat(u ? u.trovate : '—', 'trovate') + stat(n, 'da correggere') + '</div>';
        const pulsante = n > 0
            ? _ballPulsante('Correggi', `_ballAzioneRiga(event,'tab','inserimento')`)
            : _ballPulsante('Aggiungi carta', `_ballAzioneRiga(event,'tab','inserimento')`);
        const blocco = `<div class="ball-ins">${ultimo}${pista}${griglia}${pulsante}</div>`;
        return { inline, blocco };
    },

    binder: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const pubblici = d.pubblici || 0;
        const inline =
            '<p class="ball-k-tit">Binders</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">binder${pubblici ? ` · ${pubblici} pubblic${pubblici === 1 ? 'o' : 'i'}` : ''}</span>`;
        const blocco = (d.copertine && d.copertine.length) ? _ballCopertine(d.copertine, true) : '';
        return { inline, blocco };
    },

    condividi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Condividi</p>' +
            `<div class="ball-k-big ball-k-mono">${d.pubbliche}</div>` +
            `<span class="ball-k-lab">cos${d.pubbliche === 1 ? 'a pubblica' : 'e pubbliche'} · ${d.private} privat${d.private === 1 ? 'a' : 'e'}</span>`;
        const blocco = d.copertine.length
            ? _ballCopertine(d.copertine)
            : '<span class="ball-k-lab ball-attesa">Rendi pubblico un binder o uno scaffale per condividerlo.</span>';
        return { inline, blocco };
    },

    richieste: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.totale || 0, ris = d.riservate || 0;
        const inline =
            '<p class="ball-k-tit">Richieste</p>' +
            `<div class="ball-k-big ball-k-mono"${n ? ' style="color:#d32f2f"' : ''}>${n}</div>` +
            `<span class="ball-k-lab">da gestire${ris ? ` · ${ris} riservat${ris === 1 ? 'a' : 'e'}` : ''}</span>`;
        let blocco = '';
        if (d.immagini && d.immagini.length) {
            blocco += '<div class="ball-th">' + d.immagini.map(u => `<img src="${_urlImmagineVisualizzabile(u, 64) || ''}" alt="" onerror="this.remove();">`).join('') +
                `<span>${d.oggetti} oggett${d.oggetti === 1 ? 'o' : 'i'}${d.valore ? ' · ' + formattaEuro(d.valore) : ''}</span></div>`;
        }
        blocco += _ballPulsante(n || ris ? 'Gestisci' : 'Apri Richieste', `_ballAzioneRiga(event,'tab','richieste')`);
        return { inline, blocco };
    },

    achievement: (d) => {
        if (!d || !d.totale) return { inline: '', blocco: '' };
        const ultime = d.ultime || [];
        const inline =
            '<p class="ball-k-tit">Achievement</p>' +
            `<div class="ball-k-big ball-k-mono">${d.posseduti || 0}</div>` +
            `<span class="ball-k-lab">di ${d.totale}</span>`;
        if (!ultime.length) return { inline, blocco: '<span class="ball-k-lab ball-attesa">La prima medaglia arriva con il primo traguardo.</span>' };
        const blocco =
            '<div class="ball-medaglie">' + ultime.map(u =>
                `<span class="ball-medaglia r-${u.rarita}" title="${escapeHtml(u.titolo)}"><i class="fa-solid fa-trophy"></i></span>`).join('') + '</div>' +
            `<span class="ball-k-lab">ultimo: “${escapeHtml(ultime[0].titolo)}”${ultime[0].quando ? ', ' + _ballQuando(ultime[0].quando) : ''}</span>`;
        return { inline, blocco };
    },

    scaffali: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.prodotti || 0;
        const inline =
            '<p class="ball-k-tit">Scaffali</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">scaffal${d.totale === 1 ? 'e' : 'i'} · ${n} prodott${n === 1 ? 'o' : 'i'}</span>`;
        return { inline, blocco: _ballRipiano(n, d.chiavi) };
    },

    sealed: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => formattaEuroTondo(v);
        const inline =
            '<p class="ball-k-tit">Sealed</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">prodotti${d.valore ? ' · ' + eur(d.valore) : ''}</span>`;
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-riga-set">' + d.lista.map(p =>
                `<div class="ball-riga"><span class="ball-nome">${escapeHtml(p.nome)}</span><span class="ball-dato">${eur(p.prezzo)}</span></div>`
            ).join('') + '</div>';
        }
        return { inline, blocco };
    },

    gruppo_attivo: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Gruppo</p>' +
            `<div class="ball-k-mid">${d.attivo ? 'Al lavoro' : 'In pausa'}</div>` +
            '<span class="ball-k-lab">stato del gruppo adesso</span>' +
            _ballPill(d.attivo ? 'qualcuno online' : 'nessuno online', !!d.attivo);
        return { inline, blocco: '' };
    },

    suggerimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const esc = (t) => escapeHtml(String(t == null ? '' : t));
        const nFare = (d.daFare || []).length, nOpp = (d.opportunita || []).length;
        const inline =
            '<p class="ball-k-tit">Centro operativo</p>' +
            `<div class="ball-k-big ball-k-mono"${nFare ? ' style="color:#d32f2f"' : ''}>${nFare}</div>` +
            `<span class="ball-k-lab">${nFare || nOpp ? `da fare adesso · ${nOpp} opportunità` : 'tutto in ordine'}</span>`;
        const scheda = (s, alto) =>
            `<div class="ball-co-it${alto ? ' al' : ''} ball-clic" onclick="_ballAzioneRiga(event,'tab','${s.tab === 'home' ? 'dafare' : s.tab}')">` +
            `<span class="ball-co-ic ${alto ? 'r' : (s.gruppo === 'opportunita' ? 'p' : 'g')}"><i class="fa-solid ${s.icona || 'fa-circle-info'}"></i></span>` +
            `<span class="n"><b>${esc(s.testo)}</b>${s.sotto ? `<span>${esc(s.sotto)}</span>` : ''}</span>` +
            ((s.immagini && s.immagini.length) ? `<span class="th">${s.immagini.map(u => `<img src="${_urlImmagineVisualizzabile(u, 64) || ''}" alt="" onerror="this.remove();">`).join('')}</span>` : '') +
            '<i class="fa-solid fa-chevron-right"></i></div>';
        let blocco = '<div class="ball-co">' + (d.daFare || []).map(s => scheda(s, true)).join('');
        if (nOpp) blocco += '<div class="ball-co-sez">Opportunità</div>' + d.opportunita.map(s => scheda(s, false)).join('');
        if (!nFare && !nOpp) blocco += '<div class="ball-co-vuoto"><i class="fa-solid fa-circle-check"></i> Niente da fare adesso</div>';
        const m = d.missioni;
        blocco += '<div class="ball-co-foot">' +
            `<div class="ball-clic" onclick="_ballAzioneRiga(event,'tab','missioni')"><b>Missioni di oggi</b><span>${m ? `${m.fatte} di ${m.totali}` : '—'}</span>` +
            (m ? `<span class="ball-barra-out"><span class="ball-barra-in" style="display:block;width:${Math.round((m.fatte / m.totali) * 100)}%"></span></span>` : '') + '</div>' +
            `<div><b>${d.gruppoAlLavoro ? '<span class="ball-co-dot"></span>' : ''}Il gruppo adesso</b><span>${d.gruppoAlLavoro ? 'qualcuno sta lavorando' : 'nessuno al lavoro'}</span></div>` +
            '</div></div>';
        return { inline, blocco };
    },

    estensione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        if (!d.rilevata) {
            return {
                inline: '<p class="ball-k-tit">Estensione</p>' +
                    '<div class="ball-k-mid" style="color:var(--text-muted)">○ Non rilevata</div>' +
                    '<span class="ball-k-lab">serve per aggiornare i prezzi e aiutare il gruppo</span>',
                blocco: _ballPulsante('Come installarla', `event.stopPropagation(); _widgetEstensioneApriIstruzioni(false)`),
            };
        }
        const inline =
            '<p class="ball-k-tit">Estensione</p>' +
            '<div class="ball-k-mid" style="color:var(--success,#2e7d32)">● Attiva</div>' +
            `<span class="ball-k-lab">v${escapeHtml(d.versione)} · su questo computer</span>` +
            _ballPill(d.aiutaGruppo ? 'aiuta il gruppo' : 'aiuto disattivo', !!d.aiutaGruppo);
        const blocco = d.aggiornamento
            ? `<span class="ball-k-lab" style="font-weight:700;color:var(--primary-text, var(--primary))">Aggiornamento disponibile: v${escapeHtml(d.ultima)}</span>` +
              _ballPulsante('Aggiorna', `event.stopPropagation(); _widgetEstensioneApriIstruzioni(true)`)
            : '';
        return { inline, blocco };
    },

    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        const inline =
            '<p class="ball-k-tit">Controllo prezzi</p>' +
            `<div class="ball-k-big ball-k-mono"${scaduti > 0 ? ' style="color:#b8860b"' : ''}>${scaduti > 0 ? scaduti : totale}</div>` +
            `<span class="ball-k-lab">${scaduti > 0 ? 'da aggiornare' : 'tutti aggiornati'}</span>`;

        const stat = (v, et) => `<div class="ball-stat"><b>${v}</b><span>${et}</span></div>`;
        const blocco =
            '<div class="ball-prz">' +
            '<div class="ball-quota">' +
            `<div class="ball-barra-testo"><span>Aggiornati</span><span>${aggiornati} di ${totale}</span></div>` +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>` +
            '</div>' +
            '<div class="ball-stat-griglia">' + stat(aggiornati, 'aggiornati') + stat(scaduti, 'da aggiornare') + stat(totale, 'totale') + '</div>' +
            _ballPulsante('Apri Controllo prezzi', `_ballAzioneRiga(event,'tab','prezzi')`) +
            '</div>';
        return { inline, blocco };
    },

    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${(d.totale || 0).toLocaleString('it-IT')}</div>` +
            `<span class="ball-k-lab">carte · ${formattaEuro(d.valore || 0)}</span>`;
        let blocco = '<div class="ball-chips">' +
            `<span>Carte ${d.totale || 0}</span><span>Sealed ${d.nSealed || 0}</span><span>Wishlist ${d.nWishlist || 0}</span></div>`;
        if (d.ultime && d.ultime.length) {
            blocco += '<div class="ball-strip ball-strip-fill">' + d.ultime.map(c => _ballMiniCarta(c)).join('') + '</div>' +
                (d.aggiunteRecenti ? `<span class="ball-k-lab">+${d.aggiunteRecenti} negli ultimi 14 giorni</span>` : '');
        }
        return { inline, blocco };
    },

    location: (d) => {
        if (!d || !d.voci) return { inline: '', blocco: '' };
        const prima = d.voci[0];
        const inline =
            '<p class="ball-k-tit">Location</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">location${prima ? ` · la più preziosa è ${escapeHtml(prima.nome)}` : ''}</span>`;
        const totaleValore = d.voci.reduce((t, v) => t + v.valore, 0) || 1;
        const attesa = d.inAttesa
            ? `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'location','?')">${_ballPill(`<i class="fa-solid fa-circle-question"></i> ${d.inAttesa} cart${d.inAttesa === 1 ? 'a' : 'e'} in “?”`, false)}</div>`
            : '';
        const blocco = attesa + d.voci.slice(0, 3).map(v =>
            _ballRigaBarra(escapeHtml(v.nome), formattaEuro(v.valore), (v.valore / totaleValore) * 100,
                `_ballAzioneRiga(event,'location','${escapeJsAttr(v.nome)}')`)
        ).join('');
        return { inline, blocco };
    },

    match: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scambio = d.scambio || 0, wishlist = d.wishlist || 0;
        const totale = scambio + wishlist;
        const inline =
            '<p class="ball-k-tit">Match trovati</p>' +
            `<div class="ball-k-big ball-k-mono${totale > 0 ? ' su' : ''}">${totale}</div>` +
            `<span class="ball-k-lab">${totale === 0 ? 'nessuna novità' : (totale === 1 ? 'corrispondenza' : 'corrispondenze')}</span>` +
            (totale > 0 ? _ballPill('da vedere', true) : '');

        const blocco =
            '<div class="ball-stat-griglia">' +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${scambio}</b><span>Scambio</span></div>` +
                `<div class="ball-stat ball-clic" onclick="_ballAzioneRiga(event,'tab','binder')"><b>${wishlist}</b><span>Wishlist</span></div>` +
            '</div>' +
            (totale > 0 ? _ballPulsante('Apri Binders', `_ballAzioneRiga(event,'tab','binder')`) : '');
        return { inline, blocco };
    },

    chat: (d) => {
        if (!d) return { inline: '', blocco: '' };
        if (d.vietato) {
            return {
                inline: '<p class="ball-k-tit">Chat</p><span class="ball-k-lab">Non disponibile</span>',
                blocco: '',
            };
        }
        const totale = d.totale || 0;
        const conversazioni = d.conversazioni || [];
        const inline =
            '<p class="ball-k-tit">Chat</p>' +
            `<div class="ball-k-big ball-k-mono">${totale}</div>` +
            `<span class="ball-k-lab">${totale === 0 ? 'nessun messaggio' : (totale === 1 ? 'messaggio non letto' : 'messaggi non letti')}</span>` +
            (totale > 0 ? _ballPill(`${totale} nuov${totale === 1 ? 'o' : 'i'}`, true) : '');

        const blocco = conversazioni.map(c => {
            const label = (typeof escapeHtml === 'function' ? escapeHtml(c.label) : c.label);
            const labelAttr = escapeJsAttr(c.label);
            return `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'chat-conversazione','${c.ownerAltro}','${labelAttr}')"><span class="ball-nome">${label}</span><span class="ball-dato">${c.count}</span></div>`;
        }).join('');
        return { inline, blocco };
    },

    ultima_carta: (d) => {
        if (!d || d.vuoto) return { inline: '', blocco: '' };
        return { inline: '', blocco: _ballCorpoFotoCarta(d) };
    },
};

function _ballCorpoGenerico(anteprima) {
    return {
        inline: `<div class="ball-righe-testo">${(anteprima.righe || []).map(r => `<span>${escapeHtml(r)}</span>`).join('')}</div>`,
        blocco: ''
    };
}

function _ballCorpoWidget(id, anteprima) {
    const f = _ballCORPI[id];
    if (!f || !anteprima || !anteprima.dati) return _ballCorpoGenerico(anteprima);
    try {
        const c = f(anteprima.dati);
        if (!c || (!c.inline && !c.blocco)) return _ballCorpoGenerico(anteprima);
        return c;
    } catch (e) {
        console.error('Corpo widget ' + id + ':', e);
        return _ballCorpoGenerico(anteprima);
    }
}
