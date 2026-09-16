-- ============================================================================
-- CardSync Pro — 59: Fase 9 — Fondazioni Achievement
--
-- Design confermato con Claudio: l'Achievement NON è un sistema nuovo di
-- criteri di sblocco — riusa i traguardi con ricompensa tipo='stampino'
-- (37 su 115, già nel catalogo missioni, già valutati e sicuri da sql/58).
-- achievement_catalogo/achievement_sbloccati sono il "binder-like thing"
-- richiesto da Claudio, stessa struttura di bustina_catalogo/bustina_
-- carte_possedute (catalogo + tabella posseduti, sola SELECT per il
-- client, scrittura solo via RPC) — lezione di sicurezza di sql/58
-- applicata fin dal primo giorno qui, non aggiunta dopo.
--
-- Titoli/rarità in achievement_catalogo sono PLACEHOLDER (Claudio: "li
-- rifinisco dopo quando ho tempo") — derivati dal campo 'riferimento' già
-- presente in catalogo_ricompense per le stesse voci (es. 'raro' →
-- "Collezionista Raro" per t_carte_12), MAI inventati da zero: ogni titolo
-- riflette la categoria+tier reali del traguardo sottostante. nome_file
-- lasciato NULL — nessuna immagine ancora, stesso trattamento del
-- fallback già gestito lato UI per bustina (fallback.webp per rarità).
-- rarita: 'comune'/'rara'/'leggendaria' — derivata dal riferimento
-- ('raro'→rara, 'leggendario'→leggendaria, altrimenti comune), usata per
-- il raggruppamento richiesto dalla roadmap ("Binder Achievement...
-- diviso per rarità").
--
-- SBLOCCO: riscatta_traguardo (sql/58) estesa con un unico blocco IF in
-- coda — quando la ricompensa del traguardo appena riscosso è
-- 'stampino', inserisce ANCHE in achievement_sbloccati, stesso id.
-- Nessuna nuova superficie di attacco: stessa RPC già SECURITY DEFINER,
-- stesso auth.uid(), nessun input aggiuntivo dal client.
-- ============================================================================


-- ── achievement_catalogo — sola lettura per il client ────────────────────
CREATE TABLE public.achievement_catalogo (
    id       text PRIMARY KEY,  -- STESSO id del traguardo sottostante (es. 't_carte_12') — un solo posto dove cercare il criterio di sblocco: CATALOGO_TRAGUARDI (client) per i dettagli del criterio.
    titolo   text NOT NULL,
    rarita   text NOT NULL CHECK (rarita IN ('comune', 'rara', 'leggendaria')),
    nome_file text,             -- nome file immagine (bucket 'achievement-immagini', stesso pattern di bustina-immagini: {rarita}/{nome_file}.webp) — NULL finché non caricata
    attiva   boolean NOT NULL DEFAULT true
);

ALTER TABLE public.achievement_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chiunque autenticato legge il catalogo achievement"
    ON public.achievement_catalogo FOR SELECT
    USING (auth.role() = 'authenticated');


-- ── achievement_sbloccati — mirror di bustina_carte_possedute ───────────
CREATE TABLE public.achievement_sbloccati (
    owner_id       uuid NOT NULL REFERENCES auth.users(id),
    achievement_id text NOT NULL REFERENCES public.achievement_catalogo(id),
    sbloccato_il   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, achievement_id)
);

ALTER TABLE public.achievement_sbloccati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utenti leggono i propri achievement sbloccati"
    ON public.achievement_sbloccati FOR SELECT
    USING (auth.uid() = owner_id);

-- Nessuna policy admin "vede tutti" per ora (bustina_carte_possedute ce
-- l'ha, is_admin()) — non richiesta esplicitamente, aggiungibile in un
-- secondo momento se serve un pannello admin dedicato.

-- NESSUNA policy INSERT/UPDATE/DELETE su nessuna delle due tabelle — la
-- sola via di scrittura è riscatta_traguardo (SECURITY DEFINER) sotto.


-- ── riscatta_traguardo — ESTESA per sbloccare l'achievement (se c'è) ────
-- Stessa firma, stesso comportamento per tutto il resto — solo aggiunto
-- un blocco alla fine, dopo l'insert di inventario_ricompense esistente.
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

    -- Fase 9 (2026-09-13): sblocco Achievement — SOLO se la ricompensa di
    -- questo traguardo è uno stampino E esiste davvero una voce in
    -- achievement_catalogo con questo id (non tutti gli stampini sono
    -- ancora stati aggiunti lì per scelta, anche se oggi lo sono tutti e
    -- 37 — controllo comunque per sicurezza futura, mai un errore se un
    -- domani un traguardo stampino viene aggiunto senza il corrispondente
    -- achievement).
    if v_ricompensa.tipo_ricompensa = 'stampino' then
        insert into public.achievement_sbloccati (owner_id, achievement_id, sbloccato_il)
        select v_owner_id, p_traguardo_id, now()
        where exists (select 1 from public.achievement_catalogo where id = p_traguardo_id)
        on conflict (owner_id, achievement_id) do nothing;
    end if;

    return true;
end;
$$;


-- ============================================================================
-- VERIFICA POST-ESECUZIONE
-- ============================================================================
-- 1. select count(*) from achievement_catalogo; -- atteso: 37
-- 2. select rarita, count(*) from achievement_catalogo group by rarita;
-- 3. Test end-to-end (usa un id vero dei tuoi traguardi 'stampino', es.
--    t_carte_1, e il TUO owner_id):
-- select riscatta_traguardo('t_carte_1');
-- select * from achievement_sbloccati where owner_id = '<il-tuo-owner-id>';
-- -- atteso: una riga con achievement_id='t_carte_1'
-- ============================================================================


-- ── DATI: achievement_catalogo (37 righe — placeholder, da rifinire) ────
INSERT INTO public.achievement_catalogo (id, titolo, rarita, nome_file, attiva) VALUES
    ('t_carte_1', 'Primo Passo', 'comune', NULL, true),
    ('t_carte_4', 'Apprendista Collezionista', 'comune', NULL, true),
    ('t_carte_8', 'Archivista', 'comune', NULL, true),
    ('t_carte_10', 'Maestro Collezionista', 'comune', NULL, true),
    ('t_carte_12', 'Collezionista Raro', 'rara', NULL, true),
    ('t_carte_15', 'Collezionista Leggendario', 'leggendaria', NULL, true),
    ('t_valore_4', 'Cacciatore di Tesori', 'comune', NULL, true),
    ('t_valore_7', 'Valutatore Raro', 'rara', NULL, true),
    ('t_valore_10', 'Valutatore Leggendario', 'leggendaria', NULL, true),
    ('t_location_2', 'Viaggiatore', 'comune', NULL, true),
    ('t_location_5', 'Cartografo', 'comune', NULL, true),
    ('t_location_8', 'Esploratore Raro', 'rara', NULL, true),
    ('t_location_10', 'Esploratore Leggendario', 'leggendaria', NULL, true),
    ('t_wishlist_4', 'Cacciatore di Desideri', 'comune', NULL, true),
    ('t_wishlist_7', 'Desiderante Raro', 'rara', NULL, true),
    ('t_wishlist_10', 'Desiderante Leggendario', 'leggendaria', NULL, true),
    ('t_doppioni_4', 'Collezionista di Doppioni', 'comune', NULL, true),
    ('t_doppioni_7', 'Doppioni Raro', 'rara', NULL, true),
    ('t_doppioni_10', 'Doppioni Leggendario', 'leggendaria', NULL, true),
    ('t_missioni_1', 'Recluta', 'comune', NULL, true),
    ('t_missioni_4', 'Missioni Veterano', 'comune', NULL, true),
    ('t_missioni_7', 'Missioni Raro', 'rara', NULL, true),
    ('t_missioni_9', 'Missioni Leggendario', 'leggendaria', NULL, true),
    ('t_accessi_4', 'Accessi Veterano', 'comune', NULL, true),
    ('t_accessi_7', 'Accessi Raro', 'rara', NULL, true),
    ('t_accessi_9', 'Accessi Leggendario', 'leggendaria', NULL, true),
    ('t_binder_aperture_4', 'Sfogliatore Veterano', 'comune', NULL, true),
    ('t_binder_aperture_7', 'Sfogliatore Raro', 'rara', NULL, true),
    ('t_binder_aperture_10', 'Sfogliatore Leggendario', 'leggendaria', NULL, true),
    ('t_match_6', 'Sociale', 'comune', NULL, true),
    ('t_match_9', 'Match Raro', 'rara', NULL, true),
    ('t_match_12', 'Match Leggendario', 'leggendaria', NULL, true),
    ('t_binder_visitati_7', 'Esploratore di Binder', 'comune', NULL, true),
    ('t_binder_visitati_10', 'Visite Raro', 'rara', NULL, true),
    ('t_binder_visitati_13', 'Visite Leggendario', 'leggendaria', NULL, true),
    ('t_maestro_cardsync', 'Maestro CardSync', 'leggendaria', NULL, true),
    ('t_leggenda_cardsync', 'Leggenda CardSync', 'leggendaria', NULL, true);
