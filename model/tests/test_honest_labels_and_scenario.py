"""Honest labels (a range between two ET0 methods, the 0.5 factor is not an irrigation efficiency), caveats, a localised
dry-year rule, and a dry scenario for the rotation ranking that uses the same supply as the calendar."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agua_parcela  # noqa: E402
import generador  # noqa: E402
import simulador_tope as sim  # noqa: E402

BANNED = ("calibrat", "calibrad", "overestimat", "sobreestim")


def _all_text(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _all_text(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _all_text(v)


# ---------- wording ----------

@pytest.mark.parametrize("lang", ["es", "en"])
def test_calendar_text_does_not_call_hargreaves_calibrated_or_pm_an_overestimate(lang):
    d = agua_parcela.calendar(["Papa", "Haba"], lang=lang)
    text = " ".join(_all_text({k: d[k] for k in ("supuestos", "resumen", "dry_rule", "caveats")})).lower()
    assert not any(b in text for b in BANNED)


def test_calendar_assumptions_describe_the_factor_and_the_method_range():
    en = " ".join(agua_parcela.calendar(["Papa"], lang="en")["supuestos"])
    assert "ratio of satellite-estimated ET to delivered water" in en
    assert "conveyance and application losses" in en and "ET estimation error" in en
    assert "range between two standard ET0 methods (Hargreaves-Samani and FAO-56 Penman-Monteith)" in en
    es = " ".join(agua_parcela.calendar(["Papa"], lang="es")["supuestos"])
    assert "Hargreaves-Samani" in es and "Penman-Monteith" in es and "pérdidas de conducción" in es


@pytest.mark.parametrize("lang", ["es", "en"])
def test_rotation_texts_do_not_say_calibrated(lang):
    for r in generador.generate("Papa", lang=lang):
        assert not any(b in r["water_balance"].lower() for b in BANNED)
    assert "ratio" in generador.generate("Papa", lang="en")[0]["water_balance"]


# ---------- caveats ----------

def test_caveats_are_three_localised_entries():
    en = agua_parcela.calendar(["Papa"], lang="en")["caveats"]
    es = agua_parcela.calendar(["Papa"], lang="es")["caveats"]
    assert len(en) == len(es) == 3 and en != es
    assert "order-of-magnitude" in en[0] and "field measurements" in en[0]
    assert "gross revenue" in en[1] and "production costs" in en[1]
    assert "synthetic stress case" in en[2] and "lowest delivery" in en[2]
    assert agua_parcela.caveats("fr") == es          # unknown language falls back to Spanish like the other texts


# ---------- dry_rule follows the language ----------

def test_dry_rule_is_localised():
    en = agua_parcela.calendar(["Papa"], lang="en")["dry_rule"]
    es = agua_parcela.calendar(["Papa"], lang="es")["dry_rule"]
    assert en.startswith("Dry year") and es.startswith("Año seco") and en != es
    assert "entrega_min_hm3" in en and "entrega_min_hm3" in es


# ---------- central == low flag ----------

def test_water_range_says_when_the_central_value_is_the_low_end():
    wr = generador.generate("Papa")[0]["facts"]["water_range_m3_ha_campaign"]
    assert wr["central"] == wr["low"] and wr["central_is_low"] is True
    assert wr["low"] <= wr["high"]


# ---------- dry scenario in the ranking ----------

def test_ranking_default_supply_is_unchanged_and_dry_uses_the_calendar_supply():
    normal = generador.generate("Papa")[0]["facts"]["agua_cabe"]
    assert normal["llega_m3_ha_anio"] == agua_parcela.calendar(["Papa"])["entrega_anual_m3_ha"]
    assert generador.generate("Papa", scenario="normal")[0]["facts"]["agua_cabe"] == normal
    dry = generador.generate("Papa", scenario="dry")[0]["facts"]["agua_cabe"]
    assert dry["llega_m3_ha_anio"] == agua_parcela.calendar(["Papa"], scenario="dry")["entrega_anual_m3_ha"]
    assert dry["llega_m3_ha_anio"] < normal["llega_m3_ha_anio"]


def test_a_flat_cap_still_wins_over_the_dry_scenario_like_in_the_calendar():
    flat = generador.generate("Papa", cap_pct=88, scenario="dry")[0]["facts"]["agua_cabe"]
    assert flat["llega_m3_ha_anio"] == agua_parcela.calendar(["Papa"], cap_pct=88, scenario="dry")["entrega_anual_m3_ha"]


def test_dry_scenario_does_not_move_the_scores_or_the_water_figures():
    a, b = generador.generate("Papa"), generador.generate("Papa", scenario="dry")
    assert [(r["sequence"], r["score"]) for r in a] == [(r["sequence"], r["score"]) for r in b]
    assert [r["facts"]["water_range_m3_ha_campaign"] for r in a] == [r["facts"]["water_range_m3_ha_campaign"] for r in b]
    assert sim.EFFICIENCY == 0.5
