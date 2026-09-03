-- ============================================================================
-- CardSync Pro — 35: correzioni di sicurezza (audit 2026-09-01)
--
-- LEGGI PRIMA DI ESEGUIRE. Questo file NON è pensato per essere lanciato
-- tutto insieme al primo colpo: è diviso in PASSI, in ordine di rischio
-- crescente. I passi 0 e 1 sono innocui. Il passo 2 e il passo 3 possono
-- rompere l'estensione se le assunzioni scritte qui sotto non valgono, e
-- ognuno dei due dice esattamente cosa verificare prima.
--
-- Problemi affrontati:
--   A2 — la vista public.coda_carte scavalca la Row Level Security della
--        tabella coda_lavoro, e i due trigger che la rendono scrivibile non
--        controllano di chi sia la riga.
--   A6 — le policy del bucket 'immagini-carte' non verificano la cartella
--        del proprietario: qualunque utente autenticato può sovrascrivere
--        i file di chiunque.
-- ============================================================================


-- ============================================================================
-- PASSO 0 — DIAGNOSI (non modifica niente, esegui e leggi i risultati)
-- ============================================================================

-- 0.1 — Chi possiede la vista, e ha già security_invoker?
--       Se 'viewowner' è postgres/supabase_admin e reloptions NON contiene
--       security_invoker=true, allora A2 è confermato: chiunque abbia la
--       chiave pubblica può leggere la coda di tutti.
select v.viewname, v.viewowner, c.reloptions
from pg_views v
join pg_class c on c.relname = v.viewname
where v.viewname = 'coda_carte';

-- 0.2 — Quante righe di coda esistono e di quanti proprietari diversi:
--       serve per capire, dopo il passo 2, se la vista continua a mostrarti
--       quello che ti aspetti.
select count(*) as righe_totali, count(distinct creato_da) as proprietari
from public.coda_lavoro
where tipo in ('aggiungi_carta', 'aggiungi_wishlist');

-- 0.3 — Come sono organizzati i percorsi in 'immagini-carte'.
--       SERVE PRIMA DEL PASSO 3: se il primo pezzo del percorso NON è
--       l'id dell'utente (formato UUID), il passo 3 va adattato o saltato,
--       altrimenti l'estensione non riuscirà più a caricare le immagini.
select name,
       split_part(name, '/', 1) as prima_cartella,
       (split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$') as sembra_un_id_utente
from storage.objects
where bucket_id = 'immagini-carte'
limit 20;


-- ============================================================================
-- PASSO 1 — CHIUDE LA PORTA AGLI ANONIMI (rischio nullo, esegui pure)
-- ============================================================================
-- Il sito non tocca MAI la coda senza login: l'unica operazione è
-- l'inserimento dalla pagina Inserimento, che richiede una sessione attiva
-- (vedi salvaCarteReali in ui/entry.ui.js, che esce subito se manca
-- l'utente). Il ruolo 'anon' non ha quindi alcun motivo di accedere a
-- questa vista, mentre oggi ce l'ha per via del GRANT generico su tutte le
-- tabelle in 17_grant_permessi_base.sql.
--
-- Da solo questo passo declassa A2 da "chiunque su internet, con la chiave
-- pubblica che sta nel repository" a "solo i membri del gruppo, tra loro".
revoke all on public.coda_carte from anon;

-- Stessa cosa sulla tabella reale sottostante, per coerenza.
revoke all on public.coda_lavoro from anon;


-- ============================================================================
-- PASSO 2 — LA VISTA RISPETTA LA RLS  ⚠️ VERIFICA PRIMA
-- ============================================================================
-- Cosa cambia: da qui in poi, leggere public.coda_carte applica le policy
-- di coda_lavoro, cioè "vede le proprie richieste" (creato_da = auth.uid()).
-- Ogni utente vedrà SOLO le proprie righe, non più quelle di tutti.
--
-- ⚠️ RISCHIO — DA VERIFICARE PRIMA DI ESEGUIRE:
-- Il sito non legge mai questa vista (fa solo insert), quindi per il SITO
-- questo passo è a rischio zero. Ma il worker dell'estensione
-- (aggiungi_carta_popup.js) NON è in questo repository e deve poter vedere
-- le righe in attesa DEGLI ALTRI per lavorarle al posto loro — è tutto il
-- senso di "Aiuta il gruppo".
--
-- Apri quel file e cerca 'coda_carte':
--   • se il worker chiama le funzioni reclama_lavoro() /
--     conta_lavoro_pendente() → sono SECURITY DEFINER, continuano a
--     funzionare: esegui pure questo passo;
--   • se invece fa una select diretta su coda_carte per trovare il lavoro
--     del gruppo → NON eseguire questo passo così com'è: smetterebbe di
--     vedere le righe altrui. Servirebbe prima spostare quella lettura su
--     una funzione dedicata, ed è un lavoro a sé.
--
-- Per annullare questo passo:
--   alter view public.coda_carte set (security_invoker = false);

-- alter view public.coda_carte set (security_invoker = true);


-- ============================================================================
-- PASSO 3 — I TRIGGER CONTROLLANO CHI STA SCRIVENDO  ⚠️ VERIFICA PRIMA
-- ============================================================================
-- Oggi _coda_carte_view_update e _coda_carte_view_delete sono SECURITY
-- DEFINER (girano con i permessi del proprietario, quindi ignorano la RLS)
-- e agiscono su "where id = old.id" senza mai chiedersi chi stia chiedendo.
-- Il gemello in inserimento invece il controllo ce l'ha:
--     if new.owner_id is distinct from auth.uid() then raise exception ...
--
-- La difficoltà è che l'aggiornamento NON può essere ristretto al solo
-- proprietario: il PC che aiuta il gruppo deve poter scrivere l'esito sulle
-- righe altrui. La soluzione qui sotto distingue i due casi:
--   • il PROPRIETARIO può modificare la propria riga come vuole;
--   • un ALTRO utente autenticato può toccare solo i campi di lavorazione
--     (stato, claimed_by, claimed_at, completato_il, tentativi_falliti,
--     errore_msg, esito) e NON può riscrivere il contenuto della carta
--     (nome, url_diretto) né cancellare la riga.
--
-- ⚠️ VERIFICA PRIMA: se il worker, finito il lavoro, riscrive anche 'nome'
-- o 'url_diretto' sulle righe altrui (per esempio per normalizzare il nome
-- trovato su Cardmarket), questa versione glielo impedirà. In quel caso
-- togli 'nome' e 'url_diretto' dall'elenco dei campi protetti più sotto.

-- create or replace function public._coda_carte_view_update()
--  returns trigger
--  language plpgsql
--  security definer
--  set search_path = public          -- mancava: vedi nota nel passo 4
-- as $function$
-- declare
--   v_proprietario uuid;
-- begin
--   select creato_da into v_proprietario from coda_lavoro where id = old.id;
--   if v_proprietario is null then
--     raise exception 'riga di coda inesistente';
--   end if;
--
--   -- Chi non è il proprietario sta "aiutando il gruppo": può aggiornare
--   -- lo stato della lavorazione, non il contenuto della richiesta.
--   if v_proprietario is distinct from auth.uid() then
--     if new.nome is distinct from old.nome
--        or new.url_diretto is distinct from old.url_diretto then
--       raise exception 'solo il proprietario puo modificare il contenuto della riga';
--     end if;
--   end if;
--
--   update coda_lavoro set
--     stato          = coalesce(new.stato, stato),
--     errore_msg     = new.errore_msg,
--     claimed_by     = new.claimed_by,
--     claimed_at     = new.claimed_at,
--     completato_il  = new.completato_il,
--     tentativi_falliti = coalesce(new.tentativi_falliti, tentativi_falliti),
--     esito          = case when new.opzioni_disambiguazione is not null
--                           then jsonb_build_object('opzioni_disambiguazione', new.opzioni_disambiguazione)
--                           else esito end,
--     payload        = payload || jsonb_strip_nulls(jsonb_build_object('nome', new.nome, 'url_diretto', new.url_diretto))
--   where id = old.id;
--   return new;
-- end;
-- $function$;

-- La cancellazione invece resta al solo proprietario (o a un admin):
-- nessun automatismo del gruppo ha motivo di cancellare le righe altrui.
-- create or replace function public._coda_carte_view_delete()
--  returns trigger
--  language plpgsql
--  security definer
--  set search_path = public
-- as $function$
-- declare
--   v_proprietario uuid;
-- begin
--   select creato_da into v_proprietario from coda_lavoro where id = old.id;
--   if v_proprietario is distinct from auth.uid() and not is_admin() then
--     raise exception 'puoi cancellare solo le tue righe di coda';
--   end if;
--   delete from coda_lavoro where id = old.id;
--   return old;
-- end;
-- $function$;


-- ============================================================================
-- PASSO 4 — search_path fisso sulle funzioni che ne sono prive
-- ============================================================================
-- Una funzione SECURITY DEFINER senza search_path fisso può essere
-- ingannata: chi riesce a creare una tabella o una funzione con lo stesso
-- nome in uno schema che viene cercato prima di 'public' fa eseguire il
-- proprio codice con i permessi del proprietario della funzione. Nel
-- progetto oltre trenta funzioni lo impostano già correttamente; queste no.
--
-- _coda_carte_view_insert lo si sistema qui; update e delete lo ricevono
-- già dal passo 3 (sono riscritte per intero lì).
alter function public._coda_carte_view_insert() set search_path = public;

-- Queste tre sembrano la versione VECCHIA del meccanismo di coda,
-- sostituita da completa_riga_coda_carte / conta_carte_da_controllare_gruppo
-- / reclama_carte_per_controllo_prezzi (che invece il search_path ce
-- l'hanno). Se sul database non esistono più, le tre righe daranno errore
-- "function does not exist": in quel caso è una buona notizia, saltale.
-- Se esistono ancora, vale la pena chiedersi se qualcosa le usi davvero.
alter function public.completa_lavoro(uuid, jsonb) set search_path = public;
alter function public.conta_lavoro_pendente() set search_path = public;
alter function public.reclama_lavoro(text) set search_path = public;


-- ============================================================================
-- PASSO 5 — A6: le immagini carte non sono più sovrascrivibili da chiunque
-- ============================================================================
-- ⚠️ ESEGUI SOLO SE il passo 0.3 ha mostrato che la prima cartella del
-- percorso è l'id dell'utente. Altrimenti il caricamento delle immagini
-- dall'estensione smette di funzionare.
--
-- Oggi le due policy di scrittura controllano soltanto il bucket, quindi
-- qualunque utente autenticato può sovrascrivere il file di chiunque
-- altro. Le policy di 'user-media' e 'foto-carte', nello stesso file,
-- fanno già la cosa giusta: si allineano a quelle.

-- drop policy if exists "utenti autenticati caricano immagini carte" on storage.objects;
-- create policy "utenti caricano le proprie immagini carte"
-- on storage.objects for insert
-- to authenticated
-- with check (
--   bucket_id = 'immagini-carte'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- drop policy if exists "utenti autenticati sovrascrivono immagini carte" on storage.objects;
-- create policy "utenti sostituiscono le proprie immagini carte"
-- on storage.objects for update
-- to authenticated
-- using (
--   bucket_id = 'immagini-carte'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );


-- ============================================================================
-- PASSO 6 — FACOLTATIVO: foto dettaglio non più elencabili da chiunque
-- ============================================================================
-- Il bucket 'foto-carte' è pubblico e la sua policy di lettura non pone
-- condizioni, quindi chiunque (anche senza account) può elencare e
-- scaricare le foto di dettaglio di tutti. Se sono solo foto di carte
-- probabilmente va bene così — è una scelta tua, non un difetto.
--
-- Se preferisci restringerle ai soli utenti con un account, sostituisci la
-- policy. ATTENZIONE: le foto smetteranno di essere visibili tramite link
-- pubblico diretto, e il sito dovrà passare a link firmati
-- (storageFotoCartePublicUrl in data/photos.repository.js va cambiata in
-- una createSignedUrl, stesso schema già usato per 'user-media').
-- Non farlo senza aggiornare anche quel file.

-- drop policy if exists "chiunque puo vedere le foto dettaglio (bucket pubblico)" on storage.objects;
-- create policy "utenti autenticati vedono le foto dettaglio"
-- on storage.objects for select
-- to authenticated
-- using (bucket_id = 'foto-carte');


-- ============================================================================
-- PASSO 7 — VERIFICA DOPO L'ESECUZIONE
-- ============================================================================

-- 7.1 — Da loggato, questa deve restituire SOLO le tue righe (dopo il passo 2):
-- select count(*), count(distinct owner_id) from public.coda_carte;

-- 7.2 — Inserimento: dalla pagina Inserimento del sito, salva una carta di
--       prova. Deve funzionare come prima (il trigger di insert non è stato
--       toccato).

-- 7.3 — Controllo prezzi di gruppo: fai partire un controllo prezzi con
--       "aiuta il gruppo" attivo da un PC con l'estensione, e verifica che
--       le righe altrui vengano ancora lavorate. È il test che conta di più
--       dopo i passi 2 e 3.
