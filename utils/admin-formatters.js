// Funzioni di formattazione della pagina admin (niente Supabase).

const POKEMON_NAMES = ['pikachu','eevee','mewtwo','mew','snorlax','gengar','abra','kadabra','machop','geodude','onix','lapras','ditto','meowth','psyduck','vulpix','squirtle','weedle','pidgey','rattata','spearow','ekans','nidoran','zubat','oddish','paras','venonat','diglett','doduo','seel','grimer','shellder','gastly','drowzee','krabby','voltorb','cubone','koffing','rhyhorn','chansey','tangela','horsea','goldeen','staryu','scyther','magmar','pinsir','tauros','magikarp','zapdos','moltres','dratini','pichu','togepi','natu','mareep','hoppip','sunkern','yanma','wooper','murkrow','unown','pineco','gligar','snubbull','qwilfish','shuckle','sneasel','slugma','swinub','corsola','remoraid','delibird','phanpy','stantler','smeargle','tyrogue','elekid','magby','larvitar','pupitar','lugia','celebi'];

function generaPassword() {
  return POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
}

function fmtData(d) { return d ? new Date(d).toLocaleString('it-IT') : '—'; }

function _dataLocaleISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _scaricaCSV(nomeFile, intestazioni, righe) {
  const escapeCSV = (v) => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
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
