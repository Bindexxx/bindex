-- 128 — Uniforma lingua e condizione nella tabella carte (09/11/2026).
-- Il sito e l'estensione (dalla 5.52) usano JP ed EN; alcune righe vecchie hanno JA/JAP ed ENG,
-- una ha la condizione "nm" minuscola. Il prezzo non cambia (i trigger del prezzo non scattano);
-- cambia solo updated_at. Righe controllate prima: JA 11, JAP 5, ENG 9, nm 1 (26 in tutto).
-- Rollback: 128_uniforma_lingua_condizione_carte_ROLLBACK.sql (id esatti di oggi).

update carte set lingua = 'JP' where lingua in ('JA', 'JAP', 'JPN');
update carte set lingua = 'EN' where lingua = 'ENG';
update carte set condizione = upper(condizione) where condizione <> upper(condizione);

-- Verifica: deve tornare 0 righe.
select lingua, condizione, count(*) from carte
 where lingua in ('JA', 'JAP', 'JPN', 'ENG') or condizione <> upper(condizione)
 group by 1, 2;
