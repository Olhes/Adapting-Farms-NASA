"""Rotation generator: builds 3-campaign rotations after the current crop and scores them with the GreenOrbit model.

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

import i18n
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
# Display text. Crop names inside the texts are translated; facts keep the Spanish names (they are identifiers).
TXT = {
    "es": {
        "adj_dry": "tu zona perdió hasta {pct} % de verdor en un año con menos agua, así que el agua pesa 50 % más",
        "adj_et": "tu zona usa {et} mm de agua al año frente a {etz} mm del promedio, así que el agua por hectárea se ajustó ×{f:.2f}",
        "soil": "Balance de nitrógeno de la rotación: {n:+.0f} kg/ha (ajo y cebolla: extracción medida por el INIA; los demás, valores del modelo sintético). "
                "Rendimiento esperado por salinidad (CE {ece} dS/m): {y:.0f} % (FAO-29).",
        "water": "Usa {w:,.0f} m³/ha por campaña, {p:+.0f} % frente al promedio de las alternativas (eficiencia de riego {e:.0%}, calibrada).",
        "win_water": "ahorra agua: usa {m3:,} m³ por hectárea en cada campaña, {pct} % {dir} que el promedio de las otras opciones",
        "less": "menos", "more": "más",
        "give_water": "gasta más agua: {m3:,} m³ por hectárea en cada campaña",
        "win_inc": "deja buen ingreso: unos S/ {s:,} por hectárea en cada campaña, aun en un año regular a malo",
        "give_inc": "deja menos ingreso que otras opciones",
        "win_soil": "cuida el suelo: {who} repone nitrógeno", "the_rotation": "la rotación",
        "give_soil": "le quita al suelo unos {n} kg de nitrógeno por hectárea en tres campañas, porque {who} lo extraen; sumar una haba ayuda a reponerlo",
        "salt": "con una salinidad de {ce} dS/m, {hits} de lo normal, y eso ya está descontado del ingreso",
        "salt_hit": "{c} rinde {v} %",
        "current": "Si sigues sembrando {c} cada campaña (tu forma actual, para comparar): ",
        "add": "Con solo tus cultivos no hay rotación que cumpla las reglas. Si agregas {c}, ",
        "add_win": "esta rotación {win}. ", "add_ok": "esta rotación ya cumple las reglas. ", "and": " y ",
        "why": "Por qué la recomendamos: {win}. ",
        "balanced": "Es una opción equilibrada, sin un punto fuerte claro. ",
        "gives": "Qué cede: {give}. ",
        "rules_ok": "Cumple las reglas de rotación.", "rules_bad": "Ojo: ", "favor": " A favor: ",
        "gap_inc": "no hay dato de ingreso de {c}",
        "gap_sal_ref": "la salinidad de tu parcela no está medida (usamos 2,8 dS/m de referencia)",
        "gap_sal_user": "la salinidad de {ce} dS/m la ingresaste tú; no la verificamos",
        "site_kind": " Ojo: el satélite ve tu punto como {k} (verdor {ndvi}); revisa si ahí hay riego estable antes de sembrar.",
        "site_adj": " Ajustado a tu parcela: ",
        "unknown": " Qué no sabemos: ",
    },
    "en": {
        "adj_dry": "your area lost up to {pct} % of greenness in a year with less water, so water weighs 50 % more",
        "adj_et": "your area uses {et} mm of water a year versus {etz} mm on average, so water per hectare was adjusted ×{f:.2f}",
        "soil": "Nitrogen balance of the rotation: {n:+.0f} kg/ha (garlic and onion: extraction measured by INIA; the rest, values from the synthetic model). "
                "Expected yield under salinity (EC {ece} dS/m): {y:.0f} % (FAO-29).",
        "water": "Uses {w:,.0f} m³/ha per campaign, {p:+.0f} % versus the average of the alternatives (irrigation efficiency {e:.0%}, calibrated).",
        "win_water": "saves water: it uses {m3:,} m³ per hectare each campaign, {pct} % {dir} than the average of the other options",
        "less": "less", "more": "more",
        "give_water": "uses more water: {m3:,} m³ per hectare each campaign",
        "win_inc": "gives a good income: about S/ {s:,} per hectare each campaign, even in a regular to bad year",
        "give_inc": "gives less income than other options",
        "win_soil": "protects the soil: {who} puts nitrogen back", "the_rotation": "the rotation",
        "give_soil": "takes about {n} kg of nitrogen per hectare from the soil over three campaigns, because {who} extract it; adding fava beans helps put it back",
        "salt": "with a salinity of {ce} dS/m, {hits} of normal, and that is already taken off the income",
        "salt_hit": "{c} yields {v} %",
        "current": "If you keep sowing {c} every campaign (your current way, for comparison): ",
        "add": "With only your crops no rotation follows the rules. If you add {c}, ",
        "add_win": "this rotation {win}. ", "add_ok": "this rotation already follows the rules. ", "and": " and ",
        "why": "Why we recommend it: {win}. ",
        "balanced": "It is a balanced option, with no clear strong point. ",
        "gives": "What it gives up: {give}. ",
        "rules_ok": "It follows the rotation rules.", "rules_bad": "Watch out: ", "favor": " In favour: ",
        "gap_inc": "there is no income data for {c}",
        "gap_sal_ref": "your plot's salinity is not measured (we use 2.8 dS/m as a reference)",
        "gap_sal_user": "you entered the salinity of {ce} dS/m; we have not checked it",
        "site_kind": " Watch out: the satellite sees your point as {k} (greenness {ndvi}); check that there is steady irrigation there before sowing.",
        "site_adj": " Adjusted to your plot: ",
        "unknown": " What we do not know: ",
    },
}


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


def generate(current, w_water=80, w_soil=65, w_income=45, ece=2.8, top=5, site=None, allowed=None, cap_pct=100.0, lang="es"):
    """First 3 items: best by weighted score. The rest: alternatives along the income-soil Pareto front.

    site (optional, from pixeles.site): the tapped MODIS pixel. (1) If its greenness dropped in dry years, water weighs
    50 % more; (2) desert or mixed pixels lower the confidence; (3) water per hectare is scaled by local ET / zone ET.

    allowed (optional): the crops the farmer plans to sow. Rotations use only those; when no rotation of them follows
    the rules (e.g. only potato), the answer is the best rotations that add ONE crop, saying which one. The farmer's
    current way (the current crop every campaign) is always appended last, for comparison.
    Scores are normalised over all valid rotations, so they compare across these cases.
    lang: language of the display texts ('es' or 'en'); numbers and identifiers do not change.
    """
    txt = TXT.get(lang, TXT["es"])
    adjust = []
    sensitive = bool(site and site["peor_anio_seco_pct"] is not None and site["peor_anio_seco_pct"] <= -5)
    if sensitive:
        w_water = w_water * 1.5
        adjust.append(txt["adj_dry"].format(pct=abs(site['peor_anio_seco_pct'])))
    factor = site["factor_agua"] if site and site["factor_agua"] else 1.0
    if site and site["factor_agua"]:
        adjust.append(txt["adj_et"].format(et=site['et_mm'], etz=site['et_zona_mm'], f=factor))
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
        bad, good = rotacion.check(seq, previous=current, lang=lang)
        rows.append({"seq": seq, "bad": bad, "good": good,
                     "water": st.mean(water[c] for c in seq),
                     "n": sum(n_bal[c] for c in seq),
                     "yrel": st.mean(_salt_yield(c, ece) for c in seq),
                     "inc": [income[c][0] for c in seq if c in income],
                     "inc_src": [income[c][1] for c in seq if c in income]})
    ok = [r for r in rows if not r["bad"]]
    known = [v for v, _ in income.values()]
    fill = st.median(known)
    for r in rows:
        # salinity lowers the yield, so it lowers the income of each crop by its FAO-29 relative yield
        vals = [(income[c][0] if c in income else fill) * _salt_yield(c, ece) for c in r["seq"]]
        r["income"] = st.mean(vals)
        wl, wh = min(r["water"] for r in ok), max(r["water"] for r in ok)
    nl, nh = min(r["n"] for r in ok), max(r["n"] for r in ok)
    ilo, ihi = min(r["income"] for r in ok), max(r["income"] for r in ok)
    tot = (w_water + w_soil + w_income) or 1
    for r in rows:
        r["s_water"] = min(1.0, max(0.0, 1 - _norm(r["water"], wl, wh)))
        # soil = what the rotation does to the soil (nitrogen, rules); salinity is a condition of the plot, it goes to income
        r["s_soil"] = min(1.0, 0.85 * _norm(r["n"], nl, nh) + 0.15 * min(1, len(r["good"])))
        r["s_soil"] = max(0.0, r["s_soil"])
        r["s_inc"] = min(1.0, max(0.0, _norm(r["income"], ilo, ihi)))
        r["score"] = (w_water * r["s_water"] + w_soil * r["s_soil"] + w_income * r["s_inc"]) / tot
    ok.sort(key=lambda r: -r["score"])
    # which rotations may be shown: all, only the farmer's crops, or the farmer's crops plus one suggested crop
    all_valid = list(ok)
    mode, added = "libre", {}
    allowed_set = {c for c in (allowed or []) if c in CANDIDATES}
    if allowed_set:
        inside = [r for r in ok if set(r["seq"]) <= allowed_set]
        if inside:
            ok, mode = inside, "lista"
        else:
            mode, by_extra = "sugerencia", {}
            for r in ok:                     # ok is sorted: the first rotation per set of added crops is its best
                extra = frozenset(set(r["seq"]) - allowed_set)
                if 1 <= len(extra) <= 2:
                    by_extra.setdefault(extra, r)
            ok = sorted(by_extra.values(), key=lambda r: -r["score"])[:3]
            added = {id(r): " y ".join(sorted(x)) for x, r in by_extra.items()}
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
    spread = sorted(front, key=lambda r: r["s_soil"]) if mode != "sugerencia" else []
    for pos in ((0.0, 0.25, 0.5, 0.75, 1.0) if spread else ()):   # trade-off alternatives spread along the front, so the chart shows a front
        r = spread[round(pos * (len(spread) - 1))]
        k = frozenset(r["seq"])
        if k not in seen and len(best) < top + 1:
            seen.add(k)
            best.append(r)
    # water that reaches one hectare in a year vs what each campaign asks (agua_parcela, month by month)
    import agua_parcela
    supply = agua_parcela.delivery_m3_ha(cap_pct)
    et0s = [sim.load_et0_monthly(m) for m in ("hargreaves", "pm")]
    monthly = {c: agua_parcela.crop_monthly(c, crops, et0s)[0] for c in set(c for r in rows for c in r["seq"]) | {current}}
    monthly = {c: [v * factor for v in prof] for c, prof in monthly.items()}

    def fit(seq):
        over = [c for c in dict.fromkeys(seq) if sum(monthly[c]) > sum(supply)]
        short = max(sum(d > s_ for d, s_ in zip(monthly[c], supply)) for c in seq)
        return {"llega_m3_ha_anio": round(sum(supply)), "cap_pct": cap_pct, "cabe_en_el_anio": not over,
                "no_caben": over, "max_meses_con_deficit": short,
                "pide_max_m3_ha": round(max(sum(monthly[c]) for c in seq))}

    current_way = next(r for r in rows if r["seq"] == (current,) * 3)
    if current_way not in best:
        best.append(current_way)
    avg_w = st.mean(r["water"] for r in all_valid)
    out = []
    for i, r in enumerate(best):
        is_current = r is current_way
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
            "modo": mode, "agrega": added.get(id(r)), "es_forma_actual": is_current,
            "agua_cabe": fit(r["seq"]),
        }
        rationale = explain_template(facts, lang)
        out.append({
            "id": "actual" if is_current else f"gen-{i + 1}", "sequence": [current, *r["seq"]], "confidence": conf, "rationale": rationale, "facts": facts,
            "soil_impact": txt["soil"].format(n=r['n'], ece=ece, y=100 * r['yrel']),
            "water_balance": txt["water"].format(w=r['water'], p=100 * (r['water'] / avg_w - 1), e=sim.EFFICIENCY),
            "adj_water": _stars(r["s_water"]), "adj_soil": _stars(r["s_soil"]), "adj_income": _stars(r["s_inc"]),
            "score": round(5 * r["score"], 2), "match_pct": max(42, min(98, round(100 * r["score"]))),
            "pareto_x": round(100 * r["s_inc"]), "pareto_y": round(100 * r["s_soil"]), "pareto_optimal": id(r) in front_ids and not is_current,
        })
    return out


def explain_template(f, lang="es"):
    """Plain-language explanation built only from the model's facts: why it wins, what it gives up, what we do not know."""
    txt = TXT.get(lang, TXT["es"])
    names = lambda cs: i18n.crops(cs, lang)
    win, give = [], []
    st_ = f["estrellas"]
    if st_["agua"] >= 4:
        win.append(txt["win_water"].format(m3=f['agua_m3_ha_campana'], pct=abs(f['agua_vs_promedio_pct']),
                                           dir=txt["less"] if f["agua_vs_promedio_pct"] < 0 else txt["more"]))
    elif st_["agua"] <= 2:
        give.append(txt["give_water"].format(m3=f['agua_m3_ha_campana']))
    if st_["ingreso"] >= 4:
        win.append(txt["win_inc"].format(s=f['ingreso_prudente_s']))
    elif st_["ingreso"] <= 2:
        give.append(txt["give_inc"])
    if st_["suelo"] >= 4:
        win.append(txt["win_soil"].format(who=names(f['reponen_n']) or txt["the_rotation"]))
    elif f["balance_n_kg_ha"] < 0:
        give.append(txt["give_soil"].format(n=abs(f['balance_n_kg_ha']), who=names(dict.fromkeys(f['extraen_n']))))
    hit = {c: v for c, v in f["rinde_por_sal"].items() if v < 85}
    if hit:
        give.append(txt["salt"].format(ce=f['ce_dsm'], hits=", ".join(txt["salt_hit"].format(c=i18n.crop(c, lang), v=v) for c, v in hit.items())))
    if f.get("es_forma_actual"):
        lead = txt["current"].format(c=i18n.crop(f['rotacion'][0], lang))
        text = lead + ("; ".join(win + give) + ". " if win or give else "")
        give = []
    elif f.get("agrega"):
        added = txt["and"].join(i18n.crop(c, lang) for c in f["agrega"].split(" y "))   # facts join with " y "
        text = (txt["add"].format(c=added)
                + (txt["add_win"].format(win="; ".join(win)) if win else txt["add_ok"]))
    else:
        text = txt["why"].format(win="; ".join(win)) if win else txt["balanced"]
    if give:
        text += txt["gives"].format(give="; ".join(give))
    text += txt["rules_ok"] if f["reglas_ok"] else txt["rules_bad"] + " ".join(f["reglas_rotas"])
    if f["a_favor"]:
        text += txt["favor"] + " ".join(f["a_favor"])
    gaps = []
    if f["sin_dato_ingreso"]:
        gaps.append(txt["gap_inc"].format(c=names(f['sin_dato_ingreso'])))
    gaps.append(txt["gap_sal_ref"] if f["ce_dsm"] == 2.8 else txt["gap_sal_user"].format(ce=f['ce_dsm']))
    p = f.get("parcela")
    if p:
        if p["tipo"] != "regado":
            text += txt["site_kind"].format(k=i18n.kind(p['tipo'], lang), ndvi=p['ndvi'])
        if f.get("ajustes_parcela"):
            text += txt["site_adj"] + "; ".join(f["ajustes_parcela"]) + "."
    return text.strip() + txt["unknown"] + "; ".join(gaps) + "."


def real_income_crops():
    return {"Papa", "Cebolla", "Ajo"}


if __name__ == "__main__":
    for r in generate("Papa"):
        print(" > ".join(r["sequence"]), r["confidence"], r["adj_water"], r["adj_soil"], r["adj_income"], r["match_pct"])
