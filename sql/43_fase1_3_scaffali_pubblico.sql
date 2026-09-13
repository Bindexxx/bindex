-- ============================================================================
-- CardSync Pro — 43: Fase 1.3, Step 5c — Scaffali pubblici (link
-- condivisibile), RPC per scaffali-pubblico.html
--
-- Mirror di sql/22_binder_pubblico_generico.sql, ma STRUTTURALMENTE più
-- semplice: Scaffali non ha la biforcazione tipo='location'/tipo='extra'
-- dei Binder (niente location legacy) — un solo join via scaffale_prodotti
-- copre sia 'libero' sia 'vetrina'. Niente equivalente di
-- leggi_media_binder_pubblico: Scaffali non ha copertina/sleeve
-- personalizzate (Step 5b ridotto a solo tema CSS, vedi compilato).
--
-- GRANT: nessuno esplicito necessario — sql/17_grant_permessi_base.sql ha
-- già "alter default privileges in schema public grant execute on
-- functions to anon, authenticated", quindi ogni nuova funzione li
-- eredita di default (stesso motivo per cui sql/22 non ne aveva bisogno).
-- ============================================================================

create or replace function public.leggi_scaffale_pubblico_info(p_scaffale_id uuid)
returns table(nome text, tipo text, owner_id uuid)
language sql
security definer
set search_path to 'public'
as $$
    select s.nome, s.tipo, s.owner_id
    from public.scaffali s
    where s.id = p_scaffale_id and s.stato_pubblicazione = 'pubblico';
$$;


create or replace function public.leggi_scaffale_pubblico(p_scaffale_id uuid)
returns table(
    id uuid, nome text, codice text, set_espansione text, lingua text,
    integrita_packaging text, qty integer, prezzo numeric, note text, immagine text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_scaffale record;
begin
    select * into v_scaffale from public.scaffali where id = p_scaffale_id and stato_pubblicazione = 'pubblico';
    if v_scaffale is null then
        return; -- scaffale inesistente o non pubblico: nessuna riga, mai un errore che riveli la differenza
    end if;

    return query
    select p.id, p.nome, p.codice, p.set_espansione, p.lingua,
           p.integrita_packaging, p.qty, p.prezzo, p.note, p.immagine
    from public.prodotti_sealed p
    join public.scaffale_prodotti sp on sp.prodotto_id = p.id
    where sp.scaffale_id = p_scaffale_id
      and sp.owner_id = v_scaffale.owner_id
      and p.owner_id = v_scaffale.owner_id
      and p.stato = 'collezione'
    order by p.nome;
end;
$$;


-- Mirror di registra_apertura_binder_pubblico (sql/33) — evento missioni/
-- traguardi, fire-and-forget, mai un errore visibile al visitatore anonimo.
create or replace function public.registra_apertura_scaffale_pubblico(p_scaffale_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_owner_id uuid;
    v_pubblico boolean;
begin
    select owner_id, (stato_pubblicazione = 'pubblico')
    into v_owner_id, v_pubblico
    from public.scaffali where id = p_scaffale_id;

    if v_owner_id is null or not v_pubblico then
        return; -- silenzioso: nessun errore visibile al visitatore anonimo
    end if;

    insert into public.activity_log (user_id, source, action, details)
    values (v_owner_id, 'scaffale-pubblico', 'aperto', jsonb_build_object('scaffale_id', p_scaffale_id));
end;
$$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- select proname from pg_proc where proname in (
--   'leggi_scaffale_pubblico_info', 'leggi_scaffale_pubblico',
--   'registra_apertura_scaffale_pubblico'
-- );
-- -- devono comparire tutte e 3
