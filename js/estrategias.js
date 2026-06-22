// ═══════════════════════════════════════════════════════════════════
// estrategias.js — Comparador de estrategias de cumplimiento Ley REP
//   Solo · Colectivo (costos compartidos) · Monetizar (logística rentable)
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', init);
  var $ = function (id) { return document.getElementById(id); };
  var clp = function (n) { return (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); };
  var chart = null;

  function init() {
    $('e-cat').innerHTML = Store.DAMU.categorias.map(function (c) {
      return '<option value="' + c + '">' + Store.DAMU.catIcono[c] + ' ' + Store.DAMU.catLabel[c] + '</option>';
    }).join('');
    $('e-region').innerHTML = Object.keys(Store.DAMU.regiones).map(function (k) {
      return '<option value="' + k + '">' + Store.DAMU.regiones[k] + '</option>';
    }).join('');
    ['e-cat', 'e-tons', 'e-meta', 'e-region', 'e-emp'].forEach(function (id) {
      $(id).addEventListener('input', recalc);
      $(id).addEventListener('change', recalc);
    });
    $('e-meta').addEventListener('input', function () { $('lbl-meta').textContent = $('e-meta').value; });
    $('e-emp').addEventListener('input', function () { $('lbl-emp').textContent = $('e-emp').value; });
    recalc();
  }

  function filas(o, extra) {
    var netoCls = o.neto >= 0 ? 'text-emerald-400' : 'text-red-400';
    var html = ''
      + linea('Costo total', clp(o.costoTotal))
      + linea('Ingreso material', clp(o.ingreso), 'text-emerald-400')
      + linea('Multa Art. 48', o.multa === 0 ? 'Sin riesgo' : clp(o.multa), o.multa === 0 ? 'text-emerald-400' : 'text-amber-400')
      + (extra || '')
      + '<div class="flex justify-between pt-1.5 border-t border-slate-700 mt-1"><span class="font-semibold">Resultado neto</span><strong class="' + netoCls + '">' + clp(o.neto) + '</strong></div>';
    return html;
  }
  function linea(l, v, cls) {
    return '<div class="flex justify-between border-b border-slate-800 pb-1"><span class="text-slate-400">' + l + '</span><strong class="' + (cls || '') + '">' + v + '</strong></div>';
  }

  function recalc() {
    var r = Store.calcEstrategias($('e-cat').value, $('e-tons').value, $('e-meta').value, $('e-region').value, $('e-emp').value);

    $('card-solo').innerHTML = filas(r.solo);
    $('card-colectivo').innerHTML = filas(r.colectivo,
      linea('Empresas que comparten', r.colectivo.empresas)
      + linea('Ahorro vs. solo', clp(r.colectivo.ahorroVsSolo), 'text-emerald-400'));
    $('card-monetizar').innerHTML = filas(r.monetizar,
      linea('Meta valorizada', r.monetizar.metaUsada + '%'));

    // Recomendación: mayor resultado neto
    var ops = [
      { k: 'Cumplir solo', v: r.solo.neto },
      { k: 'Sistema colectivo', v: r.colectivo.neto },
      { k: 'Monetizar el residuo', v: r.monetizar.neto },
    ].sort(function (a, b) { return b.v - a.v; });
    var best = ops[0];
    var rec = $('recom');
    rec.innerHTML = '✅ Estrategia más conveniente: <strong>' + best.k + '</strong> · resultado neto ' + clp(best.v)
      + '. <span class="font-normal text-slate-300">El colectivo baja el costo logístico al repartirlo; monetizar maximiza el ingreso del material y evita la multa.</span>';
    rec.className = 'rounded-2xl px-5 py-4 mb-6 text-sm font-semibold bg-emerald-900/40 border border-emerald-700/50 text-emerald-200';

    pintar([r.solo.neto, r.colectivo.neto, r.monetizar.neto]);
  }

  function pintar(data) {
    if (!window.Chart) return;
    var labels = ['Cumplir solo', 'Colectivo', 'Monetizar'];
    var colores = data.map(function (v) { return v >= 0 ? '#059669' : '#dc2626'; });
    if (chart) { chart.data.datasets[0].data = data; chart.data.datasets[0].backgroundColor = colores; chart.update(); return; }
    chart = new Chart($('e-chart'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colores, borderRadius: 6 }] },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
      },
    });
  }
})();
