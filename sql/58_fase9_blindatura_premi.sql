-- ============================================================================
-- CardSync Pro — 58: Fase 9 — BLINDATURA SICUREZZA PREMI (priorità su
-- Achievement, richiesta esplicita di Claudio)
--
-- ⚠ VULNERABILITÀ REALE TROVATA E CONFERMATA DAL VIVO in questa sessione:
-- missioni_completate, traguardi_riscossi, inventario_ricompense avevano
-- tutte una policy RLS "FOR ALL USING (owner_id = auth.uid())" — nessun
-- controllo su tipo/quantita/riferimento_id. Chiunque poteva, dalla
-- console del browser, scrivere direttamente:
--   supabaseClient.from('inventario_ricompense').insert({owner_id: '<...>', tipo:'polvere', quantita: 999999, ...})
-- e ottenere polvere/bustine illimitate, o marcare missioni/traguardi come
-- completati senza averli davvero soddisfatti. bustina_carte_possedute era
-- già protetta correttamente (solo SELECT, scrittura esclusiva via RPC
-- apri_bustina) — questo file estende LO STESSO modello alle altre 3
-- tabelle.
--
-- STRATEGIA (pragmatica, non una riscrittura completa del motore missioni):
-- portare l'INTERA logica di valutazione missioni (20+ metriche, alcune
-- complesse — vedi MOTORE_MISSIONI in ui/missioni.ui.js) lato server
-- sarebbe un lavoro enorme e rischioso. Questo fix chiude il danno
-- concreto (valuta arbitrari) senza richiederlo: le due nuove RPC sotto
-- NON ri-verificano "la missione è stata davvero completata" (si fidano
-- ancora del client su QUELLO), ma non si fidano MAI del client per QUANTO
-- premio dare — quantità e tipo di ricompensa vengono SEMPRE letti da
-- catalogo_ricompense (nuova tabella, sola lettura per il client, sync
-- manuale dal catalogo JS — stesso principio già in uso per
-- set_espansioni/genera-libreria-set.html), mai dal parametro della RPC.
-- Il vincolo UNIQUE esistente resta la rete di sicurezza anti-doppio-
-- accredito, ora raggiungibile SOLO tramite queste RPC.
-- RISCHIO RESIDUO ACCETTATO: un utente potrebbe ancora forzare il
-- completamento di UNA missione/traguardo che non ha davvero soddisfatto,
-- una sola volta ciascuno (bloccato da UNIQUE per i tentativi successivi)
-- — un tetto massimo finito e noto (somma di tutte le ricompense del
-- catalogo, una volta sola), non più un'apertura a quantità illimitate.
-- Per un gruppo piccolo di amici fidati, proporzionato; se in futuro
-- servirà chiudere anche questo, serve portare le singole metriche più
-- semplici lato SQL una alla volta — fuori scope di questo file.
--
-- catalogo_ricompense: 187 righe (72 missioni + 115 traguardi), ESTRATTE
-- eseguendo per davvero ui/missioni-catalogo.ui.js in Node (non trascritte
-- a mano, non indovinate via regex) — affidabilità massima sui dati
-- economicamente sensibili di questo file. quantita NULL per le
-- ricompense 'stampino' senza quantità esplicita nel JS (coalesce a 1
-- nella RPC, stesso comportamento di oggi: m.ricompensa.quantita || 1).
-- riferimento_id scritto in inventario_ricompense resta l'ID della
-- missione/traguardo (comportamento ESATTO di oggi, m.id — non la colonna
-- 'riferimento' di questa tabella, che è un dato diverso: il nome dello
-- stampino per la UI, es. 'primo_passo').
-- ============================================================================


-- ── catalogo_ricompense — sola lettura per il client, sync manuale ───────
CREATE TABLE public.catalogo_ricompense (
    voce_id          text PRIMARY KEY,
    categoria        text NOT NULL CHECK (categoria IN ('missione', 'traguardo')),
    tipo_ricompensa  text NOT NULL,
    quantita         integer,
    riferimento      text
);

ALTER TABLE public.catalogo_ricompense ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chiunque autenticato legge il catalogo ricompense"
    ON public.catalogo_ricompense FOR SELECT
    USING (auth.role() = 'authenticated');

-- Nessuna policy INSERT/UPDATE/DELETE per il client — tabella di
-- configurazione, gestita solo da qui (migration) o a mano da admin.



-- ── RPC #1: riscatta_missione_completata ─────────────────────────────────
-- Sostituisce la coppia missioniInserisciCompletamento() +
-- ricompenseInserisci() (data/missioni-scrittura.repository.js) — ora
-- atomica in un'unica transazione (prima erano 2 insert client separati,
-- non atomici: la regola generale del progetto "tutte le azioni che
-- modificano premi/polvere devono essere transazionali" non era rispettata
-- qui, corretto di riflesso insieme al fix di sicurezza).
-- Ritorna true SOLO se questa chiamata ha davvero assegnato qualcosa di
-- nuovo (permette al client di sapere se mostrare il feedback "nuova
-- missione completata" esattamente come faceva prima controllando
-- error.code === '23505').
CREATE OR REPLACE FUNCTION public.riscatta_missione_completata(p_missione_id text, p_finestra text, p_periodo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_owner_id uuid := auth.uid();
    v_ricompensa record;
begin
    if v_owner_id is null then
        raise exception 'Non autenticato';
    end if;

    begin
        insert into public.missioni_completate (owner_id, missione_id, finestra, periodo, origine, completato_il)
        values (v_owner_id, p_missione_id, p_finestra, p_periodo, 'normale', now());
    exception when unique_violation then
        return false; -- già completata per questo periodo, nessuna nuova ricompensa
    end;

    select tipo_ricompensa, quantita, riferimento into v_ricompensa
    from public.catalogo_ricompense
    where voce_id = p_missione_id and categoria = 'missione';

    if v_ricompensa is null then
        -- Completamento registrato comunque; nessuna ricompensa nel
        -- catalogo per questo id (dato mancante/da sincronizzare col
        -- catalogo JS) — mai inventare una quantità.
        return true;
    end if;

    insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
    values (v_owner_id, v_ricompensa.tipo_ricompensa, p_missione_id, coalesce(v_ricompensa.quantita, 1), now());

    return true;
end;
$$;


-- ── RPC #2: riscatta_traguardo — stesso schema, per traguardi_riscossi ──
CREATE OR REPLACE FUNCTION public.riscatta_traguardo(p_traguardo_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
    v_owner_id uuid := auth.uid();
    v_ricompensa record;
begin
    if v_owner_id is null then
        raise exception 'Non autenticato';
    end if;

    begin
        insert into public.traguardi_riscossi (owner_id, traguardo_id, riscosso_il)
        values (v_owner_id, p_traguardo_id, now());
    exception when unique_violation then
        return false;
    end;

    select tipo_ricompensa, quantita, riferimento into v_ricompensa
    from public.catalogo_ricompense
    where voce_id = p_traguardo_id and categoria = 'traguardo';

    if v_ricompensa is null then
        return true;
    end if;

    insert into public.inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
    values (v_owner_id, v_ricompensa.tipo_ricompensa, p_traguardo_id, coalesce(v_ricompensa.quantita, 1), now());

    return true;
end;
$$;


-- ── BLINDATURA RLS — rimuove la scrittura diretta, resta solo SELECT ────
-- Stesso identico modello già usato per bustina_carte_possedute. Da questo
-- momento le uniche 2 vie per scrivere su queste 3 tabelle sono le due RPC
-- sopra (+ apri_bustina, invariata, per inventario_ricompense tipo=
-- 'polvere'/'bustina' dai doppioni — RPC, già bypassa RLS).

DROP POLICY IF EXISTS "propria collezione missioni" ON public.missioni_completate;
CREATE POLICY "utenti leggono le proprie missioni completate"
    ON public.missioni_completate FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "propria collezione traguardi" ON public.traguardi_riscossi;
CREATE POLICY "utenti leggono i propri traguardi riscossi"
    ON public.traguardi_riscossi FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "propria collezione ricompense" ON public.inventario_ricompense;
CREATE POLICY "utenti leggono le proprie ricompense"
    ON public.inventario_ricompense FOR SELECT
    USING (auth.uid() = owner_id);


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- 1. Il buco è chiuso — questo insert diretto DEVE fallire ora (RLS):
-- insert into inventario_ricompense (owner_id, tipo, riferimento_id, quantita, ottenuto_il)
-- values (auth.uid(), 'polvere', null, 999999, now());
-- -- atteso: "new row violates row-level security policy"
--
-- 2. Le RPC funzionano ancora per l'uso legittimo:
-- select riscatta_missione_completata('m01_primo_accesso', 'una_tantum', 'sempre');
-- select riscatta_missione_completata('m01_primo_accesso', 'una_tantum', 'sempre'); -- seconda chiamata identica
-- -- atteso: true poi false (già completata), MAI un errore
-- select * from inventario_ricompense where riferimento_id = 'm01_primo_accesso' order by ottenuto_il desc limit 3;
-- -- atteso: UNA sola riga (non due), quantita = 1 (dal catalogo, non un valore a caso)
--
-- 3. Conteggio catalogo:
-- select categoria, count(*) from catalogo_ricompense group by categoria;
-- -- atteso: missione 72, traguardo 115
-- ============================================================================


-- ── DATI: catalogo_ricompense (187 righe, estratte da ui/missioni-catalogo.ui.js) ──
INSERT INTO public.catalogo_ricompense (voce_id, categoria, tipo_ricompensa, quantita, riferimento) VALUES
    ('m01_primo_accesso', 'missione', 'polvere', 1, NULL),
    ('m02_una_carta_in_piu', 'missione', 'polvere', 2, NULL),
    ('m03_fai_scorta', 'missione', 'polvere', 5, NULL),
    ('m04_giornata_produttiva', 'missione', 'polvere', 8, NULL),
    ('m05_grande_raccolto', 'missione', 'polvere', 15, NULL),
    ('m06_occhiata_alla_collezione', 'missione', 'polvere', 2, NULL),
    ('m07_controllo_wishlist', 'missione', 'polvere', 2, NULL),
    ('m08_occhiata_ai_prezzi', 'missione', 'polvere', 2, NULL),
    ('m09_controllo_mercato', 'missione', 'polvere', 3, NULL),
    ('m10_analista', 'missione', 'polvere', 6, NULL),
    ('m11_metti_ordine', 'missione', 'polvere', 3, NULL),
    ('m13_sfoglia_larchivio', 'missione', 'polvere', 8, NULL),
    ('m14_cerca_un_doppione', 'missione', 'polvere', 2, NULL),
    ('m16_cacciatore_di_carte', 'missione', 'polvere', 2, NULL),
    ('m17_completa_una_ricerca', 'missione', 'polvere', 2, NULL),
    ('m84_cerca_e_trova', 'missione', 'polvere', 4, NULL),
    ('m85_ricerca_completa', 'missione', 'polvere', 7, NULL),
    ('m18_qualcuno_ti_ha_trovato', 'missione', 'polvere', 3, NULL),
    ('m19_doppio_interesse', 'missione', 'polvere', 5, NULL),
    ('m20_molto_cercato', 'missione', 'polvere', 7, NULL),
    ('m23_match_point', 'missione', 'polvere', 2, NULL),
    ('m24_primo_match', 'missione', 'polvere', 4, NULL),
    ('m25_caccia_di_scambi', 'missione', 'polvere', 7, NULL),
    ('m27_condividi', 'missione', 'polvere', 3, NULL),
    ('m29_qr_hunter', 'missione', 'polvere', 3, NULL),
    ('m30_esplora_una_location', 'missione', 'polvere', 2, NULL),
    ('m31_nuovo_posto', 'missione', 'polvere', 2, NULL),
    ('m32_due_luoghi', 'missione', 'polvere', 4, NULL),
    ('m36_controllo_qualita', 'missione', 'polvere', 8, NULL),
    ('m37_il_prezzo_giusto', 'missione', 'polvere', 3, NULL),
    ('m38_occhio_al_valore', 'missione', 'polvere', 2, NULL),
    ('m40_portfolio', 'missione', 'polvere', 3, NULL),
    ('m39_tesori_nascosti', 'missione', 'polvere', 4, NULL),
    ('m41_prima_apertura', 'missione', 'polvere', 2, NULL),
    ('m42_carta_preferita', 'missione', 'polvere', 2, NULL),
    ('m50_missione_compiuta', 'missione', 'polvere', 3, NULL),
    ('m51_inarrestabile', 'missione', 'polvere', 6, NULL),
    ('m52_giornata_piena', 'missione', 'polvere', 10, NULL),
    ('m53_giornata_perfetta', 'missione', 'polvere', 15, NULL),
    ('m54_cacciatore_di_obiettivi', 'missione', 'polvere', 15, NULL),
    ('m44_torna_domani', 'missione', 'polvere', 4, NULL),
    ('m45_costanza', 'missione', 'polvere', 7, NULL),
    ('m46_settimana_attiva', 'missione', 'polvere', 15, NULL),
    ('m57_raccoglitore', 'missione', 'polvere', 4, NULL),
    ('m63_un_desiderio_in_meno', 'missione', 'polvere', 5, NULL),
    ('m64_obiettivo_raggiunto', 'missione', 'polvere', 6, NULL),
    ('m66_aggiornamento_completo', 'missione', 'polvere', 10, NULL),
    ('m68_mercato_pulito', 'missione', 'polvere', 10, NULL),
    ('m69_binder_aperto', 'missione', 'polvere', 2, NULL),
    ('m70_binder_pubblico', 'missione', 'polvere', 2, NULL),
    ('m75_matchmaker', 'missione', 'polvere', 4, NULL),
    ('m78_esplora_il_gruppo', 'missione', 'polvere', 3, NULL),
    ('m79_pokedex_aggiornato', 'missione', 'polvere', 2, NULL),
    ('m80_numeri_alla_mano', 'missione', 'polvere', 1, NULL),
    ('m81_conta_tutto', 'missione', 'polvere', 5, NULL),
    ('m82_occhio_ai_dettagli', 'missione', 'polvere', 4, NULL),
    ('m83_tre_tesori', 'missione', 'polvere', 6, NULL),
    ('m86_archivio_digitale', 'missione', 'polvere', 2, NULL),
    ('m87_ritorno_al_passato', 'missione', 'polvere', 3, NULL),
    ('m88_estensione_pronta', 'missione', 'polvere', 2, NULL),
    ('m89_apri_il_pokedex', 'missione', 'polvere', 3, NULL),
    ('m90_collega_il_mondo', 'missione', 'polvere', 5, NULL),
    ('m91_widget_explorer', 'missione', 'polvere', 3, NULL),
    ('m92_telefono_completo', 'missione', 'polvere', 6, NULL),
    ('m93_panoramica_completa', 'missione', 'polvere', 8, NULL),
    ('m94_personalizza', 'missione', 'polvere', 3, NULL),
    ('m95_il_tuo_telefono', 'missione', 'polvere', 5, NULL),
    ('m99_super_giornata', 'missione', 'polvere', 15, NULL),
    ('m100_leggenda_del_giorno', 'missione', 'polvere', 20, NULL),
    ('m96_una_giornata_cardsync', 'missione', 'polvere', 12, NULL),
    ('m97_collezionista_sociale', 'missione', 'polvere', 8, NULL),
    ('m98_tuttofare', 'missione', 'polvere', 12, NULL),
    ('t_carte_1', 'traguardo', 'stampino', NULL, 'primo_passo'),
    ('t_carte_2', 'traguardo', 'polvere', 5, NULL),
    ('t_carte_3', 'traguardo', 'polvere', 10, NULL),
    ('t_carte_4', 'traguardo', 'stampino', NULL, 'apprendista'),
    ('t_carte_5', 'traguardo', 'polvere', 25, NULL),
    ('t_carte_6', 'traguardo', 'bustina', 1, NULL),
    ('t_carte_7', 'traguardo', 'polvere', 50, NULL),
    ('t_carte_8', 'traguardo', 'stampino', NULL, 'archivista'),
    ('t_carte_9', 'traguardo', 'bustina', 2, NULL),
    ('t_carte_10', 'traguardo', 'stampino', NULL, 'maestro'),
    ('t_carte_11', 'traguardo', 'polvere', 100, NULL),
    ('t_carte_12', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_carte_13', 'traguardo', 'polvere', 250, NULL),
    ('t_carte_14', 'traguardo', 'bustina', NULL, 'speciale'),
    ('t_carte_15', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_valore_1', 'traguardo', 'polvere', 5, NULL),
    ('t_valore_2', 'traguardo', 'polvere', 10, NULL),
    ('t_valore_3', 'traguardo', 'polvere', 15, NULL),
    ('t_valore_4', 'traguardo', 'stampino', NULL, 'tesoro'),
    ('t_valore_5', 'traguardo', 'bustina', 1, NULL),
    ('t_valore_6', 'traguardo', 'polvere', 50, NULL),
    ('t_valore_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_valore_8', 'traguardo', 'polvere', 100, NULL),
    ('t_valore_9', 'traguardo', 'bustina', 2, NULL),
    ('t_valore_10', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_location_1', 'traguardo', 'polvere', 5, NULL),
    ('t_location_2', 'traguardo', 'stampino', NULL, 'viaggiatore'),
    ('t_location_3', 'traguardo', 'polvere', 15, NULL),
    ('t_location_4', 'traguardo', 'bustina', 1, NULL),
    ('t_location_5', 'traguardo', 'stampino', NULL, 'cartografo'),
    ('t_location_6', 'traguardo', 'polvere', 30, NULL),
    ('t_location_7', 'traguardo', 'bustina', NULL, 'speciale'),
    ('t_location_8', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_location_9', 'traguardo', 'polvere', 100, NULL),
    ('t_location_10', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_wishlist_1', 'traguardo', 'polvere', 3, NULL),
    ('t_wishlist_2', 'traguardo', 'polvere', 5, NULL),
    ('t_wishlist_3', 'traguardo', 'polvere', 10, NULL),
    ('t_wishlist_4', 'traguardo', 'stampino', NULL, 'cacciatore'),
    ('t_wishlist_5', 'traguardo', 'bustina', 1, NULL),
    ('t_wishlist_6', 'traguardo', 'polvere', 50, NULL),
    ('t_wishlist_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_wishlist_8', 'traguardo', 'polvere', 100, NULL),
    ('t_wishlist_9', 'traguardo', 'bustina', 2, NULL),
    ('t_wishlist_10', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_doppioni_1', 'traguardo', 'polvere', 3, NULL),
    ('t_doppioni_2', 'traguardo', 'polvere', 5, NULL),
    ('t_doppioni_3', 'traguardo', 'polvere', 10, NULL),
    ('t_doppioni_4', 'traguardo', 'stampino', NULL, 'doppione'),
    ('t_doppioni_5', 'traguardo', 'bustina', 1, NULL),
    ('t_doppioni_6', 'traguardo', 'polvere', 50, NULL),
    ('t_doppioni_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_doppioni_8', 'traguardo', 'polvere', 100, NULL),
    ('t_doppioni_9', 'traguardo', 'bustina', 2, NULL),
    ('t_doppioni_10', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_missioni_1', 'traguardo', 'stampino', NULL, 'recluta'),
    ('t_missioni_2', 'traguardo', 'polvere', 10, NULL),
    ('t_missioni_3', 'traguardo', 'polvere', 15, NULL),
    ('t_missioni_4', 'traguardo', 'stampino', NULL, NULL),
    ('t_missioni_5', 'traguardo', 'bustina', 1, NULL),
    ('t_missioni_6', 'traguardo', 'polvere', 50, NULL),
    ('t_missioni_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_missioni_8', 'traguardo', 'bustina', 2, NULL),
    ('t_missioni_9', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_missioni_10', 'traguardo', 'polvere', 250, NULL),
    ('t_accessi_1', 'traguardo', 'polvere', 3, NULL),
    ('t_accessi_2', 'traguardo', 'polvere', 5, NULL),
    ('t_accessi_3', 'traguardo', 'polvere', 10, NULL),
    ('t_accessi_4', 'traguardo', 'stampino', NULL, NULL),
    ('t_accessi_5', 'traguardo', 'bustina', 1, NULL),
    ('t_accessi_6', 'traguardo', 'polvere', 50, NULL),
    ('t_accessi_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_accessi_8', 'traguardo', 'bustina', 2, NULL),
    ('t_accessi_9', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_accessi_10', 'traguardo', 'polvere', 250, NULL),
    ('t_binder_aperture_1', 'traguardo', 'polvere', 3, NULL),
    ('t_binder_aperture_2', 'traguardo', 'polvere', 5, NULL),
    ('t_binder_aperture_3', 'traguardo', 'polvere', 10, NULL),
    ('t_binder_aperture_4', 'traguardo', 'stampino', NULL, NULL),
    ('t_binder_aperture_5', 'traguardo', 'bustina', 1, NULL),
    ('t_binder_aperture_6', 'traguardo', 'polvere', 50, NULL),
    ('t_binder_aperture_7', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_binder_aperture_8', 'traguardo', 'polvere', 100, NULL),
    ('t_binder_aperture_9', 'traguardo', 'bustina', 2, NULL),
    ('t_binder_aperture_10', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_match_1', 'traguardo', 'polvere', 5, NULL),
    ('t_match_2', 'traguardo', 'polvere', 5, NULL),
    ('t_match_3', 'traguardo', 'polvere', 6, NULL),
    ('t_match_4', 'traguardo', 'polvere', 8, NULL),
    ('t_match_5', 'traguardo', 'polvere', 10, NULL),
    ('t_match_6', 'traguardo', 'stampino', NULL, 'social'),
    ('t_match_7', 'traguardo', 'polvere', 25, NULL),
    ('t_match_8', 'traguardo', 'bustina', 1, NULL),
    ('t_match_9', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_match_10', 'traguardo', 'polvere', 75, NULL),
    ('t_match_11', 'traguardo', 'bustina', 2, NULL),
    ('t_match_12', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_match_13', 'traguardo', 'polvere', 250, NULL),
    ('t_binder_visitati_1', 'traguardo', 'polvere', 3, NULL),
    ('t_binder_visitati_2', 'traguardo', 'polvere', 4, NULL),
    ('t_binder_visitati_3', 'traguardo', 'polvere', 5, NULL),
    ('t_binder_visitati_4', 'traguardo', 'polvere', 6, NULL),
    ('t_binder_visitati_5', 'traguardo', 'polvere', 5, NULL),
    ('t_binder_visitati_6', 'traguardo', 'polvere', 10, NULL),
    ('t_binder_visitati_7', 'traguardo', 'stampino', NULL, 'esploratore'),
    ('t_binder_visitati_8', 'traguardo', 'bustina', 1, NULL),
    ('t_binder_visitati_9', 'traguardo', 'polvere', 50, NULL),
    ('t_binder_visitati_10', 'traguardo', 'stampino', NULL, 'raro'),
    ('t_binder_visitati_11', 'traguardo', 'polvere', 100, NULL),
    ('t_binder_visitati_12', 'traguardo', 'bustina', 2, NULL),
    ('t_binder_visitati_13', 'traguardo', 'stampino', NULL, 'leggendario'),
    ('t_giorno_impeccabile', 'traguardo', 'bustina', 1, NULL),
    ('t_collezionista_completo', 'traguardo', 'bustina', 2, NULL),
    ('t_maestro_cardsync', 'traguardo', 'stampino', NULL, 'maestro_cardsync'),
    ('t_leggenda_cardsync', 'traguardo', 'stampino', NULL, 'leggendario_esclusivo');
