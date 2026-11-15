"""
Servicio de recomendacion de cultivo por INGRESO NETO (CatBoost MultiRMSE, 10 cultivos).

A diferencia de clasificador_cultivo.py (clasificador con 12 entradas: clima + CE +
3 rieles + cultivo previo), este modelo es de REGRESION multi-salida:
  * Entradas: mes_sin, mes_cos y medias climaticas del periodo (t2m, rh2m, sw_dwn,
    ws2m, prectot). NO usa rieles, CE ni cultivo previo.
  * Salida: ingreso_neto predicho (S/ha) para cada uno de los 10 cultivos;
    el cultivo recomendado es el de mayor ingreso predicho.

Cobertura: una sola zona (Valle de Tambo); la climatologia mensual viene en
clasificador_ingreso_10cultivos_meta.json. Modo simple: el usuario solo elige el
mes; modo avanzado: puede fijar los 5 valores climaticos.

Instalacion: copiar clasificador_ingreso.py + clasificador_ingreso_10cultivos.pkl
+ clasificador_ingreso_10cultivos_meta.json a backend/app/modules/rotations/ y en
main.py:
    from app.modules.rotations.clasificador_ingreso import router as ingreso_router
    app.include_router(ingreso_router)
"""
from __future__ import annotations

import json
import math
import pickle
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field

_DIR = Path(__file__).parent
_modelo = None
_meta = None
_CAMPOS_CLIMA = ["t2m", "rh2m", "sw_dwn", "ws2m", "prectot"]
_ETIQ = {"t2m": "temperatura", "rh2m": "humedad relativa", "sw_dwn": "radiacion solar",
         "ws2m": "viento", "prectot": "precipitacion"}


def _cargar():
    global _modelo, _meta
    if _modelo is None:
        _meta = json.load(open(_DIR / "clasificador_ingreso_10cultivos_meta.json", encoding="utf-8"))
        with open(_DIR / "clasificador_ingreso_10cultivos.pkl", "rb") as f:
            _modelo = pickle.load(f)
    return _modelo, _meta


# ----------------------------------------------------------------------------- esquemas
class EntradaIngreso(BaseModel):
    mes: int | None = Field(default=None, ge=1, le=12, description="mes de siembra; si falta, el mes actual")
    cultivos: list[str] | None = Field(
        default=None, min_length=4,
        description="cultivos a evaluar (ids del modelo); si falta, los 10. Minimo 4")
    # configuracion avanzada (opcionales): medias climaticas del periodo
    t2m: float | None = None
    rh2m: float | None = Field(default=None, ge=0, le=100)
    sw_dwn: float | None = Field(default=None, ge=0)
    ws2m: float | None = Field(default=None, ge=0)
    prectot: float | None = Field(default=None, ge=0)


class SalidaIngreso(BaseModel):
    soportado: bool
    mensaje: str | None = None
    mes: int | None = None
    cultivo_recomendado: str | None = None
    ranking: list[str] | None = None
    ingresos_predichos: dict[str, float] | None = None
    valores_usados: dict[str, float | int] | None = None
    origen_valores: dict[str, str] | None = None
    factores_principales: list[dict] | None = None
    advertencias: list[str] = []


# ----------------------------------------------------------------------------- prediccion
def predecir(e: EntradaIngreso) -> SalidaIngreso:
    modelo, meta = _cargar()
    todos = meta["cultivos"]

    # filtro de cultivos elegidos por el usuario (orden canonico del modelo)
    if e.cultivos:
        pedidos = set(e.cultivos)
        elegidos = [c for c in todos if c in pedidos]
        if len(elegidos) < 4:
            return SalidaIngreso(
                soportado=False,
                mensaje=f"Selecciona al menos 4 cultivos validos del modelo "
                        f"({', '.join(todos)}); recibidos validos: {len(elegidos)}.")
    else:
        elegidos = todos

    mes = e.mes or date.today().month
    clim = {c: meta["climatologia_mensual"][c][str(mes)] for c in _CAMPOS_CLIMA}
    valores, origen = {}, {}
    for c in _CAMPOS_CLIMA:
        v = getattr(e, c)
        valores[c] = float(v) if v is not None else float(clim[c])
        origen[c] = "usuario" if v is not None else "clima_de_la_zona_en_ese_mes"
    origen["mes"] = "usuario" if e.mes else "mes_actual"

    fila = {
        "mes_sin": math.sin(2 * math.pi * mes / 12), "mes_cos": math.cos(2 * math.pi * mes / 12),
        **{c: valores[c] for c in _CAMPOS_CLIMA},
    }
    X = pd.DataFrame([fila])[meta["features"]]
    # el modelo fue entrenado con targets estandarizados: desestandarizar a S/ha
    z = np.asarray(modelo.predict(X))[0]
    sd = np.asarray(meta["estandarizacion"]["sd"])
    mu = np.asarray(meta["estandarizacion"]["mu"])
    ingresos = z * sd + mu
    pred = {c: round(float(v), 2) for c, v in zip(todos, ingresos) if c in elegidos}
    ranking = sorted(pred, key=pred.get, reverse=True)

    # factores: importancia de cada feature (Media de los 10 outputs estandarizados)
    imp = modelo.get_feature_importance()
    imp = imp.mean(axis=1) if imp.ndim > 1 else imp
    fila_imp = dict(zip(meta["features"], imp))
    tot = sum(fila_imp.values()) or 1.0
    val_txt = {"mes": mes, **{c_: round(valores[c_], 3) for c_ in _CAMPOS_CLIMA}}
    factores = []
    for f, s in sorted(fila_imp.items(), key=lambda t: -t[1])[:3]:
        clave = "mes" if f in ("mes_sin", "mes_cos") else f
        if any(x["factor"] == _ETIQ.get(clave, clave) for x in factores):
            continue
        factores.append({"factor": _ETIQ.get(clave, clave), "valor": val_txt[clave],
                         "participacion": round(float(s / tot), 3)})

    avisos = []
    i1, i2 = pred[ranking[0]], pred[ranking[1]]
    if i1 > 0 and (i1 - i2) / i1 < 0.05:
        avisos.append(f"Los dos primeros cultivos ({ranking[0]} y {ranking[1]}) tienen ingresos "
                      "muy parecidos; considera ambos.")
    if i1 <= 0:
        avisos.append("El mejor ingreso neto predicho es negativo con los valores actuales.")

    return SalidaIngreso(
        soportado=True, mes=mes, cultivo_recomendado=ranking[0], ranking=ranking,
        ingresos_predichos=pred, valores_usados={"mes": mes, **valores},
        origen_valores=origen, factores_principales=factores, advertencias=avisos)


# ----------------------------------------------------------------------------- rotacion encadenada
class EntradaRotacionIngreso(EntradaIngreso):
    campanas: int = Field(default=3, ge=1, le=6, description="numero de campanas a planificar")
    paso_meses: int = Field(default=4, ge=1, le=12,
                            description="meses que avanza cada campana (ciclo tipico ~4)")


class PasoRotacionIngreso(BaseModel):
    campana: int
    mes: int
    cultivo_recomendado: str
    ranking: list[str] | None = None
    ingresos_predichos: dict[str, float] | None = None
    valores_usados: dict[str, float | int] | None = None
    origen_valores: dict[str, str] | None = None
    factores_principales: list[dict] | None = None
    advertencias: list[str] = []


class SalidaRotacionIngreso(BaseModel):
    soportado: bool
    mensaje: str | None = None
    pasos: list[PasoRotacionIngreso] = []


def rotacion(e: EntradaRotacionIngreso) -> SalidaRotacionIngreso:
    """Llama al regresor N veces: cada campaña avanza `paso_meses` desde el mes
    inicial. El modelo no usa cultivo previo, asi que cada paso es independiente;
    la cadena solo refleja la estacionalidad del ingreso predicho."""
    mes0 = e.mes or date.today().month
    pasos: list[PasoRotacionIngreso] = []
    for i in range(e.campanas):
        mes = (mes0 - 1 + i * e.paso_meses) % 12 + 1
        r = predecir(EntradaIngreso(
            mes=mes, cultivos=e.cultivos, t2m=e.t2m, rh2m=e.rh2m, sw_dwn=e.sw_dwn,
            ws2m=e.ws2m, prectot=e.prectot))
        if not r.soportado:
            if i == 0:
                return SalidaRotacionIngreso(soportado=False, mensaje=r.mensaje)
            break
        pasos.append(PasoRotacionIngreso(
            campana=i + 1, mes=mes, cultivo_recomendado=r.cultivo_recomendado,
            ranking=r.ranking, ingresos_predichos=r.ingresos_predichos,
            valores_usados=r.valores_usados, origen_valores=r.origen_valores,
            factores_principales=r.factores_principales, advertencias=r.advertencias))
    if not pasos:
        return SalidaRotacionIngreso(soportado=False, mensaje="No se pudo generar la rotacion.")
    return SalidaRotacionIngreso(soportado=True, pasos=pasos)


# ----------------------------------------------------------------------------- rutas
router = APIRouter(prefix="/api/rotations10", tags=["rotations10"])


@router.get("/cobertura")
def cobertura():
    """Para que la UI sepa que cultivos y variables conoce este modelo."""
    _, meta = _cargar()
    return {"cultivos": meta["cultivos"], "features": meta["features"],
            "metricas_test": meta.get("metricas_test"), "nota": meta.get("nota")}


@router.post("/classify", response_model=SalidaIngreso)
def clasificar(entrada: EntradaIngreso) -> SalidaIngreso:
    return predecir(entrada)


@router.post("/rotation", response_model=SalidaRotacionIngreso)
def clasificar_rotacion(entrada: EntradaRotacionIngreso) -> SalidaRotacionIngreso:
    return rotacion(entrada)
