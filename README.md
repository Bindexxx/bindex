# CardSync Pro (bindex)

Gestione collezione carte Pokémon condivisa tra un piccolo gruppo: sito web
(GitHub Pages), estensione Chrome, backend Supabase (progetto
`xpfibrzsffurdlypxnrw`, piano free). Oggi in fase di test: quando diventerà
ufficiale si cancelleranno account e dati, mentre la struttura del
database resta com'è.

Sito: https://bindexxx.github.io/bindex/

## Pagine (7)

| Pagina | A cosa serve |
|---|---|
| `index.html` | App principale: home a widget ("telefono" con cornice Pokédex) e tutte le sezioni |
| `admin.html` | Pannello admin: utenti, richieste, log, Work in Progress |
| `binder-pubblico.html` | Binder condiviso (sola lettura, richiesta di scambio) |
| `scaffali-pubblico.html` | Scaffale sealed condiviso (sola lettura, richiesta di scambio) |
| `wishlist.html` | Wishlist condivisa |
| `sealed.html` | Catalogo sealed condiviso |

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
- `utils/*.js` — funzioni pure (`formatters.js` per il sito,
  `shared-public.js` per le pagine pubbliche).
- `ui/*.ui.js` — DOM, logica, eventi. Home a widget: motore in
  `ui/paginainiziale*.ui.js`, un file per widget in `ui/widget-<nome>.ui.js`
  (28 widget registrati in `CATALOGO_WIDGET`).
- `statusbar.js` / `statusbar.css` — barra di stato e tendina (CSBar).
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
2. **Nessuna chiamata al DB al caricamento di un file.** `supabaseClient`
   viene creato nell'**ultimo** `<script>` di ogni pagina: il codice che
   gira mentre gli script si caricano (anche indirettamente, funzione dopo
   funzione) non lo trova ancora e va in errore. Il lavoro sul DB parte da
   `window.onload` in poi o da un'azione dell'utente.
3. **Nomi globali unici per pagina.** Due `let`/`const` con lo stesso nome
   in due file della stessa pagina bloccano l'intera pagina.
4. **Testo dentro l'HTML sempre protetto:** `escapeHtml()` per testo e
   attributi; `escapeJsAttr()` per il testo passato come argomento stringa
   dentro `onclick="f('…')"`, perché gestisce apostrofi, virgolette e a capo.
5. **Euro:** sempre `formattaEuro()`, che produce "1.234,50 €". Le copie in
   `utils/formatters.js` e `utils/shared-public.js` vanno tenute identiche,
   come quelle di `escapeHtml`.
6. **Librerie esterne a versione esatta.** Oggi è `@supabase/supabase-js@2.117.1`,
   uguale in tutte le pagine: va aggiornata a mano, in tutte insieme.
   Chart.js 4.5.1 viene caricato solo all'apertura del grafico prezzi
   (`ui/prices.ui.js`).

## Sessione e logout

- Il logout chiude solo il dispositivo in uso (`signOut({ scope: 'local' })`).
- "Mantieni accesso" decide dove si salva la sessione: in `localStorage`
  (resta tra un'apertura e l'altra) oppure in `sessionStorage` (muore con la
  scheda). Il codice è in `AUTH_STORAGE_SESSIONE`, dentro
  `data/auth.repository.js`.

## Estensione Chrome

Sorgente = `releases/cardsync-extension.zip`. A ogni modifica: incrementare
`version` nel `manifest.json` e scrivere lo stesso numero in
`releases/latest-version.txt`. Il sito confronta le due versioni
all'avvio. Il dominio in `externally_connectable` deve combaciare
esattamente con quello del sito.
