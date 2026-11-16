"""The water a crop is scored with must be the water the monthly calendar shows (one shared function), and the ET0
method behind it must be the calibrated one, with the uncalibrated one only as the upper end of a range."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agua_parcela  # noqa: E402
import generador  # noqa: E402
import simulador_tope as sim  # noqa: E402


def _scored_water(crop):
    """The per-campaign water the generator scored `crop` with: the farmer's current way is (crop, crop, crop)."""
    current_way = generador.generate(crop)[-1]
    assert current_way["id"] == "actual" and current_way["sequence"] == [crop] * 4
    return current_way["facts"]["agua_m3_ha_campana"]


@pytest.mark.parametrize("crop", generador.CANDIDATES)
def test_calendar_annual_total_equals_the_scored_water(crop):
    campaign = agua_parcela.calendar([crop])["campanas"][0]
    assert campaign["total_m3_ha"] == _scored_water(crop)


@pytest.mark.parametrize("crop", generador.CANDIDATES)
def test_calendar_months_add_up_to_the_total(crop):
    campaign = agua_parcela.calendar([crop])["campanas"][0]
    assert sum(campaign["demanda_m3_ha"]) == pytest.approx(campaign["total_m3_ha"], abs=6)   # 12 rounded months


def test_paprika_is_measured_and_its_monthly_profile_is_rescaled_to_the_measured_total():
    campaign = agua_parcela.calendar(["Paprika"])["campanas"][0]
    assert campaign["water_basis"] == "measured"
    assert campaign["total_m3_ha"] == sim.MEASURED["Paprika"]
    assert max(campaign["demanda_m3_ha"]) > 0 and sum(v == 0 for v in campaign["demanda_m3_ha"]) >= 1


def test_every_other_rotation_crop_is_fao56():
    for crop in generador.CANDIDATES:
        basis = agua_parcela.calendar([crop])["campanas"][0]["water_basis"]
        assert basis == ("measured" if crop in sim.MEASURED_BASIS else "fao56")


def test_potato_calendar_uses_all_its_sowing_months_not_only_september():
    potato = sim.crop_water("Papa")
    assert len(sim.SOWING["Papa"]["months"]) >= 2
    september_only = sim.seasonal_profile(1.15, 120, 9, sim.load_et0_monthly("hargreaves"))
    assert potato["total"] != pytest.approx(sum(september_only) * 10 / sim.EFFICIENCY)
    assert agua_parcela.calendar(["Papa"])["campanas"][0]["total_m3_ha"] == round(potato["total"])


# ---------- ET0 method: calibrated central value, uncertainty range ----------

def test_central_et0_is_the_calibrated_method_and_pm_is_the_upper_end():
    assert sim.ET0_CENTRAL == "hargreaves" and sim.ET0_HIGH == "pm"
    for crop in ("Papa", "Alfalfa", "Haba"):
        r = sim.crop_water_range(crop)
        assert r["low"]["total"] <= r["central"]["total"] < r["high"]["total"]
        assert r["central"]["total"] == sim.crop_water(crop, method="hargreaves")["total"]


def test_measured_total_does_not_depend_on_the_et0_method():
    r = sim.crop_water_range("Paprika")
    assert r["low"]["total"] == r["central"]["total"] == r["high"]["total"] == sim.MEASURED["Paprika"]


def test_calendar_returns_a_range_next_to_the_central_value():
    r = agua_parcela.calendar(["Haba"])
    c = r["campanas"][0]
    assert r["et0_method"] == "hargreaves" and r["et0_range_methods"] == {"low": "hargreaves", "high": "pm"}
    assert c["total_range_m3_ha"]["low"] <= c["total_m3_ha"] < c["total_range_m3_ha"]["high"]
    assert len(c["demand_range_m3_ha"]["low"]) == len(c["demand_range_m3_ha"]["high"]) == 12
    assert all(lo <= hi for lo, hi in zip(c["demand_range_m3_ha"]["low"], c["demand_range_m3_ha"]["high"]))


def test_generator_scores_with_the_central_value_and_reports_the_range():
    out = generador.generate("Papa")
    for r in out:
        f = r["facts"]
        rng = f["water_range_m3_ha_campaign"]
        assert rng["low"] <= rng["central"] <= rng["high"]
        assert rng["central"] == f["agua_m3_ha_campana"]
        assert set(f["water_basis"]) == set(r["sequence"][1:])


def test_generator_no_longer_averages_the_two_methods():
    harg = sim.crop_water("Haba", method="hargreaves")["total"]
    pm = sim.crop_water("Haba", method="pm")["total"]
    scored = _scored_water("Haba")
    assert scored == round(harg) and scored != round((harg + pm) / 2)
