# Prove del sito Bindex

Strumenti per provare il sito **prima di ogni PR**, fuori dal browser di tutti i giorni: nessun
dato vero, nessun accesso. Supabase, font e immagini esterne sono finti o bloccati. Non vengono
pubblicati (`tools/` è escluso da `versiona_file.py`).

## Uso

```
cd tools/test-sito
npm install
npm test                       # prova-statica.js + prova-selettore.js + prova-salva-codici.js + prova-pagine.js + prova-set-pagine.js + prova-accesso-unico.js
node prova-statica.js          # solo le prove senza browser
```

`BINDEX_SITO=/percorso/copia` prova un'altra copia del sito (per esempio un ramo estratto a parte).
`prova-pagine.js` usa Playwright con il suo Chromium: `PLAYWRIGHT_MODULE` = percorso del modulo se
non è installato qui, `CHROME_PATH` = un altro Chrome.

## Cosa c'è

| File | Cosa prova |
|---|---|
| `prova-statica.js` | Per ognuna delle 6 pagine, sugli script nell'ordine di caricamento vero: ogni `<script src>` locale esiste e si legge; nessun nome di primo livello dichiarato in due script (`let`/`const`/`class` doppi bloccano tutta la pagina, una funzione ridefinita vince in silenzio); `supabaseClient` usato solo in `config/` e `data/`; le funzioni chiamate negli attributi `on…="…"`, sia nell'HTML sia nei testi generati dagli script, esistono. |
| `prova-selettore.js` | Il selettore carte dell'Inserimento (`ui/selettore-carte.ui.js`) senza browser: come legge quello che scrivi ("jigglypuff 8", "svi 054", "PAL054", "zubat trainer kit 11", "mew 8"), che ricerca manda al catalogo, i testi e i link delle carte, quando una riga si blocca da sola. La funzione SQL `catalogo_cerca` (sql/132) si prova a parte in PGlite. |
| `prova-salva-codici.js` | Inserimento, salvataggio (19/11/2026): pagina di prova in Chromium con i file veri `ui/entry.ui.js` e `ui/selettore-carte.ui.js` e catalogo/coda finti. Le righe scritte a codice e mai uscite dal campo si collegano al catalogo al salvataggio: codice preciso con una sola carta → link della pagina (o `?idProduct=`) e testo del catalogo; due carte possibili, solo un nome, "Non è questa" → restano testo; riga già scelta → resta la sua scelta; avviso con quanti codici sono stati collegati. Sulla versione di prima fallisce. |
| `prova-pagine.js` | Le 6 pagine aperte in Chromium da un server locale con Supabase finto (nessuna sessione, tabelle vuote): nessun errore JavaScript, nessun `console.error` (a parte le risorse di rete bloccate apposta), la pagina mostra qualcosa. |
| `prova-accesso-unico.js` | Un solo accesso con l'estensione (estensione 5.83, 19/11/2026): `index.html` vero in Chromium con Supabase finto (Auth e funzione `biglietto-accesso`) ed estensione finta che risponde come `background.js`. Estensione dentro e sito fuori → il sito entra con il biglietto dell'estensione (`verify` con `token_hash`), "Continua come …" ed entra da solo, senza password; sito dentro (anche dopo un accesso a mano) ed estensione fuori → biglietto dalla funzione con la sessione del sito, passato all'estensione; "Esci" nell'estensione dopo l'accesso al sito → esce anche il sito (prima dell'accesso, o di un altro account → no); "Esci" sul sito → esce prima l'estensione (stesso account), e niente rientra da solo; due account diversi, interruttore spento, estensione vecchia → come prima; PC usato da più persone → una parte entra da sola solo con l'ultimo account entrato lì; la scheda che torna in vista segue l'estensione (entrata o uscita nel frattempo). Sulla versione di prima fallisce. |
| `lib/pagine.js` | Elenco delle pagine e dei loro script in ordine (`vendor/` e script esterni esclusi dalle prove sui nomi). |
| `lib/verifica.js` | Registro OK / FALLITO (copia di quello delle prove dell'estensione). |

Provate anche al contrario (04/11/2026): su una copia rotta apposta (un `let` doppio tra due file,
una funzione ridefinita, `supabaseClient` in `ui/`, un `onclick` verso una funzione che non c'è)
ogni controllo fallisce come deve.

## Limiti

- Le pagine si aprono senza accesso: le parti dell'app che partono solo dopo il login (home a
  widget, collezione, admin) sono provate solo da `prova-statica.js`, non eseguite.
- Gli `on…="…"` costruiti a pezzi con variabili (nome della funzione dentro `${…}`) non si leggono.
