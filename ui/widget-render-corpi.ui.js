// ═══════════════════════════════════════════════════════════════════════
// WIDGET-RENDER-CORPI.UI.JS — corpo grafico di ogni widget in modalità
// tessera grande (CardSync Pro)
// ═══════════════════════════════════════════════════════════════════════
// STEP separato dal piano "riduzione accoppiamento" concordato con Claudio
// il 2026-09-11 (secondo giro di taglio, dopo l'estrazione da
// ui/widget-render-condiviso.ui.js). Estratto da
// ui/widget-render-tessere-grandi.ui.js. NESSUNA riscrittura del codice
// esistente: solo spostamento, zero cambi di comportamento per l'utente
// finale.
//
// Contiene: _ballCORPI (un corpo per ogni id di widget — usa i 'dati'
// prodotti dal preview() del widget corrispondente, definito nel proprio
// file widget-<nome>.ui.js) e _ballCorpoWidget (dispatcher che sceglie il
// corpo giusto o ripiega su un corpo generico).
//
// Dipende da ui/widget-render-tessere-grandi.ui.js per i componenti
// visivi condivisi (_ballRiga/_ballPill/_ballSparkline/_ballMiniCarta/
// _ballPulsante) — chiamati cross-file, stesso meccanismo di sempre.
// Nessuna istruzione qui gira a tempo di caricamento script — l'ordine tra
// i tre file widget-render-*.ui.js è indifferente.
// ───────────────────────────────────────────────────────────────────────

// ── I QUATTRO CORPI ──────────────────────────────────────────────────────
// ── CORPI DEI TRE WIDGET NATI DALLA HOME FISSA (2026-09-03) ─────────────
// Claudio, vedendo la prima versione: "non assomigliano per niente a cio'
// che ho in home e quindi non mi servono a sostituirla". Aveva ragione: i
// widget non definivano un corpo, quindi _ballCorpoWidget ripiegava su
// _ballCorpoGenerico (tre righe di testo accanto alla sfera). Qui i corpi
// ricostruiscono davvero i blocchi della home fissa, con gli stessi
// mattoni gia' usati dagli altri widget: _ballMiniCarta per le miniature,
// .ball-strip per le file di carte, .ball-riga per gli elenchi.
//
// COME SI COMPORTANO ALLE VARIE TAGLIE: 'inline' sta accanto alla sfera e
// si vede sempre; 'blocco' sta sotto e il CSS ne mostra sempre meno man
// mano che la tessera si abbassa (vedi .wf-largo .ball-slot-blocco). Quindi
// le tre categorie complete si vedono sulle taglie alte, mentre su una
// tessera bassa resta la prima. Nessun controllo di taglia da scrivere qui.
function _ballFilaCarte(titolo, carte, origine) {
    if (!carte || !carte.length) return '';
    // Titolo e fila avvolti insieme: dentro .ball-gruppi ogni figlio e'
    // una colonna, quindi senza questo involucro il titolo finirebbe in
    // una colonna e le sue carte in quella accanto.
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
    // La frase che Claudio voleva leggere: "valore salito di 45 euro,
    // aggiunte tre carte ieri dal valore complessivo di 43 euro". La
    // scomposizione arriva gia' pronta da storicoValoreConfronta().
    variazione_valore: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Math.abs(Number(v) || 0).toFixed(2);
        const segno = (v) => (Number(v) >= 0 ? '+' : '−');

        if (d.soloUnGiorno) {
            return {
                inline: `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
                        '<span class="ball-k-lab">primo giorno misurato</span>',
                blocco: '<span class="ball-k-lab ball-attesa">La variazione compare domani, quando ci sara' + "'" + ' un secondo giorno da confrontare.</span>',
            };
        }

        const colore = d.variazione >= 0 ? 'var(--success)' : 'var(--danger)';
        const inline =
            `<div class="ball-k-big ball-k-mono" style="color:${colore}">${segno(d.variazione)}${eur(d.variazione)}</div>` +
            `<span class="ball-k-lab">${eur(d.valoreOggi)} in totale</span>`;

        // Le due voci della scomposizione. Compaiono solo se hanno
        // qualcosa da dire: una riga "acquisti: 0,00" e' rumore.
        const voci = [];
        if (d.carteAggiunte > 0) {
            voci.push(`<div class="ball-riga">
                <span class="ball-nome">${d.carteAggiunte} cart${d.carteAggiunte === 1 ? 'a aggiunta' : 'e aggiunte'}</span>
                <span class="ball-dato">${segno(d.daAggiunte)}${eur(d.daAggiunte)}</span>
            </div>`);
        }
        if (d.rimozioniSospette) {
            // Limite noto, spiegato nella migration 36: una carta uscita
            // dalla collezione non lascia traccia, quindi finirebbe nel
            // residuo e verrebbe letta come "i prezzi sono scesi". Quando
            // i pezzi calano si dice cosa e' successo invece di attribuire
            // il calo ai prezzi.
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

    // Disposizione scelta da Claudio: due numeri affiancati in alto, barra
    // della quota in basso. La barra usa .ball-barra-out/.ball-barra-in,
    // gli stessi mattoni del corpo 'prezzi' — niente CSS nuovo.
    contributi: (d) => {
        // La RPC non ha risposto. Non si scrive "0": sarebbe
        // un'affermazione falsa sul lavoro del gruppo.
        if (!d) {
            return {
                inline: '<div class="ball-k-mid">\u2014</div><span class="ball-k-lab">dati non disponibili</span>',
                blocco: '',
            };
        }

        // I due numeri hanno lo stesso peso visivo ma NON la stessa scala:
        // 'miei' cresce senza tetto, 'personeAiutate' ha come massimo 4
        // (cinque membri, te esclusa) e una volta arrivato li' resta fermo
        // per sempre. Non e' un difetto: e' il dato vero, ed e' l'aspetto
        // che il widget avra' fra qualche settimana.
        const inline =
            '<div class="ball-k-duo">' +
                `<div><div class="ball-k-big ball-k-mono">${d.miei}</div><span class="ball-k-lab">carte</span></div>` +
                `<div><div class="ball-k-big ball-k-mono">${d.personeAiutate}</div><span class="ball-k-lab">person${d.personeAiutate === 1 ? 'a' : 'e'}</span></div>` +
            '</div>';

        // GUARDIA SUL DENOMINATORE. Al primo giorno sono tre zeri
        // legittimi: niente divisione, e nessun "0% del lavoro del gruppo",
        // che e' vero ma si legge come un rimprovero quando il gruppo non
        // ha ancora fatto niente.
        if (!d.gruppo) {
            return {
                inline,
                // .ball-quota: contenitore che rende la coppia
                // barra+didascalia un blocco ATOMICO per
                // _potaContenutoFuoriTessera(). Senza, in una tessera
                // stretta la didascalia veniva tagliata a meta' dal bordo:
                // la potatura conosce solo .ball-riga/.ball-gruppo/
                // .ball-spark/.ball-strip e ignorava questi due elementi.
                blocco: '<div class="ball-quota">' +
                        '<div class="ball-barra-out"><div class="ball-barra-in" style="width:0%"></div></div>' +
                        '<span class="ball-k-lab ball-attesa">Primi contributi in arrivo.</span>' +
                        '</div>',
            };
        }

        // Intero, non decimale: con numeri piccoli (1 su 3) i decimali
        // darebbero una precisione che il dato non ha.
        // 'gruppo' conta TUTTE le righe, comprese le proprie, quindi la
        // quota non puo' superare il 100%.
        const perc = Math.round((d.miei / d.gruppo) * 100);
        // Stesso contenitore atomico del ramo qui sopra: o la quota si
        // vede tutta, o sparisce tutta. Mezza didascalia e' peggio di
        // nessuna didascalia.
        const blocco =
            '<div class="ball-quota">' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc}%"></div></div>` +
            `<span class="ball-k-lab">${perc}% del lavoro del gruppo</span>` +
            '</div>';

        return { inline, blocco };
    },

    // Le tre categorie della home fissa: valore piu' alto, oscillazione in
    // su, oscillazione in giu'. Stesse tre carte per categoria.
    primo_piano: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const top = (d.perValore && d.perValore[0]) || null;
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // NIENTE ball-k-tit qui: renderWidgetHome stampa gia' il titolo del
        // widget accanto alla sfera, quindi si leggeva due volte ("In primo
        // piano" e subito sotto "In vetrina"). Difetto visto in uno
        // screenshot di Claudio il 2026-09-03.
        const inline = top
            ? `<div class="ball-k-big ball-k-mono">${eur(top.prezzo)}</div><span class="ball-k-lab">${top.nome}</span>`
            : '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>';
        // Le tre categorie AFFIANCATE quando c'e' larghezza, impilate
        // quando non ce n'e' (Claudio: "dovrebbe estendersi in orizzontale
        // come nella home"). Il contenitore usa auto-fit nel CSS, quindi
        // non serve sapere qui quanto e' largo il widget: si dispone da
        // solo e si comporta bene sia a 3 colonne di griglia sia a tutta
        // riga in orizzontale.
        const blocco = '<div class="ball-gruppi">' +
            _ballFilaCarte('Valore più alto', d.perValore, 'top_valore') +
            _ballFilaCarte('Oscillazione +', d.su, 'oscillazione_su') +
            _ballFilaCarte('Oscillazione −', d.giu, 'oscillazione_giu') +
            '</div>';
        return { inline, blocco };
    },

    // Elenco delle ultime aggiunte, nome + data, come il pannello
    // "Attività recenti" della home fissa.
    carte_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessuna carta ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">aggiunta il ${d.lista[0].quando}</span>`;
        const blocco =
            '<div class="ball-strip">' + d.lista.map(c => _ballMiniCarta(c, undefined, 'ultime_aggiunte')).join('') + '</div>' +
            _ballElencoRighe(d.lista.map(c => ({ id: c.id, nome: c.nome, dato: c.quando, origine: 'ultime_aggiunte' })));
        return { inline, blocco };
    },

    // Stesso elenco per i controlli prezzo recenti. La variante e' mostrata
    // accanto al nome come fa la home fissa.
    prezzi_recenti: (d) => {
        if (!d || !d.lista || !d.lista.length) {
            return { inline: '<div class="ball-k-mid">—</div><span class="ball-k-lab">nessun controllo ancora</span>', blocco: '' };
        }
        const inline =
            `<div class="ball-k-mid">${d.lista[0].nome}</div>` +
            `<span class="ball-k-lab">controllata il ${d.lista[0].quando}</span>`;
        const blocco = _ballElencoRighe(d.lista.map(c => ({
            id: c.id,
            nome: c.nome + (c.variante ? ` <span class="ball-k-lab">${c.variante}</span>` : ''),
            dato: c.quando,
            origine: 'prezzi_recenti',
        })));
        return { inline, blocco };
    },

    set_completamento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        if (!d.voci || !d.voci.length) {
            return {
                inline: '<p class="ball-k-tit">Set</p><div class="ball-k-mid">—</div>' +
                        `<span class="ball-k-lab">${d.riconosciute ? 'nessuna espansione' : 'codici non riconosciuti'}</span>`,
                blocco: ''
            };
        }
        const prima = d.voci[0];

        // Con il set in libreria si mostra l'avanzamento; senza, si mostra
        // quante carte hai — mai una percentuale su un totale ignoto.
        const inline =
            '<p class="ball-k-tit">Set</p>' +
            ((prima.totale && prima.perc != null)
                ? `<div class="ball-k-big ball-k-mono">${Math.round(prima.perc)}%</div>` +
                  `<span class="ball-k-lab">${prima.nome} · ${prima.totale - prima.hai} alla fine</span>`
                : `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
                  `<span class="ball-k-lab">espansioni · ${prima.nome} in testa</span>`);

        const blocco = d.voci.slice(0, 4).map(v => (v.totale && v.perc != null)
            ? _ballRigaBarra(v.nome, `${v.hai}/${v.totale}`, v.perc, `_ballAzioneRiga(event,'tab','visualizzazione')`)
            : `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','visualizzazione')">
                   <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.hai} carte</span>
               </div>`
        ).join('') +
        // Se nessun set è in libreria è giusto dirlo, invece di lasciare
        // pensare che l'avanzamento non esista.
        (d.inLibreria === 0 ? '<span class="ball-k-lab ball-attesa">Avanzamento non disponibile: libreria set da compilare</span>' : '');

        return { inline, blocco };
    },

    // ── SEGNAPOSTO GACHA ─────────────────────────────────────────────────
    // Stessa forma dello "stato vuoto" del mockup: dice cosa arriverà,
    // senza numeri finti e senza pulsanti che non portano da nessuna parte.
    bustina: (d) => _ballCorpoSegnaposto('Bustina', d),
    polvere: (d) => _ballCorpoSegnaposto('Polvere', d),
    missioni: (d) => _ballCorpoSegnaposto('Missioni', d),

    // ── I CINQUE WIDGET NUOVI ────────────────────────────────────────────
    valore_collezione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Valore</p>' +
            `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
            `<span class="ball-k-lab">${d.pezzi} pezzi · media ${eur(d.media)}</span>`;
        let blocco = '';
        if (d.top && d.top.length) {
            // Missioni #39/#83: origine 'top_valore', SOLO qui — non nel
            // blocco 'lista' di doppioni sotto né in quello di
            // 'visualizzazione' più in basso, che riusano la stessa
            // _ballMiniCarta ma non sono "le carte di maggior valore".
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
            (d.valoreExtra > 0 ? `<span class="ball-k-lab su">€ ${Math.round(d.valoreExtra).toLocaleString('it-IT')} scambiabili</span>` : '');
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
            // Barra: quanto è vicino il prezzo attuale all'obiettivo. Piena
            // quando il prezzo è sceso fino al bersaglio.
            blocco = d.lista.map(c => {
                const perc = c.prezzo > 0 ? Math.min(100, (c.obiettivo / c.prezzo) * 100) : 0;
                return _ballRigaBarra(c.nome, `€ ${c.prezzo.toFixed(0)} / ${c.obiettivo.toFixed(0)}`, perc,
                    `_ballAzioneRiga(event,'carta','${c.id}')`);
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
            _ballRigaBarra('Valore', `€ ${d.euro.valore.toLocaleString('it-IT')}/${d.euro.soglia.toLocaleString('it-IT')}`, d.euro.perc) +
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

    // ── CORPI PER I WIDGET GIÀ ESISTENTI ─────────────────────────────────
    inserimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.daCorreggere || 0;
        const inline =
            '<p class="ball-k-tit">Inserimento</p>' +
            `<div class="ball-k-big ball-k-mono${n > 0 ? ' giu' : ' su'}">${n}</div>` +
            `<span class="ball-k-lab">${n > 0 ? 'in coda da correggere' : 'coda pulita'}</span>`;
        const blocco = n > 0
            ? _ballPulsante('Vai alla coda', `_ballAzioneRiga(event,'tab','inserimento')`)
            : _ballPulsante('Aggiungi carta', `_ballAzioneRiga(event,'tab','inserimento')`);
        return { inline, blocco };
    },

    binder: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Binders</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            '<span class="ball-k-lab">raccoglitori</span>';
        let blocco = '';
        if (d.voci && d.voci.length) {
            const massimo = d.voci[0][1] || 1;
            blocco = d.voci.slice(0, 3).map(([nome, n]) =>
                _ballRigaBarra(nome, n, (n / massimo) * 100,
                    `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)).join('');
        }
        return { inline, blocco };
    },

    sealed: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 });
        const inline =
            '<p class="ball-k-tit">Sealed</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">prodotti${d.valore ? ' · ' + eur(d.valore) : ''}</span>`;
        let blocco = '';
        if (d.lista && d.lista.length) {
            blocco = '<div class="ball-riga-set">' + d.lista.map(p =>
                `<div class="ball-riga"><span class="ball-nome">${p.nome}</span><span class="ball-dato">${eur(p.prezzo)}</span></div>`
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
        const inline =
            '<p class="ball-k-tit">Prossima azione</p>' +
            `<div class="ball-k-mid">${d.testo || ''}</div>` +
            '<span class="ball-k-lab">la cosa più utile ora</span>';
        const blocco = d.tab && d.tab !== 'home'
            ? _ballPulsante('Fallo adesso', `_ballAzioneRiga(event,'tab','${d.tab}')`)
            : '';
        return { inline, blocco };
    },

    estensione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Estensione</p>' +
            `<div class="ball-k-mid">${d.rilevata ? 'v' + d.versione : 'Non rilevata'}</div>` +
            `<span class="ball-k-lab">${d.rilevata ? 'collegata a questo dispositivo' : 'installala per sincronizzare'}</span>` +
            (d.rilevata ? _ballPill(d.aiutaGruppo ? 'aiuta il gruppo' : 'aiuto disattivo', !!d.aiutaGruppo) : '');
        return { inline, blocco: '' };
    },

    // Prezzi: quanti chiedono attenzione, quanto vale la collezione, la
    // quota di aggiornati come barra e le carte scadute come righe.
    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        const inline =
            '<p class="ball-k-tit">Prezzi</p>' +
            `<div class="ball-k-big ball-k-mono${scaduti > 0 ? ' giu' : ' su'}">${scaduti > 0 ? scaduti : totale}</div>` +
            `<span class="ball-k-lab">${scaduti > 0 ? 'da aggiornare' : 'tutti aggiornati'}</span>` +
            (d.valore ? `<span class="ball-k-lab">€ ${d.valore.toLocaleString('it-IT', { maximumFractionDigits: 0 })} in collezione</span>` : '');

        // .ball-quota (2026-09-06): didascalia e barra sono un blocco
        // ATOMICO per _potaContenutoFuoriTessera(). Prima erano due figli
        // diretti sciolti, che la potatura non conosce: in tessera stretta
        // la riga "Aggiornati N/M" veniva tagliata a meta' dal bordo.
        // Difetto preesistente, stesso identico caso gia' corretto sul
        // widget 'contributi'.
        let blocco =
            '<div class="ball-quota">' +
            '<div class="ball-barra-testo"><span>Aggiornati</span><span>' + aggiornati + '/' + totale + '</span></div>' +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>` +
            '</div>';

        if (d.lista && d.lista.length) {
            blocco += '<div class="ball-riga-set">' + d.lista.slice(0, 3).map(v =>
                `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'prezzi-scaduti')">
                    <span class="ball-nome">${v.nome}</span><span class="ball-dato">${v.quando}</span>
                 </div>`).join('') + '</div>';
            blocco += _ballPulsante('Vedi tutte', `_ballAzioneRiga(event,'prezzi-scaduti')`);
        }
        return { inline, blocco };
    },

    // Visualizzazione: il totale, l'andamento vero degli inserimenti degli
    // ultimi 14 giorni come sparkline, e le ultime carte entrate.
    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${(d.totale || 0).toLocaleString('it-IT')}</div>` +
            '<span class="ball-k-lab">carte in collezione</span>' +
            (d.aggiunteRecenti ? `<span class="ball-k-lab su">+${d.aggiunteRecenti} negli ultimi 14 giorni</span>` : '');

        let blocco = '';
        if (d.serie && d.serie.length > 1) blocco += _ballSparkline(d.serie, 'var(--accent)');
        if (d.ultime && d.ultime.length) {
            blocco += '<div class="ball-strip">' + d.ultime.map(c => _ballMiniCarta(c)).join('') + '</div>' +
                      '<span class="ball-k-lab">Ultime aggiunte</span>';
        }
        return { inline, blocco };
    },

    // Location: quante posizioni, e una barra per ciascuna delle più piene,
    // in scala sulla maggiore. Ogni riga apre la collezione già filtrata.
    location: (d) => {
        if (!d || !d.voci || !d.voci.length) return { inline: '', blocco: '' };
        const massimo = d.voci[0][1] || 1;
        const prima = d.voci[0];
        const inline =
            '<p class="ball-k-tit">Location</p>' +
            `<div class="ball-k-big ball-k-mono">${d.voci.length}</div>` +
            `<span class="ball-k-lab">${d.voci.length === 1 ? 'posizione' : 'posizioni'} · più piena ${prima[0]}</span>`;

        const blocco = d.voci.slice(0, 4).map(([nome, n]) =>
            _ballRigaBarra(nome, n, (n / massimo) * 100,
                `_ballAzioneRiga(event,'location','${String(nome).replace(/'/g, "\\'")}')`)
        ).join('');
        return { inline, blocco };
    },

    // Match: il totale, e i due tipi come riquadri di statistica separati —
    // scambio e wishlist sono due cose diverse.
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
    }
};

// Ripiego per gli undici widget non ancora convertiti: le righe di testo di
// sempre, così nessuno perde niente mentre procediamo quattro alla volta.
function _ballCorpoGenerico(anteprima) {
    return {
        inline: `<div class="ball-righe-testo">${(anteprima.righe || []).map(r => `<span>${r}</span>`).join('')}</div>`,
        blocco: ''
    };
}

function _ballCorpoWidget(id, anteprima) {
    const f = _ballCORPI[id];
    if (!f || !anteprima || !anteprima.dati) return _ballCorpoGenerico(anteprima);
    try {
        const c = f(anteprima.dati);
        // Un corpo vuoto (dati insufficienti) non deve lasciare la tessera
        // muta: si torna al testo.
        if (!c || (!c.inline && !c.blocco)) return _ballCorpoGenerico(anteprima);
        return c;
    } catch (e) {
        console.error('Corpo widget ' + id + ':', e);
        return _ballCorpoGenerico(anteprima);
    }
}
