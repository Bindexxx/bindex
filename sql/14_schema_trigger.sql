-- ============================================================================
-- CardSync Pro — 14: Trigger (agganciano le funzioni di 13 alle tabelle).
-- Mappa tabella→trigger→funzione verificata via information_schema.triggers
-- sul DB reale. Da eseguire dopo 13.
-- ============================================================================

create trigger trg_carte_updated_at
  before update on public.carte
  for each row execute function public.aggiorna_updated_at();

create trigger trg_storico_prezzo_carte
  after insert or update on public.carte
  for each row execute function public._cardsync_registra_storico_prezzo();

create trigger trg_traccia_prezzo_precedente
  before update on public.carte
  for each row execute function public._cardsync_traccia_prezzo_precedente();

create trigger trg_storico_prezzo_wishlist
  after insert or update on public.wishlist
  for each row execute function public._cardsync_registra_storico_prezzo();

create trigger trg_traccia_prezzo_precedente_wishlist
  before update on public.wishlist
  for each row execute function public._cardsync_traccia_prezzo_precedente();

-- I 3 trigger INSTEAD OF sulla view coda_carte sono già creati da
-- 11_schema_correzioni_manuali_carte.sql insieme alla view stessa — non
-- ripeterli qui.

-- ── DEDOTTO, non confermato da query diretta su schema auth ──────────
-- Pattern standard Supabase: crea la riga in public.profiles quando nasce
-- un nuovo utente in auth.users. La funzione handle_new_user() (in 13)
-- corrisponde esattamente a questo scopo. Verifica dopo l'esecuzione che
-- un nuovo utente via Dashboard > Authentication > Add user generi
-- automaticamente una riga in profiles.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
