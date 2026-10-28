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
| `prova-ordini.js` | Ordini e processi (dalla 5.40): messaggio sconosciuto dal sito, versione del motore, ordini abbandonati chiusi dal database, versione del PC (`segnala_dispositivo`), 15 s + 10 s di lettura, app già aperta senza ricarica (service worker, `app.js`, `popup.js`), "Nessuna carta da controllare" = ordine completato, "mi unisco" con l'ultima attività, un lotto di prezzi ogni 25 carte della coda, login ricordato; dalla 5.41 `app.js` che ricarica l'estensione se il motore in uso è vecchio (una volta per versione). `prova-background.js` dalla 5.40 controlla anche sveglie (create una volta, mai sotto i 30 s) e `VERSIONE_MOTORE` = manifest. |
| `prova-impronta.js` | Impronta su Cardmarket e login (dalla 5.42): manifest senza risorse leggibili dal web né script dichiarati su Cardmarket, sito solo da `/bindex/`; `content.js` senza scroll/mouse finto e una volta per pagina; widget Turnstile con offerte o h1 della carta ≠ Cloudflare; scheda del controllo prezzi di `popup.js` con `shared.js` + `content.js` iniettati e prezzo filtrato per lingua; lettura in background con `shared.js` iniettato una volta e login ricordato; "Mantienimi loggato" con `chrome.storage.session` e spostamento della sessione; pulizia ordini anche con il PC occupato. |
| `prova-velocita.js` | Velocità (dalla 5.43): rallentamento dopo Cloudflare nel turno comune (+3 s per gradino, max 5, uno per carta, giù a ogni carta pulita, salvato); fase `quando` senza prenotazione; pagina Aggiungi carte con il solo conto alla rovescia del turno e "pausa lunga ogni" 75 di default; micro-pausa di `popup.js` sommata al turno; worker della coda con le carte di fila (un turno per carta, si ferma all'apertura dell'app); link diretto letto con la sola scheda (nome/codice dall'h1, immagine vera o nessuna), ricerca senza la pagina carta scaricata, link alla lista riconosciuto senza richieste o nella scheda, secondo tentativo RH solo con 0 offerte, scheda che non legge niente = carta non salvata. |
| `prova-sealed.js` | Sealed (dalla 5.44): nome mostrato dalla ricerca (testo del link, entità decodificate) usato con lo slug; nome italiano e inglese → stesso prodotto (Elite Trainer Box, non Pokémon Center/confezione da 10/scatola vuota), parole in qualunque ordine e senza accenti, pari merito = scelta manuale con i nomi italiani; stessa scelta con la ricerca letta nella scheda; prezzo = prima offerta comprabile nella lingua della pagina, `shared.js` iniettato prima della lettura, niente prezzo se nessuna offerta nella lingua. |
| `prova-grafica.js` | Grafica (dalla 5.46): chiaro/scuro del sito in ogni pagina (`tema.css` dopo lo stile della pagina, `tema.js` primo script, cambio senza ricaricare), niente temi interni né Google Fonts/cdnjs, font e icone che esistono, nome del manifest che `aggiorna_cardsync.bat` cerca; pagina Coda dentro l'app che dice cosa fa (lettura, attesa con la prossima carta, fatta, ferma) e ubbidisce a Ferma/Riprendi solo dall'app; Varianti in una cella; pagina Prezzi senza "foglio", profilo e "v3.1", soglia a tendina, "Ultime controllate"; "Esci" con il suo stile (B14) e nel menu dell'app; messaggio "aggiornata" una volta per versione; Cloudflare del giorno contati. |
| `prova-pulizia.js` | Pulizia (dalla 5.47): nessuna funzione o costante mai usata (stessa analisi di `codice-morto.js`), ogni azione dell'adapter chiamata da qualcuno, niente codice per pagine e ordini che non esistono più (vecchie azioni, `APRI_URL_WORKER_TAB`, ordini `aggiungi_*`, audio keep-alive, prova a secco, `bulkSessione`, User-Agent finto); un solo controllo "Cloudflare ancora in pagina" per le attese (provato su pagine finte), frasi del 1015 da `RATE_LIMIT_MARKERS`, `AGGIUNGI_CARTA` con un'azione = errore. |
| `codice-morto.js` | Dichiarazioni di primo livello mai usate (analisi della sintassi, i commenti non contano). |
| `schermate.js` | Schermate di app, popup, Aggiungi carte e changelog con dati finti; dalla 5.46 a 1.440, 1.180 e 1.024 px, in scuro (`?scuro`) e con il menu utente aperto. `PLAYWRIGHT_MODULE` = percorso di Playwright se non è installato qui; `CHROME_PATH` = percorso di Chrome. |
| `lib/chrome-finto.js` | `chrome.*` e Supabase finti per Node: registrano sveglie, messaggi, schede, RPC e tabelle toccate. `opts.dati` = righe per tabella (anche con getter, letto una volta per query), `opts.conta` = conteggio per tabella, `opts.inoltraA` = gestori al posto del service worker; `log.chiamate` = tabelle/RPC con argomenti. |
| `lib/browser-finto.js` | Lo stesso, iniettato nelle pagine per le schermate, con dati di esempio. |
| `lib/carica-background.js` | Carica il service worker; `opts.fetch` permette di servire pagine finte di Cardmarket. |

Per i doppioni di codice: `npx jscpd --min-lines 8 <cartella dell'estensione>`.

## Regole

- Mai rete vera: le pagine di Cardmarket si simulano con `opts.fetch`.
- Una correzione nell'estensione si accompagna a un caso qui (per esempio in `prova-ricerca.js`),
  così non torna indietro alla versione dopo.
