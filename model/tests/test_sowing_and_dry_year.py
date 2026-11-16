"""Sowing months come from the monthly sown-area records; the dry-year supply and the normal cap come from the Pitay
delivery table."""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agua_parcela  # noqa: E402
import generador  # noqa: E402
import simulador_tope as sim  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "data"
CSV_MONTH = {"ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AGO": 8, "SET": 9, "OCT": 10,
             "NOV": 11, "DIC": 12}


def _sown_area(crop):
    area = [0.0] * 12
    with open(DATA / "majes_siembra_mensual.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["cultivo"] == crop.upper() and r["serie"] == "historico":
                area[CSV_MONTH[r["mes"]] - 1] += float(r["hectareas"])
    return area


# ---------- sowing months ----------

def test_garlic_is_sown_where_the_records_peak_not_in_the_hardcoded_may():
    garlic = sim.SOWING["Ajo"]
    assert garlic["basis"] == "data"
    months = dict(garlic["months"])
    assert max(months, key=months.get) == 4          # the April peak
    assert 5 not in months or months[5] < months[4]
    assert "majes_siembra_mensual.csv" in garlic["source"]


@pytest.mark.parametrize("crop", ["Papa", "Cebolla", "Ajo", "Quinua", "Zapallo"])
def test_sowing_months_are_weighted_by_the_sown_area(crop):
    area = _sown_area(crop)
    months = sim.SOWING[crop]["months"]
    assert sum(w for _, w in months) == pytest.approx(1.0)
    peak = max(area)
    assert all(area[m - 1] >= sim.SOWING_PEAK_SHARE * peak for m, _ in months)       # only the real sowing window
    picked = sum(area[m - 1] for m, _ in months)
    for m, w in months:
        assert w == pytest.approx(area[m - 1] / picked)


@pytest.mark.parametrize("crop", ["Maíz", "Haba", "Alfalfa"])
def test_crops_missing_from_the_records_keep_a_labelled_fallback(crop):
    s = sim.SOWING[crop]
    assert s["basis"] == "fallback" and s["source"] == sim.SOWING_FALLBACK[crop][1]


def test_calendar_exposes_the_sowing_source_per_crop():
    garlic, haba = agua_parcela.calendar(["Ajo", "Haba"])["campanas"]
    assert garlic["siembra"]["basis"] == "data" and "majes_siembra_mensual.csv" in garlic["fuente_mes"]
    assert garlic["siembra"]["months"][0]["mes"] in {"mar", "abr"} and garlic["mes_siembra"] == "abr"
    assert haba["siembra"]["basis"] == "fallback" and haba["mes_siembra"] == "set"


# ---------- Pitay deliveries ----------

def test_normal_cap_is_derived_from_the_delivery_table():
    with open(DATA / "entrega_mensual_pitay.csv", encoding="utf-8") as f:
        total = sum(float(r["entrega_media_hm3"]) for r in csv.DictReader(f))
    assert sim.CAP_NORMAL_HM3 == round(total, 1) == 333.8


def test_dry_year_supply_is_the_lowest_delivery_seen_in_each_month():
    with open(DATA / "entrega_mensual_pitay.csv", encoding="utf-8") as f:
        lowest = [float(r["entrega_min_hm3"]) for r in csv.DictReader(f)]
    dry = agua_parcela.calendar(["Papa"], scenario="dry")
    assert dry["supply_basis"] == "dry_profile"
    assert dry["entrega_m3_ha"] == [round(v * 1e6 / sim.AREA_HA) for v in lowest]
    normal = agua_parcela.calendar(["Papa"])
    assert normal["supply_basis"] == "normal_mean" and dry["entrega_anual_m3_ha"] < normal["entrega_anual_m3_ha"]
    assert 70 < dry["cap_pct"] < 95            # the effective share of a normal year, reported as a number


def test_normal_calendar_also_carries_the_dry_year_so_the_ui_can_compare():
    r = agua_parcela.calendar(["Papa"])
    assert r["entrega_seca_m3_ha"] == agua_parcela.calendar(["Papa"], scenario="dry")["entrega_m3_ha"]
    assert r["entrega_seca_anual_m3_ha"] == sum(r["entrega_seca_m3_ha"]) or abs(r["entrega_seca_anual_m3_ha"] - sum(r["entrega_seca_m3_ha"])) <= 6


def test_dry_year_shows_which_months_are_short():
    sequence = generador.CANDIDATES
    normal = agua_parcela.calendar(sequence)["campanas"]
    dry = agua_parcela.calendar(sequence, scenario="dry")["campanas"]
    more_short = 0
    for n, d in zip(normal, dry):
        assert {x["mes"] for x in n["meses_con_deficit"]} <= {x["mes"] for x in d["meses_con_deficit"]}
        more_short += len(d["meses_con_deficit"]) > len(n["meses_con_deficit"])
    assert more_short >= 1
    assert [c["meses_con_deficit_seco"] for c in normal] == [c["meses_con_deficit"] for c in dry]


def test_cap_pct_still_overrides_with_a_flat_multiplier():
    flat = agua_parcela.calendar(["Papa"], cap_pct=88, scenario="dry")
    normal = agua_parcela.calendar(["Papa"])
    assert flat["supply_basis"] == "cap_override" and flat["cap_pct"] == 88
    assert flat["entrega_m3_ha"] == [round(v * 0.88) for v in agua_parcela.delivery_m3_ha(100.0)]
    assert flat["entrega_anual_m3_ha"] == pytest.approx(0.88 * normal["entrega_anual_m3_ha"], abs=2)
    assert agua_parcela.calendar(["Papa"], cap_pct=100)["supply_basis"] == "normal_mean"
