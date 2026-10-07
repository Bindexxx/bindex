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
        const eur = (v) => formattaEuro(Math.abs(Number(v) || 0)); // formato unico, audit 2026-09-25 C2
        const segno = (v) => (Number(v) >= 0 ? '+' : '−');

        if (d.soloUnGiorno) {
            return {
                inline: `<div class="ball-k-big ball-k-mono">${eur(d.valore)}</div>` +
                        '<span class="ball-k-lab">primo giorno misurato</span>',
                blocco: '<span class="ball-k-lab ball-attesa">La variazione compare domani, quando ci sara' + "'" + ' un secondo giorno da confrontare.</span>',
            };
        }

        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Variazione = +X € in 7
        // giorni + mercato/aggiunte"): se c'è la finestra di 7 giorni
        // (d.settimana, dal preview) si usa quella, con due righe a barra;
        // altrimenti resta il corpo di prima (confronto col giorno prima).
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

        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Contributi =
        // percentuale + numeri"): in alto la quota sul lavoro del gruppo, i
        // due numeri scendono nel blocco come righe con barra.
        // 'personeAiutate' ha come massimo 4 (cinque membri, te esclusa).
        const percTop = d.gruppo ? Math.round((d.miei / d.gruppo) * 100) : null;
        const inline =
            '<p class="ball-k-tit">Contributi</p>' +
            `<div class="ball-k-big ball-k-mono">${percTop != null ? percTop + '%' : d.miei}</div>` +
            `<span class="ball-k-lab">${percTop != null ? 'dei controlli prezzi del gruppo' : 'carte controllate per il gruppo'}</span>`;
        const righeNumeri =
            _ballRigaBarra('I tuoi controlli', String(d.miei), percTop || 0) +
            _ballRigaBarra('Persone aiutate', `${d.personeAiutate} di 4`, (d.personeAiutate / 4) * 100);

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

        // Percentuale intera (con numeri piccoli i decimali darebbero una
        // precisione che il dato non ha); 'gruppo' conta anche le proprie
        // righe, quindi non supera il 100%. Le due righe con barra sono
        // blocchi atomici per _potaContenutoFuoriTessera (.ball-riga-set).
        return { inline, blocco: righeNumeri };
    },

    // Le tre categorie della home fissa: valore piu' alto, oscillazione in
    // su, oscillazione in giu'. Stesse tre carte per categoria.
    primo_piano: (d) => {
        // 2026-09-19 (riscrittura widget "Primo Piano"): il corpo vive ora in
        // ui/widget-in-primo-piano.ui.js (_primoPianoCorpo) — carte che
        // riempiono lo spazio del tile, quarta categoria Box, titoli
        // cliccabili. Se quella funzione non c'e' (file non ancora
        // caricato) si ripiega sul corpo di prima, che legge le stesse
        // chiavi di 'dati' (perValore/su/giu) ed e' quindi compatibile.
        if (typeof _primoPianoCorpo === 'function') return _primoPianoCorpo(d);
        if (!d) return { inline: '', blocco: '' };
        const top = (d.perValore && d.perValore[0]) || null;
        const eur = (v) => formattaEuro(v); // restyle FASE 2: "12,00 €"
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
        // RESTYLE BINDEX FASE 2 (2026-09-30, "Ultime aggiunte = una lista"):
        // prima una fila di miniature E un elenco con gli stessi nomi (due
        // volte la stessa cosa). Ora una lista sola: miniatura, nome, quando,
        // prezzo; ogni riga apre la carta (origine 'ultime_aggiunte' come
        // prima, per le missioni).
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

    // RISCRITTO (2026-09-20, restyle widget SET): stessi mattoni di prima
    // (_ballRigaBarra, _ballPill, classi ball-k-*), cambia cosa c'è scritto.
    // Dati da CATALOGO_WIDGET.set_completamento.preview() (ui/widget-set.ui.js):
    // il set in corso più vicino al completamento e, se c'è una soglia
    // appena raggiunta e non ancora vista, quella al posto del testo
    // normale (stessa pill "acceso" che usa il widget Match).
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
            // RESTYLE BINDEX FASE 2: il set più avanti, un decimale.
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

    // ── SEGNAPOSTO GACHA ─────────────────────────────────────────────────
    // Stessa forma dello "stato vuoto" del mockup: dice cosa arriverà,
    // senza numeri finti e senza pulsanti che non portano da nessuna parte.
    bustina: (d) => _ballCorpoSegnaposto('Bustina', d),
    // RESTYLE BINDEX FASE 8c (tavola "Foto carte · tessera"): fatte/totale,
    // barra, le prossime 3 da fotografare e "Inizia sessione foto".
    foto: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const perc = d.totale ? Math.round((d.fatte / d.totale) * 100) : 0;
        const inline = '<p class="ball-k-tit">Foto carte</p>' +
            `<div class="ball-k-big ball-k-mono">${d.fatte} / ${d.totale}</div>` +
            `<span class="ball-k-lab">carte con foto vere${d.daFare ? ` · ${d.daFare} da fare` : ''}</span>` +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc}%"></div></div>`;
        if (!d.daFare) return { inline, blocco: '<span class="ball-k-lab">Tutte le carte hanno almeno una foto.</span>' };
        const righe = (d.prossime || []).map(c => `
            <div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'tab','foto')">
                <span class="ball-nome">${escapeHtml(c.name || '')}</span>
                <span class="ball-dato">${_ballPill('Fronte', c.fronte)}${_ballPill('Retro', c.retro)}${c.scambio ? _ballPill('Scambio', false) : ''}</span>
            </div>`).join('');
        return {
            inline,
            blocco: '<div class="ball-gruppo"><span class="ball-k-lab">Prossime da fotografare</span>' + righe + '</div>' +
                _ballPulsante('<i class="fa-solid fa-camera"></i> Inizia sessione foto', 'fotoAvviaSessioneDaTessera(event)'),
        };
    },
    // Restyle FASE 2: saldo vero (vedi ui/widget-polvere.ui.js).
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
    // Missioni: tessera vera dal 2026-09-26 (prima segnaposto "In
    // arrivo"). Dati da CATALOGO_WIDGET.missioni.preview()
    // (ui/widget-missioni.ui.js): fatte/totali di OGGI + le missioni del
    // giorno. Sopra il conteggio, sotto una riga per missione (✓ se fatta,
    // altrimenti il premio); ogni riga apre la pagina Missioni. Se i dati
    // mancano (non loggato/errore → placeholder) si ricade sul testo.
    missioni: (d) => {
        if (!d || d.placeholder || !d.totali) return { inline: '', blocco: '' };
        const tutte = d.fatte >= d.totali;
        // Niente ball-k-tit: il titolo "Missioni" lo stampa già
        // renderWidgetHome (widget-tile-titolo) — stesso motivo di
        // 'primo_piano' e 'ultima_carta', evita il titolo doppio.
        // Restyle FASE 2 (tavola home pagina 2): titolo "Missioni di oggi",
        // premi scritti "+5 ✧" (regola comune).
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

    // ── I CINQUE WIDGET NUOVI ────────────────────────────────────────────
    valore_collezione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const eur = (v) => formattaEuroTondo(v); // restyle FASE 2: "1.520 €" nei widget
        const inline =
            '<p class="ball-k-tit">Valore collezione</p>' +
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
            // Barra: quanto è vicino il prezzo attuale all'obiettivo. Piena
            // quando il prezzo è sceso fino al bersaglio.
            blocco = d.lista.map(c => {
                const perc = c.prezzo > 0 ? Math.min(100, (c.obiettivo / c.prezzo) * 100) : 0;
                return _ballRigaBarra(c.nome, `${formattaEuroTondo(c.prezzo)} / ${formattaEuroTondo(c.obiettivo)}`, perc,
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

    // ── CORPI PER I WIDGET GIÀ ESISTENTI ─────────────────────────────────
    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Inserimento"): in coda,
    // ultimo invio, Aggiungi carta. Da correggere resta in primo piano
    // quando c'è (è l'azione).
    inserimento: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const n = d.daCorreggere || 0, q = d.inCoda || 0;
        const inline =
            '<p class="ball-k-tit">Inserimento</p>' +
            (n > 0
                ? `<div class="ball-k-big ball-k-mono" style="color:#d32f2f">${n}</div><span class="ball-k-lab">da correggere${q ? ` · ${q} in coda` : ''}</span>`
                : `<div class="ball-k-big ball-k-mono">${q}</div><span class="ball-k-lab">in coda · ${q ? 'in lavorazione' : 'tutto inviato'}</span>`);
        const u = d.ultimoInvio;
        let blocco = '';
        if (u) {
            const esito = u.inCorso ? `${u.inCorso} ancora in coda`
                : (u.errori ? `${u.errori} da correggere` : (u.quante === 1 ? 'trovata' : 'tutte trovate'));
            blocco += `<span class="ball-k-lab">Ultimo invio: ${u.quante} cart${u.quante === 1 ? 'a' : 'e'} ${_ballQuando(u.quando)}, ${esito}</span>`;
        }
        blocco += n > 0
            ? _ballPulsante('Correggi', `_ballAzioneRiga(event,'tab','inserimento')`)
            : _ballPulsante('Aggiungi carta', `_ballAzioneRiga(event,'tab','inserimento')`);
        return { inline, blocco };
    },

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Tessere · Binders"):
    // conteggio vero + pubblici, e le copertine come binder veri (dorso
    // scuro, globo sui pubblici). Colore: tinta fissa dal nome finché non
    // esiste il colore scelto dall'utente (FASE 8a, colonna nuova sul DB).
    // "Ultimo aperto" delle tavole NON c'è: richiede un dato che oggi il DB
    // non registra (file 03 § 1.3) — arriverà con la FASE 8.
    binder: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const pubblici = d.pubblici || 0;
        const inline =
            '<p class="ball-k-tit">Binders</p>' +
            `<div class="ball-k-big ball-k-mono">${d.totale || 0}</div>` +
            `<span class="ball-k-lab">binder${pubblici ? ` · ${pubblici} pubblic${pubblici === 1 ? 'o' : 'i'}` : ''}</span>`;
        const blocco = (d.copertine && d.copertine.length) ? _ballCopertine(d.copertine) : '';
        return { inline, blocco };
    },

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Condividi"): prima nessun corpo.
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

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Richieste = chi/cosa +
    // Gestisci"): prima nessun corpo.
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

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Achievement = ultime
    // medaglie"): prima nessun corpo (solo "N/125 sbloccati").
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

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Scaffali = ripiano"):
    // prima nessun corpo (ricadeva sulle righe di testo).
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
        const eur = (v) => formattaEuroTondo(v); // restyle FASE 2: "1.520 €" nei widget
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

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Tessera Centro operativo"):
    // prima leggeva d.testo/d.tab, campi che il preview non restituiva più
    // dal 2026-08-28 (la tessera grande restava quasi vuota). Ora: schede
    // cliccabili con icona e freccia (bordo rosso = da fare adesso), poi
    // Opportunità, in fondo Missioni di oggi e Il gruppo adesso.
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

    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Estensione = ● Attiva · vX
    // · su questo computer + Aggiornamento disponibile"). d.ultima = versione
    // pubblicata in releases/latest-version.txt (letta dal preview): se è più
    // nuova di quella installata compare l'avviso con "Aggiorna", che scarica
    // aggiorna_cardsync.bat come oggi (stesso file di releases/).
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
            ? `<span class="ball-k-lab" style="font-weight:700;color:var(--primary)">Aggiornamento disponibile: v${escapeHtml(d.ultima)}</span>` +
              _ballPulsante('Aggiorna', `event.stopPropagation(); _widgetEstensioneApriIstruzioni(true)`)
            : '';
        return { inline, blocco };
    },

    // Prezzi: quanti chiedono attenzione, quanto vale la collezione, la
    // quota di aggiornati come barra e le carte scadute come righe.
    prezzi: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const scaduti = d.scaduti || 0;
        const totale = d.totale || 0;
        const aggiornati = Math.max(0, totale - scaduti);
        const perc = totale > 0 ? (aggiornati / totale) * 100 : 100;

        // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Controllo prezzi = da
        // aggiornare, barra, bottone che apre la pagina"): titolo nuovo,
        // numero in ambra (da fare, non un errore), niente valore della
        // collezione (è della tessera Valore).
        const inline =
            '<p class="ball-k-tit">Controllo prezzi</p>' +
            `<div class="ball-k-big ball-k-mono"${scaduti > 0 ? ' style="color:#b8860b"' : ''}>${scaduti > 0 ? scaduti : totale}</div>` +
            `<span class="ball-k-lab">${scaduti > 0 ? 'da aggiornare' : 'tutti aggiornati'}</span>`;

        // .ball-quota (2026-09-06): didascalia e barra sono un blocco
        // ATOMICO per _potaContenutoFuoriTessera(). Prima erano due figli
        // diretti sciolti, che la potatura non conosce: in tessera stretta
        // la riga "Aggiornati N/M" veniva tagliata a meta' dal bordo.
        // Difetto preesistente, stesso identico caso gia' corretto sul
        // widget 'contributi'.
        let blocco =
            '<div class="ball-quota">' +
            `<div class="ball-barra-testo"><span>Aggiornati</span><span>${aggiornati} di ${totale}</span></div>` +
            `<div class="ball-barra-out"><div class="ball-barra-in" style="width:${perc.toFixed(1)}%"></div></div>` +
            '</div>';
        // Il bottone apre la pagina Controllo prezzi (tavole approvate); il
        // tocco sulla tessera fa lo stesso. L'elenco delle scadute resta
        // nella pagina/modale, non ripetuto qui.
        blocco += _ballPulsante('Apri Controllo prezzi', `_ballAzioneRiga(event,'tab','prezzi')`);
        return { inline, blocco };
    },

    // Visualizzazione: il totale, l'andamento vero degli inserimenti degli
    // ultimi 14 giorni come sparkline, e le ultime carte entrate.
    // RESTYLE BINDEX FASE 2 (2026-09-30, tavola "Collezione"): carte ·
    // valore, le tre schede Carte/Sealed/Wishlist e le ultime 4 entrate.
    visualizzazione: (d) => {
        if (!d) return { inline: '', blocco: '' };
        const inline =
            '<p class="ball-k-tit">Collezione</p>' +
            `<div class="ball-k-big ball-k-mono">${(d.totale || 0).toLocaleString('it-IT')}</div>` +
            `<span class="ball-k-lab">carte · ${formattaEuro(d.valore || 0)}</span>`;
        let blocco = '<div class="ball-chips">' +
            `<span>Carte ${d.totale || 0}</span><span>Sealed ${d.nSealed || 0}</span><span>Wishlist ${d.nWishlist || 0}</span></div>`;
        if (d.ultime && d.ultime.length) {
            // ball-strip-fill: le carte vanno a capo e riempiono tutto lo spazio della
            // tessera (larghezza E altezza); quelle che non ci stanno le nasconde
            // _potaContenutoFuoriTessera, intere, mai tagliate a meta'.
            blocco += '<div class="ball-strip ball-strip-fill">' + d.ultime.map(c => _ballMiniCarta(c)).join('') + '</div>' +
                (d.aggiunteRecenti ? `<span class="ball-k-lab">+${d.aggiunteRecenti} negli ultimi 14 giorni</span>` : '');
        }
        return { inline, blocco };
    },

    // Location: quante posizioni, e una barra per ciascuna delle più piene,
    // in scala sulla maggiore. Ogni riga apre la collezione già filtrata.
    // RESTYLE BINDEX FASE 2 (2026-09-30): le 3 più preziose con il loro
    // valore e la quota sul totale, e il promemoria delle carte in "?".
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

    // Match: il totale, e i due tipi come riquadri di statistica separati —
    // scambio e wishlist sono due cose diverse.
    // RIPULITO (2026-09-24, estrazione widget Chat): il terzo dato
    // (chatNonLetti) aggiunto nella sessione precedente è tornato al
    // widget Chat, che ora ha una tessera propria — vedi 'chat' qui
    // sotto. Questo corpo è tornato esattamente quello di prima di quella
    // sessione (solo scambio/wishlist).
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

    // ── CHAT (id catalogo 'chat') ─────────────────────────────────────
    // AGGIUNTO (2026-09-24, estrazione da widget-match.ui.js). Opzione B
    // del mockup approvato da Claudio: totale in grande + le prime 3
    // conversazioni con non letti nel blocco esteso (nome, puntino,
    // conteggio) — righe cliccabili, stesso pattern di 'location' qui
    // sopra. d = { totale, conversazioni: [{ownerAltro, label, count}] },
    // prodotto da CATALOGO_WIDGET.chat.preview() (ui/widget-chat.ui.js),
    // popolato da _aggiornaBadgeChat() — zero query qui, tutto già in
    // memoria, stesso principio degli altri corpi.
    // Il click sulla riga apre AVVIA il flusso "apri inbox poi apri
    // questa conversazione" (case 'chat-conversazione' in
    // _ballAzioneRiga, ui/widget-render-tessere-grandi.ui.js) — non più
    // solo la lista, vedi commento lì. label passata come 'origine'
    // (4° parametro), escaping apostrofi come altrove nel progetto.
    chat: (d) => {
        if (!d) return { inline: '', blocco: '' };
        // AGGIUNTO (2026-09-24): tessera "spenta" per chi è nella lista
        // vietati (widget-chat.ui.js, _CHAT_EMAIL_VIETATE) — senza
        // questo caso mostrerebbe comunque "0, nessun messaggio non
        // letto", che implica che la funzione sia disponibile e solo
        // vuota, non negata.
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
            const labelAttr = escapeJsAttr(c.label); // audit 2026-09-25 M2
            return `<div class="ball-riga ball-clic" onclick="_ballAzioneRiga(event,'chat-conversazione','${c.ownerAltro}','${labelAttr}')"><span class="ball-nome">${label}</span><span class="ball-dato">${c.count}</span></div>`;
        }).join('');
        return { inline, blocco };
    },

    // ── VETRINA (id catalogo 'ultima_carta') ─────────────────────────────
    // AGGIUNTO (Claudio, sessione bugfix widget Vetrina — vedi chat). Prima
    // non c'era nessun caso qui: la tessera grande ricadeva su
    // _ballCorpoGenerico, lasciando un blocco vuoto sotto stella+titolo e
    // solo la vecchia miniatura piccola in fondo (vedi screenshot). Foto a
    // piena larghezza costruita da _ballCorpoFotoCarta
    // (ui/widget-render-tessere-grandi.ui.js). Se la carta non è ancora
    // stata scelta (d.vuoto, da widget-vetrina.ui.js) o non ha una foto,
    // torna vuoto: _ballCorpoWidget ricade sul corpo generico, che per lo
    // stato "Scegli una carta" tiene la ball/icona classica — comportamento
    // voluto (Claudio, sessione corrente), non toccato.
    // NIENTE ball-k-tit nell'inline: il titolo "Vetrina" lo stampa già
    // renderWidgetHome (widget-tile-titolo), stesso motivo già documentato
    // sopra per 'primo_piano' — evita la duplicazione vista in uno
    // screenshot di Claudio il 2026-09-03 su quel widget.
    ultima_carta: (d) => {
        if (!d || d.vuoto) return { inline: '', blocco: '' };
        return { inline: '', blocco: _ballCorpoFotoCarta(d) };
    },
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
