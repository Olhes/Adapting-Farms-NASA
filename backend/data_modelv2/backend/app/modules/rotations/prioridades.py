"""
Ecuaciones que traducen los 3 rieles de la UI a las columnas que usa el sistema.
Se usa IGUAL en el entrenamiento (para etiquetar) y en el backend (para mostrar los pesos efectivos).

  riel -> componentes (0-1)                        peso interno
  ahorro_agua   bajo_consumo_agua                  0.60   (menos m3/ha en el ciclo)
                productividad_del_agua             0.40   (kg de materia seca por m3)
  sanidad_suelo rotacion_previo_siguiente          0.40   (cultivo previo -> cultivo candidato)
                tolerancia_salinidad_CE            0.35   (% de rendimiento que se conserva con esa CE)
                impacto_intrinseco_cultivo         0.25   (extraccion de nutrientes, estructura, plagas)
  ingreso       ingreso_neto                       1.00   (columna explicita: S/ha)

score(cultivo) = w_agua*S_agua + w_suelo*S_suelo + w_ingreso*S_ingreso
con w = valor del riel / suma de los 3 rieles.

TODOS los pesos internos y coeficientes son SUPUESTOS editables (no hay datos reales para calibrarlos).
"""
import numpy as np

from app.modules.rotations import generar_target as g

CULT = ["arroz", "papa", "maiz_duro"]
PREV = ["ninguno", "arroz", "papa", "maiz_duro"]
RIELES = ["ahorro_agua", "sanidad_suelo", "ingreso"]

COMPOSICION = {
    "ahorro_agua": {"bajo_consumo_agua": 0.60, "productividad_del_agua": 0.40},
    "sanidad_suelo": {"rotacion_previo_siguiente": 0.40, "tolerancia_salinidad_CE": 0.35,
                      "impacto_intrinseco_cultivo": 0.25},
    "ingreso": {"ingreso_neto": 1.0},
}

SAL = {"arroz": (3.0, 12), "papa": (1.7, 12), "maiz_duro": (1.7, 12)}   # umbral CE dS/m, pendiente %/dS/m (FAO-29)
SUELO_BASE = {"arroz": 0.60, "papa": 0.40, "maiz_duro": 0.70}           # SUPUESTO
MATERIA_SECA = {"arroz": 0.86, "papa": 0.20, "maiz_duro": 0.86}         # fraccion de MS del producto cosechado
ROT = {                                                                  # cultivo previo -> candidato, SUPUESTO
    "ninguno":   {"arroz": 1.00, "papa": 1.00, "maiz_duro": 1.00},
    "arroz":     {"arroz": 0.75, "papa": 0.95, "maiz_duro": 1.20},
    "papa":      {"arroz": 1.15, "papa": 0.50, "maiz_duro": 1.20},
    "maiz_duro": {"arroz": 1.05, "papa": 1.15, "maiz_duro": 0.75},
}
AGUA_REF_M3 = 14000     # m3/ha con score de consumo = 0
PROD_REF = 2.5          # kg MS/m3 con score de productividad = 1
VIABLE_MIN = 0.35       # rendimiento relativo minimo para considerar viable un cultivo


def componentes(c, rend_t_ha, agua_m3, bruto, ce, previo):
    """Devuelve (dict de componentes 0-1, viable) para el cultivo c. Entradas: arrays numpy."""
    thr, sl = SAL[c]
    fce = np.clip(1 - sl * np.maximum(ce - thr, 0) / 100, 0, 1)
    rend = rend_t_ha * fce
    neto = bruto * fce - g.CULTIVOS[c]["costo"] - agua_m3 * g.PRECIO_AGUA
    prod_agua = rend * 1000 * MATERIA_SECA[c] / np.maximum(agua_m3, 1)
    rot = np.clip(np.array([ROT[p][c] for p in previo]) / 1.2, 0, 1)
    comp = {
        "bajo_consumo_agua": np.clip(1 - agua_m3 / AGUA_REF_M3, 0, 1),
        "productividad_del_agua": np.clip(prod_agua / PROD_REF, 0, 1),
        "rotacion_previo_siguiente": rot,
        "tolerancia_salinidad_CE": fce,
        "impacto_intrinseco_cultivo": np.full(np.shape(fce), SUELO_BASE[c], dtype=float),
        "ingreso_neto": np.clip((neto + 3000) / 25000, 0, 1),
    }
    viable = rend / g.CULTIVOS[c]["ypot"] >= VIABLE_MIN
    return comp, viable


def score(comp, viable, w):
    """w: dict riel -> array/float de pesos normalizados (suman 1)."""
    total = 0
    for riel in RIELES:
        s_riel = sum(peso * comp[k] for k, peso in COMPOSICION[riel].items())
        total = total + w[riel] * s_riel
    return np.where(viable, total, total - 1.0)


def normalizar_rieles(agua, suelo, ingreso):
    """Valor de cada riel (cualquier escala, p. ej. 0-100 %) -> pesos que suman 1."""
    s = agua + suelo + ingreso
    if s <= 0:
        return {"ahorro_agua": 1 / 3, "sanidad_suelo": 1 / 3, "ingreso": 1 / 3}
    return {"ahorro_agua": agua / s, "sanidad_suelo": suelo / s, "ingreso": ingreso / s}


def pesos_efectivos(w):
    """Peso final de cada columna en la decision = peso del riel x peso interno."""
    return {k: round(float(w[r] * v), 4) for r, comp in COMPOSICION.items() for k, v in comp.items()}
