// ═══════════════════════════════════════════════════════════════════
// store.js — "Backend" 100% en el navegador (sin Supabase)
//   • Persistencia: localStorage  (los datos sobreviven a recargas)
//   • Tiempo real : BroadcastChannel (sincroniza pestañas Productor ↔ Transportista)
//   • Identidad   : código de productor (sin login)
// Todas las páginas de operativo/ cargan este archivo.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Catálogo Ley REP (tarifas, CO₂e, factores logísticos) ─────────
  var DAMU = {
    tarifas: {
      envases:    { co2: 0.8 }, neumaticos: { co2: 1.4 }, pilas: { co2: 0.4 },
      raee:       { co2: 1.1 }, aceites:    { co2: 0.9 },
    },
    categorias: ['envases','neumaticos','pilas','raee','aceites'],
    catLabel: { envases:'Envases', neumaticos:'Neumáticos', pilas:'Pilas/Bat.', raee:'RAEE', aceites:'Aceites' },
    catIcono: { envases:'📦', neumaticos:'🛞', pilas:'🔋', raee:'🖥️', aceites:'🛢️' },
    rendimDefault: 12,    // km/L
    dieselDefault: 1200,  // CLP/L
    co2PorLitro:   2.68,  // kg CO₂e por litro
  };

  var DB_KEY = 'damu_op_db';            // toda la base vive aquí
  var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('damu_op') : null;

  // ── Lectura/escritura de la "base de datos" ───────────────────────
  function leer() {
    try { return JSON.parse(localStorage.getItem(DB_KEY)) || base(); }
    catch (e) { return base(); }
  }
  function base() {
    return { productores: [], producciones: [], rutas: [], vinculos: [] };
  }
  function guardar(db, avisar) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (avisar !== false) emitir();
  }
  function emitir() {
    if (bc) bc.postMessage({ t: Date.now() });
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ── Suscripción a cambios (entre pestañas y dentro de la misma) ───
  function onChange(cb) {
    if (bc) bc.onmessage = function () { cb(); };
    // 'storage' se dispara en OTRAS pestañas; cubre el caso sin BroadcastChannel
    window.addEventListener('storage', function (e) { if (e.key === DB_KEY) cb(); });
  }

  // ── Cálculos REP ──────────────────────────────────────────────────
  function calcProduccion(categoria, toneladas, metaPct) {
    var t = DAMU.tarifas[categoria] || { co2: 1 };
    return {
      categoria: categoria,
      toneladas: +toneladas || 0,
      co2e_estimado: +((+toneladas || 0) * t.co2).toFixed(2),
      meta_valorizacion_pct: +metaPct || 0,
    };
  }
  function calcRuta(distanciaKm) {
    var d = +distanciaKm || 0;
    var litros = d / DAMU.rendimDefault;
    return {
      distancia_km: +d.toFixed(2),
      costo_diesel: +(litros * DAMU.dieselDefault).toFixed(2),
      co2e_ruta: +(litros * DAMU.co2PorLitro).toFixed(2),
    };
  }

  function nuevoCodigo() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    return 'DAMU-' + s;
  }

  // ── API de dominio (equivale a las tablas op_*) ───────────────────
  var Store = {
    DAMU: DAMU,
    onChange: onChange,
    calcProduccion: calcProduccion,
    calcRuta: calcRuta,
    nuevoTokenQR: function () { return 'QR-' + uid(); },

    crearProductor: function (nombre) {
      var db = leer();
      var p = { id: uid(), codigo_productor: nuevoCodigo(), nombre_empresa: nombre || 'Productora', created_at: Date.now() };
      db.productores.push(p); guardar(db);
      return p;
    },
    buscarProductor: function (codigo) {
      return leer().productores.filter(function (p) { return p.codigo_productor === codigo; })[0] || null;
    },

    addProduccion: function (productorId, datos) {
      var db = leer();
      datos.id = uid(); datos.productor_id = productorId; datos.created_at = Date.now();
      db.producciones.push(datos); guardar(db);
      return datos;
    },
    producciones: function (productorId) {
      return leer().producciones.filter(function (x) { return x.productor_id === productorId; });
    },

    addRuta: function (productorId, datos, produccionId) {
      var db = leer();
      var r = {
        id: uid(), productor_id: productorId,
        origen: datos.origen || '', destino: datos.destino || '',
        distancia_km: datos.distancia_km, co2e_ruta: datos.co2e_ruta, costo_diesel: datos.costo_diesel,
        estado: 'disponible', transportista_alias: null, token_qr: null, created_at: Date.now(),
      };
      db.rutas.push(r);
      if (produccionId) db.vinculos.push({ id: uid(), ruta_id: r.id, produccion_id: produccionId });
      guardar(db);
      return r;
    },
    rutas: function (productorId) {
      return leer().rutas
        .filter(function (x) { return x.productor_id === productorId; })
        .sort(function (a, b) { return b.created_at - a.created_at; });
    },
    actualizarRuta: function (rutaId, cambios) {
      var db = leer();
      db.rutas.forEach(function (r) { if (r.id === rutaId) Object.assign(r, cambios); });
      guardar(db);
    },
    // Toma atómica: solo si sigue 'disponible' (evita doble toma)
    tomarRuta: function (rutaId, alias) {
      var db = leer(), ok = false;
      db.rutas.forEach(function (r) {
        if (r.id === rutaId && r.estado === 'disponible') { r.estado = 'tomada'; r.transportista_alias = alias; ok = true; }
      });
      if (ok) guardar(db);
      return ok;
    },
  };

  window.Store = Store;
})();
