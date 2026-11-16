"""Yearly NDVI summary of the Majes pampa from an AppEEARS point-sample CSV (MOD13Q1.061).

Usage:  python3 analizar_ndvi.py path/to/Puntos-Majes-MOD13Q1-061-results.csv

Question it helps answer: did the crops (NDVI) drop in the dry-delivery years
2014, 2016 and 2023?  NDVI is a proxy for vigor, NOT a yield measurement.

Assumptions (change the constants below):
  IRRIGATED_NDVI : points below this NDVI are treated as desert, not irrigated (0.3 is a guess)
  GOOD_QUALITY   : pixel_reliability values kept (0 = good, 1 = marginal)
"""
import csv, sys, statistics as st, collections
from pathlib import Path

IRRIGATED_NDVI = 0.3
GOOD_QUALITY = {0, 1}
FOCUS = {2014: "entrega 88 %", 2016: "entrega 92 %", 2017: "Niño costero", 2023: "entrega 93 %"}


def find_col(header, *needles):
    for h in header:
        if all(n.lower() in h.lower() for n in needles):
            return h
    return None


def main(path):
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8-sig")))
    if not rows:
        sys.exit("El archivo está vacío.")
    h = rows[0].keys()
    c_date, c_id = find_col(h, "date"), find_col(h, "id")
    c_ndvi, c_qa = find_col(h, "ndvi"), find_col(h, "pixel_reliability")
    if not (c_date and c_ndvi):
        sys.exit(f"No encuentro las columnas Date/NDVI. Columnas: {list(h)}")
    print(f"Filas: {len(rows)} | columna NDVI: {c_ndvi} | calidad: {c_qa or 'NO ENCONTRADA (no se filtra)'}")

    obs = []                                  # (date, point id, ndvi)
    dropped = collections.Counter()
    for r in rows:
        try:
            v = float(r[c_ndvi])
        except ValueError:
            dropped["sin valor"] += 1
            continue
        if abs(v) > 2:                        # unscaled MODIS integers
            v /= 10000
        if not -0.2 <= v <= 1.0:
            dropped["fuera de rango (relleno)"] += 1
            continue
        if c_qa:
            try:
                if int(float(r[c_qa])) not in GOOD_QUALITY:
                    dropped["calidad mala (nube, nieve)"] += 1
                    continue
            except ValueError:
                pass
        obs.append((r[c_date][:10], r[c_id] if c_id else "", v))
    print("Descartadas:", dict(dropped) or "ninguna", "| usadas:", len(obs))

    per_year = collections.defaultdict(list)  # year -> list of (date, ndvi)
    for d, _, v in obs:
        per_year[int(d[:4])].append((d, v))

    summary = {}
    for y, L in sorted(per_year.items()):
        irr = [(d, v) for d, v in L if v >= IRRIGATED_NDVI]
        by_date = collections.defaultdict(list)
        for d, v in irr:
            by_date[d].append(v)
        date_means = [st.mean(v) for v in by_date.values()]
        summary[y] = {
            "ndvi_medio_regado": st.mean(date_means) if date_means else float("nan"),
            "ndvi_pico": max(date_means) if date_means else float("nan"),
            "frac_regado": len(irr) / len(L),   # share of observations above the irrigated threshold
            "n_obs": len(L),
        }

    years = sorted(summary)
    print(f"\n{'año':5s} {'NDVI medio':>10s} {'pico':>6s} {'% regado':>9s} {'z (vs resto)':>13s}  nota")
    for y in years:
        others = [summary[k]["ndvi_medio_regado"] for k in years if k != y]
        z = (summary[y]["ndvi_medio_regado"] - st.mean(others)) / st.pstdev(others) if len(others) > 2 and st.pstdev(others) else float("nan")
        s = summary[y]
        print(f"{y:5d} {s['ndvi_medio_regado']:10.3f} {s['ndvi_pico']:6.2f} {100 * s['frac_regado']:8.0f}% {z:+13.2f}  {FOCUS.get(y, '')}")
    print("\nz = cuántas desviaciones se aleja ese año del promedio de los demás (|z| > 2 sería llamativo).")
    print(f"Umbral de 'regado': NDVI >= {IRRIGATED_NDVI} (supuesto). Con {len(years)} años es una comparación rústica.")

    out = Path(path).with_name("ndvi_pampa_resumen.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["anio", "ndvi_medio_regado", "ndvi_pico", "frac_regado", "n_obs"])
        for y in years:
            s = summary[y]
            w.writerow([y, round(s["ndvi_medio_regado"], 4), round(s["ndvi_pico"], 4), round(s["frac_regado"], 4), s["n_obs"]])
    print("Resumen guardado en", out)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
