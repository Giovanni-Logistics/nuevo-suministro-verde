// ═══════════════════════════════════════════════════════════════════
// productor.js — Panel Productor (sin login, sin backend)
//   Sesión persistida en localStorage('damu_op_codigo_productor')
//   Tiempo real vía Store.onChange (BroadcastChannel / storage)
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', init);
  var KEY = 'damu_op_codigo_productor';
  var sala = null;
  var $ = function (id) { return document.getElementById(id); };

  function init() {
    pintarCategorias();
    bind();
    var cod = localStorage.getItem(KEY);
    if (cod) {
      var s = Store.buscarProductor(cod);
      if (s) return entrar(s);
      localStorage.removeItem(KEY);
    }
    Store.onChange(function () { if (sala) { refrescarProducciones(); refrescarRutas(); } });
  }

  function bind() {
    $('btn-crear').onclick = function () { entrar(Store.crearProductor($('in-empresa').value.trim())); };
    $('btn-recuperar').onclick = function () {
      var s = Store.buscarProductor($('in-codigo').value.trim().toUpperCase());
      if (s) entrar(s); else $('inicio-msg').textContent = 'Código no encontrado.';
    };
    $('btn-salir').onclick = function () { localStorage.removeItem(KEY); location.reload(); };
    $('btn-copiar').onclick = function () {
      navigator.clipboard.writeText(sala.codigo_productor);
      $('btn-copiar').textContent = '✓'; setTimeout(function () { $('btn-copiar').textContent = 'copiar'; }, 1500);
    };
    $('btn-add-prod').onclick = agregarProduccion;
    $('btn-add-ruta').onclick = agregarRuta;
    $('p-toneladas').oninput = $('p-categoria').onchange = recalcProd;
    $('r-distancia').oninput = recalcRuta;
    $('btn-cerrar-qr').onclick = function () { $('modal-qr').classList.add('hidden'); };
    recalcProd(); recalcRuta();
  }

  function pintarCategorias() {
    $('p-categoria').innerHTML = Store.DAMU.categorias.map(function (c) {
      return '<option value="' + c + '">' + Store.DAMU.catIcono[c] + ' ' + Store.DAMU.catLabel[c] + '</option>';
    }).join('');
  }
  function recalcProd() {
    $('p-co2').textContent = Store.calcProduccion($('p-categoria').value, $('p-toneladas').value, $('p-meta').value).co2e_estimado;
  }
  function recalcRuta() {
    var r = Store.calcRuta($('r-distancia').value);
    $('r-co2').textContent = r.co2e_ruta;
    $('r-diesel').textContent = Math.round(r.costo_diesel).toLocaleString('es-CL');
  }

  function entrar(s) {
    sala = s;
    localStorage.setItem(KEY, s.codigo_productor);
    $('vista-inicio').classList.add('hidden');
    $('vista-panel').classList.remove('hidden');
    $('codigo-box').classList.remove('hidden'); $('codigo-box').classList.add('flex');
    $('btn-salir').classList.remove('hidden');
    $('codigo-val').textContent = s.codigo_productor;
    Store.onChange(function () { if (sala) { refrescarProducciones(); refrescarRutas(); } });
    refrescarProducciones(); refrescarRutas();
  }

  function refrescarProducciones() {
    var ps = Store.producciones(sala.id);
    $('lista-producciones').innerHTML = ps.map(function (p) {
      return '<li class="flex justify-between bg-slate-800/60 rounded px-2 py-1">'
        + '<span>' + Store.DAMU.catIcono[p.categoria] + ' ' + Store.DAMU.catLabel[p.categoria] + ' · ' + p.toneladas + ' t</span>'
        + '<span class="text-emerald-400">' + p.co2e_estimado + ' tCO₂e</span></li>';
    }).join('');
    $('r-vinculo').innerHTML = '<option value="">— sin vincular —</option>' + ps.map(function (p) {
      return '<option value="' + p.id + '">' + Store.DAMU.catLabel[p.categoria] + ' · ' + p.toneladas + ' t</option>';
    }).join('');
  }

  function agregarProduccion() {
    Store.addProduccion(sala.id, Store.calcProduccion($('p-categoria').value, $('p-toneladas').value, $('p-meta').value));
    refrescarProducciones();
  }

  function agregarRuta() {
    var calc = Store.calcRuta($('r-distancia').value);
    Store.addRuta(sala.id, {
      origen: $('r-origen').value.trim(), destino: $('r-destino').value.trim(),
      distancia_km: calc.distancia_km, co2e_ruta: calc.co2e_ruta, costo_diesel: calc.costo_diesel,
    }, $('r-vinculo').value || null);
    $('r-origen').value = $('r-destino').value = '';
    refrescarRutas();
  }

  function refrescarRutas() {
    var rutas = Store.rutas(sala.id);
    $('rutas-vacio').style.display = rutas.length ? 'none' : 'block';
    $('lista-rutas').innerHTML = rutas.map(tarjeta).join('');
    rutas.forEach(function (rt) {
      var b = document.getElementById('qr-' + rt.id);
      if (b) b.onclick = function () { generarQR(rt); };
    });
  }

  function tarjeta(rt) {
    var col = { disponible: 'slate', tomada: 'amber', entregada: 'emerald' }[rt.estado];
    var accion = '';
    if (rt.estado === 'tomada' && !rt.token_qr)
      accion = '<button id="qr-' + rt.id + '" class="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded py-1.5 animate-pulse">⚡ Generar QR de confirmación</button>';
    else if (rt.estado === 'tomada' && rt.token_qr)
      accion = '<button id="qr-' + rt.id + '" class="mt-2 w-full bg-slate-700 text-white text-sm rounded py-1.5">Ver QR</button>';
    else if (rt.estado === 'entregada')
      accion = '<p class="mt-2 text-emerald-400 text-sm font-semibold">✓ Entrega cerrada</p>';
    return '<div class="bg-slate-800/60 border border-' + col + '-700/50 rounded-xl p-3">'
      + '<div class="flex justify-between items-start"><strong>' + (rt.origen || '—') + ' → ' + (rt.destino || '—') + '</strong>'
      + '<span class="text-xs bg-' + col + '-900/50 text-' + col + '-300 px-2 py-0.5 rounded-full">' + rt.estado + '</span></div>'
      + '<p class="text-xs text-slate-400 mt-1">' + rt.distancia_km + ' km · ' + rt.co2e_ruta + ' kg CO₂e</p>'
      + (rt.transportista_alias ? '<p class="text-xs text-amber-300 mt-1">🚚 ' + rt.transportista_alias + '</p>' : '')
      + accion + '</div>';
  }

  function generarQR(rt) {
    var token = rt.token_qr || Store.nuevoTokenQR();
    if (!rt.token_qr) Store.actualizarRuta(rt.id, { token_qr: token });
    $('qr-ruta-label').textContent = rt.origen + ' → ' + rt.destino;
    $('qr-token').textContent = token;            // respaldo manual para demo sin cámara
    QR.pintar($('qr-canvas'), token);
    $('modal-qr').classList.remove('hidden');
    refrescarRutas();
  }
})();
