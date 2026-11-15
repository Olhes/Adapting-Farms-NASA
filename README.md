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
│   └── app.js                    # estado, mapa Leaflet, i18n ES/EN, scoring
├── backend/                      # Monolito modular FastAPI
│   └── app/
│       ├── main.py               # app, CORS, health check
│       ├── core/config.py        # Settings (pydantic-settings)
│       └── modules/
│           ├── parcels/          # zonas de riego + geometría satelital
│           ├── rotations/        # motor de ranking de rotaciones (FAO-56)
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
- **Rotaciones recomendadas** rankeadas por score ponderado según las prioridades.
- **Frente de Compromisos (Pareto)** + explicación agronómica ("¿Por qué esta rotación?")
  y botón de copia para WhatsApp.
- **Mapa satelital** (Esri World Imagery): se despliega con el botón 🗺️ junto a
  Zona-Ubicación; clic en el mapa reubica el polígono de la parcela; el color del
  polígono refleja la viabilidad de la mejor rotación.
- **Selector de idioma** ES/EN (arriba a la derecha).
- **Modal de parámetros NASA POWER** (T2M, PRECTOT, RH2M, SW_DWN, WS2M, CE).
- Colores en **Display P3** con fallback sRGB; fondo animado de iconos FA.

### Correr

Abrir el HTML directamente en el navegador, o servir la carpeta:

```bash
cd frontend
python -m http.server 5500
# → http://localhost:5500
```

## Backend

Monolito modular: cada módulo tiene `domain.py` (entidades + reglas puras +
esquemas), `service.py` (casos de uso) y `controller.py` (HTTP).

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/api/parcels` | Lista de zonas de riego con polígono y estrés |
| GET | `/api/parcels/{key}` | Detalle de una zona (`majes`, `chili`, `camana`, `siguas`) |
| GET | `/api/rotations/crops` | Cultivos con rotaciones registradas |
| POST | `/api/rotations/rank` | Ranking de rotaciones (JSON body) |
| GET | `/api/rotations/rank` | Ranking de rotaciones (query params) |
| GET | `/api/climate/defaults` | Defaults climáticos NASA POWER por zona |
| POST | `/api/climate/validate` | Validación de parámetros climáticos |

### Correr

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
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

- [ ] `climate/service.py`: fetch real a NASA POWER API con caché.
- [ ] Scoring con ETc FAO-56 + Maas-Hoffman (salinidad) en `rotations`.
- [ ] Endpoint orquestador `POST /api/recommendations`.
- [ ] Entrenar CatBoost sobre `dataset_modelo_rotacion_majes.csv` y servirlo
      desde el módulo `rotations`.
- [ ] Conectar el frontend a los endpoints del backend (fetch con fallback local).
