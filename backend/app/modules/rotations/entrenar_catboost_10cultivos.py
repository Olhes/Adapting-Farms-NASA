"""
Entrena CatBoost sobre nasa_power_10cultivos.csv (10 cultivos).

Dos modelos, mismas features:
  A) REGRESION multi-salida (MultiRMSE): ingreso_neto de cada cultivo -> ranking de cultivos
  B) MULTI-ETIQUETA (MultiLogloss): top_<cultivo> = ingreso >= 85 % del mejor

Features (compatibles con el modo "simple/avanzado" de la app: valores climaticos tipo mes):
  mes_sin, mes_cos, t2m, rh2m, sw_dwn, ws2m, prectot  (medias de los 30 dias PREVIOS)

Split temporal: entrena <= 2018 (2016-2018 como validacion/early stopping), prueba >= 2019.
Se compara contra una linea base de climatologia mensual (promedio por mes del train).
"""
import json
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor, CatBoostClassifier
from sklearn.metrics import r2_score, f1_score

OUT = "/mnt/user-data/outputs/"
CULTIVOS = ["arroz", "papa", "maiz_duro", "cebolla", "ajo", "olivo", "tomate", "pimiento", "aji", "alfalfa"]
FEATS = ["mes_sin", "mes_cos", "t2m", "rh2m", "sw_dwn", "ws2m", "prectot"]
MAPA = {"t2m": "T2M", "rh2m": "RH2M", "sw_dwn": "ALLSKY_SFC_SW_DWN", "ws2m": "WS2M", "prectot": "PRECTOTCORR"}

df = pd.read_csv(OUT + "nasa_power_10cultivos.csv", parse_dates=["date"]).sort_values("date").reset_index(drop=True)
for f, col in MAPA.items():
    df[f] = df[col].rolling(30, min_periods=20).mean()
mes = df["date"].dt.month
df["mes_sin"], df["mes_cos"] = np.sin(2 * np.pi * mes / 12), np.cos(2 * np.pi * mes / 12)

ycols = [f"ingreso_neto_{c}" for c in CULTIVOS]
tcols = [f"top_{c}" for c in CULTIVOS]
df = df.dropna(subset=FEATS + ycols + tcols).reset_index(drop=True)

tr = df[df.date < "2016-01-01"]
va = df[(df.date >= "2016-01-01") & (df.date < "2019-01-01")]
te = df[df.date >= "2019-01-01"]
print("filas train/val/test:", len(tr), len(va), len(te))

# ---------- A) regresion multi-salida (targets estandarizados) ----------
mu, sd = tr[ycols].mean(), tr[ycols].std()
z = lambda d: ((d[ycols] - mu) / sd).to_numpy()
reg = CatBoostRegressor(loss_function="MultiRMSE", iterations=1500, learning_rate=0.05, depth=6,
                        random_seed=42, verbose=0, early_stopping_rounds=100)
reg.fit(tr[FEATS], z(tr), eval_set=(va[FEATS], z(va)))
pred = reg.predict(te[FEATS]) * sd.to_numpy() + mu.to_numpy()
real = te[ycols].to_numpy()

# linea base: climatologia mensual del train
clim = tr.groupby(tr.date.dt.month)[ycols].mean()
base = clim.loc[te.date.dt.month].to_numpy()

print("\n== A) Regresion de ingreso neto (test >= 2019) ==")
filas = []
for i, c in enumerate(CULTIVOS):
    filas.append((c, r2_score(real[:, i], pred[:, i]), r2_score(real[:, i], base[:, i]),
                  np.mean(np.abs(real[:, i] - pred[:, i]))))
print(pd.DataFrame(filas, columns=["cultivo", "R2_catboost", "R2_clim_mensual", "MAE_S/ha"]).round(3).to_string(index=False))

ganador_real = real.argmax(1)
acc_cb = (pred.argmax(1) == ganador_real).mean()
acc_base = (base.argmax(1) == ganador_real).mean()
print(f"\nAcierto del mejor cultivo  CatBoost: {acc_cb:.3f} | clim. mensual: {acc_base:.3f} | "
      f"siempre-el-mas-frecuente: {(ganador_real == np.bincount(ganador_real).argmax()).mean():.3f}")
top2 = np.mean([ganador_real[k] in np.argsort(-pred[k])[:2] for k in range(len(te))])
print(f"El mejor real esta en el top-2 predicho: {top2:.3f}")

# ---------- B) multi-etiqueta ----------
# MultiLogloss exige que cada etiqueta tenga ambas clases en train: las constantes se reportan aparte
frec = tr[tcols].mean()
var_cols = [c for c in tcols if 0 < frec[c] < 1]
const_cols = [c for c in tcols if c not in var_cols]
print("\n== B) Multi-etiqueta top_* ==")
print("Frecuencia en train:", frec.round(3).to_dict())
print("Etiquetas SIN variacion en train (no entrenables):", const_cols)
clf = None
if len(var_cols) < 2:
    print("-> Multi-etiqueta NO entrenado: con las etiquetas actuales hay menos de 2 que varien (degenerado).")
    print("   Corrige precios/costos en parametros_cultivos_nuevos.csv y vuelve a correr.")
else:
    clf = CatBoostClassifier(loss_function="MultiLogloss", iterations=800, learning_rate=0.05, depth=6,
                             random_seed=42, verbose=0, early_stopping_rounds=80)
    clf.fit(tr[FEATS], tr[var_cols].astype(int).to_numpy(), eval_set=(va[FEATS], va[var_cols].astype(int).to_numpy()))
    P = clf.predict(te[FEATS]).astype(int)
    Y = te[var_cols].astype(int).to_numpy()
    rows = [(c.replace("top_", ""), int(Y[:, i].sum()), f1_score(Y[:, i], P[:, i], zero_division=0),
             (Y[:, i] == P[:, i]).mean()) for i, c in enumerate(var_cols)]
    print(pd.DataFrame(rows, columns=["cultivo", "n_positivos_test", "F1", "exactitud"]).round(3).to_string(index=False))
    print("Hamming (acierto por etiqueta):", round((Y == P).mean(), 4))
print("Positivos en test de etiquetas constantes en train:", te[const_cols].sum().astype(int).to_dict())

# ---------- importancias y guardado ----------
imp = pd.Series(reg.get_feature_importance(), index=FEATS).sort_values(ascending=False)
print("\nImportancia de features (regresion):\n", imp.round(1).to_string())

reg.save_model(OUT + "catboost_ingreso_10cultivos.cbm")
if clf is not None:
    clf.save_model(OUT + "catboost_multilabel_10cultivos.cbm")
meta = {
    "features": FEATS, "cultivos": CULTIVOS,
    "target_regresion": ycols, "estandarizacion": {"mu": mu.tolist(), "sd": sd.tolist()},
    "climatologia_mensual": {f: df.groupby(df.date.dt.month)[f].mean().round(3).to_dict() for f in MAPA},
    "metricas_test": {"acierto_mejor_catboost": float(acc_cb), "acierto_mejor_clim_mensual": float(acc_base),
                      "top2": float(top2)},
    "etiquetas_constantes_en_train": const_cols, "etiquetas_multilabel_entrenadas": var_cols,
    "nota": "Etiquetas derivadas de reglas FAO-56 con precios/costos SUPUESTOS para 7 cultivos; no son decisiones observadas.",
}
json.dump(meta, open(OUT + "catboost_10cultivos_meta.json", "w"), indent=2, ensure_ascii=False)
print("\nGuardado: modelo .cbm + meta.json")
