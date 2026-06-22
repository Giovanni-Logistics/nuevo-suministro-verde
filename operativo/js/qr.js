// ═══════════════════════════════════════════════════════════════════
// qr.js — Generar / escanear QR (sin backend)
//   Generar : qrcode@1.5.3   ·   Escanear : html5-qrcode
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var QR = {
    pintar: function (el, texto) {
      el.innerHTML = '';
      if (!window.QRCode) { el.textContent = texto; return; }
      var canvas = document.createElement('canvas');
      el.appendChild(canvas);
      window.QRCode.toCanvas(canvas, texto, { width: 220, margin: 1 }, function (err) {
        if (err) el.textContent = texto;
      });
    },
    escanear: function (contenedorId) {
      return new Promise(function (resolve, reject) {
        if (!window.Html5Qrcode) { reject(new Error('html5-qrcode no cargado')); return; }
        var scanner = new window.Html5Qrcode(contenedorId);
        QR._activo = scanner;
        scanner.start(
          { facingMode: 'environment' }, { fps: 10, qrbox: 220 },
          function (texto) { scanner.stop().then(function () { resolve(texto); }).catch(function () { resolve(texto); }); },
          function () {}
        ).catch(reject);
      });
    },
    detener: function () { if (QR._activo) { try { QR._activo.stop(); } catch (e) {} QR._activo = null; } },
  };
  window.QR = QR;
})();
