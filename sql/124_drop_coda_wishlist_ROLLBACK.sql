-- ============================================================================
-- 124 ROLLBACK — coda_wishlist e admin_hard_delete_user com'erano il
-- 2026-10-28 (prima di sql/124). Struttura letta sul DB live: colonne, valori
-- predefiniti, chiavi, RLS, policy, permessi e owner. Righe: nessuna (era vuota).
-- ============================================================================

begin;

create table public.coda_wishlist (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  nome text not null,
  lingua text default 'IT'::text,
  condizione text default 'NM'::text,
  qty integer default 1,
  reverse boolean default false,
  first_ed boolean default false,
  nota text,
  prezzo_obiettivo numeric,
  stato text not null default 'pending'::text,
  creato_il timestamp with time zone default now(),
  claimed_by uuid,
  claimed_at timestamp with time zone,
  completato_il timestamp with time zone,
  errore_msg text,
  location text default 'WISHLIST'::text,
  tipo text,
  dispositivo text,
  constraint coda_wishlist_pkey primary key (id),
  constraint coda_wishlist_owner_id_fkey foreign key (owner_id) references auth.users(id),
  constraint coda_wishlist_claimed_by_fkey foreign key (claimed_by) references auth.users(id)
);
alter table public.coda_wishlist owner to postgres;
alter table public.coda_wishlist enable row level security;

create policy "utenti gestiscono la propria coda_wishlist" on public.coda_wishlist
  as permissive for select to authenticated using ((select auth.uid() as uid) = owner_id);
create policy "utenti inseriscono nella propria coda_wishlist" on public.coda_wishlist
  as permissive for insert to authenticated with check ((select auth.uid() as uid) = owner_id);
create policy "utenti aggiornano la propria coda_wishlist" on public.coda_wishlist
  as permissive for update to authenticated using ((select auth.uid() as uid) = owner_id);

-- Permessi com'erano (i predefiniti dello schema potrebbero darne altri).
revoke all on public.coda_wishlist from anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger on public.coda_wishlist to anon, authenticated;
grant truncate, references, trigger on public.coda_wishlist to service_role;

create or replace function public.admin_hard_delete_user(p_target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;
  if p_target = auth.uid() then
    raise exception 'Non puoi eliminare il tuo stesso account';
  end if;
  perform public.log_admin_action('hard_delete', p_target, null);

  -- 1. Scambi (le righe cadono in cascata dalla richiesta; poi gli avanzi)
  delete from public.richieste_scambio where proprietario_id = p_target or richiedente_id = p_target;
  delete from public.richieste_scambio_righe where proprietario_id = p_target or richiedente_id = p_target;

  -- 2. Dati propri (colonne NOT NULL) — figli prima dei padri
  delete from public.binder_carte where owner_id = p_target;
  delete from public.scaffale_prodotti where owner_id = p_target;
  delete from public.foto_carte where owner_id = p_target;
  delete from public.user_media where user_id = p_target;
  delete from public.carte where owner_id = p_target;
  delete from public.prodotti_sealed where owner_id = p_target;
  delete from public.wishlist where owner_id = p_target;
  delete from public.wishlist_sealed where owner_id = p_target;
  delete from public.location where owner_id = p_target;
  delete from public.preferenze_utente where owner_id = p_target;
  delete from public.missioni_completate where owner_id = p_target;
  delete from public.traguardi_riscossi where owner_id = p_target;
  delete from public.inventario_ricompense where owner_id = p_target;
  delete from public.bustina_carte_possedute where owner_id = p_target;
  delete from public.achievement_sbloccati where owner_id = p_target;
  delete from public.segnalazioni_bug where owner_id = p_target;
  delete from public.activity_log where user_id = p_target;
  delete from public.worker_presenza where user_id = p_target;
  delete from public.coda_lavoro where creato_da = p_target;
  delete from public.coda_wishlist where owner_id = p_target;

  -- 3. Tracce su righe altrui (colonne nullable) — la riga resta
  update public.admin_audit_log set admin_id = null where admin_id = p_target;
  update public.chat_restrizioni_utente set impostato_da = null where impostato_da = p_target;
  update public.coda_lavoro set claimed_by = null where claimed_by = p_target;
  update public.coda_wishlist set claimed_by = null where claimed_by = p_target;
  update public.ordini set creato_da = null where creato_da = p_target;
  update public.ordini set preso_in_carico_da = null where preso_in_carico_da = p_target;
  update public.pending_requests set user_id = null where user_id = p_target;
  update public.pending_requests set reviewed_by = null where reviewed_by = p_target;
  update public.user_media set reviewed_by = null where reviewed_by = p_target;
  update public.work_in_progress set attivato_da = null where attivato_da = p_target;

  -- 4. Profilo e utente (il resto va in cascata)
  delete from public.profiles where id = p_target;
  delete from auth.users where id = p_target;
end;
$function$;


commit;
