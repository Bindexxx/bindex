// ── sw.js — service worker di Bindex (V7, 2026-10-12) ───────────────────
// Rende il sito installabile sul telefono e lo apre più in fretta: i file
// del sito restano in cache sul dispositivo. Registrato da index.html.
//
// REGOLE (volutamente prudenti):
//  - Tocca SOLO richieste GET verso il sito stesso. Supabase (dati, foto,
//    accesso), Google Fonts e immagini esterne passano sempre dalla rete,
//    senza mai finire in cache.
//  - Pagine (.html): prima la rete, così si vede sempre l'ultima versione;
//    la copia in cache serve solo senza connessione.
//  - File con ?v=… (versione messa in automatico alla pubblicazione da
//    tools/versiona_file.py): non cambiano mai → prima la cache.
//  - Altri file del sito: dalla cache e aggiornati in sottofondo.
//  - releases/ (aggiornamento dell'estensione) e latest-version.txt: mai in cache.
//  - Se la versione qui sotto NON è stata sostituita (sito pubblicato senza la
//    GitHub Action), il service worker non mette in cache nulla: passa tutto
//    alla rete come se non ci fosse.
//
// INTERRUTTORE DI EMERGENZA: se mai servisse spegnerlo su tutti i dispositivi,
// sostituire QUESTO file con il contenuto di tools/sw-spegni.js e pubblicare.
// Alla visita successiva ogni dispositivo lo disinstalla e svuota la cache.

const VERSIONE = '__VERSIONE_SITO__';
const ATTIVO = !VERSIONE.startsWith('__');
const CACHE = 'bindex-' + VERSIONE;
const MAI_IN_CACHE = [/\/releases\//, /latest-version\.txt$/, /\/sw\.js$/];

self.addEventListener('install', (evento) => {
    if (!ATTIVO) return;
    // La pagina principale subito, per poter aprire il sito anche offline.
    evento.waitUntil(
        caches.open(CACHE)
            .then(c => c.add(new Request('index.html', { cache: 'no-cache' })))
            .catch(() => { /* senza rete: si riempirà alla prima visita */ })
    );
});

self.addEventListener('activate', (evento) => {
    // Via le cache delle versioni precedenti.
    evento.waitUntil(
        caches.keys().then(nomi => Promise.all(
            nomi.filter(n => n.startsWith('bindex-') && n !== CACHE).map(n => caches.delete(n))
        ))
    );
});

self.addEventListener('fetch', (evento) => {
    if (!ATTIVO) return;
    const richiesta = evento.request;
    if (richiesta.method !== 'GET') return;
    const url = new URL(richiesta.url);
    if (url.origin !== self.location.origin) return;
    if (MAI_IN_CACHE.some(r => r.test(url.pathname))) return;

    if (richiesta.mode === 'navigate') {
        evento.respondWith(
            fetch(richiesta, { cache: 'no-cache' })
                .then(risposta => {
                    if (risposta.ok) {
                        const copia = risposta.clone();
                        caches.open(CACHE).then(c => c.put(richiesta, copia));
                    }
                    return risposta;
                })
                .catch(() => caches.match(richiesta).then(r => r || caches.match('index.html')))
        );
        return;
    }

    evento.respondWith(caches.open(CACHE).then(async (c) => {
        const inCache = await c.match(richiesta);
        if (inCache && url.searchParams.has('v')) return inCache;
        const dallaRete = fetch(richiesta).then(risposta => {
            if (risposta.ok && risposta.type === 'basic') c.put(richiesta, risposta.clone());
            return risposta;
        });
        if (inCache) {
            dallaRete.catch(() => { /* offline: resta la copia in cache */ });
            return inCache;
        }
        return dallaRete;
    }));
});
