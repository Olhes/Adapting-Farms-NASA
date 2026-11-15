# Modelo Rizosfera (pampa de Majes)

Simulador de agua, rotación y tope colectivo para la pampa de Majes (Arequipa). Dos niveles:
Junta de Usuarios (agua entregada frente a agua consumida, tope colectivo) y agricultor (rotación dentro del agua asignada).

## Cómo correrlo

```bash
python3 simulador_tope.py     # solo usa la biblioteca estándar
```

## Contenido

- `simulador_tope.py`: demanda de agua por cultivo (FAO-56, ET0 Penman-Monteith mensual), mezclas de cultivos y verificación contra el tope.
- `data/`: datos usados por el modelo (ver tabla).
- `pipeline/`: scripts que generaron los datos satelitales (`pampa_completa_pc.py` necesita `pystac-client`, `planetary-computer`, `rasterio`, `numpy`; escriben junto al script, mover el resultado a `data/`).

## Qué es real y qué es supuesto

| Dato | Estado | Archivo |
|---|---|---|
| NDVI y ET por píxel 2013–2025 (MODIS, NASA) | Real | `data/ndvi_pampa_pixeles_anual.npz`, `data/et_pampa_pixeles_anual.npz` |
| Rendimiento y precio en chacra de Majes 2016–2025 (ajo, cebolla, papa) | Real (Midagri, leído del tablero Perfil Productivo) | `data/kpis_cultivo_majes_tablero.csv` |
| Rendimiento de todos los cultivos de Majes 2010–2025 | Real (Midagri) | `data/rendimiento_majes_tablero.csv` |
| Siembra mensual y mezcla 2026/27 de Majes | Real (Midagri) | `data/majes_siembra_mensual.csv`, `data/majes_intenciones_*.csv` |
| Meses de siembra de cebolla, papa, quinua y zapallo | Tomados de la siembra mensual histórica de Majes | `simulador_tope.py` (`SOWING`) |
| Meses de siembra de ajo, haba y maíz | Supuesto (maíz viene de Camaná) | `simulador_tope.py` (`SOWING`) |
| Balance de nitrógeno de ajo y cebolla | Extracción medida por el INIA en Santa Rita, 2023 | interfaz |
| Costos de producción, márgenes y balance de nitrógeno de los demás cultivos | Sintético o sin dato | `data/dataset_modelo_rotacion_majes - dataset_modelo.csv` |
| Eficiencia de riego (0,75) y área regada | Supuesto | `simulador_tope.py` |

## Límites conocidos

- El NDVI promedio de la pampa no explica el rendimiento por cultivo (11 años, correlaciones sin significancia). No se entrenó un modelo predictivo.
- No hay costos de producción oficiales para Majes: el ingreso bruto es real, el margen no.
- Las curvas de siembra mensual son promedios históricos, no el mes de una parcela.
