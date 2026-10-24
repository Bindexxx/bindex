# Prove dell'estensione CardSync Pro

Strumenti per provare l'estensione **fuori da Chrome**, prima di ogni rilascio: nessuna rete,
nessun dato vero, nessun account. Chrome, Supabase e Cardmarket sono finti.

Di default si prova lo zip pubblicato, `releases/cardsync-extension.zip` (estratto da solo in
una cartella temporanea, serve il comando `unzip`). Per provare una copia di lavoro:
`CARDSYNC_EXT=/percorso/cartella npm test`.

## Uso

```
cd tools/test-estensione
npm install
npm test          # service worker + scelta della carta + avvio di tutte le pagine
npm run morti     # elenco di funzioni e costanti mai usate
npm run schermate # schermate delle pagine (serve Playwright e un Chrome, vedi sotto)
```

`npm test` stampa una riga OK / FALLITO per ogni controllo ed esce con errore se anche uno solo
fallisce.

## Cosa c'è

| File | Cosa prova |
|---|---|
| `prova-background.js` | `background.js` parte senza errori, crea le sveglie; il turno comune di Cardmarket non fa mai partire due carte troppo vicine (3 flussi in parallelo); riconoscimento della lista di un'espansione; nome e codice letti dall'h1. |
| `prova-ricerca.js` | Scelta della carta giusta tra i risultati di una ricerca (`_trovaMatchCartaSingola`), con link veri di Cardmarket. I casi "NOME SET NUMERO" si attivano dalla versione 5.36. |
| `prova-cardmarket.js` | Pagine finte di Cardmarket (dalla 5.36): link vecchio che porta alla lista dell'espansione e ricerca di riserva per nome, "NOME SET NUMERO" dal fetch, errore 429, testo della ricerca con "&", decisione dai dati letti nella scheda, content.js su una lista, offerte non comprabili. |
| `prova-pagine.js` | Ogni pagina `.html` parte in jsdom con i suoi `<script>` nello stesso ordine della pagina vera: trova elementi mancanti, funzioni non definite e nomi `let`/`const` doppi tra file. |
| `prova-wishlist.js` | Controllo prezzi wishlist di gruppo (dalla 5.37): le azioni dell'adapter chiamano le funzioni di `sql/118` con i parametri scritti lì; la sessione del controllo prezzi usa solo le azioni del suo dominio e tiene il proprietario della riga (contributi); home dell'app senza sezione Wishlist, "di cui wishlist" e errori recenti dalle correzioni manuali. |
| `prova-ritmo.js` | Ritmo del controllo prezzi (dalla 5.38): la sessione vera di `popup.js` contro il turno Cardmarket vero di `background.js`, slider a 1 s. Tra due pagine passa una sola attesa e ogni pagina conta un solo turno (fino alla 5.37 due: ritmo dimezzato, pausa lunga ogni N/2 carte). Dalla 5.39: l'attesa finisce in orario anche con i timer rallentati di una scheda in secondo piano. |
| `prova-coda.js` | Coda "Aggiungi carte" e dati (dalla 5.39): pagina vera con service worker finto — niente pannello correzioni, carte con più versioni subito in correzione, carte a mano tra le proprie correzioni, prezzo mancante riletto prima di salvare, location (maiuscole, mai il campo sulle carte del sito), reset; adapter (tipo 'carta', movimento per le carte a mano, location dalla tabella); lingue/condizioni con alias senza riscrivere l'URL a ogni controllo. |
| `prova-ordini.js` | Ordini e processi (dalla 5.40): messaggio sconosciuto dal sito, versione del motore, ordini abbandonati chiusi dal database, versione del PC (`segnala_dispositivo`), 15 s + 10 s di lettura, app già aperta senza ricarica (service worker, `app.js`, `popup.js`), "Nessuna carta da controllare" = ordine completato, "mi unisco" con l'ultima attività, un lotto di prezzi ogni 25 carte della coda, login ricordato. `prova-background.js` dalla 5.40 controlla anche sveglie (create una volta, mai sotto i 30 s) e `VERSIONE_MOTORE` = manifest. |
| `codice-morto.js` | Dichiarazioni di primo livello mai usate (analisi della sintassi, i commenti non contano). |
| `schermate.js` | Schermate di app, popup, Aggiungi carte e changelog con dati finti. `PLAYWRIGHT_MODULE` = percorso di Playwright se non è installato qui; `CHROME_PATH` = percorso di Chrome. |
| `lib/chrome-finto.js` | `chrome.*` e Supabase finti per Node: registrano sveglie, messaggi, schede, RPC e tabelle toccate. `opts.dati` = righe per tabella (anche con getter, letto una volta per query), `opts.conta` = conteggio per tabella, `opts.inoltraA` = gestori al posto del service worker; `log.chiamate` = tabelle/RPC con argomenti. |
| `lib/browser-finto.js` | Lo stesso, iniettato nelle pagine per le schermate, con dati di esempio. |
| `lib/carica-background.js` | Carica il service worker; `opts.fetch` permette di servire pagine finte di Cardmarket. |

Per i doppioni di codice: `npx jscpd --min-lines 8 <cartella dell'estensione>`.

## Regole

- Mai rete vera: le pagine di Cardmarket si simulano con `opts.fetch`.
- Una correzione nell'estensione si accompagna a un caso qui (per esempio in `prova-ricerca.js`),
  così non torna indietro alla versione dopo.
