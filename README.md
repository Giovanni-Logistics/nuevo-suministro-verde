# Damu SGC — Plataforma de Trazabilidad Ley REP

Plataforma web SaaS para la gestión de logística inversa y cumplimiento de la **Ley REP (Ley 20.920 / Decreto 12)** en Chile. Conecta empresas productoras con transportistas para asegurar trazabilidad, valorización de residuos y reportes normativos ante el SMA.

---

## Arquitectura

**Stack:** HTML5 / JS vanilla · Tailwind CSS v3 (CDN) · Supabase (Postgres + Auth + RLS) · Vercel (hosting)  
**Autenticación:** Supabase Auth con Row Level Security. Dos roles: `productor` y `transportista`.  
**Routing:** OSRM (servidor público demo, sin API key) + Leaflet 1.9.4 + Leaflet Routing Machine.

```
/
├── index.html                  # Landing page pública + portal de acceso (auth/portal.html)
├── auth/
│   └── portal.html             # Login / registro / recuperar contraseña (Supabase Auth)
├── app/                        # Páginas privadas (protegidas por auth-guard.js)
│   ├── auth-guard.js           # Guarda de sesión + nav dinámico por rol
│   ├── constantes-rep.js       # Fuente única de verdad: tarifas, centros, factores CO₂e
│   ├── calculadora-rep.html    # [Productor] Calculadora de meta REP + generación de PDF
│   ├── dashboard-productor.html# [Productor] Dashboard de valorización, semáforo y red
│   ├── dashboard-kpi.html      # [Transportista] KPIs operativos, evolución temporal
│   ├── escaner-qr.html         # [Transportista] Escaneo QR → 3 escrituras DB en tiempo real
│   └── simulador-ruta.html     # [Ambos] Mapa operativo + rutas óptimas (algoritmo greedy)
├── database/
│   └── schema.sql              # Esquema completo Supabase: tablas, RLS, índices, triggers, RPCs
└── pages/                      # Páginas públicas de marketing
    ├── productores.html
    ├── transportistas.html
    └── mapa.html
```

---

## Modelo de datos

| Tabla | Descripción |
|---|---|
| `empresas` | Una empresa por productor. Genera `codigo_invitacion` automáticamente. |
| `transportistas_empresa` | Vínculo N:M transportista ↔ empresa (auto-unión por código). |
| `viajes_operativos` | Registros de rutas + escaneos QR. Columnas: `empresa_id`, `categoria`, `distancia_km`, `cargas_qr_kg`, `costo_diesel`. |
| `certificados_rep` | Declaraciones de meta REP del productor. Vinculadas a `empresa_id`. |
| `puntos_acopio` | Red de puntos de recolección. Estado: LIBRE / MEDIO / CRÍTICO según `carga_actual_kg / capacidad_total_kg`. |
| `flota_vehiculos` | Vehículos del transportista. Posición GPS + `carga_actual_kg` + `destino` (categoría). |
| `perfiles` | Roles habilitados por usuario (un usuario puede tener ambos roles). |

**Todos los campos `empresa_id` son nullables** → compatibilidad con datos pre-FASE 1. PostgreSQL evalúa múltiples políticas SELECT con lógica OR.

---

## Flujo principal

```
[Productor]                           [Transportista]
    │                                       │
    ├─ Registra empresa (auto-creada)       ├─ Recibe código de invitación
    ├─ Comparte codigo_invitacion           ├─ Se une a la empresa
    ├─ Declara meta REP (calculadora)       │
    │                                       ├─ Escanea QR del bulto (escaner-qr.html)
    │                                       │    → INSERT viajes_operativos (+categoria)
    │                                       │    → UPDATE puntos_acopio (descuenta carga)
    │                                       │    → UPDATE flota_vehiculos (suma carga + destino)
    │                                       │
    │                                       ├─ Ve mapa operativo (simulador-ruta.html)
    │                                       │    → Estado red acopio en tiempo real
    │                                       │    → Rutas sugeridas (OSRM + greedy nearest-neighbor)
    │                                       │    → Simula y guarda rutas
    │                                       │
    ├─ Dashboard REP (dashboard-productor)  ├─ Dashboard KPI (dashboard-kpi.html)
    │    → % valorización vs meta           │    → Costos, kg, CO₂e acumulados
    │    → Semáforo por categoría           │    → Evolución temporal (Chart.js)
    │    → Gráfico temporal (Chart.js)      │    → Eficiencia kg/km
    └─   → Estado red de acopio            └─   → Estado red empresa
```

---

## Tablas de constantes compartidas (`app/constantes-rep.js`)

| Clave | Uso |
|---|---|
| `DAMU.tarifas` | Tarifas REP por categoría (CLP/t) — usado en calculadora y dashboard |
| `DAMU.centros` | Centros de valorización por categoría (lat/lng) — escaner y simulador |
| `DAMU.catLabel/catColor/catIcono` | Presentación visual — todos los dashboards |
| `DAMU.rendimDefault / dieselDefault / co2PorLitro` | Factores logísticos — simulador y KPI |

---

## Seguridad

- **Anon key expuesta en `auth-guard.js`**: correcto — es el patrón oficial de Supabase. La clave anon no es un secreto; RLS enforza el acceso. La `service_role` key **nunca** debe estar en el cliente.
- **RLS habilitado en todas las tablas**: `viajes_operativos`, `certificados_rep`, `puntos_acopio`, `flota_vehiculos`, `empresas`, `transportistas_empresa`, `perfiles`.
- **Aislamiento entre empresas**: un productor solo ve viajes/certificados con `empresa_id` de su propia empresa. Un transportista solo ve datos de la empresa a la que está vinculado.
- **`empresa_select_by_codigo`**: permite que cualquier usuario autenticado busque empresas por código de invitación — necesario para el flujo "Unirse a empresa". Solo expone `nombre` y `activo`, sin datos sensibles.

---

## Dependencias externas

| Servicio | Uso | Límite |
|---|---|---|
| [OSRM demo](https://router.project-osrm.org) | Cálculo de rutas y matriz de distancias | ~1 req/s; no garantizado para producción |
| [Nominatim](https://nominatim.openstreetmap.org) | Geocodificación de texto en simulador | 1 req/s; política de uso justo |
| Supabase (proyecto `iaqvcpxselfjwbstcnma`) | Base de datos, Auth, RLS | Plan free: 500 MB / 50 k MAU |
| Chart.js 4.x (CDN) | Gráficos temporales en dashboards | — |
| Leaflet 1.9.4 + LRM 3.2.12 (CDN) | Mapa interactivo | — |

**Para producción**: reemplazar OSRM público por instancia propia o servicio comercial (GraphHopper, Mapbox).

---

## Setup local

```bash
# Sin servidor — basta con abrir directamente en el navegador:
open index.html

# Con servidor local (evita restricciones CORS en algunos browsers):
npx serve .
# o
python -m http.server 8080
```

No hay dependencias npm ni proceso de build. Todo es HTML/JS vanilla.

---

## Despliegue en Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com)
2. Sin variables de entorno requeridas (las credenciales Supabase están embebidas como es estándar para apps frontend con RLS)
3. Framework preset: **Other** (static site)

---

## SQL pendiente

Ejecutar `database/schema.sql` completo en **Supabase → SQL Editor** en este orden:
1. Todo el schema base (tablas, índices, RLS, triggers) — secciones 1–24
2. Política UPDATE de `puntos_acopio` — sección "FASE 2"
3. Columna `categoria` + backfill + RPCs — sección "FASE 4"

---

## Categorías Ley REP cubiertas

| Categoría | Clave | Tarifa |
|---|---|---|
| Envases y embalajes | `envases` | $18.000/t recolección |
| Neumáticos fuera de uso | `neumaticos` | $25.000/t recolección |
| Pilas y baterías | `pilas` | $35.000/t recolección |
| Aparatos eléctricos/electrónicos (RAEE) | `raee` | $40.000/t recolección |
| Aceites lubricantes usados | `aceites` | $22.000/t recolección |
