// Service worker: sito installabile e file in cache, aggiornati a ogni pubblicazione.
// I file con ?v=<impronta> (script e fogli di stile) stanno in CACHE_FILE, che resta tra una
// pubblicazione e l'altra: dopo un aggiornamento si scaricano solo i file cambiati. Il resto
// (pagine, file senza ?v=) sta nella cache della versione, buttata a ogni pubblicazione.

const VERSIONE = '__VERSIONE_SITO__';
const ATTIVO = !VERSIONE.startsWith('__');
const CACHE = 'bindex-' + VERSIONE;
const CACHE_FILE = 'bindex-file';
const MAI_IN_CACHE = [/\/releases\//, /latest-version\.txt$/, /\/sw\.js$/];

self.addEventListener('install', (evento) => {
    if (!ATTIVO) return;
    evento.waitUntil(
        caches.open(CACHE)
            .then(c => c.add(new Request('index.html', { cache: 'no-cache' })))
            .catch(() => {   })
    );
});

async function _recuperaFileVersionati(nomeVecchio, destinazione) {
    const vecchia = await caches.open(nomeVecchio);
    for (const richiesta of await vecchia.keys()) {
        if (!new URL(richiesta.url).searchParams.has('v')) continue;
        if (await destinazione.match(richiesta)) continue;
        const risposta = await vecchia.match(richiesta);
        if (risposta) await destinazione.put(richiesta, risposta);
    }
}

self.addEventListener('activate', (evento) => {
    evento.waitUntil((async () => {
        const fileCache = await caches.open(CACHE_FILE);
        const vecchie = (await caches.keys()).filter(n => n.startsWith('bindex-') && n !== CACHE && n !== CACHE_FILE);
        for (const nome of vecchie) {
            try { await _recuperaFileVersionati(nome, fileCache); } catch (_) {   }
            await caches.delete(nome);
        }
    })());
});

async function _togliVersioniVecchie(cache, richiesta) {
    const url = new URL(richiesta.url);
    for (const k of await cache.keys()) {
        const u = new URL(k.url);
        if (u.origin === url.origin && u.pathname === url.pathname && u.search !== url.search) await cache.delete(k);
    }
}

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

    if (url.searchParams.has('v')) {
        evento.respondWith(caches.open(CACHE_FILE).then(async (c) => {
            const inCache = await c.match(richiesta);
            if (inCache) return inCache;
            const risposta = await fetch(richiesta);
            if (risposta.ok && risposta.type === 'basic') {
                const copia = risposta.clone();
                evento.waitUntil(c.put(richiesta, copia).then(() => _togliVersioniVecchie(c, richiesta)).catch(() => {   }));
            }
            return risposta;
        }));
        return;
    }

    evento.respondWith(caches.open(CACHE).then(async (c) => {
        const inCache = await c.match(richiesta);
        const dallaRete = fetch(richiesta).then(risposta => {
            if (risposta.ok && risposta.type === 'basic') c.put(richiesta, risposta.clone());
            return risposta;
        });
        if (inCache) {
            dallaRete.catch(() => {   });
            return inCache;
        }
        return dallaRete;
    }));
});
