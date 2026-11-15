"""Honest test of a predictive yield model for Majes (leave-one-year-out cross-validation).

Question: do satellite NDVI/ET and water delivery improve the prediction of a crop's yield in a year,
compared with just knowing the crop's usual yield (and its trend)?

Setup: pooled panel of Majes crops (Midagri yields 2015-2025), target = log(yield) minus the crop mean of the
training years. Features are year-level (the satellite data is for the whole pampa, not per crop):
NDVI mean/peak over irrigated pixels, ET, delivered water. The held-out year never enters training.
Run: python experimento_predictivo.py  (needs numpy, pandas, scikit-learn, catboost)
"""
import csv
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.linear_model import Ridge

DATA = Path(__file__).parent / "data"
DELIVERY = dict(zip(range(2013, 2026),
                    [356.5, 293.3, 348.0, 306.3, 335.9, 346.4, 336.3, 339.8, 347.6, 349.2, 309.8, 333.0, 337.4]))


def year_features():
    d, e = np.load(DATA / "ndvi_pampa_pixeles_anual.npz"), np.load(DATA / "et_pampa_pixeles_anual.npz")
    years = list(d["years"])
    base = np.nanmean(d["mean"][[i for i, y in enumerate(years) if y < 2025]], axis=0)
    irr = base >= 0.3
    return pd.DataFrame({"anio": years,
                         "ndvi_medio": [np.nanmean(d["mean"][i][irr]) for i in range(len(years))],
                         "ndvi_pico": [np.nanmean(d["peak"][i][irr]) for i in range(len(years))],
                         "et_mm": [np.nanmean(e["et"][i]) for i in range(len(years))],
                         "entrega_hm3": [DELIVERY[y] for y in years]})


def panel():
    r = pd.read_csv(DATA / "rendimiento_majes_tablero.csv")
    r = r[(r.anio.between(2015, 2025)) & (r.rendimiento_t_ha > 0) & (r.cosechada_ha >= 50)]
    keep = r.groupby("cultivo").anio.nunique()
    r = r[r.cultivo.isin(keep[keep >= 9].index)]
    return r.merge(year_features(), on="anio")


def cv(df, feats):
    rows = []
    for y in sorted(df.anio.unique()):
        tr, te = df[df.anio != y].copy(), df[df.anio == y].copy()
        mu = tr.groupby("cultivo").rendimiento_t_ha.apply(lambda s: np.log(s).mean())
        tr = tr[tr.cultivo.isin(mu.index)]
        te = te[te.cultivo.isin(mu.index)]
        if te.empty:
            continue
        ytr = np.log(tr.rendimiento_t_ha) - tr.cultivo.map(mu)
        yte = np.log(te.rendimiento_t_ha) - te.cultivo.map(mu)
        pred = {"base: rendimiento habitual del cultivo": np.zeros(len(te))}
        # per-crop linear trend on year (fit on training years only)
        tp = []
        for c, g in te.groupby("cultivo"):
            gt = tr[tr.cultivo == c]
            b = np.polyfit(gt.anio, np.log(gt.rendimiento_t_ha) - mu[c], 1)
            tp.append(pd.Series(np.polyval(b, g.anio), index=g.index))
        pred["base: tendencia por cultivo"] = pd.concat(tp).reindex(te.index).values
        Xtr, Xte = tr[feats], te[feats]
        rg = Ridge(alpha=5.0).fit((Xtr - Xtr.mean()) / Xtr.std(), ytr)
        pred["Ridge (satélite + agua)"] = rg.predict((Xte - Xtr.mean()) / Xtr.std())
        cb = CatBoostRegressor(iterations=300, depth=3, learning_rate=0.05, verbose=0, random_seed=0)
        cb.fit(pd.concat([Xtr, tr.cultivo], axis=1), ytr, cat_features=["cultivo"])
        pred["CatBoost (satélite + agua + cultivo)"] = cb.predict(pd.concat([Xte, te.cultivo], axis=1))
        for k, p in pred.items():
            for yt, pp in zip(yte.values, p):
                rows.append((k, y, yt, pp))
    return pd.DataFrame(rows, columns=["modelo", "anio", "real", "pred"])


if __name__ == "__main__":
    df = panel()
    print(f"Panel: {len(df)} filas, {df.cultivo.nunique()} cultivos, años {df.anio.min()}-{df.anio.max()}")
    res = cv(df, ["ndvi_medio", "ndvi_pico", "et_mm", "entrega_hm3"])
    res["err"] = res.real - res.pred
    out = res.groupby("modelo").err.agg(rmse=lambda e: float(np.sqrt((e ** 2).mean())), mae=lambda e: float(e.abs().mean()))
    base = out.loc["base: rendimiento habitual del cultivo", "rmse"]
    out["vs_base_%"] = 100 * (out.rmse / base - 1)
    print("\nError (en log del rendimiento; 0,10 ≈ 10 %), validación dejando un año fuera:")
    print(out.round(3).to_string())
    # does the year-level signal matter? correlation of the mean yearly residual with each feature
    ym = df.copy()
    mu = ym.groupby("cultivo").rendimiento_t_ha.transform(lambda s: np.log(s).mean())
    ym["res"] = np.log(ym.rendimiento_t_ha) - mu
    yr = ym.groupby("anio").res.mean().to_frame().join(year_features().set_index("anio"))
    print("\nCorrelación del 'año bueno/malo' promedio (todos los cultivos) con cada variable:")
    print(yr.drop(columns="res").corrwith(yr.res).round(2).to_string())
