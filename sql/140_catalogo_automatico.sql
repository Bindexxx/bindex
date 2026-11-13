-- 140 — Catalogo che si aggiorna da solo da TCGdex (13/11/2026).
-- Ogni notte (dalle 2 alle 5, ora italiana) la funzione sul server "catalogo-tcgdex" (Supabase Edge
-- Function) legge TCGdex e:
--   1. una volta al giorno guarda l'elenco dei set: un set che non conosce finisce in "Da confermare"
--      nella pagina admin (scheda Catalogo). I set di TCG Pocket (gioco digitale) vengono ignorati.
--      Un set entra nel catalogo solo quando l'admin conferma sigla e nome (decisione di Claudio, 13/11);
--   2. a ogni giro ricontrolla UN set uscito negli ultimi 120 giorni (o appena confermato), al massimo
--      80 carte per giro, e aggiunge solo quello che manca: carte, varianti (i reverse arrivano su
--      TCGdex settimane dopo l'uscita), numeri di prodotto, nomi, rarità e miniature vuote.
--      Non cancella e non sovrascrive niente.
-- Stessa regola delle varianti della prima importazione (verificata su Buio Pesto con la 139).
-- Piano free: 12 giri a notte (uno ogni 20 minuti), circa 360 chiamate al mese della funzione, meno di
-- 100 secondi l'una; nessun costo.
--
-- Verificato sul DB reale il 13/11/2026, prima di scrivere:
--   - estensioni: pgcrypto (schema extensions) e supabase_vault ci sono; pg_cron e pg_net no (disponibili);
--   - set_espansioni: 185 tcgdex_id; 8 tcgdex_id su due sigle (doppioni con i due punti: "BRS:TG" e
--     "BRS-TG"…): il giro salta le sigle con i due punti;
--   - is_admin() = profilo admin E accesso con il secondo fattore (aal2);
--   - il set "B2" ha le carte di Base Set 2 (130, Alakazam, Blastoise…) ma nome, data e tcgdex_id di
--     "Fantastical Parade" (B2 di TCG Pocket, gennaio 2026): il widget Set mostra 155 carte invece di
--     130 e il giro automatico ci avrebbe messo le carte di Pocket. Corretto qui sotto (tcgdex base4).
-- VA ESEGUITA DOPO sql/138 (usa cardmarket_id_dubbio). Rollback: 140_catalogo_automatico_ROLLBACK.sql.

create extension if not exists pg_cron;
create extension if not exists pg_net;

begin;

do $$
begin
    if not exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'set_carte' and column_name = 'cardmarket_id_dubbio') then
        raise exception 'Prima va eseguita sql/138_catalogo_numeri_prodotto_sbagliati.sql';
    end if;
end $$;

-- ── 0. B2 = Base Set 2 ────────────────────────────────────────────────────────────────────────
update public.set_espansioni
set nome = 'Base Set 2', tcgdex_id = 'base4', carte_base = 130, carte_totali = 130,
    data_uscita = '2000-02-24', aggiornato_il = now()
where sigla = 'B2' and tcgdex_id = 'B2';

-- ── 1. i set di TCGdex visti dal giro ─────────────────────────────────────────────────────────
create table if not exists public.catalogo_tcgdex (
    tcgdex_id      text primary key,
    stato          text not null check (stato in ('nostro', 'da_confermare', 'ignorato')),
    nome_en        text,
    nome_it        text,
    sigla_proposta text,
    serie          text,
    data_uscita    date,
    carte_base     integer,
    carte_totali   integer,
    visto_il       timestamptz not null default now(),
    deciso_da      uuid references auth.users(id) on delete set null,
    deciso_il      timestamptz,
    nota           text
);
alter table public.catalogo_tcgdex enable row level security;
drop policy if exists "admin legge i set di tcgdex" on public.catalogo_tcgdex;
create policy "admin legge i set di tcgdex" on public.catalogo_tcgdex for select to authenticated using (is_admin());
revoke all on public.catalogo_tcgdex from anon;
grant select on public.catalogo_tcgdex to authenticated;

-- i set che abbiamo già
insert into public.catalogo_tcgdex (tcgdex_id, stato, nome_it, data_uscita, carte_base, carte_totali, nota)
select distinct on (e.tcgdex_id) e.tcgdex_id, 'nostro', e.nome, e.data_uscita, e.carte_base, e.carte_totali, 'già nel catalogo il 13/11/2026'
from public.set_espansioni e
where e.tcgdex_id is not null
order by e.tcgdex_id, (e.sigla ~ ':'), e.sigla
on conflict (tcgdex_id) do nothing;

-- quelli che TCGdex aveva il 13/11/2026 e non abbiamo: set vecchi già noti o TCG Pocket. Non vanno
-- proposti; se servono, si confermano a mano cambiando lo stato.
insert into public.catalogo_tcgdex (tcgdex_id, stato, nota)
select x, 'ignorato', 'su TCGdex il 13/11/2026, non nel catalogo: vecchio o TCG Pocket'
from unnest(array['miscp','wp','jumbo','gym1','gym2','si1','lc','sp','bog','ex5.5','ex7','ex16','pop6',
                  'pop8','pl3','ru1','tk-bw-z','tk-bw-e','rc','bw11','dc1','fut2020','mfb',
                  'A1','P-A','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a','B1','B1a','B2','B2a']) x
on conflict (tcgdex_id) do nothing;

-- ── 2. a che punto è il ricontrollo di ogni set ───────────────────────────────────────────────
create table if not exists public.catalogo_aggiornamenti (
    sigla          text primary key references public.set_espansioni(sigla) on update cascade on delete cascade,
    cursore        integer not null default 0,
    controllato_il timestamptz,
    fino_al        date,
    esito          text,
    aggiornato_il  timestamptz not null default now()
);
alter table public.catalogo_aggiornamenti enable row level security;
drop policy if exists "admin legge gli aggiornamenti del catalogo" on public.catalogo_aggiornamenti;
create policy "admin legge gli aggiornamenti del catalogo" on public.catalogo_aggiornamenti for select to authenticated using (is_admin());
revoke all on public.catalogo_aggiornamenti from anon;
grant select on public.catalogo_aggiornamenti to authenticated;

create table if not exists public.catalogo_giri (
    id      bigserial primary key,
    il      timestamptz not null default now(),
    tipo    text not null,
    esito   jsonb
);
alter table public.catalogo_giri enable row level security;
drop policy if exists "admin legge i giri del catalogo" on public.catalogo_giri;
create policy "admin legge i giri del catalogo" on public.catalogo_giri for select to authenticated using (is_admin());
revoke all on public.catalogo_giri from anon;
grant select on public.catalogo_giri to authenticated;
create index if not exists catalogo_giri_il_idx on public.catalogo_giri (il desc);

-- ── 3. il prossimo set da ricontrollare ───────────────────────────────────────────────────────
-- Uscito negli ultimi 120 giorni, oppure confermato da poco (fino_al), sigla senza i due punti.
-- Prima quello a metà (cursore > 0), poi quello mai controllato, poi il controllato da più tempo; un
-- set già controllato nelle ultime 20 ore non si ripete.
create or replace function public._catalogo_prossimo_set()
returns table (sigla text, tcgdex_id text, cursore integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
    select e.sigla, e.tcgdex_id, coalesce(a.cursore, 0)
    from public.set_espansioni e
    left join public.catalogo_aggiornamenti a on a.sigla = e.sigla
    where e.tcgdex_id is not null and e.lingua = 'INT' and e.sigla !~ ':'
      and (e.data_uscita >= current_date - 120 or a.fino_al >= current_date)
      and (coalesce(a.cursore, 0) > 0 or a.controllato_il is null or a.controllato_il < now() - interval '20 hours')
    order by (coalesce(a.cursore, 0) > 0) desc, (a.controllato_il is null) desc, a.controllato_il, e.data_uscita desc, e.sigla
    limit 1;
$function$;

-- ── 4. scrittura delle righe lette da TCGdex ──────────────────────────────────────────────────
-- p_righe: [{numero, variante, nome, rarita, immagine, cardmarket_id}, …]
-- Aggiunge le righe che mancano; su quelle che ci sono riempie solo i campi vuoti. Un numero di prodotto
-- già usato da un'altra carta del catalogo non si usa (regola della 138).
create or replace function public._catalogo_tcgdex_scrivi(p_sigla text, p_righe jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_nuove    integer := 0;
    v_complete integer := 0;
    v_n        integer;
begin
    if not exists (select 1 from public.set_espansioni where sigla = p_sigla) then
        raise exception 'Set % non nel catalogo', p_sigla;
    end if;

    create temp table if not exists _righe_tcgdex (numero integer, variante text, nome text, rarita text,
        immagine text, cardmarket_id bigint) on commit drop;
    truncate _righe_tcgdex;
    insert into _righe_tcgdex
    select distinct on ((r ->> 'numero')::integer, r ->> 'variante')
           (r ->> 'numero')::integer, r ->> 'variante', nullif(r ->> 'nome', ''), nullif(r ->> 'rarita', ''),
           case when r ->> 'immagine' ~ '^https://assets\.tcgdex\.net/[A-Za-z0-9._/-]+$' then r ->> 'immagine' end,
           nullif(r ->> 'cardmarket_id', '')::bigint
    from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) r
    where (r ->> 'numero') ~ '^[0-9]{1,4}$' and (r ->> 'numero')::integer > 0
      and (r ->> 'variante') ~ '^[a-z0-9][a-z0-9-]{0,60}$';

    -- numero di prodotto già di un'altra carta (nel catalogo o in questo stesso lotto): non si usa
    update _righe_tcgdex n set cardmarket_id = null
    where n.cardmarket_id is not null
      and (exists (select 1 from public.set_carte s
                   where (s.cardmarket_id = n.cardmarket_id or s.cardmarket_id_dubbio = n.cardmarket_id)
                     and (s.sigla, s.numero) <> (p_sigla, n.numero))
           or exists (select 1 from _righe_tcgdex x where x.cardmarket_id = n.cardmarket_id and x.numero <> n.numero));

    insert into public.set_carte (sigla, numero, variante, nome, rarita, immagine, cardmarket_id)
    select p_sigla, n.numero, n.variante, n.nome, n.rarita, n.immagine, n.cardmarket_id
    from _righe_tcgdex n
    on conflict (sigla, numero, variante) do nothing;
    get diagnostics v_nuove = row_count;

    update public.set_carte s
    set nome = coalesce(s.nome, n.nome),
        rarita = coalesce(s.rarita, n.rarita),
        immagine = coalesce(s.immagine, n.immagine),
        cardmarket_id = case when s.cardmarket_id is null and s.cardmarket_id_dubbio is null then n.cardmarket_id
                             else s.cardmarket_id end,
        aggiornato_il = now()
    from _righe_tcgdex n
    where s.sigla = p_sigla and s.numero = n.numero and s.variante = n.variante
      and ((s.nome is null and n.nome is not null) or (s.rarita is null and n.rarita is not null)
           or (s.immagine is null and n.immagine is not null)
           or (s.cardmarket_id is null and s.cardmarket_id_dubbio is null and n.cardmarket_id is not null));
    get diagnostics v_complete = row_count;

    select count(*) into v_n from _righe_tcgdex;
    return jsonb_build_object('lette', v_n, 'nuove', v_nuove, 'completate', v_complete);
end;
$function$;

create or replace function public._catalogo_segna(p_sigla text, p_cursore integer, p_finito boolean, p_esito text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
    insert into public.catalogo_aggiornamenti as a (sigla, cursore, controllato_il, esito, aggiornato_il)
    values (p_sigla, case when p_finito then 0 else p_cursore end, case when p_finito then now() end, p_esito, now())
    on conflict (sigla) do update
    set cursore = excluded.cursore,
        controllato_il = case when p_finito then now() else a.controllato_il end,
        esito = excluded.esito, aggiornato_il = now();
$function$;

-- ── 5. chiave tra il cron e la funzione sul server ────────────────────────────────────────────
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'catalogo_cron') then
        perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'catalogo_cron',
                                    'Chiave del giro notturno del catalogo (sql/140)');
    end if;
end $$;

create or replace function public._catalogo_cron_ok(p_segreto text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
    select coalesce(length(p_segreto) = 64 and p_segreto = (select decrypted_secret from vault.decrypted_secrets
                                                            where name = 'catalogo_cron' limit 1), false);
$function$;

-- funzioni del giro: solo la funzione sul server (chiave di servizio)
revoke all on function public._catalogo_prossimo_set() from public, anon, authenticated;
revoke all on function public._catalogo_tcgdex_scrivi(text, jsonb) from public, anon, authenticated;
revoke all on function public._catalogo_segna(text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public._catalogo_cron_ok(text) from public, anon, authenticated;
grant execute on function public._catalogo_prossimo_set() to service_role;
grant execute on function public._catalogo_tcgdex_scrivi(text, jsonb) to service_role;
grant execute on function public._catalogo_segna(text, integer, boolean, text) to service_role;
grant execute on function public._catalogo_cron_ok(text) to service_role;
grant select, insert, update on public.catalogo_tcgdex to service_role;
grant select, insert on public.catalogo_giri to service_role;
grant usage, select on sequence public.catalogo_giri_id_seq to service_role;

-- ── 6. conferma e scarto dalla pagina admin ───────────────────────────────────────────────────
create or replace function public.catalogo_set_conferma(p_tcgdex_id text, p_sigla text, p_nome text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_set public.catalogo_tcgdex%rowtype;
    v_sigla text := upper(btrim(coalesce(p_sigla, '')));
    v_nome  text := btrim(coalesce(p_nome, ''));
begin
    if not is_admin() then raise exception 'Solo un admin può confermare un set'; end if;
    select * into v_set from public.catalogo_tcgdex where tcgdex_id = p_tcgdex_id for update;
    if not found or v_set.stato <> 'da_confermare' then raise exception 'Set % non da confermare', p_tcgdex_id; end if;
    if v_sigla !~ '^[A-Z0-9][A-Z0-9-]{0,11}$' then
        raise exception 'Sigla non valida: lettere maiuscole, numeri e trattino, al massimo 12';
    end if;
    if v_nome = '' or length(v_nome) > 120 then raise exception 'Scrivi il nome del set'; end if;
    if exists (select 1 from public.set_espansioni where sigla = v_sigla) then
        raise exception 'La sigla % c''è già nel catalogo', v_sigla;
    end if;
    if coalesce(v_set.carte_totali, 0) <= 0 then raise exception 'TCGdex non dice quante carte ha il set'; end if;

    insert into public.set_espansioni (sigla, tcgdex_id, nome, carte_base, carte_totali, data_uscita, lingua, aggiornato_il)
    values (v_sigla, v_set.tcgdex_id, v_nome, v_set.carte_base, v_set.carte_totali, v_set.data_uscita, 'INT', now());
    insert into public.catalogo_aggiornamenti (sigla, fino_al)
    values (v_sigla, greatest(coalesce(v_set.data_uscita, current_date), current_date) + 120);
    update public.catalogo_tcgdex
    set stato = 'nostro', nome_it = v_nome, sigla_proposta = v_sigla, deciso_da = auth.uid(), deciso_il = now()
    where tcgdex_id = p_tcgdex_id;
end;
$function$;

create or replace function public.catalogo_set_ignora(p_tcgdex_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if not is_admin() then raise exception 'Solo un admin può scartare un set'; end if;
    update public.catalogo_tcgdex
    set stato = 'ignorato', deciso_da = auth.uid(), deciso_il = now(), nota = 'scartato dall''admin'
    where tcgdex_id = p_tcgdex_id and stato = 'da_confermare';
    if not found then raise exception 'Set % non da confermare', p_tcgdex_id; end if;
end;
$function$;

revoke all on function public.catalogo_set_conferma(text, text, text) from public, anon;
revoke all on function public.catalogo_set_ignora(text) from public, anon;
grant execute on function public.catalogo_set_conferma(text, text, text) to authenticated;
grant execute on function public.catalogo_set_ignora(text) to authenticated;

-- ── 7. il giro notturno: ogni 20 minuti dalle 1:00 alle 4:40 UTC (2–5 in Italia d'inverno) ─────
do $$
begin
    if exists (select 1 from cron.job where jobname = 'catalogo-tcgdex') then
        perform cron.unschedule('catalogo-tcgdex');
    end if;
    perform cron.schedule('catalogo-tcgdex', '*/20 1-4 * * *', $cron$
        select net.http_post(
            url := 'https://xpfibrzsffurdlypxnrw.supabase.co/functions/v1/catalogo-tcgdex',
            headers := jsonb_build_object('content-type', 'application/json',
                'x-bindex-segreto', (select decrypted_secret from vault.decrypted_secrets where name = 'catalogo_cron' limit 1)),
            body := '{}'::jsonb,
            timeout_milliseconds := 150000);
    $cron$);
end $$;

commit;

-- Controllo a occhio dopo l'esecuzione (non cambia niente):
select (select count(*) from public.catalogo_tcgdex where stato = 'nostro')   as set_nostri,
       (select count(*) from public.catalogo_tcgdex where stato = 'ignorato') as set_ignorati,
       (select schedule from cron.job where jobname = 'catalogo-tcgdex')       as orario,
       (select sigla from public._catalogo_prossimo_set())                     as primo_set_del_giro,
       (select nome || ' · ' || carte_totali from public.set_espansioni where sigla = 'B2') as b2;
