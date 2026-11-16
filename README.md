# GreenOrbit — rotaciones de cultivo que caben en el agua que llega

Proyecto para **NASA Space Apps Challenge 2026**, reto **Field Shift: Adapting Farms with NASA Data**.
**Demo en vivo:** <https://rizosfera.onrender.com/app/> · API: <https://rizosfera.onrender.com/docs>
(servidor gratuito: si nadie lo usó en los últimos minutos, la primera visita tarda cerca de un minuto en cargar)

Zona piloto: pampa de **Majes** (Arequipa, Perú), un desierto que vive del agua del canal de Majes; mapa satelital también para el **Valle de Tambo**.

La pampa recibe unos **334 millones de m³** de agua al año y los satélites indican que plantas y suelo consumen unos **138**. Con la eficiencia real de riego, la mezcla de cultivos actual ya pediría entre el **78 % y el 99 %** del agua disponible: casi no hay margen para un año seco. GreenOrbit ayuda a decidir qué sembrar con esa restricción. Apoya la decisión; no la reemplaza.

## Qué hace

**Para el agricultor**
- Marca los cultivos que piensa sembrar y mueve tres prioridades: ahorrar agua, cuidar el suelo, ganar más.
- Recibe rotaciones de tres campañas que respetan reglas agronómicas con fuente (INIA: no repetir familia, 3 años sin papa) y, siempre, su forma actual para comparar. Si con sus cultivos no hay rotación posible (por ejemplo, solo papa), le dice qué cultivo agregar.
- Ve cuánta agua le llega por hectárea (≈ 21 000 m³ al año en un año normal) y, mes a mes, si cada rotación cabe, también en un año seco.
- Toca su parcela en el mapa: el satélite muestra su verdor, el agua que usa y cómo le fue en los años secos, y las rotaciones se ajustan a ese punto.
- Cada recomendación explica por qué gana, qué cede y qué datos faltan. Opcionalmente una IA (Gemini) la redacta en lenguaje llano usando solo las cifras del modelo.

**Para la Junta de Usuarios**
- ¿Alcanza el agua con esta mezcla de cultivos? Demanda frente a lo disponible, con la eficiencia calibrada.
- Mapa de zonas sensibles a la sequía: qué cuadros perdieron más verdor en 2014, 2016 y 2023 y se recuperaron después (los que bajaron para siempre se marcan como cambio de uso).
- Al bajar el agua disponible, el mapa marca las zonas que se quedarían sin riego primero.

Interfaz en español e inglés.

## Datos y cómo se verificaron

| Fuente | Qué se usa | Verificación |
|---|---|---|
| MODIS MOD13Q1 (NDVI, 250 m), NASA | Verdor de cada cuadro de 5,4 ha, 2013–2025 | Idéntico a NASA AppEEARS: 715 comparaciones, diferencia 0; filas y columnas iguales en los 36 puntos |
| MODIS MOD16A3GF (ET, 500 m), NASA | Agua que consumen plantas y suelo | Igual a AppEEARS en 156 casos (correlación 0,999) |
| NASA POWER | Clima para la demanda de agua (ET0 FAO-56) | Penman-Monteith probado con el ejemplo 18 de FAO-56 |
| USGS SSEBop | Consumo de agua de la pampa | Contraste con MODIS |
| Autodema (SIMHEI) | Agua entregada en Pitay, mensual 2003–2026 | Serie oficial |
| Midagri (SIEA, tableros) | Rendimiento, precio en chacra, siembra mensual e intenciones de siembra de Majes | Leído por dos vías; cifras coinciden |
| INIA, FAO-29, FAO-56 | Reglas de rotación, tolerancia a sales, Kc | Con fuente en el código |

## El modelo, en corto

- **Agua:** FAO-56 (Kc × ET0) con los meses de siembra reales de Majes. Calibrado contra la ET satelital: con Hargreaves queda entre −3 % y +7 %; la eficiencia de riego implícita es ≈ 0,5 (no 0,75).
- **Rotaciones:** se generan todas las combinaciones de tres campañas, se descartan las que rompen reglas y se puntúan agua, suelo (balance de nitrógeno) e ingreso (precio real de Majes, descontando la pérdida por salinidad).
- **Lo que no funcionó:** un modelo predictivo de rendimiento (CatBoost) no superó al rendimiento habitual de cada cultivo (error 0,230 frente a 0,221, validación dejando un año fuera). No se usa.
- **Lo que no sabemos:** costos de producción (solo la alfalfa tiene dato oficial), salinidad medida por parcela, el agua que recibe cada parcela (se usa el promedio por hectárea) y el detalle de cada parcela (el satélite ve cuadros de 5,4 ha).

Más detalle en [`model/README.md`](model/README.md).

## Cómo correrlo

La versión publicada está en <https://rizosfera.onrender.com/app/>. Para correrla en tu máquina se requiere Python 3.11 o superior.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn app.main:app --port 8765
```

- Interfaz: <http://localhost:8765/app/>
- Documentación de la API: <http://localhost:8765/docs>

**IA opcional.** Para que Gemini redacte las explicaciones, crea `backend/.env` (está en `.gitignore`, nunca se sube):

```
FIELD_SHIFT_GEMINI_API_KEY=tu_clave_de_google_ai_studio
```

Sin clave, la app funciona igual con la explicación generada por el modelo.

**Pruebas**

```bash
.venv/bin/pip install pytest httpx
cd model && ../.venv/bin/python -m pytest tests
cd ../backend && ../.venv/bin/python -m pytest tests
```

## API principal (`/api/model`)

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/rotations` | Rotaciones para un cultivo actual (prioridades, salinidad, parcela, cultivos planificados, agua del año, idioma) |
| GET | `/explain` | Explicación de una rotación (plantilla o Gemini) |
| GET | `/calendar` | Agua que pide cada campaña frente a la que llega, mes a mes |
| POST | `/simulate` | Agua que pide una mezcla de cultivos frente al tope de la Junta |
| GET | `/point` | Lo que vio el satélite en el cuadro de un punto |
| GET | `/irrigated` | Cuadros regados de la zona |
| GET | `/vulnerability` | Zonas sensibles a la sequía (Majes) |
| GET | `/crops`, `/mixes`, `/rotation-crops` | Catálogos |

## Estructura

```
backend/   API FastAPI; sirve también la interfaz en /app/
frontend/  Interfaz (HTML, Tailwind, Leaflet)
model/     Modelo de agua y rotaciones, datos satelitales y oficiales, pruebas
model/pipeline/  Scripts que descargaron NDVI y ET de NASA (Planetary Computer)
render.yaml  Despliegue en Render
```

## Despliegue

`render.yaml` define un servicio web gratuito en Render: instala `backend/requirements.txt` y arranca Uvicorn. La clave de Gemini se configura como variable de entorno en el panel de Render, no en el repositorio. En el plan gratuito el servicio se duerme tras unos minutos sin uso y la primera visita tarda cerca de un minuto.

## Equipo

GreenOrbit — NASA Space Apps Challenge 2026, Arequipa, Perú.
