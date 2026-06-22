# Módulo Operativo REP — Réplica funcional (sin servidor)

App autónoma de rutas y producción sustentable (Ley REP). **No usa Supabase ni login.**
Todo corre en el navegador: datos en `localStorage`, tiempo real entre pestañas con
`BroadcastChannel`. Carpeta independiente; no toca ningún otro proyecto.

## Cómo usar

1. Abre `operativo/index.html`.
2. **Productor**: genera su Código (ej. `DAMU-7F3K`), asigna producción (calculadora
   ambiental), crea rutas con impacto CO₂e y vincula producción ↔ ruta.
3. **Transportista**: abre `transportista.html` en otra pestaña, teclea el código →
   ve las rutas disponibles, toma una → en el panel del productor salta la alerta
   **"Generar QR"** en vivo.
4. Productor genera el QR; el transportista lo escanea (o pega el código manual) para
   cerrar la entrega → estado `entregada`.

> La cámara para escanear QR exige servir por `http(s)` (`python -m http.server`).
> Para abrir con doble clic (`file://`) usa el **código manual** del QR, ya incluido.

## Archivos

```
operativo/
├── index.html          Lanzador (dos paneles)
├── productor.html
├── transportista.html
├── README.md
└── js/
    ├── store.js           "Backend" en localStorage + BroadcastChannel + cálculos REP
    ├── qr.js              Generar (qrcode) / escanear (html5-qrcode)
    ├── productor.js
    └── transportista.js
```

## Modelo de datos (en localStorage, clave `damu_op_db`)

`productores · producciones · rutas · vinculos` — réplica de las entidades del diseño
relacional, sin usuarios registrados (la identidad es el código de productor).
Estado de ruta: `disponible → tomada → entregada`.
