-- ROLLBACK di sql/112: regole e permessi di ordini come prima (letti sul DB
-- il 2026-10-15): UPDATE using (true) senza with check, INSERT con il solo
-- creato_da = auth.uid(), tutti i privilegi a anon e authenticated.
-- Contiene REVOKE: da eseguire nell'SQL editor di Supabase.
alter policy "ordini: modifica se in attesa o preso in carico da me" on public.ordini
  rename to "utenti autenticati possono aggiornare ordini";
alter policy "utenti autenticati possono aggiornare ordini" on public.ordini
  using (true)
  with check (true);

alter policy "ordini: creazione solo propri e in attesa" on public.ordini
  rename to "utenti autenticati possono creare ordini";
alter policy "utenti autenticati possono creare ordini" on public.ordini
  with check (( SELECT auth.uid() AS uid) = creato_da);

-- I privilegi per colonna vanno tolti prima di ridare quelli di tabella.
revoke update (stato, preso_in_carico_da, preso_in_carico_il, completato_il, risultato, errore_msg)
  on table public.ordini from authenticated;
grant all on table public.ordini to anon, authenticated;

-- Verifica
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'ordini' order by cmd;
