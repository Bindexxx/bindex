// ── tools/sw-spegni.js — INTERRUTTORE DI EMERGENZA del service worker ────
// Da usare SOLO se il service worker (sw.js) dovesse creare problemi: copiare
// questo contenuto al posto di sw.js e pubblicare. Ogni dispositivo, alla
// visita successiva, scarica questa versione, che svuota le cache di Bindex,
// si disinstalla e ricarica le pagine aperte: il sito torna a funzionare
// esattamente come prima del service worker. (index.html continuerà a
// registrarlo: per spegnerlo del tutto togliere anche la registrazione in
// fondo a index.html.)

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
    evento.waitUntil((async () => {
        const nomi = await caches.keys();
        await Promise.all(nomi.filter(n => n.startsWith('bindex-')).map(n => caches.delete(n)));
        await self.registration.unregister();
        const pagine = await self.clients.matchAll({ type: 'window' });
        pagine.forEach(p => p.navigate(p.url));
    })());
});
