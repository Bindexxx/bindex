// ── utils/admin-formatters.js ────────────────────────────────────────
// Funzioni pure di formattazione/utilità per la dashboard admin: nessun
// accesso a Supabase, nessuna manipolazione diretta del DOM (a parte la
// creazione/rimozione del link <a> temporaneo per il download CSV).

const POKEMON_NAMES = ['pikachu','eevee','mewtwo','mew','snorlax','gengar','abra','kadabra','machop','geodude','onix','lapras','ditto','meowth','psyduck','vulpix','squirtle','weedle','pidgey','rattata','spearow','ekans','nidoran','zubat','oddish','paras','venonat','diglett','doduo','seel','grimer','shellder','gastly','drowzee','krabby','voltorb','cubone','koffing','rhyhorn','chansey','tangela','horsea','goldeen','staryu','scyther','magmar','pinsir','tauros','magikarp','zapdos','moltres','dratini','pichu','togepi','natu','mareep','hoppip','sunkern','yanma','wooper','murkrow','unown','pineco','gligar','snubbull','qwilfish','shuckle','sneasel','slugma','swinub','corsola','remoraid','delibird','phanpy','stantler','smeargle','tyrogue','elekid','magby','larvitar','pupitar','lugia','celebi'];

function generaPassword() {
  return POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
}


function fmtData(d) { return d ? new Date(d).toLocaleString('it-IT') : '—'; }


// FIX (bug [15]): formatta una Date come YYYY-MM-DD usando i componenti
// LOCALI, non .toISOString() (sempre UTC — causava uno shift di un giorno
// nei preset data tra mezzanotte e le ~2 del mattino in Italia).
function _dataLocaleISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// Escaping minimo per valori utente inseriti in attributi HTML (campi
// anagrafici editabili sotto) — evita che virgolette/tag nel dato
// rompano il markup della modale.
function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// Costruisce e scarica un CSV (separatore ; e BOM UTF-8, per aprirlo
// correttamente in Excel con le impostazioni regionali italiane).
function _scaricaCSV(nomeFile, intestazioni, righe) {
  const escapeCSV = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const contenuto = [intestazioni, ...righe].map(riga => riga.map(escapeCSV).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
