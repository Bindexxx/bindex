-- 137 — Il catalogo impara link e miniatura dalle carte che l'estensione aggiunge (12/11/2026).
-- Ogni volta che una carta entra in collezione (o il controllo prezzi le rinfresca link o immagine) la
-- riga del catalogo (set_carte) prende il link della sua pagina Cardmarket e la miniatura vera, quella
-- che l'estensione ha già salvato nello Storage. Le miniature di TCGdex vengono sostituite man mano da
-- quelle di Cardmarket e arrivano anche dove TCGdex non ne ha (Battle Academy, McDonald's, Trainer Kit).
--
-- PERCHÉ UN TRIGGER E NON L'ESTENSIONE: l'estensione scrive già link e immagine in "carte" per tre
-- strade (completa_riga_coda_carte, l'inserimento a mano, aggiorna_prezzo_controllo_gruppo /
-- aggiorna_url_controllo_gruppo). Agganciandosi a "carte" si prendono tutte e tre senza toccare
-- l'estensione: nessuna versione nuova, nessun PC da aggiornare.
--
-- Verificato sul DB reale il 12/11/2026, prima di scrivere:
--   carte: 6 trigger (cestino, pulisci_foto, scambio_automatico, updated_at, storico_prezzo,
--   traccia_prezzo_precedente), nessuno sul catalogo; solo righe stato 'collezione' (la coda è in
--   coda_lavoro); 2.298 immagini nello Storage, tutte "<24 cifre esadecimali>.jpg".
--   set_carte: nessun trigger; proprietario postgres, RLS non forzata, scrittura solo is_admin() → la
--   funzione è SECURITY DEFINER; indici: chiave, numero, cardmarket_id (nessuno sul link); i link
--   sono tutti della versione /it/ del sito.
--   PostgreSQL 17.6: sha256() c'è.
--
-- LA PROVA CON LA FOTO. L'estensione chiama il file dell'immagine con le prime 24 cifre dello SHA-256
-- dell'indirizzo della foto su Cardmarket (background.js, _hashUrl), e quell'indirizzo contiene il
-- numero del prodotto: https://product-images.s3.cardmarket.com/51/MEW/733728/733728.jpg
-- Quindi dal nome del file si può controllare DI QUALE prodotto è una pagina: si rifà il conto per i
-- numeri di prodotto che il catalogo conosce per quella carta e si guarda quale combacia.
-- Misurato sulle carte del gruppo (12/11/2026): su 1.462 carte per cui il catalogo ha i numeri di
-- prodotto, 1.431 combaciano e 31 no (prodotto che il catalogo non conosce, o numero di prodotto di
-- TCGdex sbagliato); per altre 293 il catalogo non ha numeri di prodotto.
-- Vale anche per le espansioni "con la x" di Cardmarket (xPRE, xBLK, xWHT, xASC, xJTG, xDRI, xMEG: le
-- versioni Poké Ball, Master Ball, cosmos…), che nel catalogo stanno nel set senza la x: 295 su 297.
--
-- REGOLE, una carta alla volta (pagina = link senza parametri, sempre /it/):
--   A. PROVA. Codice "SIGLA NUMERO" (lingue occidentali), pagina /Products/Singles/ che finisce con quel
--      codice, e la foto è quella di un prodotto che il catalogo conosce per quella carta: pagina e
--      miniatura vanno sulle righe di QUEL prodotto (la carta base, oppure una sua versione: timbrata,
--      cosmos, Poké Ball…). Se la stessa pagina era finita sulle righe di un altro prodotto, da lì viene
--      tolta. È l'unico caso in cui un link già presente viene cambiato.
--   B. La pagina è già nel catalogo (tutti i masterset promo, e le carte già agganciate): prende solo la
--      miniatura, se non ne ha una o ha quella di TCGdex.
--   C. Senza prova: solo se l'indirizzo NON ha il segno di versione (-V1-, -V2-…). Senza quel segno su
--      Cardmarket esiste un solo prodotto con quel nome nell'espansione, quindi la pagina è quella della
--      carta: va sulle righe normale e reverse che non hanno ancora un link.
--      Con il segno di versione e senza prova non si scrive niente: non si può sapere se è la carta
--      base o una versione (Quaxly-V2-PAL050, Abra-V2-MEW063).
--   Si accettano solo link https://www.cardmarket.com/…/Pokemon/Products/Singles/… e immagini dello
--   Storage "immagini-carte". Se qualcosa va storto la carta si salva lo stesso: il catalogo non blocca
--   mai l'estensione.
--
-- COSA CORREGGE DELLA 132. La 132 agganciava la pagina alle righe normale/reverse guardando solo il
-- codice. Il passaggio in fondo ripassa tutte le carte con le regole nuove: dove la foto dimostra che
-- la pagina è di un'altra versione (21 carte del gruppo, es. Eevee-V3-MEW133 = versione "snowflake"),
-- il link viene spostato sulla riga giusta e la carta base torna alla miniatura di TCGdex.
--
-- LIMITI NOTI:
--   - chi ha fatto l'accesso scrive link e immagine delle proprie carte, quindi può far imparare al
--     catalogo una pagina o una miniatura sbagliata. Tra i sei del gruppo è lo stesso rischio che c'è
--     già sulle immagini delle carte.
--   - se una carta ha link e immagine di due pagine diverse (link corretto a mano, immagine non ancora
--     rinfrescata) il catalogo può imparare la coppia sbagliata: si corregge da solo al controllo prezzi
--     successivo, perché la prova con la foto riscrive la riga.
--   - se Cardmarket cambia l'indirizzo delle foto la prova non combacia più: restano le regole B e C.
-- Rollback: 137_catalogo_impara_dalle_carte_ROLLBACK.sql.

begin;

create index if not exists set_carte_cardmarket_url_idx
  on public.set_carte using btree (cardmarket_url) where (cardmarket_url is not null);

create or replace function public._catalogo_impara(p_codice text, p_lingua text, p_url text, p_immagine text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_pagina  text;
    v_slug    text;
    v_img     text;
    v_foto    text;
    v_sigla   text;      -- sigla scritta nel codice della carta ("MEW", "XPRE")
    v_set     text;      -- set del catalogo ("MEW", "PRE")
    v_cartella text;     -- la sigla come la scrive Cardmarket nell'indirizzo e nella foto ("MEW", "xPRE")
    v_numero  integer;
    v_codice  boolean := false;
    v_id      bigint;
begin
    if p_url is null then return; end if;
    v_pagina := split_part(p_url, '?', 1);
    if v_pagina !~ '^https://www\.cardmarket\.com/[a-z]{2}/Pokemon/Products/Singles/[^/?#]+/[^/?#[:space:]"<>'']+$' then
        return;
    end if;
    -- il catalogo tiene i link della versione italiana del sito
    v_pagina := regexp_replace(v_pagina, '^https://www\.cardmarket\.com/[a-z]{2}/', 'https://www.cardmarket.com/it/');
    v_slug   := split_part(v_pagina, '/', 9);
    if p_immagine ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/immagini-carte/[A-Za-z0-9._-]+$' then
        v_img  := p_immagine;
        v_foto := substring(p_immagine from '/immagini-carte/([0-9a-f]{24})\.[a-z]+$');
    end if;

    -- codice "SIGLA NUMERO" dei set normali, e pagina che finisce con quel codice (Blissey-LOT153 per "LOT 153")
    if p_codice ~ '^[A-Za-z0-9]+ [0-9]{1,4}$' and coalesce(p_lingua, '') in ('IT', 'EN', 'DE', 'FR', 'ES', 'PT') then
        v_sigla    := upper(split_part(p_codice, ' ', 1));
        v_numero   := split_part(p_codice, ' ', 2)::integer;
        v_cartella := substring(v_slug from '(?i)-(' || v_sigla || ')-?0*' || v_numero::text || '$');
        v_codice   := v_numero > 0 and v_cartella is not null;
        -- "xPRE", "xBLK", "xASC"…: su Cardmarket sono le versioni speciali (Poké Ball, Master Ball, cosmos…)
        -- dei set PRE, BLK, ASC; nel catalogo stanno nel set senza la x, ognuna col suo numero di prodotto
        v_set := case when v_sigla ~ '^X[A-Z0-9]{2,}$'
                           and not exists (select 1 from public.set_espansioni e where e.sigla = v_sigla)
                      then substr(v_sigla, 2) else v_sigla end;
    end if;

    -- A. la foto dice di quale prodotto è la pagina
    if v_codice and v_foto is not null then
        select s.cardmarket_id into v_id
        from public.set_carte s
        where s.sigla = v_set and s.numero = v_numero and s.codice is null and s.cardmarket_id is not null
          and left(encode(sha256(convert_to('https://product-images.s3.cardmarket.com/51/' || v_cartella || '/'
                   || s.cardmarket_id::text || '/' || s.cardmarket_id::text || '.jpg', 'UTF8')), 'hex'), 24) = v_foto
        limit 1;
        if v_id is not null then
            -- la pagina non è degli altri prodotti di questa carta: da lì si toglie (e con lei la sua foto)
            update public.set_carte s
            set cardmarket_url = null,
                immagine = case when s.immagine = v_img
                                then (select min(x.immagine) from public.set_carte x
                                      where x.sigla = s.sigla and x.numero = s.numero
                                        and x.immagine like 'https://assets.tcgdex.net/%')
                                else s.immagine end,
                aggiornato_il = now()
            where s.sigla = v_set and s.numero = v_numero and s.codice is null
              and s.cardmarket_url = v_pagina and s.cardmarket_id is distinct from v_id;
            update public.set_carte s
            set cardmarket_url = v_pagina, immagine = v_img, aggiornato_il = now()
            where s.sigla = v_set and s.numero = v_numero and s.codice is null and s.cardmarket_id = v_id
              and (s.cardmarket_url is distinct from v_pagina or s.immagine is distinct from v_img);
            return;
        end if;
    end if;

    -- B. pagina già nel catalogo: al massimo le manca la miniatura vera
    if exists (select 1 from public.set_carte s where s.cardmarket_url = v_pagina) then
        if v_img is not null then
            update public.set_carte s
            set immagine = v_img, aggiornato_il = now()
            where s.cardmarket_url = v_pagina
              and (s.immagine is null or s.immagine like 'https://assets.tcgdex.net/%');
        end if;
        return;
    end if;

    -- C. senza prova: solo indirizzi senza segno di versione (un solo prodotto con quel nome),
    --    e mai le espansioni con la x, che non sono la carta base
    if not v_codice or v_set <> v_sigla or v_slug ~ '-V[0-9]+-' then return; end if;
    -- l'espansione dev'essere quella degli altri link del set (una ristampa in un'altra espansione no)
    if exists (select 1 from public.set_carte s
               where s.sigla = v_sigla and s.codice is null and s.cardmarket_url is not null
                 and split_part(s.cardmarket_url, '/', 8) <> split_part(v_pagina, '/', 8)) then
        return;
    end if;
    update public.set_carte s
    set cardmarket_url = v_pagina,
        immagine = case when v_img is not null and (s.immagine is null or s.immagine like 'https://assets.tcgdex.net/%')
                        then v_img else s.immagine end,
        aggiornato_il = now()
    where s.sigla = v_sigla and s.numero = v_numero and s.variante in ('normale', 'reverse')
      and s.codice is null and s.cardmarket_url is null;
end;
$function$;

create or replace function public._carte_insegna_al_catalogo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    -- il controllo prezzi aggiorna la carta di continuo: qui interessa solo se cambiano link, immagine o codice
    if tg_op = 'UPDATE'
       and new.url is not distinct from old.url and new.immagine is not distinct from old.immagine
       and new.codice is not distinct from old.codice and new.lingua is not distinct from old.lingua then
        return new;
    end if;
    begin
        -- l'immagine vale come prova solo se è appena stata letta dalla pagina (carta nuova o foto rinfrescata):
        -- se è cambiato solo il link, la foto può essere ancora quella della pagina di prima
        perform public._catalogo_impara(
            new.codice, new.lingua, new.url,
            case when tg_op = 'INSERT' or new.immagine is distinct from old.immagine then new.immagine end);
    exception when others then
        -- il catalogo non deve mai impedire di salvare una carta
        raise warning '[catalogo] carta % non imparata: %', new.id, sqlerrm;
    end;
    return new;
end;
$function$;

-- funzioni interne: le usa solo il trigger (come le altre funzioni di trigger, sql/126)
revoke all on function public._catalogo_impara(text, text, text, text) from public, anon, authenticated;
revoke all on function public._carte_insegna_al_catalogo() from public, anon, authenticated;

drop trigger if exists trg_carte_insegna_al_catalogo on public.carte;
create trigger trg_carte_insegna_al_catalogo
  after insert or update on public.carte
  for each row execute function public._carte_insegna_al_catalogo();

-- Una volta, per le carte che ci sono già: le promo del gruppo prendono la miniatura vera, e i link che
-- la 132 aveva messo sulla riga sbagliata vengono spostati (vedi "COSA CORREGGE DELLA 132").
-- In ordine di ultimo controllo prezzi: se due carte dicono cose diverse vale la più fresca.
do $$
declare
    r record;
begin
    for r in select c.codice, c.lingua, c.url, c.immagine from public.carte c
             order by c.ultimo_controllo nulls first, c.id loop
        perform public._catalogo_impara(r.codice, r.lingua, r.url, r.immagine);
    end loop;
end $$;

commit;

-- Controllo a occhio dopo l'esecuzione (non cambia niente):
select count(*) filter (where cardmarket_url is not null) as righe_con_link,
       count(*) filter (where immagine ~ 'supabase\.co/storage/') as miniature_di_cardmarket,
       count(*) filter (where immagine like 'https://assets.tcgdex.net/%') as miniature_di_tcgdex,
       count(*) filter (where immagine is null) as senza_miniatura
from public.set_carte;
