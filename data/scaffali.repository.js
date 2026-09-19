// data/scaffali.repository.js
// Fase 1.3 (2026-09-12) — Scaffali sostituisce location per l'organizzazione
// dei prodotti sealed (sql/41/42). Questo file nasce MINIMO apposta: solo
// scaffaliList(), che serve subito al pannello "Controllo Prezzi Sealed" in
// ui/prices.ui.js (Step 4) per popolare il filtro. La UI completa di
// gestione Scaffali (creare/rinominare/copertina/pubblicazione/assegnare
// prodotti) è un pezzo a sé, ancora da costruire (Step 5) — quando arriva,
// le funzioni di scrittura (insert/update/delete su scaffali e
// scaffale_prodotti) vanno aggiunte qui, stesso file, per coerenza con
// l'architettura del progetto (UI → repository → supabaseClient, mai
// chiamate dirette fuori da qui).

async function scaffaliList(userId) {
    return supabaseClient.from('scaffali').select('id, nome, tipo').eq('owner_id', userId).order('created_at');
}

// ── Aggiunte Step 5a (2026-09-12): gestione privata base ────────────────

// Lazy come binderExtraGarantisci — SELECT prima di INSERT, mai upsert
// diretto (stesso motivo: evitare una race di doppia creazione non è
// critico qui, un utente apre la pagina Scaffali una tab alla volta).
async function scaffaleGarantisciVetrina(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('scaffali').select('*').eq('owner_id', userId).eq('tipo', 'vetrina').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };
    return supabaseClient.from('scaffali').insert({ owner_id: userId, tipo: 'vetrina', nome: 'Vetrina' }).select().single();
}

async function scaffaleInsert(userId, nome) {
    return supabaseClient.from('scaffali').insert({ owner_id: userId, tipo: 'libero', nome }).select().single();
}

async function scaffaleDelete(userId, scaffaleId) {
    return supabaseClient.from('scaffali').delete().eq('owner_id', userId).eq('id', scaffaleId);
}

async function scaffaleImpostaPubblicazione(userId, scaffaleId, pubblico) {
    return supabaseClient.from('scaffali')
        .update({ stato_pubblicazione: pubblico ? 'pubblico' : 'privato', condivisibile: pubblico })
        .eq('owner_id', userId).eq('id', scaffaleId);
}

// scaffale_prodotti: ponte multi-scaffale (Fase 1.3, sql/41).
async function scaffaleProdottiList(userId, scaffaleId) {
    return supabaseClient.from('scaffale_prodotti').select('prodotto_id').eq('owner_id', userId).eq('scaffale_id', scaffaleId);
}

async function scaffaleProdottoAggiungi(userId, scaffaleId, prodottoId) {
    return supabaseClient.from('scaffale_prodotti').insert({ owner_id: userId, scaffale_id: scaffaleId, prodotto_id: prodottoId });
}

async function scaffaleProdottoRimuovi(userId, scaffaleId, prodottoId) {
    return supabaseClient.from('scaffale_prodotti').delete().eq('owner_id', userId).eq('scaffale_id', scaffaleId).eq('prodotto_id', prodottoId);
}

// Aggiunta (sessione widget Doppioni, 2026-09-18) — TUTTE le associazioni
// scaffale↔prodotto dell'utente in un solo giro (scaffale_id, prodotto_id,
// quantita_offerta), a differenza di scaffaleProdottiConteggiTutti sotto
// (che seleziona solo scaffale_id, pensata per un conteggio, non per
// sapere DI QUALE prodotto). Serve al breakdown "dove si trovano le copie"
// della pagina Doppioni: una query sola invece di una per scaffale.
async function scaffaleProdottiTuttiUtente(userId) {
    return supabaseClient.from('scaffale_prodotti').select('scaffale_id, prodotto_id, quantita_offerta').eq('owner_id', userId);
}

// Conteggio prodotti per OGNI scaffale in un solo giro (per la griglia) —
// niente RPC dedicata: select minimale, conteggio fatto in JS. Se il
// numero di scaffali/associazioni crescesse molto, valutare una RPC
// count-per-scaffale — non necessario ora (gruppo di poche persone).
async function scaffaleProdottiConteggiTutti(userId) {
    return supabaseClient.from('scaffale_prodotti').select('scaffale_id').eq('owner_id', userId);
}

// ── Aggiunte Fase 3, Step 3 (2026-09-12) — Scaffale Scambio per i sealed,
// mirror di binderScambioGarantisci/binderCarteQueryConQuantita/
// binderCarteImpostaQuantitaScambio in data/binder.repository.js. Stessa
// differenza chiave lì documentata: qui serve un NUMERO (quantita_offerta),
// non un semplice sì/no come per l'assegnazione libera a uno scaffale
// 'libero'/'vetrina'.

// Forza pubblico/condivisibile già in fase di creazione (a differenza di
// 'libero'/'vetrina', creati privati di default) — Scambio deve essere
// sempre pubblico, stesso principio del binder Scambio (trigger DB lato
// binders). NOTA DI TRASPARENZA: qui la forzatura è SOLO client-side (nessun
// trigger DB equivalente a _binders_forza_condivisione creato per scaffali
// in questa sessione, per limitare lo scope) — un aggiornamento diretto via
// API potrebbe in teoria rimetterlo privato. Rischio basso (nessuna UI lo
// permette), ma da tenere a mente se in futuro si vuole la stessa garanzia
// a livello DB dei Binder.
async function scaffaleScambioGarantisci(userId) {
    const { data: esistente, error: errSelect } = await supabaseClient
        .from('scaffali').select('*').eq('owner_id', userId).eq('tipo', 'scambio').maybeSingle();
    if (errSelect) return { data: null, error: errSelect };
    if (esistente) return { data: esistente, error: null };

    return supabaseClient
        .from('scaffali')
        .insert({ owner_id: userId, tipo: 'scambio', nome: 'Scambio', stato_pubblicazione: 'pubblico', condivisibile: true })
        .select()
        .single();
}

// Gemella di scaffaleProdottiList, con quantita_offerta.
function scaffaleProdottiQueryConQuantita(userId, scaffaleId) {
    return supabaseClient.from('scaffale_prodotti').select('prodotto_id, quantita_offerta').eq('owner_id', userId).eq('scaffale_id', scaffaleId);
}

// Upsert quantità — un solo giro copre sia "prima volta che lo offro" sia
// "cambio quantità", stessa UNIQUE(owner_id,scaffale_id,prodotto_id) di
// sql/41.
async function scaffaleProdottoImpostaQuantitaScambio(userId, scaffaleId, prodottoId, quantita) {
    return supabaseClient.from('scaffale_prodotti')
        .upsert({ owner_id: userId, scaffale_id: scaffaleId, prodotto_id: prodottoId, quantita_offerta: quantita }, { onConflict: 'owner_id,scaffale_id,prodotto_id' });
}
