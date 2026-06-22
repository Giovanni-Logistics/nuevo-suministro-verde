// ═══════════════════════════════════════════════════════════════════
// mapa-ruta.js — Mapa de ruteo con Leaflet + Routing Machine (OSRM)
//   Geocodificación: Nominatim (OpenStreetMap, gratis, sin API key)
//   Calcula distancia → litros → costo diésel → CO₂e (constantes REP)
//   Guarda la ruta en Store para el código de productor indicado.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', init);
  var $ = function (id) { return document.getElementById(id); };
  var clp = function (n) { return '$' + Math.round(n).toLocaleString('es-CL'); };

  var map, control, rutaCalc = null;

  function init() {
    map = L.map('map').setView([-33.45, -70.66], 11); // Santiago RM
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    setTimeout(function () { map.invalidateSize(); }, 200);

    $('btn-trazar').onclick = trazar;
    $('btn-guardar').onclick = guardar;
    $('in-codigo').addEventListener('input', cargarProducciones);
    // Precarga el código del productor si quien abre venía del panel
    var cod = localStorage.getItem('damu_op_codigo_productor') || localStorage.getItem('damu_op_codigo');
    if (cod) { $('in-codigo').value = cod; cargarProducciones(); }
  }

  // Al teclear un código válido, llena el selector con sus producciones
  function cargarProducciones() {
    var sel = $('in-vinculo');
    var sala = Store.buscarProductor($('in-codigo').value.trim().toUpperCase());
    if (!sala) {
      sel.innerHTML = '<option value="">— ingresa un código válido —</option>';
      $('vinc-msg').textContent = '';
      return;
    }
    var ps = Store.producciones(sala.id);
    if (!ps.length) {
      sel.innerHTML = '<option value="">— sin producciones registradas —</option>';
      $('vinc-msg').textContent = sala.nombre_empresa + ': aún no tiene producciones.';
      return;
    }
    sel.innerHTML = '<option value="">— sin vincular —</option>' + ps.map(function (p) {
      return '<option value="' + p.id + '">' + Store.DAMU.catIcono[p.categoria] + ' '
        + Store.DAMU.catLabel[p.categoria] + ' · ' + p.toneladas + ' t</option>';
    }).join('');
    $('vinc-msg').textContent = sala.nombre_empresa + ': ' + ps.length + ' producción(es) disponibles.';
  }

  // Nominatim: dirección → {lat, lng}
  function geocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then(function (r) { return r.json(); })
      .then(function (a) { return (a && a[0]) ? { lat: +a[0].lat, lng: +a[0].lon } : null; });
  }

  function trazar() {
    $('map-msg').textContent = 'Buscando direcciones…';
    Promise.all([geocode($('in-origen').value), geocode($('in-destino').value)]).then(function (pts) {
      if (!pts[0] || !pts[1]) { $('map-msg').textContent = 'No se encontró alguna dirección.'; return; }
      $('map-msg').textContent = 'Calculando ruta…';
      if (control) map.removeControl(control);
      control = L.Routing.control({
        waypoints: [L.latLng(pts[0].lat, pts[0].lng), L.latLng(pts[1].lat, pts[1].lng)],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        addWaypoints: false, draggableWaypoints: false, fitSelectedRoutes: true, show: false,
        lineOptions: { styles: [{ color: '#2563eb', weight: 5 }] },
      }).addTo(map);

      control.on('routesfound', function (e) {
        var route = e.routes[0];
        var km = route.summary.totalDistance / 1000;
        var calc = Store.calcRuta(km); // distancia_km, costo_diesel, co2e_ruta
        var litros = km / Store.DAMU.rendimDefault;
        rutaCalc = {
          origen: $('in-origen').value, destino: $('in-destino').value,
          distancia_km: calc.distancia_km, co2e_ruta: calc.co2e_ruta, costo_diesel: calc.costo_diesel,
        };
        $('r-dist').textContent = calc.distancia_km + ' km';
        $('r-litros').textContent = litros.toFixed(1) + ' L';
        $('r-diesel').textContent = clp(calc.costo_diesel);
        $('r-co2').textContent = calc.co2e_ruta + ' kg';
        $('map-msg').textContent = 'Ruta lista. Puedes guardarla.';
      });
      control.on('routingerror', function () { $('map-msg').textContent = 'No se pudo calcular la ruta (OSRM).'; });
    }).catch(function () { $('map-msg').textContent = 'Error de geocodificación.'; });
  }

  function guardar() {
    if (!rutaCalc) { msg('Primero calcula una ruta.', false); return; }
    var cod = $('in-codigo').value.trim().toUpperCase();
    var sala = Store.buscarProductor(cod);
    if (!sala) { msg('Código de productor no encontrado.', false); return; }
    var vinc = $('in-vinculo').value || null;
    Store.addRuta(sala.id, rutaCalc, vinc);
    msg('✓ Ruta guardada para ' + sala.nombre_empresa + (vinc ? ' (con producción vinculada).' : '.') + ' Visible en sus paneles.', true);
  }

  function msg(t, ok) {
    var el = $('save-msg');
    el.textContent = t;
    el.className = 'text-xs mt-2 h-4 ' + (ok ? 'text-emerald-400' : 'text-red-400');
  }
})();
