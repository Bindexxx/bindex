# Bindex (nome interno CardSync Pro)

Gestione collezione carte Pokémon condivisa tra un piccolo gruppo: sito web
(GitHub Pages), estensione Chrome, backend Supabase (progetto
`xpfibrzsffurdlypxnrw`, piano free). Un solo ambiente, ancora "di test"
(account `nome@test.local`): il passaggio in produzione è pianificato a parte
e la struttura del database resta com'è.

Sito: https://bindexxx.github.io/bindex/

## Pagine (6)

| Pagina | A cosa serve |
|---|---|
| `index.html` | App principale: home a widget ("telefono" con cornice Pokédex) e tutte le sezioni |
| `admin.html` | Pannello admin: richieste da approvare, utenti (con le versioni dell'estensione dei loro PC), Shop, lavori in corso, registro |
| `binder-pubblico.html` | Binder condiviso (sola lettura, richiesta di scambio) |
| `scaffali-pubblico.html` | Scaffale sealed condiviso (sola lettura, richiesta di scambio) |
| `wishlist.html` | Wishlist condivisa: mostra il binder Wishlist del proprietario |
| `sealed.html` | Vecchio link dei sealed condivisi: avvisa che si sono spostati nello Scaffale |

(`scambio.html` è stata ritirata ed eliminata il 2026-09-25: lo Scambio ora
passa dai binder pubblici.)

## Struttura del codice

Script classici (niente moduli, niente bundler), caricati in ordine fisso
con `<script src>`. Tutti i file di una pagina condividono **un unico scope
globale**.

- `config/supabase.js` — URL e chiave anon di Supabase, unica fonte.
- `data/*.repository.js` — **tutte** le chiamate a Supabase (query, RPC,
  storage, auth, realtime). `data/pubblico.repository.js` contiene quelle
  delle pagine pubbliche.
- `state/*.state.js` — variabili di stato per dominio.
- `utils/*.js` — funzioni pure: `comuni.js` (escapeHtml, escapeJsAttr,
  formattaEuro, URL immagini — una sola copia per TUTTE le pagine),
  `formatters.js` (solo sito), `shared-public.js` (solo pagine pubbliche).
- `index.css` — stili di `index.html` (le pagine pubbliche hanno ancora il
  proprio `<style>` interno).
- `ui/*.ui.js` — DOM, logica, eventi. Home a widget: motore in
  `ui/paginainiziale*.ui.js`, un file per widget in `ui/widget-<nome>.ui.js`
  (28 id registrati in `CATALOGO_WIDGET`, in 25 file).
- `statusbar.js` / `statusbar.css` — barra di stato e tendina (CSBar).
- `sw.js` — service worker (sito installabile, file in cache): la versione
  la scrive la pubblicazione.
- `vendor/` — librerie copiate nel repo (supabase-js 2.117.1, Chart.js 4.5.1,
  qrcodejs 1.0.0, Font Awesome 6.4.0): nessun CDN esterno. Dettagli e impronte
  in `vendor/LEGGIMI.txt`.
- `sql/schema_live_2026-09-25.sql` — **fotografia reale dello schema** del
  database (tabelle, funzioni, policy…), generata dal DB live: è il
  riferimento per sapere com'è fatto il DB oggi.
- `sql/` (file numerati) — migrazioni **storiche**: NON sono una copia fedele del database
  (mancano diversi file e alcuni sono superati). La fonte di verità è sempre
  il DB live. Due query di SOLA LETTURA da eseguire nell'SQL editor:
  `sql/verifica_dipendenze_db.sql` (tutto ciò che il codice usa esiste
  davvero? atteso: zero righe) e `sql/esporta_schema_live.sql` (ricostruisce
  dallo stato reale l'intera struttura del DB: tabelle, funzioni, viste,
  vincoli, indici, RLS, policy, trigger, bucket).
- `releases/` — distribuzione dell'estensione: `cardsync-extension.zip`
  (struttura piatta), `latest-version.txt`, `aggiorna_cardsync.bat`.

## Regole da rispettare

1. **Mai `supabaseClient` fuori da `data/*.repository.js`.** La UI raccoglie
   l'input, decide cosa fare e chiama il repository.
2. **`supabaseClient` nasce in `config/supabase.js`**, il primo script dopo
   la libreria Supabase, con le opzioni scelte da `data-client` sul tag
   (`app` per index, `admin`, `pubblico` per le pagine pubbliche). Esiste
   quindi per tutti gli altri file; resta buona pratica avviare il lavoro sul
   DB da `window.onload` in poi o da un'azione dell'utente.
3. **Nomi globali unici per pagina.** Due `let`/`const` con lo stesso nome
   in due file della stessa pagina bloccano l'intera pagina.
4. **Testo dentro l'HTML sempre protetto:** `escapeHtml()` per testo e
   attributi; `escapeJsAttr()` per il testo passato come argomento stringa
   dentro `onclick="f('…')"`, perché gestisce apostrofi, virgolette e a capo.
5. **Euro:** sempre `formattaEuro()`, che produce "1.234,50 €" (in
   `utils/comuni.js`, unica copia). Eccezione voluta: le tessere compatte
   della home (`ui/widget-render-corpi.ui.js`) usano valori arrotondati.
6. **Librerie a versione esatta, servite da `vendor/`.** Oggi
   `supabase-js-2.117.1.js`, uguale in tutte le pagine: si aggiorna
   sostituendo il file in tutte insieme (vedi `vendor/LEGGIMI.txt`).
   Chart.js 4.5.1 viene caricato solo all'apertura del grafico prezzi
   (`ui/prices.ui.js`).
7. **Testi visibili:** "Bindex" (mai "CardSync Pro"), nickname e mai email,
   badge rossi solo per azioni da fare.

## Pubblicazione e prove

- A ogni push su `main` il workflow `.github/workflows/pubblica-sito.yml`
  pubblica il sito su GitHub Pages; prima `tools/versiona_file.py` aggiunge
  `?v=<impronta>` ai file di ogni pagina e la versione in `sw.js`.
- Prima di ogni PR del sito: `cd tools/test-sito && npm install && npm test`
  (prova statica: script esistenti, nomi doppi tra script, `supabaseClient`
  solo in `config/` e `data/`; prova delle 6 pagine in Chromium con Supabase
  finto). Non copre le parti dopo il login.
- Prima di ogni PR dell'estensione: `cd tools/test-estensione && npm install
  && npm test` (di default sullo zip pubblicato; vedi il suo README).

## Sessione e logout

- Il logout chiude solo il dispositivo in uso (`signOut({ scope: 'local' })`).
- "Mantieni accesso" decide dove si salva la sessione: in `localStorage`
  (resta tra un'apertura e l'altra) oppure in `sessionStorage` (muore con la
  scheda). Il codice è in `AUTH_STORAGE_SESSIONE`, dentro
  `config/supabase.js`.

## Estensione Chrome

Sorgente = `releases/cardsync-extension.zip` (struttura piatta, 36 file; non
esiste un repo separato). A ogni modifica, anche minima: stesso numero nuovo in
`version` del `manifest.json`, in `VERSIONE_MOTORE` di `background.js` e in
`releases/latest-version.txt`, più una voce in `CHANGELOG.md`. Il nome nel
manifest resta "CardSync Pro" (lo cerca `aggiorna_cardsync.bat`).

- `releases/aggiorna_cardsync.bat` trova la cartella dell'estensione dalle
  Preferences di Chrome, scarica lo zip, lo estrae e riavvia Chrome.
- `configurazione_app.versione_minima` sul DB blocca le versioni vecchie: si
  alza solo dopo che i PC sono aggiornati (tabella `dispositivi_estensione`,
  visibile anche nella scheda Utenti dell'admin).
- Il dominio in `externally_connectable` deve combaciare esattamente con
  quello del sito (oggi `https://bindexxx.github.io/bindex/*`).
- "AMBIENTE DI TEST": il login col solo nome aggiunge `@test.local` in
  `auth_ui.js` (estensione), `ui/auth.ui.js`, `ui/admin-shell.ui.js`,
  `utils/shared-public.js` e nella funzione `admin_process_pending_request`
  (sql/110). Al passaggio in produzione si cambiano tutti insieme.
