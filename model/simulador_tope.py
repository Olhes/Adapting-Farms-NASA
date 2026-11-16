"""Water-cap simulator for the Majes pampa (first version, hackathon draft).

Question it answers: given a campaign water cap, does a crop mix fit?

What is REAL here: monthly ET0 (NASA POWER, 1984-2014) and the Autodema 2016
measured applied water for some crops.
What is ASSUMED (and flagged): sowing months, irrigated area, scenario mixes,
irrigation efficiency, conveyance loss. The crop parameters (Kc, cycle, margin)
come from the SYNTHETIC rotation dataset; do not present them as measurements.

Run:  python3 simulador_tope.py
Needs (already in this folder): et0_mensual_majes_climatologia.csv,
dataset_modelo_rotacion_majes - dataset_modelo.csv  (made by recalcular_et0.py)
"""
import csv, collections, statistics as st
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
num = lambda s: float(s.replace(",", "."))


def _read_csv(name):
    with open(HERE / "data" / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=None)
def load_delivery():
    """Monthly delivery at Pitay (hm3), Jan..Dec, over 2013-2025: the mean, and the lowest/highest value seen in each
    month. The file holds only these three summaries per month, not one value per year."""
    rows = _read_csv("entrega_mensual_pitay.csv")
    return {"mean": tuple(float(r["entrega_media_hm3"]) for r in rows),
            "min": tuple(float(r["entrega_min_hm3"]) for r in rows),
            "max": tuple(float(r["entrega_max_hm3"]) for r in rows)}


# --- ASSUMPTIONS (change them; each one must be validated with the soil expert) ---
AREA_HA = 15_900          # licensed area per the repo report; satellite mask suggests ~21,000 ha
EFFICIENCY = 0.5          # ratio of satellite-estimated ET to delivered water (0.41-0.56, see calibracion_et.py); includes conveyance
                          # and application losses and any ET estimation error; NOT a measured irrigation efficiency
CONVEYANCE_LOSS = 0.0     # canal losses inside the pampa: UNKNOWN, kept at 0
CAP_NORMAL_HM3 = round(sum(load_delivery()["mean"]), 1)   # mean delivery at Pitay 2013-2025, from entrega_mensual_pitay.csv

# ET0 methods: a range between two standard methods, Hargreaves-Samani (the lower, used as the central value) and
# FAO-56 Penman-Monteith (the higher). The two are never averaged. calibracion_et.py compares Hargreaves with satellite
# ET, but the areas of that comparison do not match exactly, so it is a plausibility check, not a calibration.
ET0_CENTRAL = "hargreaves"
ET0_LOW = "hargreaves"
ET0_HIGH = "pm"

# Sowing months used when the monthly sown-area records have no data for a crop. 'fuente' says where each one comes from;
# most are NOT from Majes. For crops present in data/majes_siembra_mensual.csv the months come from that file (SOWING below).
SOWING_FALLBACK = {
    "Alfalfa": (1, "perenne: ciclo anual completo"),
    "Cebolla": (6, "Majes: siembra mensual histórica, pico jun-jul (Midagri, Avance de campaña)"),
    "Maíz": (4, "Camana 2017 (maiz choclo, mar-may); no es Majes"),
    "Zapallo": (8, "Majes: siembra mensual histórica, pico ago (Midagri, Avance de campaña)"),
    "Papa": ((9, 2), "Majes: dos campañas, sep-oct y feb-mar (Midagri, Avance de campaña)"),
    "Ajo": (5, "SUPUESTO sin fuente"),
    "Haba": (9, "SUPUESTO sin fuente"),
    "Quinua": (5, "Majes: siembra mensual histórica, pico may-jul (Midagri, Avance de campaña)"),
}
SOWING_CSV = "majes_siembra_mensual.csv"
SOWING_SERIES = "historico"          # long-run average of the monthly sown area (the other series are single campaigns)
SOWING_PEAK_SHARE = 0.75             # a month is a sowing month when its area is at least this share of the crop's peak month
CSV_MONTHS = {"ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AGO": 8, "SET": 9, "OCT": 10,
              "NOV": 11, "DIC": 12}
MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@lru_cache(maxsize=None)
def _sown_area_by_crop():
    area = collections.defaultdict(lambda: [0.0] * 12)
    for r in _read_csv(SOWING_CSV):
        if r["serie"] == SOWING_SERIES and r["cultivo"] != "TODAS":
            area[r["cultivo"].capitalize()][CSV_MONTHS[r["mes"]] - 1] += float(r["hectareas"])
    return {c: tuple(a) for c, a in area.items()}


def _sowing_from_data(crop):
    """[(month, weight)] from the sown area of the crop's sowing window (months >= SOWING_PEAK_SHARE of the peak month,
    weighted by area), or None when the records have no area for it."""
    area = _sown_area_by_crop().get(crop)
    if not area or max(area) <= 0:
        return None
    picked = [(m + 1, a) for m, a in enumerate(area) if a >= SOWING_PEAK_SHARE * max(area)]
    total = sum(a for _, a in picked)
    return [(m, a / total) for m, a in picked]


def _build_sowing():
    out = {}
    for crop, (month, source) in SOWING_FALLBACK.items():
        data = _sowing_from_data(crop)
        if data:
            shares = ", ".join(f"{MONTH_EN[m - 1]} {100 * w:.0f} %" for m, w in data)
            out[crop] = {"months": data, "basis": "data",
                         "source": f"Majes monthly sown area, historical series (data/{SOWING_CSV}), weighted by area: {shares}"}
        else:
            months = month if isinstance(month, tuple) else (month,)
            out[crop] = {"months": [(m, 1 / len(months)) for m in months], "basis": "fallback", "source": source}
    return out


# crop -> {"months": [(month 1-12, weight)], "basis": "data" | "fallback", "source": str}
SOWING = _build_sowing()

# Measured applied water (m3/ha per campaign), Autodema 2016 via the Dialnet article.
# Paprika and vine are NOT in the synthetic dataset: only this number exists for them.
# Official margin for alfalfa (the only crop with an official Arequipa cost): ESCO Midagri 2024-2025, cost S/ 7,118/ha;
# income S/ 6,101/ha (ESCO) to S/ 8,929/ha (departmental 2023, green forage) -> margin -1,017 .. +1,811, midpoint used.
OFFICIAL_MARGIN = {"Alfalfa": (397, "ESCO Midagri 2024-2025 (costo tipico, forraje verde)")}

MEASURED = {"Alfalfa": 28583, "Maíz": 7115, "Paprika": 8544, "Cebolla": 5609, "Vid": 9043, "Ajo": 9217}
# Crops whose water is the MEASURED total (they have no Kc in the dataset); every other crop is FAO-56 ETc / efficiency.
MEASURED_BASIS = ("Paprika",)
# Only the SHAPE of paprika's monthly demand comes from this assumed Kc profile; its total is rescaled to MEASURED.
SHAPE_ONLY = {"Paprika": {"kc": 1.05, "ciclo": 210, "mes": 8, "fuente": "SUPUESTO: Kc FAO-56 de pimiento, siembra en agosto"}}

# Scenario mixes in % of area. ACTUAL is Autodema 2016; the other two are ILLUSTRATIVE.
MIXES = {
    "Actual (Autodema 2016)": {"Alfalfa": 48.2, "Maíz": 15.7, "Paprika": 8.6, "Cebolla": 4.3, "Vid": 2.8, "Papa": 2.9, "Ajo": 0.07},
    "Menos alfalfa (ilustrativo)": {"Alfalfa": 30, "Maíz": 15.7, "Paprika": 8.6, "Cebolla": 8, "Vid": 2.8, "Papa": 5, "Ajo": 2, "Haba": 8, "Quinua": 5, "Zapallo": 5},
    "Diversificada (ilustrativo)": {"Alfalfa": 15, "Maíz": 15, "Paprika": 8.6, "Cebolla": 10, "Vid": 2.8, "Papa": 10, "Ajo": 5, "Haba": 10, "Quinua": 10, "Zapallo": 5},
}


@lru_cache(maxsize=None)
def _et0_monthly(method):
    return tuple(float(r[f"et0_{method}_mm"]) for r in _read_csv("et0_mensual_majes_climatologia.csv"))


def load_et0_monthly(method="pm"):
    """Monthly ET0 (mm), Jan..Dec, climatology 1984-2014. The file is read once."""
    return list(_et0_monthly(method))


@lru_cache(maxsize=None)
def load_crops():
    """Crop parameters from the rotation dataset. Read once and shared: treat the result as read-only."""
    by = collections.defaultdict(list)
    for r in _read_csv("dataset_modelo_rotacion_majes - dataset_modelo.csv"):
        by[r["cultivo_candidato"]].append(r)
    crops = {}
    for c, R in by.items():
        crops[c] = {"kc": num(R[0]["kc_medio"]), "ciclo": int(num(R[0]["ciclo_dias"])),
                    "ce_umbral": num(R[0]["ce_umbral_dsm"]),
                    "margen_s_ha": st.mean(num(r["ingreso_neto_s_ha"]) for r in R)}  # synthetic, except OFFICIAL_MARGIN
    for c, (value, _) in OFFICIAL_MARGIN.items():
        if c in crops:
            crops[c]["margen_s_ha"] = value
    return crops


def seasonal_profile(kc, cycle, sow_month, et0m):
    """Crop evapotranspiration (mm) per calendar month, from the sowing month."""
    left, m, prof = cycle, sow_month - 1, [0.0] * 12
    while left > 0:
        d = min(left, DAYS[m])
        prof[m] += kc * et0m[m] * d / DAYS[m]
        left -= d
        m = (m + 1) % 12
    return prof


def _fao56_monthly(crop, crops, et0m, efficiency):
    """Irrigation water (m3/ha) per calendar month of one campaign: FAO-56 ETc averaged over the crop's sowing months
    (weighted by sown area), divided by the irrigation efficiency."""
    out = [0.0] * 12
    for month, weight in SOWING[crop]["months"]:
        for i, mm in enumerate(seasonal_profile(crops[crop]["kc"], crops[crop]["ciclo"], month, et0m)):
            out[i] += weight * mm * 10 / efficiency
    return out


def water_m3_ha(crop, crops, et0m, source="calculada", efficiency=EFFICIENCY):
    if source == "medida" and crop in MEASURED:
        return MEASURED[crop]
    if crop in crops and crop in SOWING:
        return sum(_fao56_monthly(crop, crops, et0m, efficiency))
    return MEASURED.get(crop)  # Paprika / Vid: only the measured value exists


@lru_cache(maxsize=512)
def crop_water(crop, method=ET0_CENTRAL, efficiency=EFFICIENCY):
    """THE water figure of one crop campaign, shared by the rotation score and the monthly calendar.

    Returns {"monthly": 12 values (m3/ha), "total": float, "basis": "fao56" | "measured", "sowing": {...}}.
    fao56: ETc from Kc and the sowing months, over the efficiency. measured: the measured applied water total, with the
    monthly shape of an assumed Kc profile rescaled to it (efficiency and ET0 method do not change the total).
    The result is cached and shared: do not modify it."""
    et0m = load_et0_monthly(method)
    if crop in MEASURED_BASIS:
        shape = SHAPE_ONLY[crop]
        prof = seasonal_profile(shape["kc"], shape["ciclo"], shape["mes"], et0m)
        monthly = [v / sum(prof) * MEASURED[crop] for v in prof]
        sowing = {"months": [(shape["mes"], 1.0)], "basis": "fallback", "source": shape["fuente"]}
        return {"monthly": tuple(monthly), "total": sum(monthly), "basis": "measured", "sowing": sowing}
    monthly = _fao56_monthly(crop, load_crops(), et0m, efficiency)
    return {"monthly": tuple(monthly), "total": sum(monthly), "basis": "fao56", "sowing": SOWING[crop]}


def crop_water_range(crop, efficiency=EFFICIENCY):
    """Central value (Hargreaves-Samani) with the low and high end over the two standard ET0 methods."""
    low, high = (crop_water(crop, m, efficiency) for m in (ET0_LOW, ET0_HIGH))
    ends = sorted((low, high), key=lambda r: r["total"])
    return {"low": ends[0], "central": crop_water(crop, ET0_CENTRAL, efficiency), "high": ends[1]}


def simulate(mix, crops, et0m, source, cap_hm3, area_ha=AREA_HA, efficiency=EFFICIENCY):
    tot = sum(mix.values())
    demand = margin = covered = 0.0
    for c, pct in mix.items():
        share = pct / tot
        w = water_m3_ha(c, crops, et0m, source, efficiency)
        demand += share * area_ha * w / 1e6
        if c in crops:
            margin += share * area_ha * crops[c]["margen_s_ha"] / 1e6
            covered += share
    cap_field = cap_hm3 * (1 - CONVEYANCE_LOSS)
    return {"demanda_hm3": demand, "tope_hm3": cap_field, "saldo_hm3": cap_field - demand,
            "uso_pct": 100 * demand / cap_field, "margen_millones_s": margin, "margen_cubre_pct": 100 * covered}


def demo():
    crops = load_crops()
    et0m = load_et0_monthly("pm")
    print("1) EFECTO DE USAR LA ET0 DEL MES DE SIEMBRA (m3/ha por ciclo, Penman-Monteith, eficiencia 50 %)")
    print(f"   {'cultivo':9s} {'siembra':>7s} {'anual':>8s} {'mensual':>8s} {'dif':>6s}  fuente del mes")
    annual = sum(et0m)
    for c in SOWING:
        k = crops[c]
        a = k["kc"] * annual * k["ciclo"] / 365 * 10 / EFFICIENCY
        s = water_m3_ha(c, crops, et0m)
        months = "+".join(str(m) for m, _ in SOWING[c]["months"])
        print(f"   {c:9s} {months:>7s} {a:8.0f} {s:8.0f} {100 * (s / a - 1):+5.0f}%  {SOWING[c]['source']}")
    print("\n2) PERFIL MENSUAL DE LA CEBOLLA (mm de ETc por mes, siembra en junio):")
    p = seasonal_profile(crops["Cebolla"]["kc"], crops["Cebolla"]["ciclo"], 6, et0m)
    print("   " + " ".join(f"{m + 1}:{v:.0f}" for m, v in enumerate(p) if v > 0))
    print(f"\n3) ¿CABE LA MEZCLA? (área {AREA_HA:,} ha; tope normal {CAP_NORMAL_HM3} hm3; pérdida de conducción {CONVEYANCE_LOSS:.0%})")
    for pct_cap in (100, 88):
        cap = CAP_NORMAL_HM3 * pct_cap / 100
        print(f"\n   Tope = {pct_cap} % del normal = {cap:.0f} hm3")
        print(f"   {'escenario':30s} {'agua':9s} {'demanda':>8s} {'saldo':>8s} {'uso':>6s}  margen*")
        for name, mix in MIXES.items():
            for source in ("calculada", "medida"):
                r = simulate(mix, crops, et0m, source, cap)
                flag = "  <-- NO CABE" if r["saldo_hm3"] < 0 else ""
                print(f"   {name:30s} {source:9s} {r['demanda_hm3']:8.0f} {r['saldo_hm3']:+8.0f} {r['uso_pct']:5.0f}%  {r['margen_millones_s']:5.0f} M{flag}")
    print("\n   * margen sintético en millones de S/, solo cultivos del dataset (paprika y vid no tienen dato).")


if __name__ == "__main__":
    demo()
