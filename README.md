# Field Shift — Adapting Farms with NASA Data

Asesor de decisión para agricultores de Arequipa (Perú) frente al cambio climático:
rotación de cultivos, salud del suelo y balance hídrico, usando datos de NASA
(POWER, MODIS, SMAP) y referencias de SIEA-MIDAGRI / ENFEN.

**NASA Space Apps Challenge** — "Field Shift: Adapting Farms with NASA Data".

## El problema

Temperaturas fluctuantes, lluvia impredecible, escasez de agua y degradación
del suelo obligan al agricultor a elegir bien la rotación de cultivos — decisión
crítica pero difícil sin datos precisos. La app evalúa rotaciones según salud
del suelo, ahorro de agua e ingreso, y las explica en lenguaje simple.

## Estructura del repositorio

```
Nasa_adapting_farm/
├── frontend/                     # SPA estática (sin build)
│   ├── field_shift_asesor_de_rotaci_n_de_cultivos_arequipa (1).html
│   ├── styles.css                # sistema de color Display P3 + tema
│   └── app.js                    # estado, mapa Leaflet, i18n ES/EN,
│                                 # scoring local + cliente del modelo
├── backend/                      # Monolito modular FastAPI
│   ├── data_model/               # CSVs de entrenamiento del clasificador
│   │   ├── train_con_target.csv  # ~11.7k filas diarias NASA POWER + target
│   │   ├── test_con_target.csv
│   │   └── nasa_power_con_target.csv
│   └── app/
│       ├── main.py               # app, CORS, health check
│       ├── core/config.py        # Settings (pydantic-settings)
│       └── modules/
│           ├── parcels/          # zonas de riego + geometría satelital
│           ├── rotations/        # motor local + clasificador CatBoost
│           │   ├── clasificador_cultivo.py   # API + orquestación de rotación
│           │   ├── prioridades.py           # rieles → pesos por columna
│           │   ├── generar_target.py        # constantes/etiquetas del modelo
│           │   ├── entrenar_clasificador_ui.py
│           │   ├── clasificador_cultivo_ui.cbm  # modelo entrenado
│           │   ├── clasificador_meta.json      # features, clases, climatología
│           │   └── domain.py / service.py / controller.py
│           └── climate/          # parámetros NASA POWER por zona
└── model/                        # Datos y pipeline del modelo (pampa de Majes)
    ├── README.md                 # detalle de datos reales vs sintéticos
    ├── simulador_tope.py         # simulador agua/rotación/tope (stdlib)
    ├── data/                     # CSVs + NPZ satelitales (NDVI, ET)
    └── pipeline/                 # scripts de extracción satelital
```

## Frontend

HTML + Tailwind CDN + Leaflet + Font Awesome, sin build step.

- **Ranura en C** con 3 rieles arrastrables: ahorro de agua, salud del suelo, ingreso.
- **Selector de mes de siembra** y **cultivo actual** (Papa, Maíz, Arroz, Ninguno;
  Cebolla/Haba/Alfalfa quedan para el fallback local).
- **Rotaciones recomendadas**: cuando el backend responde, las tarjetas son la
  salida del modelo CatBoost — una tarjeta por campaña (`C1 · Noviembre`,
  `C2 · Marzo`, `C3 · Julio` por defecto) con la cadena acumulada de cultivos,
  bloques derivados de los pesos de rieles y confianza según probabilidad.
- **Frente de Compromisos (Pareto)** + explicación ("¿Por qué esta rotación?")
  y botón de copia para WhatsApp — funciona igual con salidas del modelo.
- **Mapa satelital** (Esri World Imagery): botón 🗺️ junto a Zona-Ubicación;
  clic reubica el polígono de la parcela; el punto elegido se envía como
  `lat`/`lon` al backend.
- **Selector de idioma** ES/EN (arriba a la derecha).
- **Modal de parámetros NASA POWER** (T2M, PRECTOT, RH2M, SW_DWN, WS2M, CE):
  lo que el usuario fija ahí se envía como modo avanzado al modelo.
- **Fallback local**: si el backend no responde o la zona/cultivo no está en el
  modelo, se muestra el ranking local hardcodeado + aviso. La demo nunca se rompe.
- Colores en **Display P3** con fallback sRGB; fondo animado de iconos FA.

### Correr

```bash
cd frontend
py -3 -m http.server 5500
# → http://localhost:5500/field_shift_asesor_de_rotaci_n_de_cultivos_arequipa%20(1).html
```

> Servir con `http.server` (no `file://`) para que el `fetch` al backend no sea bloqueado.

## Backend

Monolito modular: cada módulo tiene `domain.py` (entidades + reglas puras +
esquemas), `service.py` (casos de uso) y `controller.py` (HTTP).

Requiere **Python 3.9+** (los archivos usan `from __future__ import annotations`
para las uniones `X | None`). Dependencias: `fastapi`, `uvicorn`, `pydantic`,
`pydantic-settings`, `catboost`, `pandas`, `numpy`.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/api/parcels` | Lista de zonas de riego con polígono y estrés |
| GET | `/api/parcels/{key}` | Detalle de una zona (`majes`, `chili`, `camana`, `siguas`) |
| GET | `/api/rotations/crops` | Cultivos con rotaciones registradas (motor local) |
| POST | `/api/rotations/rank` | Ranking local de rotaciones (JSON body) |
| GET | `/api/rotations/rank` | Ranking local de rotaciones (query params) |
| GET | `/api/rotations/cobertura` | Zonas/cultivos que el modelo CatBoost soporta |
| GET | `/api/rotations/zona?lat&lon` | ¿El punto del mapa está cubierto por el modelo? |
| POST | `/api/rotations/classify` | Clasificador CatBoost: 1 campaña → mejor cultivo |
| POST | `/api/rotations/rotation` | **Orquestador**: N campañas encadenadas (el cultivo recomendado de una pasa a ser el `cultivo_previo` de la siguiente; el mes avanza `paso_meses`) |
| GET | `/api/climate/defaults` | Defaults climáticos NASA POWER por zona |
| POST | `/api/climate/validate` | Validación de parámetros climáticos |

### Modelo CatBoost (`modules/rotations/`)

- **Features** (12): mes cíclico (`mes_sin`/`mes_cos`), clima (`t2m`, `rh2m`,
  `sw_dwn`, `ws2m`, `prectot`), salinidad (`ce`), 3 pesos de rieles normalizados
  (`w_agua`, `w_suelo`, `w_ingreso`) y `cultivo_previo`.
- **Clases**: `arroz`, `papa`, `maiz_duro`.
- **Cobertura**: solo **Valle de Tambo** (celda NASA ±0.25° lat / ±0.31° lon,
  centro ≈ -17.10, -71.75). Fuera de ella o con cultivos no soportados
  (Cebolla, Haba, Alfalfa) devuelve `soportado: false` con mensaje claro —
  el modelo no inventa respuestas.
- **Rieles → columnas** (`prioridades.py`): cada riel se descompone en columnas
  con peso interno fijo — agua: consumo 60% + productividad 40%; suelo:
  rotación previo→siguiente 40% + tolerancia CE 35% + impacto del cultivo 25%;
  ingreso: ingreso neto 100%. `peso del riel = valor ÷ suma de los 3` y luego
  `peso_efectivo_por_columna = peso_riel × peso_interno`.
- **Modo simple vs avanzado**: en simple el clima sale de la climatología mensual
  de la zona (`clasificador_meta.json`) y CE = 2.8 por defecto; en avanzado se
  usan los valores que el usuario fija (T2M, RH2M, SW_DWN, WS2M, PRECTOT, CE).
  La respuesta incluye `valores_usados` y `origen_valores`.
- **Explicabilidad**: `factores_principales` = top-3 aportes SHAP por campaña.
- **Filtro de rotación**: `evitar_repeticion` evita sembrar el mismo cultivo
  dos campañas seguidas (toma la 2da opción del ranking y lo reporta).
- **Datos de entrenamiento**: `backend/data_model/*_con_target.csv` — series
  diarias NASA POWER + columnas de rendimiento/agua/ingreso por cultivo y
  `target` = mejor cultivo por margen de ingreso neto. Etiquetas generadas por
  reglas (ver `model/README.md`), no por decisiones observadas de agricultores.

### Correr

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000  ·  docs en /docs
```

## Modelo de datos (`model/`)

Dataset principal: `model/data/dataset_modelo_rotacion_majes - dataset_modelo.csv`
(247 filas × 39 columnas): clima NASA POWER histórico, suelo (pH, CE), cultivo
previo/candidato, demanda hídrica FAO-56, rendimiento e ingreso, y scores
objetivo (`score_balanceado`, `mejor_balanceado`, `fue_sembrado`).

Datos satelitales reales: NDVI y ET por píxel (MODIS, 2013–2025) en `.npz`.
Rendimientos reales Midagri 2010–2025 en `rendimiento_majes_tablero.csv`.

Ver `model/README.md` para el detalle de qué es real y qué es sintético.
Ver `model/simulador_tope.py` para el simulador de tope colectivo de agua.

## Fuentes de datos

- **NASA POWER** — climatología agrometeorológica por coordenadas.
- **MODIS / SMAP** (via Planetary Computer) — NDVI y humedad de suelo por píxel.
- **SIEA-MIDAGRI** — visores GEE (humedad, sequía, arroz, heladas, dinámica).
- **ENFEN** — monitoreo El Niño / Oscilación Sur.
- **Midagri / INIA** — rendimientos y balance de nitrógeno en chacra.

## Roadmap

- [x] Clasificador CatBoost entrenado y servido desde `rotations` (`/classify`, `/rotation`).
- [x] Frontend conectado al backend con fallback local.
- [ ] `climate/service.py`: fetch real a NASA POWER API con caché.
- [ ] Scoring con ETc FAO-56 + Maas-Hoffman (salinidad) en `rotations`.
- [ ] Endpoint orquestador `POST /api/recommendations`.
- [ ] Ampliar cobertura del modelo a más valles (hoy solo Valle de Tambo).
