-- 146 — Controllo mensile delle foto nuove su TCGdex per i set asiatici (13/11/2026).
-- Decisione di Claudio del 13/11/2026: per le carte asiatiche ancora senza miniatura si guarda una volta
-- al mese se TCGdex ha aggiunto la foto, nella lingua della carta. Niente Cardmarket, niente siti ufficiali.
--
-- Regola di prudenza: si prende una foto SOLO se l'API di TCGdex la elenca (campo "image" della carta).
-- Le foto che stanno sul server ma non nell'API non si prendono da sole: per M1S sono risultate sbagliate
-- (sql/145). Quelle si controllano a mano.
--
-- Come funziona (tutto dentro il DB, nessuna Edge Function):
--   il giorno 1 di ogni mese alle 3:17 UTC _catalogo_foto_chiedi() chiede a TCGdex la lista delle carte
--   di ogni set in catalogo_foto_fonti (pg_net, una richiesta per set: 38 richieste);
--   alle 3:47 UTC _catalogo_foto_leggi() legge le risposte e scrive la foto sulle righe senza miniatura
--   il cui numero di codice ("S8B 001" → 1) compare una sola volta nel set (le versioni con lo stesso
--   numero restano senza: la foto sarebbe di un'altra versione).
--   Ogni richiesta e il suo esito restano in catalogo_foto_giri (lettura solo admin).
--
-- Verificato sul DB il 13/11/2026: pg_cron e pg_net installati (pg_net.ttl = 6 ore, le risposte restano
-- 6 ore: la lettura avviene dopo 30 minuti); unico job esistente "catalogo-tcgdex"; nessun trigger su
-- set_carte; nessuna riga asiatica senza codice; 144 e 145 eseguite (2.728 foto TCGdex giapponesi).
-- Rollback: 146_catalogo_foto_controllo_mensile_ROLLBACK.sql (le foto già scritte restano; per toglierle
-- c'è la query in fondo al rollback).

begin;

-- ── 1. da dove prendere le foto di ogni set (solo set di cui TCGdex ha la lista carte nella lingua) ─────
create table if not exists public.catalogo_foto_fonti (
    sigla          text primary key references public.set_espansioni(sigla) on delete cascade,
    lingua_tcgdex  text not null check (lingua_tcgdex in ('ja', 'ko', 'zh-tw', 'zh-cn')),
    set_tcgdex     text not null
);
alter table public.catalogo_foto_fonti enable row level security;
drop policy if exists "admin legge le fonti delle foto" on public.catalogo_foto_fonti;
create policy "admin legge le fonti delle foto" on public.catalogo_foto_fonti for select to authenticated using (is_admin());
revoke all on public.catalogo_foto_fonti from anon;
grant select on public.catalogo_foto_fonti to authenticated;

insert into public.catalogo_foto_fonti (sigla, lingua_tcgdex, set_tcgdex)
select v.sigla, v.lingua, v.set_tcgdex
from (values
    -- giapponese
    ('SV2A@JP', 'ja', 'SV2a'), ('S12A@JP', 'ja', 'S12a'), ('SV4A@JP', 'ja', 'SV4a'), ('S12@JP', 'ja', 'S12'),
    ('S9A@JP', 'ja', 'S9a'), ('SV10@JP', 'ja', 'SV10'), ('SV3@JP', 'ja', 'SV3'), ('SV7A@JP', 'ja', 'SV7a'),
    ('SV8A@JP', 'ja', 'SV8a'), ('S8B@JP', 'ja', 'S8b'), ('M1L@JP', 'ja', 'M1L'), ('M1S@JP', 'ja', 'M1S'),
    ('S10B@JP', 'ja', 'S10b'), ('S10D@JP', 'ja', 'S10D'), ('S1W@JP', 'ja', 'S1W'), ('S5R@JP', 'ja', 'S5R'),
    ('SM10@JP', 'ja', 'SM10'), ('SM4A@JP', 'ja', 'SM4A'), ('S4A@JP', 'ja', 'S4a'), ('S8A@JP', 'ja', 'S8a'),
    ('SV11B@JP', 'ja', 'SV11B'), ('M-P@JP', 'ja', 'M-P'),
    -- cinese tradizionale
    ('S12@CHN-T', 'zh-tw', 'S12'),
    -- coreano
    ('S12A@KOR', 'ko', 'S12a'), ('SV2A@KOR', 'ko', 'SV2a'), ('SV3@KOR', 'ko', 'SV3'),
    ('S1H@KOR', 'ko', 'S1H'), ('S6K@KOR', 'ko', 'S6K'),
    -- cinese semplificato
    ('CS3AC@CHN', 'zh-cn', 'CS3aC'), ('CS3BC@CHN', 'zh-cn', 'CS3bC'), ('CS4AC@CHN', 'zh-cn', 'CS4aC'),
    ('CS5AC@CHN', 'zh-cn', 'CS5aC'), ('CS5BC@CHN', 'zh-cn', 'CS5bC'), ('CS6BC@CHN', 'zh-cn', 'CS6bC'),
    ('CSV1C@CHN', 'zh-cn', 'CSV1C'), ('CBB2C@CHN', 'zh-cn', 'CBB2C'), ('CBB3C@CHN', 'zh-cn', 'CBB3C'),
    ('CSV9.5C@CHN', 'zh-cn', 'CSV9.5C')
) v(sigla, lingua, set_tcgdex)
where exists (select 1 from public.set_espansioni e where e.sigla = v.sigla)
on conflict (sigla) do update set lingua_tcgdex = excluded.lingua_tcgdex, set_tcgdex = excluded.set_tcgdex;

-- ── 2. registro delle richieste e degli esiti ──────────────────────────────────────────────────────
create table if not exists public.catalogo_foto_giri (
    id          bigserial primary key,
    sigla       text not null,
    richiesta   bigint not null,           -- id della richiesta pg_net
    inviata_il  timestamptz not null default now(),
    letta_il    timestamptz,
    esito       text,                      -- 'ok', 'http 404', 'nessuna risposta', ...
    con_foto    integer,                   -- carte con foto nella lista di TCGdex
    foto_nuove  integer                    -- righe del catalogo che hanno preso la foto
);
alter table public.catalogo_foto_giri enable row level security;
drop policy if exists "admin legge i giri delle foto" on public.catalogo_foto_giri;
create policy "admin legge i giri delle foto" on public.catalogo_foto_giri for select to authenticated using (is_admin());
revoke all on public.catalogo_foto_giri from anon;
grant select on public.catalogo_foto_giri to authenticated;
create index if not exists catalogo_foto_giri_aperti_idx on public.catalogo_foto_giri (inviata_il) where letta_il is null;

-- ── 3. chiedi: una richiesta per set ───────────────────────────────────────────────────────────────
create or replace function public._catalogo_foto_chiedi()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    f record;
    n integer := 0;
begin
    for f in select * from public.catalogo_foto_fonti order by sigla loop
        insert into public.catalogo_foto_giri (sigla, richiesta)
        values (f.sigla, net.http_get(
            'https://api.tcgdex.net/v2/' || f.lingua_tcgdex || '/sets/' || f.set_tcgdex,
            timeout_milliseconds := 30000));
        n := n + 1;
    end loop;
    return n;
end;
$function$;

-- ── 4. leggi: scrive le foto elencate da TCGdex sulle righe ancora senza ───────────────────────────
create or replace function public._catalogo_foto_leggi()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    g record;
    r record;
    v_cards jsonb;
    v_con integer;
    v_nuove integer;
    v_totale integer := 0;
begin
    for g in select * from public.catalogo_foto_giri where letta_il is null order by id loop
        select status_code, content into r from net._http_response where id = g.richiesta;
        if not found then
            -- risposta non (ancora) arrivata: dopo 3 ore si chiude il giro
            if g.inviata_il < now() - interval '3 hours' then
                update public.catalogo_foto_giri set letta_il = now(), esito = 'nessuna risposta' where id = g.id;
            end if;
            continue;
        end if;
        if r.status_code is distinct from 200 then
            update public.catalogo_foto_giri set letta_il = now(), esito = 'http ' || coalesce(r.status_code::text, '?') where id = g.id;
            continue;
        end if;

        begin
            v_cards := coalesce(r.content::jsonb -> 'cards', '[]'::jsonb);
        exception when others then
            update public.catalogo_foto_giri set letta_il = now(), esito = 'risposta non leggibile' where id = g.id;
            continue;
        end;

        with foto as (
            select ltrim(c ->> 'localId', '0')::integer as n, c ->> 'image' as base
            from jsonb_array_elements(v_cards) c
            where c ? 'image'
              and (c ->> 'localId') ~ '^[0-9]+$'
              and (c ->> 'image') ~ '^https://assets\.tcgdex\.net/'
        ),
        righe as (
            select s.sigla, s.numero, s.variante, split_part(s.codice, ' ', 2)::integer as n,
                   count(*) over (partition by split_part(s.codice, ' ', 2)::integer) as quante
            from public.set_carte s
            where s.sigla = g.sigla and s.codice ~ '^\S+ [0-9]+$'
        ),
        scritte as (
            update public.set_carte s
               set immagine = f.base || '/low.webp', aggiornato_il = now()
              from righe x join foto f on f.n = x.n
             where x.quante = 1
               and s.sigla = x.sigla and s.numero = x.numero and s.variante = x.variante
               and s.immagine is null
            returning 1
        )
        select (select count(*) from foto), (select count(*) from scritte) into v_con, v_nuove;

        update public.catalogo_foto_giri
           set letta_il = now(), esito = 'ok', con_foto = v_con, foto_nuove = v_nuove
         where id = g.id;
        v_totale := v_totale + v_nuove;
    end loop;
    return v_totale;
end;
$function$;

revoke all on function public._catalogo_foto_chiedi() from public, anon, authenticated;
revoke all on function public._catalogo_foto_leggi() from public, anon, authenticated;

-- ── 5. i due appuntamenti: giorno 1 del mese, 3:17 e 3:47 UTC ──────────────────────────────────────
do $$
begin
    if exists (select 1 from cron.job where jobname = 'catalogo-foto-chiedi') then
        perform cron.unschedule('catalogo-foto-chiedi');
    end if;
    if exists (select 1 from cron.job where jobname = 'catalogo-foto-leggi') then
        perform cron.unschedule('catalogo-foto-leggi');
    end if;
    perform cron.schedule('catalogo-foto-chiedi', '17 3 1 * *', 'select public._catalogo_foto_chiedi()');
    perform cron.schedule('catalogo-foto-leggi', '47 3 1 * *', 'select public._catalogo_foto_leggi()');
end $$;

commit;

-- Controllo a occhio dopo l'esecuzione (non cambia niente):
select (select count(*) from public.catalogo_foto_fonti) as set_controllati,
       (select string_agg(jobname || ' ' || schedule, ' · ') from cron.job where jobname like 'catalogo-foto-%') as appuntamenti;
