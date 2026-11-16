"""Does a rotation fit the water the farmer receives? Month by month, per campaign.

Water the farmer receives (m3/ha per month) = monthly delivery at Pitay (data/entrega_mensual_pitay.csv, Autodema via
the team repo) spread over the irrigated area. Three supplies:
  normal_mean  the mean delivery of each month, 2013-2025;
  dry_profile  the lowest delivery seen in each month over 2013-2025 (the file has no per-year values, so this is a
               stress case built from the worst of each month, not one real year);
  cap_override a flat share of the normal year (cap_pct), which wins over the scenario when it is not 100.
Water a crop asks for = simulador_tope.crop_water (the same function that scores the rotations): FAO-56 ETc from its
sowing months with the central ET0 method (Hargreaves-Samani), divided by the 0.5 water factor (satellite-estimated ET
over delivered water, not a measured irrigation efficiency), or the measured total for paprika. The FAO-56
Penman-Monteith figure is returned as the other end of a range between two standard ET0 methods.

Assumptions (said in the output): one campaign per year; months outside the crop cycle need no water; the delivery
already includes the losses inside the pampa; paprika's total is measured and its monthly shape assumes August sowing.
"""
import i18n
import simulador_tope as sim

MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]
DRY_RULE = {
    "en": ("Dry year = the lowest delivery observed in each month at Pitay, 2013-2025 (entrega_min_hm3). The data has no "
           "per-year values, so the months come from different years: it is a stress case, harsher than any single "
           "recorded year."),
    "es": ("Año seco = la entrega más baja observada en cada mes en Pitay, 2013-2025 (entrega_min_hm3). Los datos no "
           "traen valores por año, así que los meses vienen de años distintos: es un caso de estrés, más duro que "
           "cualquier año registrado."),
}
CAVEATS = {
    "en": ["Absolute water figures are order-of-magnitude estimates; they have not been validated against field measurements.",
           "Income is gross revenue without production costs.",
           "The dry-year profile is a synthetic stress case built from the lowest delivery seen in each month."],
    "es": ["Las cifras absolutas de agua son estimaciones de orden de magnitud; no se han validado con mediciones de campo.",
           "El ingreso es ingreso bruto, sin costos de producción.",
           "El perfil de año seco es un caso de estrés sintético, armado con la entrega más baja vista en cada mes."],
}
TXT = {
    "es": {"normal": "con el agua de un año normal", "cap": "con el {pct:.0f} % del agua normal",
           "dry": "en un año seco (la entrega más baja vista en cada mes, {pct:.0f} % de lo normal)",
           "over": "{where}, {crops} pide más agua de la que llega en todo el año ({ys:,.0f} m³/ha): no alcanza.",
           "ok": "{where} alcanza todos los meses en las tres campañas.",
           "peak": "{where} alcanza en el año, pero no en los meses de mayor demanda: {crop} pide más de lo que "
                   "llega en {months} (faltan unos {d:,} m³/ha). Hace falta guardar agua de otros "
                   "meses en un reservorio o ajustar la fecha de siembra.",
           "assumptions": ["Una campaña por año; fuera del ciclo del cultivo no se riega.",
                           "El agua que te toca es la entrega de Pitay repartida en {area:,.0f} ha (promedio 2013-2025), "
                           "como si todas regaran todo el año; en la práctica las parcelas en descanso liberan agua.",
                           "El factor de eficiencia {eff:.0%} es el cociente entre la ET estimada por satélite y el agua entregada; "
                           "incluye pérdidas de conducción y de aplicación y cualquier error de estimación de la ET.",
                           "Las cifras de agua son un rango entre dos métodos estándar de ET0 (Hargreaves-Samani y Penman-Monteith FAO-56); "
                           "el valor central usa Hargreaves-Samani, el más bajo de los dos."]},
    "en": {"normal": "with the water of a normal year", "cap": "with {pct:.0f} % of the normal water",
           "dry": "in a dry year (the lowest delivery seen in each month, {pct:.0f} % of normal)",
           "over": "{where}, {crops} needs more water than arrives in the whole year ({ys:,.0f} m³/ha): it is not enough.",
           "ok": "{where} it is enough every month in all three campaigns.",
           "peak": "{where} it is enough over the year, but not in the months of highest demand: {crop} needs more than "
                   "arrives in {months} (about {d:,} m³/ha short). Water from other months has to be stored "
                   "in a reservoir, or the sowing date adjusted.",
           "assumptions": ["One campaign per year; no irrigation outside the crop cycle.",
                           "Your share of water is the Pitay delivery spread over {area:,.0f} ha (2013-2025 average), "
                           "as if every plot irrigated all year; in practice fallow plots free up water.",
                           "The efficiency factor {eff:.0%} is the ratio of satellite-estimated ET to delivered water; it includes "
                           "conveyance and application losses and any ET estimation error.",
                           "Water figures are a range between two standard ET0 methods (Hargreaves-Samani and FAO-56 Penman-Monteith); "
                           "the central value uses Hargreaves-Samani, the lower of the two."]},
}


def caveats(lang="es"):
    """Three short limits of the figures, in the requested language (Spanish when the language is unknown)."""
    return list(CAVEATS.get(lang, CAVEATS["es"]))


def dry_rule(lang="es"):
    return DRY_RULE.get(lang, DRY_RULE["es"])


def supply_m3_ha(cap_pct=None, scenario="normal", area_ha=sim.AREA_HA):
    """Water that reaches one hectare each month, and which of the three supplies it is.

    cap_pct None or 100 means no override: the scenario decides ("normal" or "dry"). Any other cap_pct is a flat
    share of the normal year and wins over the scenario."""
    delivery = sim.load_delivery()
    if cap_pct is not None and cap_pct != 100:
        hm3, basis = [v * cap_pct / 100 for v in delivery["mean"]], "cap_override"
    elif scenario == "dry":
        hm3, basis = list(delivery["min"]), "dry_profile"
    else:
        hm3, basis = list(delivery["mean"]), "normal_mean"
    return [v * 1e6 / area_ha for v in hm3], basis


def delivery_m3_ha(cap_pct=100.0, area_ha=sim.AREA_HA):
    """Monthly water per hectare at a flat share of the normal year (kept for callers that only need that)."""
    return [v * 1e6 / area_ha * cap_pct / 100 for v in sim.load_delivery()["mean"]]


def _short(demand, supply):
    return [{"mes": MONTHS[i], "falta_m3_ha": round(d - s)} for i, (d, s) in enumerate(zip(demand, supply)) if d > s]


def _campaign(crop, supply, dry_supply, efficiency):
    rng = sim.crop_water_range(crop, efficiency)
    water = rng["central"]
    demand, sowing = water["monthly"], water["sowing"]
    short = _short(demand, supply)
    year_supply = sum(supply)
    months = sorted(sowing["months"])
    return {"cultivo": crop, "mes_siembra": MONTHS[max(sowing["months"], key=lambda mw: mw[1])[0] - 1],
            "fuente_mes": sowing["source"],
            "siembra": {"basis": sowing["basis"], "months": [{"mes": MONTHS[m - 1], "peso": round(w, 3)} for m, w in months]},
            "water_basis": water["basis"],
            "demanda_m3_ha": [round(v) for v in demand], "total_m3_ha": round(water["total"]),
            "demand_range_m3_ha": {"low": [round(v) for v in rng["low"]["monthly"]],
                                   "high": [round(v) for v in rng["high"]["monthly"]]},
            "total_range_m3_ha": {"low": round(rng["low"]["total"]), "high": round(rng["high"]["total"])},
            "cabe_en_el_anio": water["total"] <= year_supply,
            "fits_in_year_high": rng["high"]["total"] <= year_supply,
            "meses_con_deficit": short, "deficit_total_m3_ha": sum(x["falta_m3_ha"] for x in short),
            "meses_con_deficit_seco": _short(demand, dry_supply)}


def calendar(sequence, cap_pct=None, area_ha=sim.AREA_HA, efficiency=sim.EFFICIENCY, lang="es", scenario="normal"):
    """sequence: the crops of the coming campaigns (without the current one). lang: 'es' or 'en' for the texts.
    scenario: 'normal' or 'dry' supply (see module docstring); cap_pct (not 100) overrides it with a flat share."""
    supply, basis = supply_m3_ha(cap_pct, scenario, area_ha)
    dry_supply, _ = supply_m3_ha(None, "dry", area_ha)
    year_supply = sum(supply)
    normal_year = sum(sim.load_delivery()["mean"]) * 1e6 / area_ha
    shown_pct = cap_pct if basis == "cap_override" else round(100 * year_supply / normal_year, 1)
    out = [_campaign(crop, supply, dry_supply, efficiency) for crop in sequence]
    return {"entrega_m3_ha": [round(v) for v in supply], "entrega_anual_m3_ha": round(year_supply),
            "supply_basis": basis, "scenario": scenario, "dry_rule": dry_rule(lang),
            "entrega_seca_m3_ha": [round(v) for v in dry_supply], "entrega_seca_anual_m3_ha": round(sum(dry_supply)),
            "cap_pct": shown_pct, "area_ha": area_ha, "eficiencia": efficiency,
            "et0_method": sim.ET0_CENTRAL, "et0_range_methods": {"low": sim.ET0_LOW, "high": sim.ET0_HIGH},
            "campanas": out,
            "resumen": summary(out, year_supply, basis, shown_pct, lang),
            "supuestos": [a.format(area=area_ha, eff=efficiency) for a in TXT.get(lang, TXT["es"])["assumptions"]],
            "caveats": caveats(lang)}


def summary(campaigns, year_supply, basis, pct, lang="es"):
    txt = TXT.get(lang, TXT["es"])
    over_year = list(dict.fromkeys(c["cultivo"] for c in campaigns if not c["cabe_en_el_anio"]))
    peaks = [c for c in campaigns if c["meses_con_deficit"]]
    where = {"normal_mean": lambda: txt["normal"], "cap_override": lambda: txt["cap"].format(pct=pct),
             "dry_profile": lambda: txt["dry"].format(pct=pct)}[basis]().capitalize()
    if over_year:
        return txt["over"].format(where=where, crops=i18n.crops(over_year, lang), ys=year_supply)
    if not peaks:
        return txt["ok"].format(where=where)
    worst = max(peaks, key=lambda c: c["deficit_total_m3_ha"])
    months = ", ".join(i18n.month(x["mes"], lang) for x in worst["meses_con_deficit"])
    return txt["peak"].format(where=where, crop=i18n.crop(worst["cultivo"], lang), months=months, d=worst["deficit_total_m3_ha"])
