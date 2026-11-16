"""Input validation, the calibrated ET0 default with its range, and the new calendar fields."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.modules.simulation import domain
from app.modules.simulation.domain import SimulationRequest

import pixeles  # noqa: E402  (the model directory is put on sys.path when the app is imported)

client = TestClient(app)
MIX = {"Alfalfa": 48.2, "Papa": 2.9}


# ---------- validation ----------

def test_negative_mix_share_is_rejected():
    with pytest.raises(ValidationError):
        SimulationRequest(mix={"Papa": 50, "Haba": -10})
    r = client.post("/api/model/simulate", json={"mix": {"Papa": 50, "Haba": -10}})
    assert r.status_code == 422


def test_non_finite_mix_share_is_rejected():
    with pytest.raises(ValidationError):
        SimulationRequest(mix={"Papa": float("nan")})
    with pytest.raises(ValidationError):
        SimulationRequest(mix={"Papa": float("inf")})


def test_all_zero_or_empty_mix_is_a_422():
    assert client.post("/api/model/simulate", json={"mix": {"Papa": 0}}).status_code == 422
    assert client.post("/api/model/simulate", json={"mix": {}}).status_code == 422


@pytest.mark.parametrize("area", [1, 999, 100_001, 1e9])
def test_area_outside_sane_bounds_is_a_422(area):
    assert client.post("/api/model/simulate", json={"mix": MIX, "area_ha": area}).status_code == 422
    assert client.get("/api/model/calendar", params={"sequence": "Papa", "area_ha": area}).status_code == 422


def test_area_within_bounds_is_accepted():
    for area in (domain.AREA_MIN_HA, 15_900, domain.AREA_MAX_HA):
        assert client.get("/api/model/calendar", params={"sequence": "Papa", "area_ha": area}).status_code == 200
    assert domain.AREA_MIN_HA >= 100 and domain.AREA_MAX_HA <= 1_000_000


def test_zone_choices_match_the_zones_the_model_has_data_for():
    assert set(domain.Zone.__args__) == set(pixeles.ZONES)


@pytest.mark.parametrize("path,params", [
    ("/api/model/point", {"lat": -16.3, "lon": -72.2}),
    ("/api/model/irrigated", {}),
    ("/api/model/vulnerability", {}),
    ("/api/model/rotations", {"crop": "Papa"}),
    ("/api/model/explain", {"crop": "Papa", "rotation_id": "gen-1"}),
])
def test_unknown_zone_is_a_422_not_a_silent_fallback(path, params):
    assert client.get(path, params={**params, "zone": "atlantis"}).status_code == 422
    assert client.get(path, params={**params, "zone": "tambo"}).status_code == 200


def test_unknown_crop_is_a_404_or_422_everywhere():
    assert client.get("/api/model/calendar", params={"sequence": "Papa,Mango"}).status_code == 404
    assert client.get("/api/model/rotations", params={"crop": "Mango"}).status_code == 404
    assert client.get("/api/model/explain", params={"crop": "Mango", "rotation_id": "gen-1"}).status_code == 404
    assert client.post("/api/model/simulate", json={"mix": {"Mango": 10}}).status_code == 422


def test_empty_calendar_sequence_is_rejected():
    assert client.get("/api/model/calendar", params={"sequence": " , "}).status_code in (404, 422)


def test_coordinates_are_range_checked_on_rotations():
    assert client.get("/api/model/rotations", params={"crop": "Papa", "lat": 123, "lon": -72.2}).status_code == 422


# ---------- ET0 method ----------

def test_calibrated_hargreaves_is_the_default_method():
    assert SimulationRequest(mix=MIX).et0_method == "hargreaves"


def test_simulation_reports_the_method_and_a_range_over_both_methods():
    d = client.post("/api/model/simulate", json={"mix": MIX}).json()
    assert d["et0_method"] == "hargreaves"
    assert d["demand_range_hm3"]["low"] <= d["demand_hm3"] < d["demand_range_hm3"]["high"]
    pm = client.post("/api/model/simulate", json={"mix": MIX, "et0_method": "pm"}).json()
    assert pm["demand_hm3"] == pytest.approx(d["demand_range_hm3"]["high"]) and pm["demand_range_hm3"] == d["demand_range_hm3"]


def test_measured_water_has_no_et0_range():
    measured_only = {"Alfalfa": 48.2, "Maíz": 15.7, "Cebolla": 4.3}      # every crop here has a measured figure
    d = client.post("/api/model/simulate", json={"mix": measured_only, "water_source": "medida"}).json()
    assert d["demand_range_hm3"]["low"] == pytest.approx(d["demand_hm3"]) == pytest.approx(d["demand_range_hm3"]["high"])


# ---------- calendar fields ----------

def test_calendar_defaults_keep_the_old_shape_and_add_the_new_fields():
    d = client.get("/api/model/calendar", params={"sequence": "Papa,Paprika"}).json()
    assert {"entrega_m3_ha", "entrega_anual_m3_ha", "cap_pct", "area_ha", "eficiencia", "campanas", "resumen", "supuestos"} <= set(d)
    assert d["cap_pct"] == 100 and d["supply_basis"] == "normal_mean" and d["et0_method"] == "hargreaves"
    papa, paprika = d["campanas"]
    assert {"cultivo", "mes_siembra", "fuente_mes", "demanda_m3_ha", "total_m3_ha", "cabe_en_el_anio",
            "meses_con_deficit", "deficit_total_m3_ha"} <= set(papa)
    assert papa["water_basis"] == "fao56" and paprika["water_basis"] == "measured"
    assert papa["total_range_m3_ha"]["low"] <= papa["total_m3_ha"] < papa["total_range_m3_ha"]["high"]
    assert len(d["entrega_seca_m3_ha"]) == 12


def test_calendar_dry_scenario_and_cap_override():
    dry = client.get("/api/model/calendar", params={"sequence": "Haba", "scenario": "dry"}).json()
    assert dry["supply_basis"] == "dry_profile" and dry["entrega_anual_m3_ha"] < dry["entrega_seca_anual_m3_ha"] + 1
    flat = client.get("/api/model/calendar", params={"sequence": "Haba", "scenario": "dry", "cap_pct": 88}).json()
    assert flat["supply_basis"] == "cap_override" and flat["cap_pct"] == 88
    assert client.get("/api/model/calendar", params={"sequence": "Haba", "scenario": "wet"}).status_code == 422


def test_rotation_facts_carry_the_water_range_and_basis():
    top = client.get("/api/model/rotations", params={"crop": "Papa"}).json()[0]["facts"]
    assert top["water_range_m3_ha_campaign"]["low"] <= top["water_range_m3_ha_campaign"]["high"]
    assert set(top["water_basis"].values()) <= {"fao56", "measured"}


def test_rotation_crops_expose_the_sowing_source_of_each_crop():
    d = client.get("/api/model/rotation-crops").json()
    assert d["sowing"]["Ajo"]["basis"] == "data" and "majes_siembra_mensual.csv" in d["sowing"]["Ajo"]["source"]
    assert d["sowing"]["Haba"]["basis"] == "fallback"
