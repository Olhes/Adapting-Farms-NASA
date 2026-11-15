"""Yearly evapotranspiration of the Majes pampa from an AppEEARS point-sample CSV (MOD16A2GF.061).

Usage:  python3 analizar_et.py path/to/Punto-Majes-ET-MOD16A2GF-061-results.csv

What it does: per 8-day composite, averages the valid points; sums the composites of each
year (mm/year); and compares the year-to-year pattern with the SSEBop v6.1 series used by
the team repo (a second, independent estimate).  MOD16 is a model, NOT a measurement, and
it is known to be weak under irrigation in deserts: use it as a cross-check, not as truth.

Value handling (from product documentation as I know it; check against your file):
  - ET_500m is kg/m2 per 8 days (= mm per period), scale factor 0.1.
  - Fill codes are 32761-32767 raw (3276.1-3276.7 once scaled): dropped.
  - Raw (unscaled) values between 250 and 3270 are divided by 10.
"""
import csv, sys, statistics as st, collections, math
from pathlib import Path

# SSEBop v6.1 net ETa, hm3/yr, from the repo file eta_vs_delivery_annual.csv (rows v61y)
SSEBOP = {2013: 152.3, 2014: 138.4, 2015: 139.7, 2016: 133.0, 2017: 131.2, 2018: 142.6, 2019: 134.2,
          2020: 133.2, 2021: 138.3, 2022: 137.1, 2023: 133.9, 2024: 139.1, 2025: 134.7}
FOCUS = {2014: "entrega 88 %", 2016: "entrega 92 %", 2017: "Niño costero", 2023: "entrega 93 %"}


def find_col(header, *needles, avoid=()):
    for h in header:
        if all(n.lower() in h.lower() for n in needles) and not any(a.lower() in h.lower() for a in avoid):
            return h
    return None


def clean(v):
    if v >= 3270:                      # fill code, raw or scaled
        return None
    if v > 250:                        # raw unscaled value
        v /= 10
    return v if v >= 0 else None


def corr(a, b):
    ma, mb = st.mean(a), st.mean(b)
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


def main(path):
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8-sig")))
    h = rows[0].keys()
    c_date = find_col(h, "date")
    c_et = find_col(h, "et_500m", avoid=("qc",))
    c_qc = find_col(h, "et_qc")
    if not (c_date and c_et):
        sys.exit(f"No encuentro Date/ET_500m. Columnas: {list(h)}")
    dates_by_year = collections.defaultdict(set)
    for r in rows:
        dates_by_year[r[c_date][:4]].add(r[c_date][:10])
    annual = max(len(v) for v in dates_by_year.values()) <= 2     # yearly product: one value per year (MOD16A3GF)
    print(f"Filas: {len(rows)} | ET: {c_et} | QC: {c_qc or 'no incluido'} | modo: {'ANUAL (mm/año ya acumulado)' if annual else '8 días (se suman)'}")
    by_date = collections.defaultdict(list)
    dropped = 0
    for r in rows:
        try:
            raw = float(r[c_et])
            v = (raw if 0 < raw < 3000 else None) if annual else clean(raw)
        except ValueError:
            v = None
        if v is None:
            dropped += 1
            continue
        by_date[r[c_date][:10]].append(v)
    print(f"Lecturas descartadas (sin dato o relleno): {dropped} de {len(rows)} | composites con datos: {len(by_date)}")
    if c_qc:
        qc = collections.Counter(r[c_qc] for r in rows)
        print("Valores de QC más frecuentes (no filtrados):", qc.most_common(4))

    per_year = collections.defaultdict(list)
    for d, v in by_date.items():
        per_year[int(d[:4])].append(st.mean(v))
    years = [y for y in sorted(per_year) if len(per_year[y]) >= (1 if annual else 40)]
    skipped = [y for y in sorted(per_year) if y not in years]
    if skipped:
        print("Años con menos de 40 composites (no se comparan):", skipped)
    et = {y: (st.mean(per_year[y]) if annual else sum(per_year[y])) for y in years}
    m = st.mean(et.values())
    ss_m = st.mean(SSEBOP[y] for y in years if y in SSEBOP)
    print(f"\n{'año':5s} {'ET MOD16 mm/año':>16s} {'composites':>11s} {'vs media':>9s} {'SSEBop hm3':>11s} {'vs media':>9s}  nota")
    for y in years:
        ss = SSEBOP.get(y)
        print(f"{y:5d} {et[y]:16.0f} {len(per_year[y]):11d} {100 * (et[y] / m - 1):+8.1f}% "
              f"{(ss if ss else float('nan')):11.1f} {(100 * (ss / ss_m - 1) if ss else float('nan')):+8.1f}%  {FOCUS.get(y, '')}")
    common = [y for y in years if y in SSEBOP]
    if len(common) >= 5:
        print(f"\nCorrelación entre MOD16 y SSEBop (n={len(common)} años): r = {corr([et[y] for y in common], [SSEBOP[y] for y in common]):+.2f}")
        print("Si MOD16 también muestra poca variación, apoya que el consumo cambia poco entre años secos y normales.")
    print(f"ET media MOD16 en los puntos con dato: {m:.0f} mm/año (solo píxeles con valor; el desierto suele venir sin dato).")
    out = Path(path).with_name("et_pampa_resumen.csv")
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["anio", "et_mod16_mm", "composites", "ssebop_hm3"])
        for y in years:
            w.writerow([y, round(et[y], 1), len(per_year[y]), SSEBOP.get(y, "")])
    print("Resumen guardado en", out)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
