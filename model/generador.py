"""Rotation generator: builds 3-campaign rotations after the current crop and scores them with the Rizosfera model.

Replaces the hand-written rotation table: candidates are enumerated, filtered/penalised by the sourced rotation rules
(rotacion.py), and scored on water (simulador_tope), soil (nitrogen balance + salinity yield loss + rules) and income
(real Majes gross income where it exists, Midagri departmental reference otherwise, nothing when there is no source).
Scores are relative to the other candidates (1-5), so they rank alternatives, they are not absolute grades.
"""
import csv
import itertools
import json
import statistics as st
from pathlib import Path

import rotacion
import simulador_tope as sim

DATA = Path(__file__).parent / "data"
CANDIDATES = ["Papa", "Cebolla", "Ajo", "Quinua", "Zapallo", "Haba", "Maíz", "Alfalfa", "Paprika"]
NOT_AVAILABLE = {"Tomate": "no hay Kc ni salinidad ni rendimiento en el modelo"}
# Nitrogen balance per campaign (kg N/ha): synthetic dataset, except onion/garlic (INIA Santa Rita 2023 extraction)
N_BALANCE_OVERRIDE = {"Ajo": -150, "Cebolla": -90, "Paprika": -100}
N_SOURCE = {"Ajo": "INIA", "Cebolla": "INIA"}
SALT = {"Cebolla": (1.2, 16), "Ajo": (3.9, 14.3), "Papa": (1.7, 12), "Maíz": (1.7, 12), "Alfalfa": (2.0, 7.3),
        "Haba": (1.6, 9.6), "Zapallo": (4.9, 10.5), "Quinua": (8.0, 2.9), "Paprika": (1.5, 14.0)}
REFERENCE_ID = {"Quinua": "quinua", "Paprika": "paprika", "Maíz": "maiz_choclo", "Haba": "haba", "Alfalfa": "alfalfa"}


def _catalog():
    crops = sim.load_crops()
    n_bal = {}
    for r in csv.DictReader(open(DATA / "dataset_modelo_rotacion_majes - dataset_modelo.csv")):
        n_bal.setdefault(r["cultivo_candidato"], sim.num(r["balance_n_kg_ha"]))
    n_bal.update(N_BALANCE_OVERRIDE)
    real = {}
    for c, key in (("Papa", "PAPA"), ("Cebolla", "CEBOLLA"), ("Ajo", "AJO")):
        v = [float(r["rendimiento_t_ha"]) * 1000 * float(r["precio_chacra_s_kg"])
             for r in csv.DictReader(open(DATA / "kpis_cultivo_majes_tablero.csv")) if r["cultivo"] == key]
        v.sort()
        real[c] = (v[round(0.25 * (len(v) - 1))], "real Majes, año regular a malo (percentil 25, Midagri 2016-2025)")
    ref = {x["id"]: x for x in json.loads((DATA / "cultivos_arequipa_greenorbit.json").read_text())["cultivos"]}
    income = dict(real)
    for c, rid in REFERENCE_ID.items():
        if rid in ref and ref[rid]["economia"].get("ingreso_bruto_referencial_S_ha"):
            income[c] = (ref[rid]["economia"]["ingreso_bruto_referencial_S_ha"], "referencia departamental (Midagri 2023)")
    return crops, n_bal, income


def _salt_yield(crop, ece):
    a, b = SALT[crop]
    return max(0.0, min(100.0, 100.0 if ece <= a else 100.0 - b * (ece - a))) / 100


def _norm(v, lo, hi):
    return 0.5 if hi - lo < 1e-9 else (v - lo) / (hi - lo)


def _stars(x):
    return max(1, min(5, round(1 + 4 * x)))


def generate(current, w_water=80, w_soil=65, w_income=45, ece=2.8, top=5, site=None):
    """First 3 items: best by weighted score. The rest: alternatives along the income-soil Pareto front.

    site (optional, from pixeles.site): the tapped MODIS pixel. (1) If its greenness dropped in dry years, water weighs
    50 % more; (2) desert or mixed pixels lower the confidence; (3) water per hectare is scaled by local ET / zone ET.
    """
    adjust = []
    sensitive = bool(site and site["peor_anio_seco_pct"] is not None and site["peor_anio_seco_pct"] <= -5)
    if sensitive:
        w_water = w_water * 1.5
        adjust.append(f"tu zona perdió hasta {abs(site['peor_anio_seco_pct'])} % de verdor en un año con menos agua, así que el agua pesa 50 % más")
    factor = site["factor_agua"] if site and site["factor_agua"] else 1.0
    if site and site["factor_agua"]:
        adjust.append(f"tu zona usa {site['et_mm']} mm de agua al año frente a {site['et_zona_mm']} mm del promedio, así que el agua por hectárea se ajustó ×{factor:.2f}")
    poor_site = bool(site and site["tipo"] != "regado")
    crops, n_bal, income = _catalog()
    et = {m: sim.load_et0_monthly(m) for m in ("hargreaves", "pm")}
    water = {}
    for c in CANDIDATES:
        if c == "Paprika":
            water[c] = sim.MEASURED["Paprika"] * factor
        else:
            water[c] = factor * st.mean(sim.water_m3_ha(c, crops, et[m], "calculada", sim.EFFICIENCY) for m in et)
    rows = []
    for seq in itertools.product(CANDIDATES, repeat=3):
        bad, good = rotacion.check(seq, previous=current)
        rows.append({"seq": seq, "bad": bad, "good": good,
                     "water": st.mean(water[c] for c in seq),
                     "n": sum(n_bal[c] for c in seq),
                     "yrel": st.mean(_salt_yield(c, ece) for c in seq),
                     "inc": [income[c][0] for c in seq if c in income],
                     "inc_src": [income[c][1] for c in seq if c in income]})
    ok = [r for r in rows if not r["bad"]] or rows
    known = [v for v, _ in income.values()]
    fill = st.median(known)
    for r in ok:
        # salinity lowers the yield, so it lowers the income of each crop by its FAO-29 relative yield
        vals = [(income[c][0] if c in income else fill) * _salt_yield(c, ece) for c in r["seq"]]
        r["income"] = st.mean(vals)
        wl, wh = min(r["water"] for r in ok), max(r["water"] for r in ok)
    nl, nh = min(r["n"] for r in ok), max(r["n"] for r in ok)
    ilo, ihi = min(r["income"] for r in ok), max(r["income"] for r in ok)
    tot = (w_water + w_soil + w_income) or 1
    for r in ok:
        r["s_water"] = 1 - _norm(r["water"], wl, wh)
        # soil = what the rotation does to the soil (nitrogen, rules); salinity is a condition of the plot, it goes to income
        r["s_soil"] = min(1.0, 0.85 * _norm(r["n"], nl, nh) + 0.15 * min(1, len(r["good"])))
        r["s_inc"] = _norm(r["income"], ilo, ihi)
        r["score"] = (w_water * r["s_water"] + w_soil * r["s_soil"] + w_income * r["s_inc"]) / tot
    ok.sort(key=lambda r: -r["score"])
    # Pareto front over ALL valid rotations (income vs soil): a rotation is dominated if another is at least as good on both
    front = [r for r in ok if not any(o["s_inc"] >= r["s_inc"] and o["s_soil"] >= r["s_soil"] and
                                      (o["s_inc"] > r["s_inc"] or o["s_soil"] > r["s_soil"]) for o in ok)]
    front_ids = {id(r) for r in front}
    best, seen = [], set()
    for r in ok:                         # top by weighted score, distinct sets of crops
        k = frozenset(r["seq"])
        if k not in seen:
            seen.add(k)
            best.append(r)
        if len(best) == 3:
            break
    spread = sorted(front, key=lambda r: r["s_soil"])
    for pos in (0.0, 0.25, 0.5, 0.75, 1.0):   # trade-off alternatives spread along the front, so the chart shows a front
        r = spread[round(pos * (len(spread) - 1))]
        k = frozenset(r["seq"])
        if k not in seen and len(best) < top + 1:
            seen.add(k)
            best.append(r)
    avg_w = st.mean(r["water"] for r in ok)
    out = []
    for i, r in enumerate(best):
        real_n = sum(c in real_income_crops() for c in r["seq"])
        missing = [c for c in r["seq"] if c not in income]
        conf = "BAJA" if (r["bad"] or (poor_site and site["tipo"].startswith("desierto"))) else ("ALTA" if not missing and real_n >= 2 and not poor_site else "MEDIA")
        stars = {"agua": _stars(r["s_water"]), "suelo": _stars(r["s_soil"]), "ingreso": _stars(r["s_inc"])}
        facts = {
            "rotacion": [current, *r["seq"]], "estrellas": stars,
            "prioridades": {"agua": w_water, "suelo": w_soil, "ingreso": w_income},
            "agua_m3_ha_campana": round(r["water"]), "agua_vs_promedio_pct": round(100 * (r["water"] / avg_w - 1)),
            "balance_n_kg_ha": round(r["n"]), "extraen_n": [c for c in r["seq"] if n_bal[c] < 0],
            "reponen_n": [c for c in r["seq"] if n_bal[c] > 0],
            "rendimiento_por_sal_pct": round(100 * r["yrel"]), "ce_dsm": ece,
            "rinde_por_sal": {c: round(100 * _salt_yield(c, ece)) for c in r["seq"]},
            "ingreso_prudente_s": round(r["income"]), "fuentes_ingreso": sorted(set(r["inc_src"])),
            "sin_dato_ingreso": missing, "reglas_ok": not r["bad"], "reglas_rotas": r["bad"], "a_favor": r["good"],
            "parcela": site, "ajustes_parcela": adjust,
        }
        rationale = explain_template(facts)
        out.append({
            "id": f"gen-{i + 1}", "sequence": [current, *r["seq"]], "confidence": conf, "rationale": rationale, "facts": facts,
            "soil_impact": f"Balance de nitrógeno de la rotación: {r['n']:+.0f} kg/ha (ajo y cebolla: extracción medida por el INIA; los demás, valores del modelo sintético). "
                           f"Rendimiento esperado por salinidad (CE {ece} dS/m): {100 * r['yrel']:.0f} % (FAO-29).",
            "water_balance": f"Usa {r['water']:,.0f} m³/ha por campaña, {100 * (r['water'] / avg_w - 1):+.0f} % frente al promedio de las alternativas (eficiencia de riego {sim.EFFICIENCY:.0%}, calibrada).",
            "adj_water": _stars(r["s_water"]), "adj_soil": _stars(r["s_soil"]), "adj_income": _stars(r["s_inc"]),
            "score": round(5 * r["score"], 2), "match_pct": max(42, min(98, round(100 * r["score"]))),
            "pareto_x": round(100 * r["s_inc"]), "pareto_y": round(100 * r["s_soil"]), "pareto_optimal": id(r) in front_ids,
        })
    return out


def explain_template(f):
    """Plain-language explanation built only from the model's facts: why it wins, what it gives up, what we do not know."""
    win, give = [], []
    st_ = f["estrellas"]
    if st_["agua"] >= 4:
        win.append(f"ahorra agua: usa {f['agua_m3_ha_campana']:,} m³ por hectárea en cada campaña, {abs(f['agua_vs_promedio_pct'])} % "
                   + ("menos" if f["agua_vs_promedio_pct"] < 0 else "más") + " que el promedio de las otras opciones")
    elif st_["agua"] <= 2:
        give.append(f"gasta más agua: {f['agua_m3_ha_campana']:,} m³ por hectárea en cada campaña")
    if st_["ingreso"] >= 4:
        win.append(f"deja buen ingreso: unos S/ {f['ingreso_prudente_s']:,} por hectárea en cada campaña, aun en un año regular a malo")
    elif st_["ingreso"] <= 2:
        give.append("deja menos ingreso que otras opciones")
    if st_["suelo"] >= 4:
        win.append(f"cuida el suelo: {', '.join(f['reponen_n']) or 'la rotación'} repone nitrógeno")
    elif f["balance_n_kg_ha"] < 0:
        give.append(f"le quita al suelo unos {abs(f['balance_n_kg_ha'])} kg de nitrógeno por hectárea en tres campañas, porque "
                    f"{', '.join(dict.fromkeys(f['extraen_n']))} lo extraen; sumar una haba ayuda a reponerlo")
    hit = {c: v for c, v in f["rinde_por_sal"].items() if v < 85}
    if hit:
        give.append(f"con una salinidad de {f['ce_dsm']} dS/m, " + ", ".join(f"{c} rinde {v} %" for c, v in hit.items())
                    + " de lo normal, y eso ya está descontado del ingreso")
    text = ("Por qué la recomendamos: " + "; ".join(win) + ". ") if win else "Es una opción equilibrada, sin un punto fuerte claro. "
    if give:
        text += "Qué cede: " + "; ".join(give) + ". "
    text += "Cumple las reglas de rotación." if f["reglas_ok"] else "Ojo: " + " ".join(f["reglas_rotas"])
    if f["a_favor"]:
        text += " A favor: " + " ".join(f["a_favor"])
    gaps = []
    if f["sin_dato_ingreso"]:
        gaps.append(f"no hay dato de ingreso de {', '.join(f['sin_dato_ingreso'])}")
    gaps.append("la salinidad de tu parcela no está medida (usamos 2,8 dS/m de referencia)" if f["ce_dsm"] == 2.8
                else f"la salinidad de {f['ce_dsm']} dS/m la ingresaste tú; no la verificamos")
    p = f.get("parcela")
    if p:
        if p["tipo"] != "regado":
            text += f" Ojo: el satélite ve tu punto como {p['tipo']} (verdor {p['ndvi']}); revisa si ahí hay riego estable antes de sembrar."
        if f.get("ajustes_parcela"):
            text += " Ajustado a tu parcela: " + "; ".join(f["ajustes_parcela"]) + "."
    return text.strip() + " Qué no sabemos: " + "; ".join(gaps) + "."


def real_income_crops():
    return {"Papa", "Cebolla", "Ajo"}


if __name__ == "__main__":
    for r in generate("Papa"):
        print(" > ".join(r["sequence"]), r["confidence"], r["adj_water"], r["adj_soil"], r["adj_income"], r["match_pct"])
