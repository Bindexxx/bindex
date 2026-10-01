-- ═══════════════════════════════════════════════════════════════════════
-- 91_shop.sql — RESTYLE BINDEX FASE 9: Shop della Polvere
-- ═══════════════════════════════════════════════════════════════════════
-- Decisioni (Claudio, 2026-10-01):
--  - Polvere = Shop: Negozio / Zaino / Movimenti.
--  - Categorie: sfere, scaffali, tema, cornici, retro, bustine, altro.
--  - Gli oggetti estetici si comprano UNA volta e valgono per tutte le carte;
--    si regalano SOLO le bustine.
--  - Admin: stati bozza / in_vendita / a_tempo / ritirato, limite per utente
--    per articolo. Ritirare un articolo RIMBORSA in polvere chi lo possiede.
--  - Il catalogo parte con i 15 articoli della tavola, tutti in BOZZA.
--
-- Spesa e rimborsi passano da inventario_ricompense (tipo 'polvere',
-- quantita negativa / positiva): polvere_saldo() resta corretto senza
-- modifiche. Riferimenti: 'shop:<acquisto_id>', 'rimborso:<acquisto_id>'.
-- Le bustine comprate/regalate: tipo 'bustina' +N, riferimento
-- 'shop:<acquisto_id>' (bustine_stato() / apri_bustina() le vedono già).
-- "Salta missione" (altro): tipo 'skip_missione' +1.
--
-- Rollback: 91_shop_ROLLBACK.sql
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Catalogo ──────────────────────────────────────────────────────
create table public.shop_articoli (
    id               uuid primary key default gen_random_uuid(),
    chiave           text not null unique,             -- codice stabile per gli effetti (es. cornice_olografica)
    nome             text not null check (length(btrim(nome)) between 1 and 60),
    categoria        text not null check (categoria in ('sfere','scaffali','tema','cornici','retro','bustine','altro')),
    descrizione      text not null default '' check (length(descrizione) <= 400),
    prezzo           integer not null check (prezzo > 0 and prezzo <= 100000),
    limite_utente    integer check (limite_utente is null or limite_utente > 0),
    regalabile       boolean not null default false,
    stato            text not null default 'bozza' check (stato in ('bozza','in_vendita','a_tempo','ritirato')),
    in_vendita_dal   timestamptz,
    fino_al          timestamptz,
    immagine_path    text,                              -- file nel bucket shop-articoli
    stile            jsonb not null default '{}'::jsonb, -- parametri dell'effetto (vedi ui/shop.ui.js)
    ordine           integer not null default 0,
    creato_il        timestamptz not null default now(),
    aggiornato_il    timestamptz not null default now(),
    constraint shop_articoli_regalo_solo_bustine check (not regalabile or categoria = 'bustine'),
    constraint shop_articoli_a_tempo_scadenza check (stato <> 'a_tempo' or fino_al is not null)
);
alter table public.shop_articoli enable row level security;

-- Tutti gli autenticati vedono gli articoli NON in bozza (anche i ritirati:
-- servono per lo storico dei Movimenti); l'admin vede tutto. Nessuna
-- policy di scrittura: si scrive solo con le funzioni admin qui sotto.
create policy "shop articoli visibili" on public.shop_articoli
    for select to authenticated
    using (stato <> 'bozza' or public.is_admin());

-- ── 2. Acquisti (registro) ───────────────────────────────────────────
create table public.shop_acquisti (
    id               uuid primary key default gen_random_uuid(),
    articolo_id      uuid not null references public.shop_articoli(id),
    compratore_id    uuid not null references auth.users(id) on delete cascade,
    destinatario_id  uuid references auth.users(id) on delete set null, -- = compratore, oppure chi riceve il regalo
    prezzo           integer not null check (prezzo > 0),
    rimborsato_il    timestamptz,
    creato_il        timestamptz not null default now()
);
create index shop_acquisti_compratore on public.shop_acquisti (compratore_id, articolo_id);
create index shop_acquisti_destinatario on public.shop_acquisti (destinatario_id);
create index shop_acquisti_articolo on public.shop_acquisti (articolo_id);
alter table public.shop_acquisti enable row level security;
create policy "shop acquisti miei o admin" on public.shop_acquisti
    for select to authenticated
    using (compratore_id = auth.uid() or destinatario_id = auth.uid() or public.is_admin());

-- ── 3. Possessi (Zaino: oggetti estetici) ────────────────────────────
create table public.shop_possessi (
    id               uuid primary key default gen_random_uuid(),
    owner_id         uuid not null references auth.users(id) on delete cascade,
    articolo_id      uuid not null references public.shop_articoli(id),
    acquisto_id      uuid references public.shop_acquisti(id) on delete set null,
    attivo           boolean not null default true,
    ottenuto_il      timestamptz not null default now(),
    unique (owner_id, articolo_id)
);
alter table public.shop_possessi enable row level security;
create policy "shop possessi miei" on public.shop_possessi
    for select to authenticated
    using (owner_id = auth.uid() or public.is_admin());

-- ── 4. Helper: gruppo di esclusività (uno solo attivo per gruppo) ────
-- sfere/scaffali/tema/cornici: uno per categoria. retro: uno per tipo di
-- elemento (sticker / timbro / medaglia), così si combinano tra loro.
create or replace function public._shop_gruppo(p_categoria text, p_stile jsonb)
returns text language sql immutable as $$
    select case when p_categoria = 'retro' then 'retro:' || coalesce(p_stile->>'retro', 'altro')
                else p_categoria end;
$$;

create or replace function public._shop_attiva_esclusivo(p_owner uuid, p_articolo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_gruppo text;
begin
    select public._shop_gruppo(categoria, stile) into v_gruppo from shop_articoli where id = p_articolo;
    update shop_possessi sp set attivo = false
      from shop_articoli a
     where a.id = sp.articolo_id and sp.owner_id = p_owner and sp.articolo_id <> p_articolo
       and sp.attivo and public._shop_gruppo(a.categoria, a.stile) = v_gruppo;
    update shop_possessi set attivo = true where owner_id = p_owner and articolo_id = p_articolo;
end;
$$;
revoke all on function public._shop_attiva_esclusivo(uuid, uuid) from public, anon, authenticated;

-- ── 5. Comprare (anche regalare una bustina) ─────────────────────────
create or replace function public.shop_compra(p_articolo uuid, p_destinatario uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid     uuid := auth.uid();
    v_dest    uuid;
    v_art     shop_articoli%rowtype;
    v_saldo   integer;
    v_gia     integer;
    v_acq     uuid;
    v_n       integer;
begin
    if v_uid is null then raise exception 'Utente non autenticato'; end if;
    -- Una spesa alla volta per utente (due clic, due schede).
    perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));

    select * into v_art from shop_articoli where id = p_articolo;
    if not found or v_art.stato not in ('in_vendita','a_tempo') then
        raise exception 'Articolo non in vendita';
    end if;
    if v_art.stato = 'a_tempo' and v_art.fino_al <= now() then
        raise exception 'Offerta scaduta';
    end if;

    v_dest := coalesce(p_destinatario, v_uid);
    if v_dest <> v_uid then
        if not v_art.regalabile then raise exception 'Questo articolo non si può regalare'; end if;
        if not exists (select 1 from profiles where id = v_dest and deleted_at is null) then
            raise exception 'Destinatario non trovato';
        end if;
    end if;

    if v_art.categoria not in ('bustine','altro') then
        if exists (select 1 from shop_possessi where owner_id = v_uid and articolo_id = v_art.id) then
            raise exception 'Ce l''hai già: lo trovi nello Zaino';
        end if;
    end if;

    if v_art.limite_utente is not null then
        select count(*) into v_gia from shop_acquisti
         where compratore_id = v_uid and articolo_id = v_art.id and rimborsato_il is null;
        if v_gia >= v_art.limite_utente then
            raise exception 'Hai raggiunto il limite per questo articolo (%)', v_art.limite_utente;
        end if;
    end if;

    select coalesce(sum(quantita), 0)::integer into v_saldo
      from inventario_ricompense where owner_id = v_uid and tipo = 'polvere';
    if v_saldo < v_art.prezzo then
        raise exception 'Polvere insufficiente: ti servono % ✧, ne hai %', v_art.prezzo, v_saldo;
    end if;

    insert into shop_acquisti (articolo_id, compratore_id, destinatario_id, prezzo)
    values (v_art.id, v_uid, v_dest, v_art.prezzo) returning id into v_acq;

    insert into inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
    values (v_uid, 'polvere', 'shop:' || v_acq, -v_art.prezzo);

    if v_art.categoria = 'bustine' then
        v_n := greatest(1, least(20, coalesce((v_art.stile->>'bustine')::integer, 1)));
        insert into inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        values (v_dest, 'bustina', 'shop:' || v_acq, v_n);
    elsif v_art.categoria = 'altro' and v_art.stile->>'ricompensa' = 'skip_missione' then
        insert into inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        values (v_uid, 'skip_missione', 'shop:' || v_acq, 1);
    else
        insert into shop_possessi (owner_id, articolo_id, acquisto_id, attivo)
        values (v_uid, v_art.id, v_acq, false);
        perform public._shop_attiva_esclusivo(v_uid, v_art.id); -- "si applica subito"
    end if;

    return jsonb_build_object('acquisto_id', v_acq, 'saldo', v_saldo - v_art.prezzo);
end;
$$;
revoke all on function public.shop_compra(uuid, uuid) from public, anon;
grant execute on function public.shop_compra(uuid, uuid) to authenticated;

-- ── 6. Attivare / togliere dallo Zaino ───────────────────────────────
create or replace function public.shop_attiva(p_articolo uuid, p_attivo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
    if v_uid is null then raise exception 'Utente non autenticato'; end if;
    if not exists (select 1 from shop_possessi where owner_id = v_uid and articolo_id = p_articolo) then
        raise exception 'Non è nel tuo Zaino';
    end if;
    if p_attivo then
        perform public._shop_attiva_esclusivo(v_uid, p_articolo);
    else
        update shop_possessi set attivo = false where owner_id = v_uid and articolo_id = p_articolo;
    end if;
end;
$$;
revoke all on function public.shop_attiva(uuid, boolean) from public, anon;
grant execute on function public.shop_attiva(uuid, boolean) to authenticated;

-- ── 7. A chi posso regalare una bustina (nickname, mai email) ────────
create or replace function public.shop_destinatari_regalo()
returns table (user_id uuid, nickname text) language plpgsql stable security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
    return query
        select p.id, pu.nickname
          from profiles p join preferenze_utente pu on pu.owner_id = p.id
         where p.id <> auth.uid() and p.deleted_at is null
           and (p.banned_until is null or p.banned_until < now())
           and coalesce(btrim(pu.nickname), '') <> ''
         order by lower(pu.nickname);
end;
$$;
revoke all on function public.shop_destinatari_regalo() from public, anon;
grant execute on function public.shop_destinatari_regalo() to authenticated;

-- ── 8. Admin: salvare un articolo ────────────────────────────────────
create or replace function public.shop_admin_salva(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_id    uuid := nullif(p->>'id', '')::uuid;
    v_stato text := coalesce(p->>'stato', 'bozza');
    v_prima text;
begin
    if not public.is_admin() then raise exception 'Solo admin'; end if;
    if v_stato = 'ritirato' then raise exception 'Per ritirare usa "Ritira dallo Shop"'; end if;
    if v_id is null then
        insert into shop_articoli (chiave, nome, categoria, descrizione, prezzo, limite_utente, regalabile,
                                   stato, in_vendita_dal, fino_al, immagine_path, stile, ordine)
        values (coalesce(nullif(p->>'chiave', ''), 'art_' || replace(gen_random_uuid()::text, '-', '')),
                p->>'nome', p->>'categoria', coalesce(p->>'descrizione', ''), (p->>'prezzo')::integer,
                nullif(p->>'limite_utente', '')::integer, coalesce((p->>'regalabile')::boolean, false),
                v_stato, case when v_stato in ('in_vendita','a_tempo') then now() end,
                nullif(p->>'fino_al', '')::timestamptz, nullif(p->>'immagine_path', ''),
                coalesce(p->'stile', '{}'::jsonb), coalesce((p->>'ordine')::integer, 0))
        returning id into v_id;
    else
        select stato into v_prima from shop_articoli where id = v_id for update;
        if not found then raise exception 'Articolo non trovato'; end if;
        if v_prima = 'ritirato' then raise exception 'Articolo ritirato: non si modifica più'; end if;
        update shop_articoli set
            nome = p->>'nome', categoria = p->>'categoria', descrizione = coalesce(p->>'descrizione', ''),
            prezzo = (p->>'prezzo')::integer, limite_utente = nullif(p->>'limite_utente', '')::integer,
            regalabile = coalesce((p->>'regalabile')::boolean, false), stato = v_stato,
            in_vendita_dal = case when v_stato in ('in_vendita','a_tempo') then coalesce(in_vendita_dal, now()) else in_vendita_dal end,
            fino_al = nullif(p->>'fino_al', '')::timestamptz,
            immagine_path = case when p ? 'immagine_path' then nullif(p->>'immagine_path', '') else immagine_path end,
            stile = coalesce(p->'stile', stile), aggiornato_il = now()
        where id = v_id;
    end if;
    return v_id;
end;
$$;
revoke all on function public.shop_admin_salva(jsonb) from public, anon;
grant execute on function public.shop_admin_salva(jsonb) to authenticated;

-- ── 9. Admin: ritirare (con rimborso a chi lo possiede) ──────────────
-- Rimborsa il prezzo pagato a chi ha l'oggetto nello Zaino e lo toglie.
-- Bustine e "salta missione" già consegnate NON si rimborsano (sono state
-- date/consumate). Restituisce quante persone sono state rimborsate.
create or replace function public.shop_admin_ritira(p_articolo uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; r record;
begin
    if not public.is_admin() then raise exception 'Solo admin'; end if;
    update shop_articoli set stato = 'ritirato', aggiornato_il = now() where id = p_articolo and stato <> 'ritirato';
    if not found then raise exception 'Articolo non trovato o già ritirato'; end if;
    for r in
        select sp.id as possesso_id, sp.owner_id, a.id as acquisto_id, a.prezzo
          from shop_possessi sp join shop_acquisti a on a.id = sp.acquisto_id
         where sp.articolo_id = p_articolo and a.rimborsato_il is null
    loop
        insert into inventario_ricompense (owner_id, tipo, riferimento_id, quantita)
        values (r.owner_id, 'polvere', 'rimborso:' || r.acquisto_id, r.prezzo);
        update shop_acquisti set rimborsato_il = now() where id = r.acquisto_id;
        delete from shop_possessi where id = r.possesso_id;
        v_n := v_n + 1;
    end loop;
    insert into admin_audit_log (admin_id, action, details)
    values (auth.uid(), 'shop_ritira', jsonb_build_object('articolo_id', p_articolo, 'rimborsati', v_n));
    return v_n;
end;
$$;
revoke all on function public.shop_admin_ritira(uuid) from public, anon;
grant execute on function public.shop_admin_ritira(uuid) to authenticated;

-- ── 10. Bucket immagini dello Shop ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-articoli', 'shop-articoli', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy "shop articoli: admin carica" on storage.objects for insert to authenticated
    with check (bucket_id = 'shop-articoli' and public.is_admin());
create policy "shop articoli: admin aggiorna" on storage.objects for update to authenticated
    using (bucket_id = 'shop-articoli' and public.is_admin());
create policy "shop articoli: admin cancella" on storage.objects for delete to authenticated
    using (bucket_id = 'shop-articoli' and public.is_admin());

-- ── 11. Catalogo di partenza (tavola), tutto in BOZZA ────────────────
insert into public.shop_articoli (chiave, nome, categoria, descrizione, prezzo, limite_utente, regalabile, stile, ordine) values
 ('sfera_aurora',        'Sfera Aurora',          'sfere',    'Skin per le sfere della home.', 250, 1, false, '{"sfera":"aurora"}', 10),
 ('sfera_carbonio',      'Sfera Carbonio',        'sfere',    'Skin per le sfere della home.', 180, 1, false, '{"sfera":"carbonio"}', 11),
 ('sfera_oro',           'Sfera Oro',             'sfere',    'Skin per le sfere della home.', 400, 1, false, '{"sfera":"oro"}', 12),
 ('scaffale_legno',      'Scaffale Legno chiaro', 'scaffali', 'Skin per i tuoi scaffali.', 120, 1, false, '{"scaffale":"legno"}', 20),
 ('scaffale_vetro',      'Scaffale Vetro',        'scaffali', 'Skin per i tuoi scaffali.', 160, 1, false, '{"scaffale":"vetro"}', 21),
 ('tema_notte',          'Tema Notte stellata',   'tema',     'Tema del sito: sostituisce quello scelto finché è attivo.', 300, 1, false, '{"tema":"notte"}', 30),
 ('tema_foresta',        'Tema Foresta',          'tema',     'Tema del sito: sostituisce quello scelto finché è attivo.', 300, 1, false, '{"tema":"foresta"}', 31),
 ('cornice_olografica',  'Cornice Olografica',    'cornici',  'Cornice per la foto della carta: si vede nella carta a tutto schermo.', 120, 1, false, '{"cornice":"olografica"}', 40),
 ('cornice_oro',         'Cornice Oro',           'cornici',  'Cornice per la foto della carta: si vede nella carta a tutto schermo.', 90, 1, false, '{"cornice":"oro"}', 41),
 ('retro_sticker_neon',  'Sticker Neon',          'retro',    'Prezzo e condizione sul retro delle tue carte: li vedi girando la carta.', 60, 1, false, '{"retro":"sticker","variante":"neon"}', 50),
 ('retro_timbro_cond',   'Timbro Condizione',     'retro',    'La condizione come timbro sul retro delle tue carte.', 70, 1, false, '{"retro":"timbro","variante":"rosso"}', 51),
 ('retro_medaglia_primo','Medaglia Primo scambio','retro',    'Una medaglia sul retro delle tue carte.', 80, 1, false, '{"retro":"medaglia","variante":"oro"}', 52),
 ('bustina_extra',       'Bustina extra',         'bustine',  'Una bustina in più da aprire. Si può regalare.', 40, null, true, '{"bustine":1}', 60),
 ('bustine_tris',        'Tris di bustine',       'bustine',  'Tre bustine da aprire. Si può regalare.', 110, null, true, '{"bustine":3}', 61),
 ('salta_missione',      'Salta missione',        'altro',    'Salta una missione del giorno che non ti va di fare.', 50, null, false, '{"ricompensa":"skip_missione"}', 70);

commit;
