"""Recompute ET0 and crop water demand for Majes with Penman-Monteith (FAO-56).

Reads (unchanged):
  POWER_Point_Daily_19810101_20150211_016d35S_072d20W_LST.csv
  dataset_modelo_rotacion_majes - dataset_modelo.csv   (decimal comma, synthetic)
Writes (new files, dot decimals):
  et0_anual_majes_1984_2014.csv
  et0_mensual_majes_climatologia.csv
  demanda_agua_cultivos_majes.csv

Methods per year:
  hargreaves : same method the model uses (low bound)
  pm         : FAO-56 Penman-Monteith with the POWER cell values (altitude 835 m)
  pm_1400m   : same, with temperatures lowered by a 6.5 C/km lapse rate to an
               ASSUMED Majes pampa altitude of 1400 m (not verified)
"""
import csv, math, datetime as dt, collections, statistics as st
from pathlib import Path

HERE = Path(__file__).parent
POWER = HERE / "POWER_Point_Daily_19810101_20150211_016d35S_072d20W_LST.csv"
MODEL = HERE / "dataset_modelo_rotacion_majes - dataset_modelo.csv"
LAT, Z_CELL, Z_SITE = -16.35, 835.38, 1400.0   # Z_SITE is an assumption
EFFICIENCY = 0.75                              # same assumption as the model
Y0, Y1 = 1984, 2014


def es_kpa(t):
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def ra_mj(doy):
    lat = math.radians(LAT)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    dec = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(max(-1, min(1, -math.tan(lat) * math.tan(dec))))
    return 24 * 60 / math.pi * 0.0820 * dr * (ws * math.sin(lat) * math.sin(dec) + math.cos(lat) * math.cos(dec) * math.sin(ws))


def penman_monteith(doy, tx, tn, tdew, u2, rs, z):
    tm = (tx + tn) / 2
    p = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26
    gamma = 0.000665 * p
    es = (es_kpa(tx) + es_kpa(tn)) / 2
    ea = es_kpa(tdew)
    delta = 4098 * es_kpa(tm) / (tm + 237.3) ** 2
    ra = ra_mj(doy)
    rso = (0.75 + 2e-5 * z) * ra
    rnl = 4.903e-9 * (((tx + 273.16) ** 4 + (tn + 273.16) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(ea)) * (1.35 * min(rs / rso, 1) - 0.35)
    rn = (1 - 0.23) * rs - rnl
    return (0.408 * delta * rn + gamma * 900 / (tm + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))


def hargreaves(doy, tx, tn):
    return 0.0023 * 0.408 * ra_mj(doy) * ((tx + tn) / 2 + 17.8) * math.sqrt(max(tx - tn, 0.1))


lines = POWER.read_text().split("\n")
rows = [r for r in csv.DictReader(lines[lines.index("-END HEADER-") + 1:]) if r.get("YEAR")]

annual = collections.defaultdict(lambda: collections.defaultdict(float))
monthly = collections.defaultdict(lambda: collections.defaultdict(list))   # (month) -> method -> yearly monthly sums
msum = collections.defaultdict(float)                                       # (year, month, method)
dlt = (Z_SITE - Z_CELL) * 0.0065
for raw in rows:
    r = {k: float(v) for k, v in raw.items()}
    y, doy = int(r["YEAR"]), int(r["DOY"])
    if not (Y0 <= y <= Y1):
        continue
    tx, tn, td, u2, rs = r["T2M_MAX"], r["T2M_MIN"], r["T2MDEW"], r["WS2M"], r["ALLSKY_SFC_SW_DWN"]
    vals = {
        "hargreaves": hargreaves(doy, tx, tn),
        "pm": penman_monteith(doy, tx, tn, td, u2, rs, Z_CELL),
        "pm_1400m": penman_monteith(doy, tx - dlt, tn - dlt, td - dlt, u2, rs, Z_SITE),
    }
    month = (dt.date(y, 1, 1) + dt.timedelta(days=doy - 1)).month
    for k, v in vals.items():
        annual[y][k] += v
        msum[(y, month, k)] += v

with open(HERE / "et0_anual_majes_1984_2014.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["anio", "et0_hargreaves_mm", "et0_pm_mm", "et0_pm_1400m_mm"])
    for y in range(Y0, Y1 + 1):
        w.writerow([y] + [round(annual[y][k], 1) for k in ("hargreaves", "pm", "pm_1400m")])

with open(HERE / "et0_mensual_majes_climatologia.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["mes", "et0_hargreaves_mm", "et0_pm_mm", "et0_pm_1400m_mm"])
    for m in range(1, 13):
        w.writerow([m] + [round(st.mean(msum[(y, m, k)] for y in range(Y0, Y1 + 1)), 1) for k in ("hargreaves", "pm", "pm_1400m")])

num = lambda s: float(s.replace(",", "."))
model = list(csv.DictReader(open(MODEL)))
out = []
for r in model:
    y, kc, cyc = int(r["anio"]), num(r["kc_medio"]), num(r["ciclo_dias"])
    et0_low = num(r["et0_anual_mm"])                      # model value (Hargreaves)
    rec = {"anio": y, "cultivo": r["cultivo_candidato"], "kc_medio": kc, "ciclo_dias": int(cyc)}
    for tag, et0 in (("hargreaves", et0_low), ("pm", annual[y]["pm"]), ("pm_1400m", annual[y]["pm_1400m"])):
        etc = kc * et0 * cyc / 365
        rec[f"etc_mm_{tag}"] = round(etc, 1)
        rec[f"agua_m3_ha_{tag}"] = round(etc * 10 / EFFICIENCY, 0)
    rec["agua_modelo_m3_ha"] = round(num(r["agua_m3_ha"]), 0)
    out.append(rec)
with open(HERE / "demanda_agua_cultivos_majes.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0]))
    w.writeheader(); w.writerows(out)

print("OK: 3 archivos escritos en", HERE)
print("\nET0 mensual media 1984-2014 (mm/mes): mes | hargreaves | PM | PM 1400 m")
for m in range(1, 13):
    print(f"  {m:2d} | " + " | ".join(f"{st.mean(msum[(y, m, k)] for y in range(Y0, Y1 + 1)):6.1f}" for k in ("hargreaves", "pm", "pm_1400m")))
print("\nDemanda de agua por cultivo (m3/ha por ciclo, media 1984-2014): Hargreaves | PM | PM 1400 m | PM/Hargreaves")
by = collections.defaultdict(list)
for r in out:
    by[r["cultivo"]].append(r)
for c, R in sorted(by.items()):
    b, m, a = (st.mean(x[f"agua_m3_ha_{t}"] for x in R) for t in ("hargreaves", "pm", "pm_1400m"))
    print(f"  {c:9s} ciclo {R[0]['ciclo_dias']:3d} d | {b:7.0f} | {m:7.0f} | {a:7.0f} | {m / b:.2f}")
