// Lettura delle carte dei masterset promo da Cardmarket (fatta l'11/11/2026 dal Chrome di Claudio,
// con l'estensione ferma). Si incolla nella console di una scheda di www.cardmarket.com DOPO aver
// aperto https://www.cardmarket.com/it/Pokemon/Expansions: legge le espansioni Trick or Trade,
// Prize Pack Series, WCD e Battle Academy, una pagina ogni ~6 secondi (30 carte per pagina), tiene
// tutto in localStorage ("bindexPromo", così si può riprendere) e alla fine scarica
// bindex-promo-cardmarket.json. Da quel file tools/catalogo-promo/genera-sql.mjs fa la SQL.
// Se Cardmarket risponde 429 o mostra il controllo di Cloudflare si ferma e lo scrive: si aspetta,
// si passa il controllo a mano e si rilancia (riparte da dove era arrivato).
(async () => {
  const VUOI = /^(WCD-\d{4}|Trick-or-Trade(-\d{4})?|Play-Pokemon-Prize-Pack-Series-\w+|Battle-Academy-\d{4}|Scarlet-Violet-Battle-Academy|My-First-Battle)$/;
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const stato = JSON.parse(localStorage.getItem('bindexPromo') || 'null') || { attese: {}, carte: {}, fatte: {}, log: [] };
  document.querySelectorAll('.expansion-row').forEach(r => {
    const a = r.querySelector('a[href*="/Pokemon/Expansions/"]'); if (!a) return;
    const slug = (a.getAttribute('href').split('/Expansions/')[1] || '').split('?')[0]; if (!VUOI.test(slug)) return;
    const t = r.innerText.replace(/\s+/g, ' ').trim().replace(a.textContent.trim(), '');
    const m = t.match(/(\d+) Cart[ae]\s*(\d{1,2}) (\w+) (\d{4})/);
    stato.attese[slug] = { n: m ? parseInt(m[1], 10) : 0, data: m ? `${m[2]}/${MESI.indexOf(m[3]) + 1}/${m[4]}` : null };
  });
  const leggi = (html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a.galleryBox')].map(a => {
    const img = a.querySelector('img');
    const id = ((img && img.getAttribute('data-echo') || '').match(/\/(\d+)\.(?:jpg|png|webp)/) || [])[1] || '';
    return a.getAttribute('href').split('?')[0].split('/').pop() + '|' + id + '|' + ((img && img.getAttribute('alt')) || '').trim();
  });
  const pausa = (ms) => new Promise(r => setTimeout(r, ms));
  for (const slug of Object.keys(stato.attese)) {
    if (stato.fatte[slug]) continue;
    const viste = new Set();
    for (let pagina = 1; pagina <= 12; pagina++) {
      const r = await fetch(`/it/Pokemon/Products/Singles/${slug}?sortBy=name_asc&site=${pagina}`, { credentials: 'include' });
      const html = await r.text();
      if (r.status === 429 || /just a moment|ci siamo quasi|cf-challenge|challenge-platform/i.test(html.slice(0, 6000))) {
        localStorage.setItem('bindexPromo', JSON.stringify(stato));
        console.warn(`Cardmarket ha fermato la lettura (${r.status}) su ${slug} pagina ${pagina}: aspetta, passa il controllo e rilancia.`);
        return;
      }
      const righe = leggi(html); const prima = viste.size; righe.forEach(x => viste.add(x));
      stato.log.push(`${slug} p${pagina}: ${righe.length}`);
      await pausa(5500);
      if (righe.length < 30 || viste.size === prima) break;
    }
    stato.carte[slug] = [...viste]; stato.fatte[slug] = viste.size;
    localStorage.setItem('bindexPromo', JSON.stringify(stato));
    console.log(`${slug}: ${viste.size} carte (Cardmarket ne dichiara ${stato.attese[slug].n})`);
  }
  const blob = new Blob([JSON.stringify({ lettoIl: new Date().toISOString(), attese: stato.attese, carte: stato.carte })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bindex-promo-cardmarket.json';
  document.body.appendChild(a); a.click(); a.remove();
  console.log('Finito: scaricato bindex-promo-cardmarket.json');
})();
