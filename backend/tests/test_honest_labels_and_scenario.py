"""API side of the honest-labels pass: caveats, wording in OpenAPI and assumptions, localised dry_rule, and the optional
dry scenario on /rotations and /explain."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
MIX = {"Alfalfa": 48.2, "Papa": 2.9}
BANNED = ("calibrat", "calibrad", "overestimat", "sobreestim")


@pytest.mark.parametrize("lang", ["es", "en"])
def test_calendar_and_simulate_carry_three_caveats(lang):
    cal = client.get("/api/model/calendar", params={"sequence": "Papa", "lang": lang}).json()
    sim = client.post("/api/model/simulate", json={"mix": MIX, "lang": lang}).json()
    assert len(cal["caveats"]) == len(sim["caveats"]) == 3
    assert cal["caveats"] == sim["caveats"]
    assert ("order-of-magnitude" in cal["caveats"][0]) == (lang == "en")


@pytest.mark.parametrize("lang", ["es", "en"])
def test_assumptions_do_not_call_hargreaves_calibrated(lang):
    text = " ".join(client.post("/api/model/simulate", json={"mix": MIX, "lang": lang}).json()["assumptions"]).lower()
    assert not any(b in text for b in BANNED)
    assert "hargreaves-samani" in text and "penman-monteith" in text


def test_openapi_describes_the_method_range_and_the_factor_honestly():
    spec = json.dumps(client.get("/openapi.json").json()).lower()
    assert not any(b in spec for b in BANNED)
    assert "range between two standard et0 methods" in spec
    assert "ratio of satellite-estimated et to delivered water" in spec


def test_dry_rule_follows_the_language():
    es = client.get("/api/model/calendar", params={"sequence": "Papa", "scenario": "dry", "lang": "es"}).json()["dry_rule"]
    en = client.get("/api/model/calendar", params={"sequence": "Papa", "scenario": "dry", "lang": "en"}).json()["dry_rule"]
    assert es.startswith("Año seco") and en.startswith("Dry year")


def _supply(params):
    return client.get("/api/model/rotations", params={"crop": "Papa", **params}).json()[0]["facts"]["agua_cabe"]["llega_m3_ha_anio"]


def test_rotations_dry_scenario_matches_the_calendar_and_default_is_unchanged():
    normal = client.get("/api/model/calendar", params={"sequence": "Papa"}).json()["entrega_anual_m3_ha"]
    dry = client.get("/api/model/calendar", params={"sequence": "Papa", "scenario": "dry"}).json()["entrega_anual_m3_ha"]
    assert _supply({}) == _supply({"scenario": "normal"}) == normal
    assert _supply({"scenario": "dry"}) == dry < normal


def test_explain_accepts_the_dry_scenario_and_rejects_unknown_ones():
    ok = client.get("/api/model/explain", params={"crop": "Papa", "rotation_id": "gen-1", "scenario": "dry"})
    assert ok.status_code == 200
    assert client.get("/api/model/explain", params={"crop": "Papa", "rotation_id": "gen-1", "scenario": "wet"}).status_code == 422
    assert client.get("/api/model/rotations", params={"crop": "Papa", "scenario": "wet"}).status_code == 422


def test_water_range_flag_is_exposed():
    wr = client.get("/api/model/rotations", params={"crop": "Papa"}).json()[0]["facts"]["water_range_m3_ha_campaign"]
    assert wr["central_is_low"] is True
