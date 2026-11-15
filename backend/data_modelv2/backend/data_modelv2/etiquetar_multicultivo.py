"""
Etiquetado MULTI-LABEL de idoneidad climática para 10 cultivos del valle de Tambo
usando datos NASA POWER (1987-2026).

Idea: en vez de UN solo target (argmax de ingreso neto -> 95 % papa), cada cultivo
recibe su PROPIO puntaje 0-1 e indicador binario. Varios cultivos pueden ser
aptos el mismo día (papa + alfalfa + cebolla...). Nada se "superpone" ni se
rebalancea artificialmente.

Método (tipo FAO-EcoCrop, Hackett 1991):
  1) Para cada día, puntaje de temperatura en forma de trapecio con la T2M diaria:
         0  si T <= Tabs_min  o  T >= Tabs_max
         1  si Topt_min <= T <= Topt_max
         lineal entre ambos extremos
  2) "Si siembro HOY": se promedia el puntaje durante los próximos `ciclo` días
     (ventana hacia adelante). Es lo que hace útil la etiqueta para un modelo:
     las features son el pasado, la etiqueta es la idoneidad del ciclo futuro.
  3) apto = puntaje >= UMBRAL_APTO.

FUENTES de los parámetros (ver columna `verificado`):
  EcoCrop FAO  -> https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=<id>
      cebolla  id=551, ajo id=367, olivo id=1553, alfalfa id=1428
  FAO Irrigation & Drainage Paper 56 / FAO Agro-Ecological Zones (t0741e, t0742e):
      arroz y maíz de tierras bajas: régimen térmico > 20 °C
  Los demás valores (papa, maíz, arroz, tomate, pimiento, ají) son rangos
  agronómicos generales: VALIDAR con EcoCrop / INIA / Agencia Agraria Islay.
"""
import numpy as np
import pandas as pd

UMBRAL_APTO = 0.9  # 0.5 deja casi todo "apto" todo el año (T de Tambo cabe en el rango absoluto de todos); 0.9 = condicion optima

# nombre: (Topt_min, Topt_max, Tabs_min, Tabs_max, ciclo_dias, verificado, fuente)
CULTIVOS = {
    "arroz":     (20, 30, 15, 38, 140, "parcial",  "FAO AEZ: regimen >20C; limites abs = rango general"),
    "cebolla":   (12, 25,  4, 30, 150, "EcoCrop",  "EcoCrop id=551 (ciclo 85-175 d)"),
    "ajo":       (13, 24,  7, 35, 150, "ajustado", "EcoCrop id=367 da opt 18-30; se baja a 13-24 por practica local (bulbificacion con frio)"),
    "papa":      (15, 20,  7, 26, 120, "general",  "rango tuberizacion 15-20C; minimo 7C"),
    "olivo":     (20, 34,  5, 40, 365, "EcoCrop",  "EcoCrop id=1553 (perenne)"),
    "maiz":      (18, 27, 10, 35, 140, "parcial",  "FAO AEZ: maiz bajura >20C; resto general"),
    "tomate":    (18, 27, 10, 35, 130, "general",  "rango general hortaliza estacion calida"),
    "pimiento":  (18, 28, 12, 35, 150, "general",  "rango general hortaliza estacion calida"),
    "aji":       (18, 30, 12, 36, 150, "general",  "rango general Capsicum"),
    "alfalfa":   (21, 27,  5, 45, 120, "EcoCrop",  "EcoCrop id=1428 (perenne)"),
}

# Meses de siembra locales (opcional). None = sin restriccion.
# Rellenar con datos de la Agencia Agraria de Islay / MIDAGRI cuando se validen.
MESES_SIEMBRA = {c: None for c in CULTIVOS}


def trapecio(t, omin, omax, amin, amax):
    s = np.zeros_like(t, dtype=float)
    up = (t > amin) & (t < omin)
    s[up] = (t[up] - amin) / (omin - amin)
    s[(t >= omin) & (t <= omax)] = 1.0
    dn = (t > omax) & (t < amax)
    s[dn] = (amax - t[dn]) / (amax - omax)
    s[np.isnan(t)] = np.nan
    return s


def etiquetar(df):
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    t = df["T2M"].to_numpy()
    for c, (omin, omax, amin, amax, ciclo, *_rest) in CULTIVOS.items():
        daily = pd.Series(trapecio(t, omin, omax, amin, amax))
        # ventana hacia adelante: invertir, rolling, invertir
        fwd = daily[::-1].rolling(ciclo, min_periods=int(0.8 * ciclo)).mean()[::-1]
        score = fwd.to_numpy()
        m = MESES_SIEMBRA[c]
        if m is not None:
            score = np.where(df["date"].dt.month.isin(m), score, 0.0)
        df[f"idon_{c}"] = np.round(score, 3)
        df[f"apto_{c}"] = np.where(np.isnan(score), np.nan, (score >= UMBRAL_APTO).astype(float))
    cols_apto = [f"apto_{c}" for c in CULTIVOS]
    df["n_cultivos_aptos"] = df[cols_apto].sum(axis=1, min_count=1)
    df["cultivos_aptos"] = df[cols_apto].apply(
        lambda r: "|".join(c.replace("apto_", "") for c in cols_apto if r[c] == 1), axis=1)
    cols_idon = [f"idon_{c}" for c in CULTIVOS]
    return df


if __name__ == "__main__":
    base = "/mnt/user-data/uploads/"
    out = "/mnt/user-data/outputs/"
    full = pd.read_csv(base + "nasa_power_con_target.csv")
    res = etiquetar(full)
    res.to_csv(out + "nasa_power_multicultivo.csv", index=False)
    res[res.date < "2019-01-01"].to_csv(out + "train_multicultivo.csv", index=False)
    res[res.date >= "2019-01-01"].to_csv(out + "test_multicultivo.csv", index=False)
    pd.DataFrame(
        [(c, *v) for c, v in CULTIVOS.items()],
        columns=["cultivo", "Topt_min", "Topt_max", "Tabs_min", "Tabs_max",
                 "ciclo_dias", "verificado", "fuente"],
    ).to_csv(out + "parametros_cultivos.csv", index=False)
    print("OK", res.shape)
