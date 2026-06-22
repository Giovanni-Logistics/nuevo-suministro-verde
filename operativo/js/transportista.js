// ═══════════════════════════════════════════════════════════════════
// transportista.js — Panel Transportista (sin registro, sin backend)
//   Sesión persistida en localStorage('damu_op_codigo')
//   Finaliza por cámara (html5-qrcode) o por código manual (demo sin cámara)
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', init);
  var KEY = 'damu_op_codigo';
  var sala = null, alias = null, rutaActiva = null;
  var $ = function (id) { return document.getElementById(id); };

  function init() {
    bind();
    var cod = localStorage.getItem(KEY);
    if (cod) {
      var s = Store.buscarProductor(cod);
      if (s) return entrar(s);
      localStorage.removeItem(KEY);
    }
    Store.onChange(function () { if (sala) refrescar(); });
  }

  function bind() {
    $('btn-entrar').onclick = entrarPorCodigo;
    $('in-codigo').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarPorCodigo(); });
    $('btn-salir').onclick = function () { localStorage.removeItem(KEY); location.reload(); };
    $('btn-cerrar-scan').onclick = cerrarScan;
    $('btn-validar-manual').onclick = function () { validar($('in-token').value.trim()); };
  }

  function entrarPorCodigo() {
    var s = Store.buscarProductor($('in-codigo').value.trim().toUpperCase());
    if (!s) { $('codigo-msg').textContent = 'Código inválido. Verifícalo con el productor.'; return; }
    entrar(s);
  }

  function entrar(s) {
    sala = s;
    localStorage.setItem(KEY, s.codigo_productor);
    alias = localStorage.getItem('damu_op_alias') || ('Transportista ' + Math.floor(Math.random() * 900 + 100));
    localStorage.setItem('damu_op_alias', alias);
    $('vista-codigo').classList.add('hidden');
    $('vista-rutas').classList.remove('hidden');
    $('btn-salir').classList.remove('hidden');
    $('empresa-nom').textContent = s.nombre_empresa;
    $('alias-nom').textContent = alias;
    Store.onChange(function () { if (sala) refrescar(); });
    refrescar();
  }

  function refrescar() {
    var rutas = Store.rutas(sala.id).filter(function (rt) {
      return rt.estado === 'disponible' || rt.transportista_alias === alias;
    });
    $('rutas-vacio').classList.toggle('hidden', rutas.length > 0);
    $('lista-rutas').innerHTML = rutas.map(tarjeta).join('');
    rutas.forEach(function (rt) {
      var bt = document.getElementById('tomar-' + rt.id);
      if (bt) bt.onclick = function () { tomar(rt); };
      var bf = document.getElementById('fin-' + rt.id);
      if (bf) bf.onclick = function () { abrirScan(rt); };
    });
  }

  function tarjeta(rt) {
    var col = { disponible: 'slate', tomada: 'amber', entregada: 'emerald' }[rt.estado];
    var accion = '';
    if (rt.estado === 'disponible')
      accion = '<button id="tomar-' + rt.id + '" class="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-sm font-semibold rounded py-1.5">Tomar ruta</button>';
    else if (rt.estado === 'tomada' && rt.token_qr)
      accion = '<button id="fin-' + rt.id + '" class="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold rounded py-1.5">📷 Escanear QR para finalizar</button>';
    else if (rt.estado === 'tomada')
      accion = '<p class="mt-2 text-amber-300 text-sm">Esperando QR del productor…</p>';
    else if (rt.estado === 'entregada')
      accion = '<p class="mt-2 text-emerald-400 text-sm font-semibold">✓ Entrega finalizada</p>';
    return '<div class="bg-slate-800/60 border border-' + col + '-700/50 rounded-xl p-3">'
      + '<div class="flex justify-between items-start"><strong>' + (rt.origen || '—') + ' → ' + (rt.destino || '—') + '</strong>'
      + '<span class="text-xs bg-' + col + '-900/50 text-' + col + '-300 px-2 py-0.5 rounded-full">' + rt.estado + '</span></div>'
      + '<p class="text-xs text-slate-400 mt-1">' + rt.distancia_km + ' km · ' + rt.co2e_ruta + ' kg CO₂e · ' + Math.round(rt.costo_diesel).toLocaleString('es-CL') + ' CLP</p>'
      + accion + '</div>';
  }

  // Tomar ruta → el panel del productor recibe la alerta (tiempo real)
  function tomar(rt) {
    if (Store.tomarRuta(rt.id, alias)) refrescar();
    else { alert('Esa ruta ya fue tomada por otro transportista.'); refrescar(); }
  }

  function abrirScan(rt) {
    rutaActiva = rt;
    $('scan-ruta-label').textContent = rt.origen + ' → ' + rt.destino;
    $('scan-msg').textContent = ''; $('in-token').value = '';
    $('modal-scan').classList.remove('hidden');
    QR.escanear('qr-reader').then(function (texto) { validar(texto); }).catch(function () {
      $('scan-msg').className = 'text-sm h-5 mb-2 text-slate-400';
      $('scan-msg').textContent = 'Sin cámara: usa el código manual.';
    });
  }

  function validar(texto) {
    if (!rutaActiva) return;
    if (texto && texto === rutaActiva.token_qr) {
      Store.actualizarRuta(rutaActiva.id, { estado: 'entregada' });
      $('scan-msg').className = 'text-sm h-5 mb-2 text-emerald-400';
      $('scan-msg').textContent = '✓ Entrega cerrada';
      setTimeout(cerrarScan, 1000);
    } else {
      $('scan-msg').className = 'text-sm h-5 mb-2 text-red-400';
      $('scan-msg').textContent = 'QR/código no corresponde a esta ruta.';
    }
  }

  function cerrarScan() {
    QR.detener();
    $('modal-scan').classList.add('hidden');
    rutaActiva = null;
    refrescar();
  }
})();
