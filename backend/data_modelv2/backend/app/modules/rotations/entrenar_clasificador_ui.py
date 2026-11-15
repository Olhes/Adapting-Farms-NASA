"""
Clasificador CatBoost (arroz / papa / maiz_duro) cuyas ENTRADAS son las de la UI:
  mes, T2M, RH2M, SW_DWN, WS2M, PRECTOT, CE, 3 rieles (agua/suelo/ingreso) y cultivo previo.

Etiqueta = cultivo con mayor score segun prioridades.py (ecuaciones riel -> columnas), sobre el clima real
NASA de Tambo 1987-2026. Los pesos de los rieles, la CE y el cultivo previo se sortean para cada fecha.
"""
import json
import warnings

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, f1_score, log_loss, roc_auc_score

from app.modules.rotations import generar_target as g
from app.modules.rotations import prioridades as P

warnings.filterwarnings("ignore")
OUT = "/mnt/user-data/outputs/"
SEED, K, EMBARGO = 42, 3, 150
CE_DEFECTO = 2.8      # valor por defecto del deslizador de salinidad en la UI
FEATURES = ["mes_sin", "mes_cos", "t2m", "rh2m", "sw_dwn", "ws2m", "prectot", "ce",
            "w_agua", "w_suelo", "w_ingreso", "cultivo_previo"]
# celda de la grilla MERRA-2 / POWER (0.5 x 0.625 grados) que cubre los datos: el sistema solo opera ahi
ZONAS = {"tambo": {"nombre": "Valle de Tambo", "lat": g.LAT, "lon": -71.75, "dlat": 0.25, "dlon": 0.3125}}


def base_diaria():
    d = pd.read_csv(OUT + "nasa_power_con_target.csv", parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    for v, n in [("T2M", "t2m"), ("RH2M", "rh2m"), ("ALLSKY_SFC_SW_DWN", "sw_dwn"),
                 ("WS2M", "ws2m"), ("PRECTOTCORR", "prectot")]:
        d[n] = d[v].rolling(30, min_periods=30).mean()
    d["mes"] = d.date.dt.month
    d["mes_sin"] = np.sin(2 * np.pi * d.mes / 12)
    d["mes_cos"] = np.cos(2 * np.pi * d.mes / 12)
    return d.dropna(subset=["target", "t2m"]).reset_index(drop=True)


def expandir(d, rng):
    x = d.iloc[np.repeat(np.arange(len(d)), K)].reset_index(drop=True)
    w = rng.dirichlet([0.8, 0.8, 0.8], size=len(x))
    x["w_agua"], x["w_suelo"], x["w_ingreso"] = w[:, 0], w[:, 1], w[:, 2]
    x["ce"] = rng.uniform(0.5, 8.0, len(x))
    x["cultivo_previo"] = rng.choice(P.PREV, len(x))
    pesos = {"ahorro_agua": x.w_agua.values, "sanidad_suelo": x.w_suelo.values, "ingreso": x.w_ingreso.values}
    S = {}
    for c in P.CULT:
        comp, viable = P.componentes(c, x[f"rend_{c}_t_ha"].values, x[f"agua_{c}_m3_ha"].values,
                                     x[f"ingreso_bruto_{c}"].values, x.ce.values, x.cultivo_previo.values)
        S[c] = P.score(comp, viable, pesos)
    x["target_ui"] = pd.DataFrame(S).idxmax(axis=1)
    return x


def nuevo(pesos, cols):
    cats = ["cultivo_previo"] if "cultivo_previo" in cols else []
    return CatBoostClassifier(loss_function="MultiClass", iterations=400, depth=5, learning_rate=0.08,
                              l2_leaf_reg=10, random_seed=SEED, verbose=0, thread_count=-1,
                              cat_features=cats, class_weights=pesos)


def metricas(y, Pr, clases):
    Y = np.column_stack([(y == c).astype(int) for c in clases])
    aucs = {c: roc_auc_score(Y[:, i], Pr[:, i]) for i, c in enumerate(clases) if Y[:, i].sum() > 0}
    auc = float(np.mean(list(aucs.values())))
    pred = np.array(clases)[Pr.argmax(axis=1)]
    return dict(auc_macro=auc, gini_macro=2 * auc - 1, **{f"auc_{c}": a for c, a in aucs.items()},
                f1_macro=f1_score(y, pred, average="macro"), bal_acc=balanced_accuracy_score(y, pred),
                logloss=log_loss(y, Pr, labels=clases)), pred


def main():
    rng = np.random.default_rng(SEED)
    d = base_diaria()
    x = expandir(d, rng)
    corte = pd.Timestamp("2019-01-01")
    tr_all = x[x.date < corte - pd.Timedelta(days=EMBARGO)].reset_index(drop=True)
    te = x[x.date >= corte].reset_index(drop=True)
    sub_tr = tr_all[tr_all.date < pd.Timestamp("2015-01-01") - pd.Timedelta(days=EMBARGO)]
    va = tr_all[tr_all.date >= pd.Timestamp("2015-01-01")]
    dist = x.target_ui.value_counts(normalize=True).round(3).to_dict()
    print("Distribucion target:", dist, "| filas train/val/test:", len(tr_all), len(va), len(te))
    clases = sorted(P.CULT)
    pesos = None
    if min(dist.values()) < 0.15:
        frec = tr_all.target_ui.value_counts(normalize=True)
        pesos = [float(1 / (len(clases) * frec[c])) for c in clases]
    log = {"distribucion_target": dist, "pesos_clase": pesos}

    m0 = nuevo(pesos, FEATURES).fit(sub_tr[FEATURES], sub_tr.target_ui)
    pi = permutation_importance(m0, va[FEATURES], va.target_ui, scoring="neg_log_loss", n_repeats=3, random_state=SEED)
    imp = pd.Series(pi.importances_mean, index=FEATURES).sort_values(ascending=False)
    imp.round(4).to_csv(OUT + "ui_importancia_permutacion.csv", header=["delta_logloss"])
    usadas = [f for f in FEATURES if imp[f] > 0.0005]
    log["features_usadas"], log["features_podadas"] = usadas, [f for f in FEATURES if f not in usadas]
    print("Importancia:\n", imp.round(4).to_string(), "\nUsadas:", usadas)

    res = {}
    for nombre, cols in {"completo": usadas,
                         "sin_clima_ni_mes": [f for f in usadas if f in ("ce", "w_agua", "w_suelo", "w_ingreso", "cultivo_previo")],
                         "sin_rieles_ni_previo": [f for f in usadas if f not in ("w_agua", "w_suelo", "w_ingreso", "cultivo_previo")]}.items():
        mm = nuevo(pesos, cols).fit(sub_tr[cols], sub_tr.target_ui)
        met, _ = metricas(va.target_ui.values, mm.predict_proba(va[cols]), list(mm.classes_))
        met["auc_train"] = metricas(sub_tr.target_ui.values, mm.predict_proba(sub_tr[cols]), list(mm.classes_))[0]["auc_macro"]
        res[nombre] = met
    cv = pd.DataFrame(res).T.round(4)
    cv.to_csv(OUT + "ui_validacion_ablacion.csv")
    print("\nVALIDACION 2015-2018:\n", cv.to_string())

    final = nuevo(pesos, usadas).fit(tr_all[usadas], tr_all.target_ui)
    Pr = final.predict_proba(te[usadas])
    met, pred = metricas(te.target_ui.values, Pr, list(final.classes_))
    cm = confusion_matrix(te.target_ui, pred, labels=list(final.classes_))
    log["test"] = {k: round(float(v), 4) for k, v in met.items()}
    log["clases"], log["matriz_confusion_test"] = list(final.classes_), cm.tolist()
    print("\nTEST 2019+:", log["test"], "\nMatriz:\n", cm)
    te["pred"] = pred
    dom = te[["w_agua", "w_suelo", "w_ingreso"]].idxmax(axis=1)
    log["acierto_por_prioridad_dominante"] = (te.pred == te.target_ui).groupby(dom).mean().round(3).to_dict()
    print("Acierto por prioridad dominante:", log["acierto_por_prioridad_dominante"])

    final.save_model(OUT + "clasificador_cultivo_ui.cbm")
    import pickle
    pickle.dump(final, open(OUT + "clasificador_cultivo_ui.pkl", "wb"))

    ref = tr_all.drop_duplicates("date")
    clim = ref.groupby("mes")[["t2m", "rh2m", "sw_dwn", "ws2m", "prectot"]].median().round(3)
    meta = {
        "features": usadas, "clases": list(final.classes_),
        "cultivos_soportados": P.CULT, "cultivo_previo_valores": P.PREV,
        "zonas": ZONAS,
        "climatologia_mensual": {"tambo": {str(m): clim.loc[m].to_dict() for m in clim.index}},
        "rango_entrenamiento": {c: [round(float(ref[c].quantile(.01)), 3), round(float(ref[c].quantile(.99)), 3)]
                                for c in ["t2m", "rh2m", "sw_dwn", "ws2m", "prectot"]},
        "rango_ce": [0.5, 8.0], "ce_defecto": CE_DEFECTO,
        "composicion_rieles": P.COMPOSICION,
        "nota": "Etiquetas por reglas (prioridades.py), no por decisiones observadas de agricultores.",
    }
    json.dump(meta, open(OUT + "clasificador_meta.json", "w"), indent=2, ensure_ascii=False)
    json.dump(log, open(OUT + "reporte_clasificador_ui.json", "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
