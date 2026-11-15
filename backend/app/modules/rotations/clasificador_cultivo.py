"""
Servicio de clasificacion de cultivo (CatBoost) para la UI de Field Shift.

Reglas de cobertura:
  * La ZONA debe existir en los datos (hoy: Valle de Tambo). Se elige por id o con un punto del mapa (lat, lon);
    fuera de la celda NASA que cubre los datos el modelo NO responde.
  * El CULTIVO PREVIO debe ser uno que el modelo conoce (arroz, papa, maiz) o "ninguno".

Modo simple:   el usuario solo mueve los 3 rieles; clima y CE salen de la climatologia del mes en la zona.
Modo avanzado: el usuario fija valores numericos (t2m, rh2m, sw_dwn, ws2m, prectot, ce); lo que no fije se completa
               igual que en modo simple.

Instalacion: copiar este archivo + prioridades.py + generar_target.py (solo constantes) + clasificador_cultivo_ui.cbm
+ clasificador_meta.json a backend/app/modules/rotations/ y en main.py:
    from app.modules.rotations.clasificador_cultivo import router as clasificador_router
    app.include_router(clasificador_router)
"""
from __future__ import annotations

import json
import math
import unicodedata
from datetime import date
from pathlib import Path

import pandas as pd
from catboost import CatBoostClassifier, Pool
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.modules.rotations import prioridades as P

_DIR = Path(__file__).parent
_modelo = None
_meta = None
_CAMPOS_CLIMA = ["t2m", "rh2m", "sw_dwn", "ws2m", "prectot"]
_ETIQ = {"mes": "mes de siembra", "t2m": "temperatura", "rh2m": "humedad relativa", "sw_dwn": "radiacion solar",
         "ws2m": "viento", "prectot": "precipitacion", "ce": "salinidad del suelo (CE)",
         "w_agua": "prioridad: ahorro de agua", "w_suelo": "prioridad: sanidad del suelo",
         "w_ingreso": "prioridad: ingreso", "cultivo_previo": "cultivo previo"}
_PREVIO = {"ninguno": "ninguno", "arroz": "arroz", "papa": "papa", "maiz": "maiz_duro", "maiz_duro": "maiz_duro",
           "maiz duro": "maiz_duro"}


def _cargar():
    global _modelo, _meta
    if _modelo is None:
        _meta = json.load(open(_DIR / "clasificador_meta.json", encoding="utf-8"))
        _modelo = CatBoostClassifier().load_model(str(_DIR / "clasificador_cultivo_ui.cbm"))
    return _modelo, _meta


def _norm(txt: str) -> str:
    t = unicodedata.normalize("NFKD", txt.strip().lower())
    return "".join(ch for ch in t if not unicodedata.combining(ch))


# ----------------------------------------------------------------------------- esquemas
class EntradaUI(BaseModel):
    # ubicacion: id de zona definido en el sistema, o un punto elegido en el mapa
    zona: str | None = Field(default=None, description="id de zona (p. ej. 'tambo')")
    lat: float | None = Field(default=None, description="latitud del punto elegido en el mapa")
    lon: float | None = Field(default=None, description="longitud del punto elegido en el mapa")
    mes: int | None = Field(default=None, ge=1, le=12, description="mes de siembra; si falta, el mes actual")
    cultivo_previo: str = Field(default="ninguno", description="cultivo actual en la parcela o 'ninguno'")
    # rieles (cualquier escala, p. ej. 0-100 %)
    ahorro_agua: float = Field(default=1, ge=0)
    sanidad_suelo: float = Field(default=1, ge=0)
    ingreso: float = Field(default=1, ge=0)
    # configuracion avanzada (opcionales)
    t2m: float | None = None
    rh2m: float | None = Field(default=None, ge=0, le=100)
    sw_dwn: float | None = Field(default=None, ge=0)
    ws2m: float | None = Field(default=None, ge=0)
    prectot: float | None = Field(default=None, ge=0)
    ce: float | None = Field(default=None, ge=0)


class SalidaClasificacion(BaseModel):
    soportado: bool
    mensaje: str | None = None
    zona: str | None = None
    cultivo_recomendado: str | None = None
    probabilidades: dict[str, float] | None = None
    ranking: list[str] | None = None
    pesos_rieles: dict[str, float] | None = None
    peso_efectivo_por_columna: dict[str, float] | None = None
    valores_usados: dict[str, float | int | str] | None = None
    origen_valores: dict[str, str] | None = None
    factores_principales: list[dict] | None = None
    advertencias: list[str] = []


# ----------------------------------------------------------------------------- cobertura
def resolver_zona(zona, lat, lon, meta):
    if zona:
        z = _norm(zona)
        return z if z in meta["zonas"] else None
    if lat is not None and lon is not None:
        for zid, z in meta["zonas"].items():
            if abs(lat - z["lat"]) <= z["dlat"] and abs(lon - z["lon"]) <= z["dlon"]:
                return zid
    return None


def _no_soportado(msg):
    return SalidaClasificacion(soportado=False, mensaje=msg)


# ----------------------------------------------------------------------------- prediccion
def predecir(e: EntradaUI) -> SalidaClasificacion:
    modelo, meta = _cargar()
    nombres = ", ".join(z["nombre"] for z in meta["zonas"].values())

    zid = resolver_zona(e.zona, e.lat, e.lon, meta)
    if zid is None:
        if e.zona is None and (e.lat is None or e.lon is None):
            return _no_soportado("Elige una zona del sistema o un punto en el mapa.")
        return _no_soportado(f"No hay datos NASA cargados para esa ubicacion; el modelo solo funciona en: {nombres}.")

    previo = _PREVIO.get(_norm(e.cultivo_previo))
    if previo is None:
        return _no_soportado(f"El cultivo '{e.cultivo_previo}' no esta en el modelo. Cultivos disponibles: "
                             "arroz, papa y maiz (o 'ninguno').")

    mes = e.mes or date.today().month
    clim = meta["climatologia_mensual"][zid][str(mes)]
    valores, origen = {"mes": mes}, {"mes": "usuario" if e.mes else "mes_actual"}
    for c in _CAMPOS_CLIMA:
        v = getattr(e, c)
        valores[c] = float(v) if v is not None else float(clim[c])
        origen[c] = "usuario" if v is not None else "clima_de_la_zona_en_ese_mes"
    valores["ce"] = float(e.ce) if e.ce is not None else float(meta["ce_defecto"])
    origen["ce"] = "usuario" if e.ce is not None else "valor_por_defecto"

    w = P.normalizar_rieles(e.ahorro_agua, e.sanidad_suelo, e.ingreso)
    fila = {
        "mes_sin": math.sin(2 * math.pi * mes / 12), "mes_cos": math.cos(2 * math.pi * mes / 12),
        **{c: valores[c] for c in _CAMPOS_CLIMA}, "ce": valores["ce"],
        "w_agua": w["ahorro_agua"], "w_suelo": w["sanidad_suelo"], "w_ingreso": w["ingreso"],
        "cultivo_previo": previo,
    }
    X = pd.DataFrame([fila])[meta["features"]]
    p = modelo.predict_proba(X)[0]
    probs = {c: round(float(v), 4) for c, v in zip(meta["clases"], p)}
    ranking = sorted(probs, key=probs.get, reverse=True)

    # explicacion: aporte (SHAP) de cada entrada a la probabilidad del cultivo recomendado
    shap = modelo.get_feature_importance(Pool(X, cat_features=["cultivo_previo"]), type="ShapValues")[0]
    k = meta["clases"].index(ranking[0])
    aporte = {}
    for f, s in zip(meta["features"], shap[k][:-1]):
        clave = "mes" if f in ("mes_sin", "mes_cos") else f
        aporte[clave] = aporte.get(clave, 0.0) + float(s)
    val_txt = {"mes": mes, **{c_: round(valores[c_], 3) for c_ in _CAMPOS_CLIMA}, "ce": valores["ce"],
               "w_agua": f"{w['ahorro_agua']:.0%}", "w_suelo": f"{w['sanidad_suelo']:.0%}",
               "w_ingreso": f"{w['ingreso']:.0%}", "cultivo_previo": previo}
    factores = [{"factor": _ETIQ[f], "valor": val_txt[f], "efecto": round(s, 3)}
                for f, s in sorted(aporte.items(), key=lambda t: -abs(t[1]))[:3]]

    avisos = []
    for campo, (lo, hi) in meta["rango_entrenamiento"].items():
        if valores[campo] < lo or valores[campo] > hi:
            avisos.append(f"{campo}={valores[campo]} esta fuera del rango historico de la zona ({lo} a {hi}); "
                          "la prediccion puede no ser confiable.")
    if sorted(probs.values())[-1] - sorted(probs.values())[-2] < 0.15:
        avisos.append("Los dos primeros cultivos estan muy parejos; considera ambos.")

    return SalidaClasificacion(
        soportado=True, zona=zid, cultivo_recomendado=ranking[0], probabilidades=probs, ranking=ranking,
        pesos_rieles={k_: round(v, 4) for k_, v in w.items()},
        peso_efectivo_por_columna=P.pesos_efectivos(w),
        valores_usados=valores, origen_valores=origen, factores_principales=factores, advertencias=avisos)


# ----------------------------------------------------------------------------- rotacion encadenada
class EntradaRotacion(EntradaUI):
    campanas: int = Field(default=3, ge=1, le=6, description="numero de campanas a planificar")
    paso_meses: int = Field(default=4, ge=1, le=12,
                            description="meses que avanza cada campana (ciclo tipico ~4)")
    evitar_repeticion: bool = Field(default=True,
                                    description="si el modelo repite el cultivo previo, se toma la 2da opcion")


class PasoRotacion(BaseModel):
    campana: int
    mes: int
    cultivo_previo: str
    cultivo_recomendado: str
    probabilidades: dict[str, float] | None = None
    ranking: list[str] | None = None
    peso_efectivo_por_columna: dict[str, float] | None = None
    factores_principales: list[dict] | None = None
    advertencias: list[str] = []


class SalidaRotacion(BaseModel):
    soportado: bool
    mensaje: str | None = None
    zona: str | None = None
    pasos: list[PasoRotacion] = []


def rotacion(e: EntradaRotacion) -> SalidaRotacion:
    """Llama al clasificador N veces: cada campaña usa como cultivo_previo el recomendado
    en la anterior y avanza `paso_meses`. Filtro: evita repetir el mismo cultivo dos
    campañas seguidas tomando la siguiente opcion del ranking."""
    _, meta = _cargar()
    mes0 = e.mes or date.today().month
    previo_in = _PREVIO.get(_norm(e.cultivo_previo))
    if previo_in is None:
        return SalidaRotacion(soportado=False,
                              mensaje=f"El cultivo '{e.cultivo_previo}' no esta en el modelo "
                                      "(arroz, papa, maiz o 'ninguno').")

    previo = previo_in
    pasos: list[PasoRotacion] = []
    zona_out: str | None = None
    for i in range(e.campanas):
        mes = (mes0 - 1 + i * e.paso_meses) % 12 + 1
        sub = EntradaUI(
            zona=e.zona, lat=e.lat, lon=e.lon, mes=mes, cultivo_previo=previo,
            ahorro_agua=e.ahorro_agua, sanidad_suelo=e.sanidad_suelo, ingreso=e.ingreso,
            t2m=e.t2m, rh2m=e.rh2m, sw_dwn=e.sw_dwn, ws2m=e.ws2m, prectot=e.prectot, ce=e.ce,
        )
        r = predecir(sub)
        if not r.soportado:
            if i == 0:
                return SalidaRotacion(soportado=False, mensaje=r.mensaje)
            break
        zona_out = zona_out or r.zona

        avisos = list(r.advertencias)
        rec = r.cultivo_recomendado
        if e.evitar_repeticion and r.ranking and len(r.ranking) > 1 and rec == previo:
            rec = r.ranking[1]
            avisos.append(f"el modelo preferia repetir '{previo}'; se eligio '{rec}' para no "
                          "sembrar el mismo cultivo dos campanas seguidas")
        pasos.append(PasoRotacion(
            campana=i + 1, mes=mes, cultivo_previo=previo, cultivo_recomendado=rec,
            probabilidades=r.probabilidades, ranking=r.ranking,
            peso_efectivo_por_columna=r.peso_efectivo_por_columna,
            factores_principales=r.factores_principales, advertencias=avisos))
        previo = rec

    if not pasos:
        return SalidaRotacion(soportado=False, mensaje="No se pudo generar la rotacion.")
    return SalidaRotacion(soportado=True, zona=zona_out, pasos=pasos)


# ----------------------------------------------------------------------------- rutas
router = APIRouter(prefix="/api/rotations", tags=["rotations"])


@router.get("/cobertura")
def cobertura():
    """Para que la UI habilite solo lo que el modelo conoce."""
    _, meta = _cargar()
    return {"zonas": meta["zonas"], "cultivos": meta["cultivos_soportados"],
            "composicion_rieles": meta["composicion_rieles"], "rango_ce": meta["rango_ce"]}


@router.get("/zona")
def zona_de_punto(lat: float, lon: float):
    """Punto elegido en el mapa -> zona soportada o null."""
    _, meta = _cargar()
    zid = resolver_zona(None, lat, lon, meta)
    return {"soportada": zid is not None, "zona": zid}


@router.post("/classify", response_model=SalidaClasificacion)
def clasificar(entrada: EntradaUI) -> SalidaClasificacion:
    return predecir(entrada)


@router.post("/rotation", response_model=SalidaRotacion)
def clasificar_rotacion(entrada: EntradaRotacion) -> SalidaRotacion:
    return rotacion(entrada)
