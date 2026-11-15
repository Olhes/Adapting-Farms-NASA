"""Does a rotation fit the water the farmer receives? Month by month, per campaign.

Water the farmer receives (m3/ha per month) = mean monthly delivery at Pitay 2013-2025 (data/entrega_mensual_pitay.csv,
Autodema via the team repo) spread over the irrigated area, times the share of a normal year (cap_pct).
Water a crop asks for = FAO-56 ETc from its sowing month (simulador_tope.seasonal_profile), mean of Hargreaves and
Penman-Monteith, divided by the calibrated irrigation efficiency.

Assumptions (said in the output): one campaign per year; months outside the crop cycle need no water; the delivery
already includes the losses inside the pampa; paprika uses FAO-56 Kc 1.05 / 210 days and an assumed August sowing.
"""
import csv
import statistics as st
from pathlib import Path

import simulador_tope as sim

DATA = Path(__file__).parent / "data"
MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]
EXTRA = {"Paprika": {"kc": 1.05, "ciclo": 210, "mes": 8, "fuente": "SUPUESTO: Kc FAO-56 de pimiento, siembra en agosto"}}


def delivery_m3_ha(cap_pct=100.0, area_ha=sim.AREA_HA):
    rows = list(csv.DictReader(open(DATA / "entrega_mensual_pitay.csv")))
    return [float(r["entrega_media_hm3"]) * 1e6 / area_ha * cap_pct / 100 for r in rows]


def crop_monthly(crop, crops, et0s, efficiency=sim.EFFICIENCY):
    if crop in EXTRA:
        kc, cycle, month, source = EXTRA[crop]["kc"], EXTRA[crop]["ciclo"], EXTRA[crop]["mes"], EXTRA[crop]["fuente"]
    else:
        kc, cycle = crops[crop]["kc"], crops[crop]["ciclo"]
        m = sim.SOWING[crop][0]
        month = m[0] if isinstance(m, tuple) else m
        source = sim.SOWING[crop][1]
    prof = [st.mean(vals) for vals in zip(*(sim.seasonal_profile(kc, cycle, month, e) for e in et0s))]
    return [v * 10 / efficiency for v in prof], month, source


def calendar(sequence, cap_pct=100.0, area_ha=sim.AREA_HA, efficiency=sim.EFFICIENCY):
    """sequence: the crops of the coming campaigns (without the current one)."""
    crops = sim.load_crops()
    et0s = [sim.load_et0_monthly(m) for m in ("hargreaves", "pm")]
    supply = delivery_m3_ha(cap_pct, area_ha)
    year_supply = sum(supply)
    out = []
    for crop in sequence:
        demand, month, source = crop_monthly(crop, crops, et0s, efficiency)
        short = [{"mes": MONTHS[i], "falta_m3_ha": round(d - s)} for i, (d, s) in enumerate(zip(demand, supply)) if d > s]
        out.append({"cultivo": crop, "mes_siembra": MONTHS[month - 1], "fuente_mes": source,
                    "demanda_m3_ha": [round(v) for v in demand], "total_m3_ha": round(sum(demand)),
                    "cabe_en_el_anio": sum(demand) <= year_supply, "meses_con_deficit": short,
                    "deficit_total_m3_ha": sum(x["falta_m3_ha"] for x in short)})
    return {"entrega_m3_ha": [round(v) for v in supply], "entrega_anual_m3_ha": round(year_supply),
            "cap_pct": cap_pct, "area_ha": area_ha, "eficiencia": efficiency, "campanas": out,
            "resumen": summary(out, year_supply, cap_pct),
            "supuestos": ["Una campaña por año; fuera del ciclo del cultivo no se riega.",
                          f"El agua que te toca es la entrega de Pitay repartida en {area_ha:,.0f} ha (promedio 2013-2025), "
                          "como si todas regaran todo el año; en la práctica las parcelas en descanso liberan agua.",
                          f"Eficiencia de riego {efficiency:.0%}, calibrada con la ET satelital."]}


def summary(campaigns, year_supply, cap_pct):
    over_year = list(dict.fromkeys(c["cultivo"] for c in campaigns if not c["cabe_en_el_anio"]))
    peaks = [c for c in campaigns if c["meses_con_deficit"]]
    where = "con el agua de un año normal" if cap_pct >= 100 else f"con el {cap_pct:.0f} % del agua normal"
    if over_year:
        return (f"{where.capitalize()}, {', '.join(over_year)} pide más agua de la que llega en todo el año "
                f"({year_supply:,.0f} m³/ha): no alcanza.")
    if not peaks:
        return f"{where.capitalize()} alcanza todos los meses en las tres campañas."
    worst = max(peaks, key=lambda c: c["deficit_total_m3_ha"])
    months = ", ".join(x["mes"] for x in worst["meses_con_deficit"])
    return (f"{where.capitalize()} alcanza en el año, pero no en los meses de mayor demanda: {worst['cultivo']} pide más de lo que "
            f"llega en {months} (faltan unos {worst['deficit_total_m3_ha']:,} m³/ha). Hace falta guardar agua de otros "
            f"meses en un reservorio o ajustar la fecha de siembra.")
