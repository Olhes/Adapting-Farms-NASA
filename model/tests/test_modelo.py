"""Checks that pin the model to the evidence it was validated against.

Run from model/:  python -m pytest tests   (needs numpy and pytest)
"""
import re
import statistics as st
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import calibracion_et  # noqa: E402
import generador  # noqa: E402
import pixeles  # noqa: E402
import rotacion  # noqa: E402
import simulador_tope as sim  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "data"
CIEPA = (-16.3255, -72.2159)       # irrigated plot that lost 19 % greenness in 2016
DESERT = (-16.40, -72.33)


# ---------- satellite pixels ----------

@pytest.mark.parametrize("zone,suffix", [("majes", "pampa"), ("tambo", "tambo")])
def test_computed_grid_matches_extracted_arrays(zone, suffix):
    ndvi = np.load(DATA / f"ndvi_{suffix}_pixeles_anual.npz")["mean"].shape[1:]
    et = np.load(DATA / f"et_{suffix}_pixeles_anual.npz")["et"].shape[1:]
    g, e = pixeles._grid(pixeles.NDVI_PIX, zone), pixeles._grid(pixeles.ET_PIX, zone)
    assert (g[1], g[3]) == ndvi
    assert (e[1], e[3]) == et


def test_pixel_rows_and_columns_equal_appeears():
    assert pixeles.check_against_appeears(DATA / "appeears_puntos_majes_muestra.csv") == 0


def test_irrigated_plot_and_desert_are_told_apart():
    farm, desert = pixeles.point_info(*CIEPA), pixeles.point_info(*DESERT)
    assert farm["tipo"] == "regado" and farm["ndvi_medio_2013_2024"] >= 0.3
    assert desert["tipo"].startswith("desierto") and desert["ndvi_medio_2013_2024"] < 0.2
    assert farm["et_mm_anual"] is not None and desert["et_mm_anual"] is None   # MODIS ET has no value on barren land


def test_point_outside_the_data_says_so():
    assert pixeles.point_info(-12.0, -77.0)["inside"] is False


# ---------- water model ----------

def test_modeled_crop_water_matches_satellite_et_within_10_percent():
    satellite = st.mean([st.mean(calibracion_et.SSEBOP), st.mean(calibracion_et.MOD16)])
    modeled = calibracion_et.modeled_etc_hm3(15_900, "hargreaves")
    assert abs(modeled / satellite - 1) <= 0.10


def test_default_efficiency_is_the_calibrated_one():
    assert 0.41 <= sim.EFFICIENCY <= 0.56


def test_less_water_available_raises_the_share_used():
    crops, et0 = sim.load_crops(), sim.load_et0_monthly("pm")
    mix = sim.MIXES["Actual (Autodema 2016)"]
    normal = sim.simulate(mix, crops, et0, "calculada", sim.CAP_NORMAL_HM3)
    dry = sim.simulate(mix, crops, et0, "calculada", sim.CAP_NORMAL_HM3 * 0.88)
    assert dry["uso_pct"] > normal["uso_pct"]
    assert dry["demanda_hm3"] == pytest.approx(normal["demanda_hm3"])


def test_official_alfalfa_margin_replaces_the_synthetic_one():
    assert sim.load_crops()["Alfalfa"]["margen_s_ha"] == sim.OFFICIAL_MARGIN["Alfalfa"][0]


# ---------- rotation rules ----------

def test_same_family_back_to_back_is_flagged():
    bad, _ = rotacion.check(["Papa", "Papa"])
    assert any("misma familia" in b for b in bad)


def test_solanaceae_wait_is_flagged():
    bad, _ = rotacion.check(["Papa", "Maíz", "Papa"])
    assert any("esperar" in b for b in bad)


def test_legume_after_cereal_is_a_bonus_and_alfalfa_is_perennial():
    _, good = rotacion.check(["Maíz", "Haba"])
    assert good
    bad, _ = rotacion.check(["Alfalfa", "Alfalfa"])
    assert not any("misma familia" in b for b in bad)


# ---------- rotation generator ----------

def test_recommendations_start_with_the_current_crop_and_respect_the_rules():
    out = generador.generate("Papa")
    assert len(out) >= 3
    for r in out[:3]:
        assert r["sequence"][0] == "Papa"
        assert not rotacion.check(r["sequence"][1:], previous="Papa")[0]


def test_priorities_change_the_ranking():
    by_soil = generador.generate("Papa", 20, 100, 20)[0]["sequence"]
    by_income = generador.generate("Papa", 20, 20, 100)[0]["sequence"]
    assert by_soil != by_income


def test_salinity_lowers_income_and_favours_tolerant_crops():
    assert generador._salt_yield("Cebolla", 10) < generador._salt_yield("Quinua", 10)
    low = generador.generate("Papa", ece=2.8)[0]["facts"]["ingreso_prudente_s"]
    high = generador.generate("Papa", ece=10)[0]["facts"]["ingreso_prudente_s"]
    assert high < low


def test_desert_pixel_lowers_confidence_and_warns():
    r = generador.generate("Papa", site=pixeles.site(*DESERT))[0]
    assert r["confidence"] == "BAJA"
    assert "desierto" in r["rationale"]


def test_drought_sensitive_plot_adjusts_and_says_why():
    r = generador.generate("Papa", site=pixeles.site(*CIEPA))[0]
    assert any("agua pesa 50 % más" in a for a in r["facts"]["ajustes_parcela"])
    assert "Ajustado a tu parcela" in r["rationale"]


def test_explanation_only_uses_numbers_from_the_facts():
    norm = lambda t: {n.replace(",", "").replace(".", "").lstrip("0") or "0" for n in re.findall(r"\d[\d.,]*", t)}
    r = generador.generate("Quinua", site=pixeles.site(*CIEPA))[0]
    allowed = norm(str(r["facts"])) | {"3", "50", "2", "8", "28"}   # "tres campañas", "50 % más", "2,8 dS/m"
    assert norm(r["rationale"]) <= allowed


# ---------- the farmer's own list of crops ----------

def test_rotations_use_only_the_farmers_crops_and_end_with_the_current_way():
    out = generador.generate("Papa", allowed=["Papa", "Cebolla", "Haba"])
    assert out[-1]["id"] == "actual" and out[-1]["sequence"] == ["Papa"] * 4
    for r in out[:-1]:
        assert set(r["sequence"]) <= {"Papa", "Cebolla", "Haba"}
        assert not rotacion.check(r["sequence"][1:], previous="Papa")[0]


def test_only_potato_never_recommends_potato_forever():
    out = generador.generate("Papa", allowed=["Papa"])
    suggestions = [r for r in out if r["id"] != "actual"]
    assert suggestions and all(r["facts"]["agrega"] for r in suggestions)
    assert all(not rotacion.check(r["sequence"][1:], previous="Papa")[0] for r in suggestions)
    assert out[-1]["confidence"] == "BAJA" and "forma actual" in out[-1]["rationale"]


# ---------- water that reaches each hectare, month by month ----------

import agua_parcela  # noqa: E402


def test_monthly_supply_adds_up_to_the_yearly_delivery():
    r = agua_parcela.calendar(["Papa"])
    assert r["entrega_anual_m3_ha"] == pytest.approx(sim.CAP_NORMAL_HM3 * 1e6 / sim.AREA_HA, rel=0.01)
    assert agua_parcela.calendar(["Papa"], cap_pct=88)["entrega_anual_m3_ha"] < r["entrega_anual_m3_ha"]


def test_alfalfa_does_not_fit_the_year_and_crops_only_ask_water_in_their_cycle():
    alfalfa = agua_parcela.calendar(["Alfalfa"])["campanas"][0]
    assert not alfalfa["cabe_en_el_anio"]
    papa = agua_parcela.calendar(["Papa"])["campanas"][0]
    assert papa["cabe_en_el_anio"] and sum(v == 0 for v in papa["demanda_m3_ha"]) >= 7   # ~4-month cycle
