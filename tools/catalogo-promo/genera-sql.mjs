// Dal file letto su Cardmarket (bindex-promo-cardmarket.json) al file sql/136 con le carte dei
// masterset promo (BOO, PPS, WCD, Battle Academy). Uso: node genera136.mjs <file.json> [cartella sql]
import fs from 'fs';
const [, , ingresso, uscita = new URL('../../sql', import.meta.url).pathname] = process.argv;
const dati = JSON.parse(fs.readFileSync(ingresso, 'utf8'));
const NUMERI = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9, Ten: 10, Eleven: 11, Twelve: 12 };

function setDi(slug) {
  let m;
  if ((m = slug.match(/^Trick-or-Trade(?:-(\d{4}))?$/))) return { sigla: 'BOO' + (m[1] ? m[1].slice(2) : ''), nome: 'Trick or Trade' + (m[1] ? ' ' + m[1] : '') };
  if ((m = slug.match(/^Play-Pokemon-Prize-Pack-Series-(\w+)$/)) && NUMERI[m[1]]) return { sigla: 'PPS' + NUMERI[m[1]], nome: 'Play! Pokémon Prize Pack Series ' + m[1] };
  if ((m = slug.match(/^WCD-(\d{4})$/))) return { sigla: 'WCD' + m[1].slice(2), nome: 'World Championship Decks ' + m[1] };
  if ((m = slug.match(/^Battle-Academy-(\d{4})$/))) return { sigla: 'BA' + m[1].slice(2), nome: 'Battle Academy ' + m[1] };
  return null;   // My First Battle (più avanti) e il Battle Academy giapponese restano fuori
}
const dataIso = (t) => { const m = String(t || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const sql = (v) => (v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'");

const set = []; const carte = []; const note = [];
for (const slugEsp of Object.keys(dati.carte)) {
  const s = setDi(slugEsp);
  if (!s) { note.push(`fuori: ${slugEsp} (${dati.carte[slugEsp].length} carte)`); continue; }
  // i "Live Code Card" sono i codici per il gioco online, non carte
  const codiciOnline = dati.carte[slugEsp].filter(x => /^(?:Live-)?Code-Card/i.test(x)).length;
  if (codiciOnline) note.push(`${s.sigla}: ${codiciOnline} "Code Card" lasciate fuori`);
  const righe = dati.carte[slugEsp].filter(x => !/^(?:Live-)?Code-Card/i.test(x)).map(x => {
    const [slug, id, ...resto] = x.split('|');
    const nome = resto.join('|').trim();
    // il codice è quello che viene dopo la sigla in fondo all'indirizzo: Darkrai-BOO24OBF-136 → "OBF 136"
    const i = slug.toUpperCase().lastIndexOf('-' + s.sigla);
    let codice = null;
    if (i >= 0) {
      const pezzi = slug.slice(i + 1 + s.sigla.length).toUpperCase().split('-').filter(Boolean);
      const ultimo = pezzi[pezzi.length - 1] || '';
      if (pezzi.length > 1 && /^\d+[A-Z]?$/.test(ultimo)) codice = pezzi.slice(0, -1).join('') + ' ' + ultimo;   // OBF-136 → "OBF 136"
      else if (pezzi.length) codice = pezzi.join('');                                                              // 086, A14
    }
    if (codice && !/^[A-Z0-9]+( [A-Z0-9]+)?$/.test(codice)) codice = null;
    return { slug, id: /^\d+$/.test(id) ? id : null, nome: nome || slug.replace(/-/g, ' '), codice };
  });
  // "A42" delle Battle Academy e "086" dei WCD stanno in un pezzo solo; "OBF 136" in due
  const chiave = (r) => { if (!r.codice) return ['~', 0, r.nome]; const p = r.codice.split(' '); const coda = p[p.length - 1]; const m = coda.match(/^([A-Z]*)(\d+)/) || [null, '', '0']; return [(p.length > 1 ? p[0] : '') + m[1], parseInt(m[2], 10), r.nome]; };
  righe.sort((a, b) => { const x = chiave(a), y = chiave(b); return x[0].localeCompare(y[0]) || x[1] - y[1] || x[2].localeCompare(y[2]) || a.slug.localeCompare(b.slug); });
  const visti = new Map();
  let doppi = 0;
  righe.forEach((r, n) => { r.numero = n + 1; r.sigla = s.sigla; if (r.codice) { if (visti.has(r.codice)) doppi++; else visti.set(r.codice, r.slug); } });
  const attese = (dati.attese[slugEsp] || {}).n;
  set.push({ ...s, slug: slugEsp, totale: righe.length, data: dataIso((dati.attese[slugEsp] || {}).data), attese, senzaCodice: righe.filter(r => !r.codice).length, doppi });
  carte.push(...righe);
}
set.sort((a, b) => a.sigla.localeCompare(b.sigla, 'en', { numeric: true }));

// mappa delle immagini TCGdex (la stessa della 134)
const mappa = [...fs.readFileSync(new URL('../../sql/134_catalogo_miniature_tcgdex.sql', import.meta.url).pathname, 'utf8').matchAll(/^    \('([A-Z0-9-]+)', '([^']+)', (\d)\)/gm)].map(m => `('${m[1]}', '${m[2]}', ${m[3]})`);

const elencoSigle = set.map(s => `'${s.sigla}'`).join(', ');
const su = `-- 136 — Catalogo: le carte dei masterset promo, lette da Cardmarket l'11/11/2026.
-- ${set.length} set, ${carte.length} carte: Trick or Trade (BOO), Prize Pack Series (PPS), World Championship Decks
-- (WCD) e Battle Academy (BA, un masterset per anno). VA ESEGUITA DOPO la 135 (colonna "codice").
--   - set_espansioni: una riga per set, col nome di Cardmarket, la data d'uscita e il totale;
--   - set_carte: una riga per carta. "numero" è un progressivo (ordine: set d'origine, numero);
--     il codice vero è in "codice" (BOO24 → "PAL 050", WCD25 → "086", BA24 → "A42");
--     link = la pagina Cardmarket della carta; cardmarket_id = il suo numero di prodotto;
--     immagine = quella della carta d'origine su TCGdex (stessa figura senza il timbro), quando il
--     set d'origine è tra quelli della 134. Per le Battle Academy e i WCD senza set d'origine resta vuota.
-- Fuori: My First Battle (più avanti) e "Scarlet & Violet Battle Academy" (è il prodotto giapponese).
-- Si può rieseguire. Rollback: 136_catalogo_carte_promo_ROLLBACK.sql.

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'set_carte' and column_name = 'codice') then
    raise exception 'Prima va eseguita sql/135_catalogo_codice_promo.sql (manca set_carte.codice)';
  end if;
end $$;

begin;

insert into public.set_espansioni (sigla, nome, carte_base, carte_totali, data_uscita, lingua) values
${set.map(s => `    (${sql(s.sigla)}, ${sql(s.nome)}, null, ${s.totale}, ${sql(s.data)}, 'INT')`).join(',\n')}
on conflict (sigla) do update
set nome = excluded.nome, carte_totali = excluded.carte_totali, data_uscita = excluded.data_uscita, aggiornato_il = now();

with pagina(sigla, cartella) as (values
${set.map(s => `    (${sql(s.sigla)}, ${sql(s.slug)})`).join(',\n')}
),
mappa(sigla, percorso, cifre) as (values
    ${mappa.join(',\n    ')}
),
nuove(sigla, numero, codice, id, nome, indirizzo) as (values
${carte.map(r => `    (${sql(r.sigla)}, ${r.numero}, ${sql(r.codice)}, ${r.id || 'null'}::bigint, ${sql(r.nome)}, ${sql(r.slug)})`).join(',\n')}
)
insert into public.set_carte (sigla, numero, variante, nome, codice, cardmarket_id, cardmarket_url, immagine)
select n.sigla, n.numero, 'normale', n.nome, n.codice, n.id,
       'https://www.cardmarket.com/it/Pokemon/Products/Singles/' || p.cartella || '/' || n.indirizzo,
       case when m.sigla is not null and split_part(n.codice, ' ', 2) ~ '^[0-9]+$' then
            'https://assets.tcgdex.net/en/' || m.percorso
            || case when length((split_part(n.codice, ' ', 2)::integer)::text) >= m.cifre then (split_part(n.codice, ' ', 2)::integer)::text
                    else lpad((split_part(n.codice, ' ', 2)::integer)::text, m.cifre, '0') end
            || '/low.webp' end
from nuove n
join pagina p on p.sigla = n.sigla
left join mappa m on m.sigla = split_part(n.codice, ' ', 1) and position(' ' in coalesce(n.codice, '')) > 0
on conflict (sigla, numero, variante) do update
set nome = excluded.nome, codice = excluded.codice, cardmarket_id = excluded.cardmarket_id,
    cardmarket_url = excluded.cardmarket_url, immagine = coalesce(public.set_carte.immagine, excluded.immagine), aggiornato_il = now();

commit;

-- Controllo a occhio (non cambia niente):
select e.sigla, e.nome, e.carte_totali, count(c.*) as carte, count(c.codice) as con_codice, count(c.immagine) as con_miniatura
from public.set_espansioni e left join public.set_carte c on c.sigla = e.sigla
where e.sigla in (${elencoSigle})
group by e.sigla, e.nome, e.carte_totali order by e.sigla;
`;
const giu = `-- ROLLBACK della 136 — toglie dal catalogo i masterset promo (le carte e i set). Le tue carte non
-- si toccano: nel widget Set tornano a contare come prima della 136.

begin;
delete from public.set_carte where sigla in (${elencoSigle});
delete from public.set_espansioni where sigla in (${elencoSigle});
commit;
`;
fs.writeFileSync(uscita + '/136_catalogo_carte_promo.sql', su);
fs.writeFileSync(uscita + '/136_catalogo_carte_promo_ROLLBACK.sql', giu);
console.log(`${set.length} set, ${carte.length} carte, ${carte.filter(r => !r.codice).length} senza codice, ${carte.filter(r => !r.id).length} senza id · file ${(su.length / 1024).toFixed(0)} KB`);
console.log(set.map(s => `${s.sigla}:${s.totale}${s.attese && s.attese !== s.totale ? '(' + s.attese + ')' : ''}${s.senzaCodice ? '!' + s.senzaCodice : ''}`).join(' '));
console.log(`codici usati da più di una carta dello stesso set: ${set.reduce((t, s) => t + s.doppi, 0)} (mazzi diversi dei WCD, holo e non holo delle PPS)`);
note.slice(0, 25).forEach(n => console.log('  ·', n)); if (note.length > 25) console.log(`  … altre ${note.length - 25} note`);
