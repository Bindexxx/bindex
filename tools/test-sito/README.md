# Prove del sito Bindex

Strumenti per provare il sito **prima di ogni PR**, fuori dal browser di tutti i giorni: nessun
dato vero, nessun accesso. Supabase, font e immagini esterne sono finti o bloccati. Non vengono
pubblicati (`tools/` è escluso da `versiona_file.py`).

## Uso

```
cd tools/test-sito
npm install
npm test                       # prova-statica.js + prova-pagine.js
node prova-statica.js          # solo le prove senza browser
```

`BINDEX_SITO=/percorso/copia` prova un'altra copia del sito (per esempio un ramo estratto a parte).
`prova-pagine.js` usa Playwright con il suo Chromium: `PLAYWRIGHT_MODULE` = percorso del modulo se
non è installato qui, `CHROME_PATH` = un altro Chrome.

## Cosa c'è

| File | Cosa prova |
|---|---|
| `prova-statica.js` | Per ognuna delle 6 pagine, sugli script nell'ordine di caricamento vero: ogni `<script src>` locale esiste e si legge; nessun nome di primo livello dichiarato in due script (`let`/`const`/`class` doppi bloccano tutta la pagina, una funzione ridefinita vince in silenzio); `supabaseClient` usato solo in `config/` e `data/`; le funzioni chiamate negli attributi `on…="…"`, sia nell'HTML sia nei testi generati dagli script, esistono. |
| `prova-pagine.js` | Le 6 pagine aperte in Chromium da un server locale con Supabase finto (nessuna sessione, tabelle vuote): nessun errore JavaScript, nessun `console.error` (a parte le risorse di rete bloccate apposta), la pagina mostra qualcosa. |
| `lib/pagine.js` | Elenco delle pagine e dei loro script in ordine (`vendor/` e script esterni esclusi dalle prove sui nomi). |
| `lib/verifica.js` | Registro OK / FALLITO (copia di quello delle prove dell'estensione). |

Provate anche al contrario (04/11/2026): su una copia rotta apposta (un `let` doppio tra due file,
una funzione ridefinita, `supabaseClient` in `ui/`, un `onclick` verso una funzione che non c'è)
ogni controllo fallisce come deve.

## Limiti

- Le pagine si aprono senza accesso: le parti dell'app che partono solo dopo il login (home a
  widget, collezione, admin) sono provate solo da `prova-statica.js`, non eseguite.
- Gli `on…="…"` costruiti a pezzi con variabili (nome della funzione dentro `${…}`) non si leggono.
