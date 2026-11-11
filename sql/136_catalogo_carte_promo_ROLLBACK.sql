-- ROLLBACK della 136 — toglie dal catalogo i masterset promo (le carte e i set). Le tue carte non
-- si toccano: nel widget Set tornano a contare come prima della 136.

begin;
delete from public.set_carte where sigla in ('BA20', 'BA22', 'BA24', 'BOO', 'BOO23', 'BOO24', 'PPS1', 'PPS2', 'PPS3', 'PPS4', 'PPS5', 'PPS6', 'PPS7', 'PPS8', 'PPS9', 'WCD04', 'WCD05', 'WCD06', 'WCD07', 'WCD08', 'WCD09', 'WCD10', 'WCD11', 'WCD12', 'WCD13', 'WCD14', 'WCD15', 'WCD16', 'WCD17', 'WCD18', 'WCD19', 'WCD22', 'WCD23', 'WCD24', 'WCD25');
delete from public.set_espansioni where sigla in ('BA20', 'BA22', 'BA24', 'BOO', 'BOO23', 'BOO24', 'PPS1', 'PPS2', 'PPS3', 'PPS4', 'PPS5', 'PPS6', 'PPS7', 'PPS8', 'PPS9', 'WCD04', 'WCD05', 'WCD06', 'WCD07', 'WCD08', 'WCD09', 'WCD10', 'WCD11', 'WCD12', 'WCD13', 'WCD14', 'WCD15', 'WCD16', 'WCD17', 'WCD18', 'WCD19', 'WCD22', 'WCD23', 'WCD24', 'WCD25');
commit;
