// Piccolo registro di controlli: stampa OK / FALLITO e alla fine esce con codice 1 se qualcosa
// non torna, così un giro di prove fallito si vede subito.
const risultati = [];

function controlla(nome, ok, dettaglio) {
  risultati.push({ nome, ok: !!ok });
  const riga = (ok ? 'OK       ' : 'FALLITO  ') + nome + (dettaglio !== undefined && !ok ? '  →  ' + (typeof dettaglio === 'string' ? dettaglio : JSON.stringify(dettaglio)) : '');
  console.log(riga);
}

function uguale(nome, ottenuto, atteso) {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  controlla(nome, a === b, 'ottenuto ' + a + ', atteso ' + b);
}

function chiudi() {
  const falliti = risultati.filter(r => !r.ok).length;
  console.log(`\n${risultati.length - falliti}/${risultati.length} controlli passati`);
  process.exit(falliti ? 1 : 0);
}

module.exports = { controlla, uguale, chiudi };
