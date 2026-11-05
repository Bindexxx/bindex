// Service worker: sito installabile e file in cache, aggiornati a ogni pubblicazione.

const VERSIONE = '__VERSIONE_SITO__';
const ATTIVO = !VERSIONE.startsWith('__');
const CACHE = 'bindex-' + VERSIONE;
const MAI_IN_CACHE = [/\/releases\//, /latest-version\.txt$/, /\/sw\.js$/];

self.addEventListener('install', (evento) => {
    if (!ATTIVO) return;
    evento.waitUntil(
        caches.open(CACHE)
            .then(c => c.add(new Request('index.html', { cache: 'no-cache' })))
            .catch(() => {   })
    );
});

self.addEventListener('activate', (evento) => {
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
            dallaRete.catch(() => {   });
            return inCache;
        }
        return dallaRete;
    }));
});
