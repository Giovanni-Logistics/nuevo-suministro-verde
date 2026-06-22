// ═══════════════════════════════════════════════════════════════════
// calculadora.js — Calculadora REP & Multas Art. 48 (sin backend)
//   Modelo del proyecto previo: costos reco/trans/val + multa Art. 48.
//   PDF client-side con jsPDF (sin servidor).
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', init);
  var $ = function (id) { return document.getElementById(id); };
  var clp = function (n) { return '$' + Math.round(n).toLocaleString('es-CL'); };
  var ultimo = null;

  function init() {
    $('s-cat').innerHTML = Store.DAMU.categorias.map(function (c) {
      return '<option value="' + c + '">' + Store.DAMU.catIcono[c] + ' ' + Store.DAMU.catLabel[c] + '</option>';
    }).join('');
    $('s-region').innerHTML = Object.keys(Store.DAMU.regiones).map(function (k) {
      return '<option value="' + k + '">' + Store.DAMU.regiones[k] + '</option>';
    }).join('');
    ['s-cat', 's-tons', 's-meta', 's-tons-real', 's-region'].forEach(function (id) {
      $(id).addEventListener('input', recalc);
      $(id).addEventListener('change', recalc);
    });
    $('s-meta').addEventListener('input', function () { $('lbl-meta').textContent = $('s-meta').value; });
    $('btn-pdf').onclick = generarPDF;
    recalc();
  }

  function recalc() {
    var r = Store.calcRep($('s-cat').value, $('s-tons').value, $('s-meta').value, $('s-region').value, $('s-tons-real').value);
    ultimo = r;
    $('kpi-grid').innerHTML = [
      { i: '⚖️', l: 'Tons. a valorizar', v: r.tonsVal + ' t', c: 'text-emerald-400' },
      { i: '💸', l: 'Costo total est.',   v: clp(r.costoTotal), c: 'text-red-400' },
      { i: '🌿', l: 'CO₂e evitado',       v: r.co2e + ' tCO₂e', c: 'text-emerald-400' },
      { i: '⚖️', l: 'Multa en riesgo',   v: r.cumple ? 'Sin riesgo' : clp(r.multa), c: r.cumple ? 'text-emerald-400' : 'text-red-400' },
    ].map(function (k) {
      return '<div class="bg-slate-800/60 rounded-xl p-3 text-center"><div class="text-xl mb-1">' + k.i + '</div>'
        + '<div class="text-[11px] text-slate-400 mb-0.5">' + k.l + '</div>'
        + '<div class="text-sm font-black ' + k.c + '">' + k.v + '</div></div>';
    }).join('');
    $('o-reco').textContent = clp(r.costoReco);
    $('o-trans').textContent = clp(r.costoTrans);
    $('o-val').textContent = clp(r.costoVal);
    $('o-metalegal').textContent = r.metaLegal + ' t';

    var b = $('estado-banner');
    if (r.cumple) {
      b.textContent = '✓ Sin riesgo de sanción Art. 48 · Cumplimiento REP verificado';
      b.className = 'rounded-xl px-4 py-3 mb-4 text-sm font-semibold bg-emerald-900/50 border border-emerald-700/60 text-emerald-300';
    } else {
      b.textContent = '⚠ Riesgo de multa Art. 48 · déficit de ' + r.shortfall + ' t valorizadas';
      b.className = 'rounded-xl px-4 py-3 mb-4 text-sm font-semibold bg-amber-900/50 border border-amber-700/60 text-amber-300';
    }
  }

  function generarPDF() {
    if (!ultimo || !window.jspdf) return;
    var doc = new window.jspdf.jsPDF();
    var cat = Store.DAMU.catLabel[$('s-cat').value];
    var M = 18, y = 22, W = 210;
    doc.setFillColor(5, 150, 105); doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255); doc.setFontSize(16); doc.setFont(undefined, 'bold');
    doc.text('Eco-Ticket REP — Damu SGC', M, 18);
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text('Decreto 12 · Ley 20.920 · Estimación referencial', M, 25);
    y = 42; doc.setTextColor(30);

    var fecha = new Date().toLocaleDateString('es-CL');
    var docId = 'REP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    function fila(l, v) {
      doc.setFont(undefined, 'normal'); doc.setTextColor(90); doc.setFontSize(10);
      doc.text(l, M, y);
      doc.setFont(undefined, 'bold'); doc.setTextColor(20);
      doc.text(String(v), W - M, y, { align: 'right' });
      doc.setDrawColor(225); doc.line(M, y + 2, W - M, y + 2);
      y += 10;
    }
    fila('Documento', docId);
    fila('Fecha', fecha);
    fila('Categoría REP', cat);
    fila('Toneladas declaradas', $('s-tons').value + ' t');
    fila('Meta de valorización', $('s-meta').value + ' %');
    fila('Toneladas a valorizar', ultimo.tonsVal + ' t');
    fila('Costo recolección', clp(ultimo.costoReco));
    fila('Costo transporte', clp(ultimo.costoTrans));
    fila('Costo valorización', clp(ultimo.costoVal));
    fila('Costo total estimado', clp(ultimo.costoTotal));
    fila('CO2e evitado estimado', ultimo.co2e + ' tCO2e');
    fila('Meta legal minima (20%)', ultimo.metaLegal + ' t');
    fila('Multa estimada Art. 48', ultimo.multa === 0 ? '$0 (sin riesgo)' : clp(ultimo.multa));

    y += 6; doc.setFontSize(8); doc.setTextColor(140);
    doc.text('Valores referenciales para fines de simulación. No constituye declaración oficial ante el SMA.', M, y, { maxWidth: W - 2 * M });
    doc.save(docId + '.pdf');
  }
})();
