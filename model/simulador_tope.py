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
from pathlib import Path

HERE = Path(__file__).parent
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
num = lambda s: float(s.replace(",", "."))

# --- ASSUMPTIONS (change them; each one must be validated with the soil expert) ---
AREA_HA = 15_900          # licensed area per the repo report; satellite mask suggests ~21,000 ha
EFFICIENCY = 0.75         # same as the synthetic model; measured alfalfa implies ~0.49
CONVEYANCE_LOSS = 0.0     # canal losses inside the pampa: UNKNOWN, kept at 0
CAP_NORMAL_HM3 = 333.8    # mean delivery at Pitay 2013-2025 (recomputed from the repo CSV)

# Sowing month per crop. 'fuente' says where it comes from; most are NOT from Majes.
SOWING = {
    "Alfalfa": (1, "perenne: ciclo anual completo"),
    "Cebolla": (6, "Majes: siembra mensual histórica, pico jun-jul (Midagri, Avance de campaña)"),
    "Maíz": (4, "Camana 2017 (maiz choclo, mar-may); no es Majes"),
    "Zapallo": (8, "Majes: siembra mensual histórica, pico ago (Midagri, Avance de campaña)"),
    "Papa": ((9, 2), "Majes: dos campañas, sep-oct y feb-mar (Midagri, Avance de campaña)"),
    "Ajo": (5, "SUPUESTO sin fuente"),
    "Haba": (9, "SUPUESTO sin fuente"),
    "Quinua": (5, "Majes: siembra mensual histórica, pico may-jul (Midagri, Avance de campaña)"),
}

# Measured applied water (m3/ha per campaign), Autodema 2016 via the Dialnet article.
# Paprika and vine are NOT in the synthetic dataset: only this number exists for them.
MEASURED = {"Alfalfa": 28583, "Maíz": 7115, "Paprika": 8544, "Cebolla": 5609, "Vid": 9043, "Ajo": 9217}

# Scenario mixes in % of area. ACTUAL is Autodema 2016; the other two are ILLUSTRATIVE.
MIXES = {
    "Actual (Autodema 2016)": {"Alfalfa": 48.2, "Maíz": 15.7, "Paprika": 8.6, "Cebolla": 4.3, "Vid": 2.8, "Papa": 2.9, "Ajo": 0.07},
    "Menos alfalfa (ilustrativo)": {"Alfalfa": 30, "Maíz": 15.7, "Paprika": 8.6, "Cebolla": 8, "Vid": 2.8, "Papa": 5, "Ajo": 2, "Haba": 8, "Quinua": 5, "Zapallo": 5},
    "Diversificada (ilustrativo)": {"Alfalfa": 15, "Maíz": 15, "Paprika": 8.6, "Cebolla": 10, "Vid": 2.8, "Papa": 10, "Ajo": 5, "Haba": 10, "Quinua": 10, "Zapallo": 5},
}


def load_et0_monthly(method="pm"):
    rows = list(csv.DictReader(open(HERE / "data" / "et0_mensual_majes_climatologia.csv")))
    return [float(r[f"et0_{method}_mm"]) for r in rows]


def load_crops():
    by = collections.defaultdict(list)
    for r in csv.DictReader(open(HERE / "data" / "dataset_modelo_rotacion_majes - dataset_modelo.csv")):
        by[r["cultivo_candidato"]].append(r)
    crops = {}
    for c, R in by.items():
        crops[c] = {"kc": num(R[0]["kc_medio"]), "ciclo": int(num(R[0]["ciclo_dias"])),
                    "ce_umbral": num(R[0]["ce_umbral_dsm"]),
                    "margen_s_ha": st.mean(num(r["ingreso_neto_s_ha"]) for r in R)}  # synthetic
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


def water_m3_ha(crop, crops, et0m, source="calculada", efficiency=EFFICIENCY):
    if source == "medida" and crop in MEASURED:
        return MEASURED[crop]
    if crop in crops and crop in SOWING:
        months = SOWING[crop][0] if isinstance(SOWING[crop][0], tuple) else (SOWING[crop][0],)
        etc = sum(sum(seasonal_profile(crops[crop]["kc"], crops[crop]["ciclo"], m, et0m)) for m in months) / len(months)
        return etc * 10 / efficiency
    return MEASURED.get(crop)  # Paprika / Vid: only the measured value exists


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
    print("1) EFECTO DE USAR LA ET0 DEL MES DE SIEMBRA (m3/ha por ciclo, Penman-Monteith, eficiencia 75 %)")
    print(f"   {'cultivo':9s} {'siembra':>7s} {'anual':>8s} {'mensual':>8s} {'dif':>6s}  fuente del mes")
    annual = sum(et0m)
    for c in SOWING:
        k = crops[c]
        a = k["kc"] * annual * k["ciclo"] / 365 * 10 / EFFICIENCY
        s = water_m3_ha(c, crops, et0m)
        print(f"   {c:9s} {str(SOWING[c][0]):>7s} {a:8.0f} {s:8.0f} {100 * (s / a - 1):+5.0f}%  {SOWING[c][1]}")
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
