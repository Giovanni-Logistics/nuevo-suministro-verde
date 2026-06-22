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

    // Parámetros normativos Ley REP (Ley 20.920 / Decreto 12)
    metaMinima:   25,     // % mínimo de valorización exigido (Art. 48)
    utmCLP:       68000,  // valor UTM referencial (CLP)
    sancionUTMporTon: 0.5,// UTM por tonelada bajo la meta — estimación referencial
    factorReciclaje: 0.92,// t CO₂e evitadas por t valorizada (proxy economía circular)
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
    // ── Indicadores Ley REP del productor ───────────────────────────
    metricas: function (productorId) {
      var prods = Store.producciones(productorId);
      var rutas = Store.rutas(productorId);
      var ton = 0, co2eProd = 0, metaPond = 0, porCat = {};
      Store.DAMU.categorias.forEach(function (c) { porCat[c] = 0; });
      prods.forEach(function (p) {
        ton += p.toneladas;
        co2eProd += p.co2e_estimado;
        metaPond += p.toneladas * p.meta_valorizacion_pct;
        porCat[p.categoria] = (porCat[p.categoria] || 0) + p.toneladas;
      });
      // Meta de valorización ponderada por tonelaje
      var metaProm = ton > 0 ? metaPond / ton : 0;
      var cumple = metaProm >= Store.DAMU.metaMinima;
      // Toneladas valorizadas vs. brecha respecto al mínimo legal
      var tonValorizadas = ton * (metaProm / 100);
      var tonMinLegal = ton * (Store.DAMU.metaMinima / 100);
      var brechaTon = Math.max(0, tonMinLegal - tonValorizadas);
      // Riesgo de multa Art. 48 (estimación referencial)
      var riesgoUTM = brechaTon * Store.DAMU.sancionUTMporTon;
      var riesgoCLP = riesgoUTM * Store.DAMU.utmCLP;
      // CO₂e evitado por valorización (economía circular)
      var co2eEvitado = tonValorizadas * Store.DAMU.factorReciclaje;
      // Estado de rutas
      var co2eRutas = 0;
      var est = { disponible: 0, tomada: 0, entregada: 0 };
      rutas.forEach(function (r) { est[r.estado]++; co2eRutas += r.co2e_ruta; });

      return {
        toneladasTotales: +ton.toFixed(2),
        co2eProduccion: +co2eProd.toFixed(2),
        co2eRutasKg: +co2eRutas.toFixed(2),
        co2eEvitado: +co2eEvitado.toFixed(2),
        metaPromedio: +metaProm.toFixed(1),
        metaMinima: Store.DAMU.metaMinima,
        cumpleMeta: cumple,
        tonValorizadas: +tonValorizadas.toFixed(2),
        brechaTon: +brechaTon.toFixed(2),
        riesgoUTM: +riesgoUTM.toFixed(1),
        riesgoMultaCLP: Math.round(riesgoCLP),
        rutasTotal: rutas.length,
        rutasDisponibles: est.disponible,
        rutasTomadas: est.tomada,
        rutasEntregadas: est.entregada,
        tasaEntrega: rutas.length ? Math.round(est.entregada / rutas.length * 100) : 0,
        porCategoria: porCat,
      };
    },

    // ── Indicadores Ley REP del transportista ───────────────────────
    metricasTransportista: function (productorId, alias) {
      var db = leer();
      var misRutas = db.rutas.filter(function (r) {
        return r.productor_id === productorId && r.transportista_alias === alias;
      });
      var kmRecorridos = 0, co2eRutas = 0, costoDiesel = 0, entregadas = 0, enCurso = 0;
      var porCatKg = {};
      Store.DAMU.categorias.forEach(function (c) { porCatKg[c] = 0; });

      misRutas.forEach(function (r) {
        co2eRutas += r.co2e_ruta;
        costoDiesel += r.costo_diesel;
        if (r.estado === 'entregada') { entregadas++; kmRecorridos += r.distancia_km; }
        else if (r.estado === 'tomada') { enCurso++; }
        // kg transportados por categoría (vía vínculos producción↔ruta)
        db.vinculos.filter(function (v) { return v.ruta_id === r.id; }).forEach(function (v) {
          var p = db.producciones.filter(function (x) { return x.id === v.produccion_id; })[0];
          if (p) porCatKg[p.categoria] = (porCatKg[p.categoria] || 0) + p.toneladas * 1000;
        });
      });

      var kgTotal = 0;
      Object.keys(porCatKg).forEach(function (c) { kgTotal += porCatKg[c]; });

      return {
        rutasTotal: misRutas.length,
        entregadas: entregadas,
        enCurso: enCurso,
        kmRecorridos: +kmRecorridos.toFixed(1),
        co2eRutasKg: +co2eRutas.toFixed(1),
        costoDieselCLP: Math.round(costoDiesel),
        kgTransportados: Math.round(kgTotal),
        porCategoriaKg: porCatKg,
      };
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
