// Widget Polvere.

let _widgetPolvereSaldo = { quando: 0, valore: null, settimana: null, inCorso: false };
function _widgetPolvereAggiorna() {
    if (_widgetPolvereSaldo.inCorso || Date.now() - _widgetPolvereSaldo.quando < 60000) return;
    if (typeof polvereSaldoLeggi !== 'function') return;
    _widgetPolvereSaldo.inCorso = true;
    polvereSaldoLeggi()
        .then(({ data, error }) => {
            if (!error) _widgetPolvereSaldo.valore = Number(data) || 0;
            _widgetPolvereSaldo.quando = Date.now();
        })
        .then(async () => {
            if (typeof polvereGuadagnataDa !== 'function') return;
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            const { data, error } = await polvereGuadagnataDa(d.toISOString());
            if (!error && Array.isArray(data)) {
                _widgetPolvereSaldo.settimana = data.reduce((t, r) => t + (Number(r.quantita) || 0), 0);
            }
        })
        .catch(e => console.error('[widget-polvere] saldo:', e))
        .finally(() => { _widgetPolvereSaldo.inCorso = false; });
}

CATALOGO_WIDGET.polvere = {
        titolo: 'Polvere', icona: 'fa-wand-sparkles',
        tab: 'shop',
        preview: () => {
            _widgetPolvereAggiorna();
            const s = _widgetPolvereSaldo.valore;
            if (s == null) return { righe: ['saldo in arrivo'], dati: null };
            const w = _widgetPolvereSaldo.settimana;
            const righe = [`${s.toLocaleString('it-IT')} ✧`];
            if (w > 0) righe.push(`+${w.toLocaleString('it-IT')} ✧ questa settimana`);
            return { righe, dati: { saldo: s, settimana: w } };
        },
};
