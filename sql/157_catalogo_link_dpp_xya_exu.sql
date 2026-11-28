-- 157: catalogo — link Cardmarket per i set che la coda non trovava dal codice (27-28/11/2026).
-- Il sito manda in coda il link quando la riga del catalogo ce l'ha; senza link manda il testo
-- "nome SIGLA numero", che per questi set su Cardmarket non porta alla carta:
--   DPP  DP Black Star Promos: su Cardmarket "DPPR DP12" (cercare "DPPRDP12" non trova niente).
--        Solo le righe 'normale', e non la 50 (Arceus: due prodotti, V1 e V2, non si sa quale).
--        Le varianti (timbri Worlds, cosmos, jumbo) restano senza link.
--   XYA  Carte con la A gialla: su Cardmarket sono la V2 della carta del set d'origine (PHF 24a…).
--   EXU  Unown di Forze Segrete: su Cardmarket "Unown A (UF A)"…, "!" = UFXM, "?" = UFQM.
--        ORDINE DEDOTTO (confermato da Claudio il 28/11): come nell'elenco di TCGdex del set exu,
--        1 = "!", 2 = "?", 3 = A … 28 = Z. Al nome si aggiunge la lettera ("Unown A"),
--        così nel selettore del sito si vede quale carta è.
-- Pagine viste dal vivo su Cardmarket il 27/11 sera (elenco DP Black Star Promos, ricerche
-- "Unown UF", PHF24, GEN28, FCO54, FFI55, ROS92, BKP107).

update public.set_carte s
set cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/DP-Black-Star-Promos/' || v.slug, aggiornato_il = now()
from (values
  (1, 'Turtwig-Lv10-DPPRDP01'),
  (2, 'Chimchar-Lv8-DPPRDP02'),
  (4, 'Pachirisu-Lv23-DPPRDP04'),
  (6, 'Buneary-Lv11-DPPRDP06'),
  (7, 'Cranidos-Lv24-DPPRDP07'),
  (8, 'Shieldon-Lv26-DPPRDP08'),
  (9, 'Torterra-LVX-DPPRDP09'),
  (10, 'Infernape-LVX-DPPRDP10'),
  (11, 'Empoleon-LVX-DPPRDP11'),
  (12, 'Lucario-LVX-DPPRDP12'),
  (13, 'Buizel-Lv10-DPPRDP13'),
  (14, 'Chatot-Lv27-DPPRDP14'),
  (15, 'Shinx-Lv7-DPPRDP15'),
  (17, 'Dialga-LVX-V1-DPPR17'),
  (18, 'Palkia-LVX-DPPR18'),
  (19, 'Darkrai-LVX-DPPRDP19'),
  (20, 'Magmortar-Lv48-DPPRDP20'),
  (21, 'Raichu-Lv40-DPPRDP21'),
  (22, 'Mime-Jr-Lv5-DPPRDP22'),
  (23, 'Glameow-Lv12-DPPRDP23'),
  (24, 'Darkrai-Lv50-V1-DPPR24'),
  (28, 'Mewtwo-LVX-DPPRDP28'),
  (29, 'Rhyperior-LVX-DPPRDP29'),
  (30, 'Regigigas-LVX-DPPRDP30'),
  (31, 'Heatran-LVX-DPPRDP31'),
  (32, 'Magnezone-Lv51-DPPRDP32'),
  (33, 'Dusknoir-Lv49-DPPRDP33'),
  (34, 'Drifblim-Lv40-DPPRDP34'),
  (35, 'Porygon-Z-Lv56-DPPRDP35'),
  (36, 'Gliscor-Lv47-DPPRDP36'),
  (37, 'Dialga-LVX-V2-DPPRDP37'),
  (38, 'Giratina-LVX-DPPRDP38'),
  (39, 'Shaymin-LVX-DPPRDP39'),
  (40, 'Regigigas-Lv46-V1-DPPRDP40'),
  (42, 'Carnivine-G-Lv43-DPPRDP42'),
  (43, 'Probopass-G-Lv53-DPPRDP43'),
  (44, 'Magnezone-Lv53-DPPRDP44'),
  (45, 'Charizard-G-LVX-DPPRDP45'),
  (46, 'Garchomp-C-LVX-DPPRDP46'),
  (47, 'Rayquaza-C-LVX-DPPRDP47'),
  (49, 'Dialga-Lv69-DPPRDP49'),
  (51, 'Cresselia-Lv62-DPPRDP51'),
  (52, 'Darkrai-Lv61-DPPRDP52'),
  (53, 'Arceus-LVX-DPPRDP53'),
  (54, 'Beginning-Door-DPPR54'),
  (55, 'Ultimate-Zone-DPPR55'),
  (56, 'Arceus-LVX-DPPRDP56')
) v(numero, slug)
where s.sigla = 'DPP' and s.numero = v.numero and s.variante = 'normale' and s.cardmarket_url is null;

update public.set_carte s
set cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/' || v.pagina, aggiornato_il = now()
from (values
  (24, 'Phantom-Forces/MManectric-EX-V2-PHF24a'),
  (28, 'Generations/Jolteon-EX-V2-GEN28a'),
  (54, 'Fates-Collide/Zygarde-EX-V2-FCO54'),
  (55, 'Furious-Fists/MLucario-EX-V2-FFI55a'),
  (92, 'Roaring-Skies/Trainers-Mail-V2-ROS92a'),
  (107, 'BREAKpoint/Professor-Sycamore-V2-BKP107a')
) v(numero, pagina)
where s.sigla = 'XYA' and s.numero = v.numero and s.cardmarket_url is null;

update public.set_carte s
set cardmarket_url = 'https://www.cardmarket.com/it/Pokemon/Products/Singles/EX-Unseen-Forces/' || v.slug,
    nome = 'Unown ' || v.lettera,
    aggiornato_il = now()
from (values
  (1, '!', 'Unown-UFXM-28'),
  (2, '?', 'Unown-UFQM-28'),
  (3, 'A', 'Unown-A-UFA-28'),
  (4, 'B', 'Unown-B-UFB-28'),
  (5, 'C', 'Unown-C-UFC-28'),
  (6, 'D', 'Unown-D-UFD-28'),
  (7, 'E', 'Unown-E-UFE-28'),
  (8, 'F', 'Unown-F-UFF-28'),
  (9, 'G', 'Unown-G-UFG-28'),
  (10, 'H', 'Unown-H-UFH-28'),
  (11, 'I', 'Unown-I-UFI-28'),
  (12, 'J', 'Unown-J-UFJ-28'),
  (13, 'K', 'Unown-K-UFK-28'),
  (14, 'L', 'Unown-L-UFL-28'),
  (15, 'M', 'Unown-M-UFM-28'),
  (16, 'N', 'Unown-N-UFN-28'),
  (17, 'O', 'Unown-O-UFO-28'),
  (18, 'P', 'Unown-P-UFP-28'),
  (19, 'Q', 'Unown-Q-UFQ-28'),
  (20, 'R', 'Unown-R-UFR-28'),
  (21, 'S', 'Unown-S-UFS-28'),
  (22, 'T', 'Unown-T-UFT-28'),
  (23, 'U', 'Unown-U-UFU-28'),
  (24, 'V', 'Unown-V-UFV-28'),
  (25, 'W', 'Unown-W-UFW-28'),
  (26, 'X', 'Unown-X-UFX-28'),
  (27, 'Y', 'Unown-Y-UFY-28'),
  (28, 'Z', 'Unown-Z-UFZ-28')
) v(numero, lettera, slug)
where s.sigla = 'EXU' and s.numero = v.numero and s.cardmarket_url is null and s.nome = 'Unown';

-- verifica: DPP 47 righe col link, XYA 6, EXU 28 (e 28 nomi con la lettera)
select sigla, count(*) filter (where cardmarket_url is not null) con_link,
       count(*) filter (where nome ~ '^Unown .$') nomi_con_lettera
from public.set_carte where sigla in ('DPP', 'XYA', 'EXU') group by sigla order by sigla;
