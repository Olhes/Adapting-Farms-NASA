"""API checks for the model endpoints. Run from backend/:  python -m pytest tests   (needs pytest and httpx)"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_rotations_for_a_tapped_plot():
    r = client.get("/api/model/rotations", params={"crop": "Papa", "lat": -16.3255, "lon": -72.2159})
    assert r.status_code == 200
    top = r.json()[0]
    assert top["sequence"][0] == "Papa" and top["facts"]["parcela"]["tipo"] == "regado"


def test_unknown_crop_is_a_clear_error():
    r = client.get("/api/model/rotations", params={"crop": "Mango"})
    assert r.status_code == 404 and "Mango" in r.json()["detail"]


def test_simulate_reports_water_use():
    body = {"mix": {"Alfalfa": 48.2, "Maíz": 15.7, "Cebolla": 4.3, "Papa": 2.9}, "cap_pct": 88}
    d = client.post("/api/model/simulate", json=body).json()
    assert d["use_pct"] == pytest.approx(100 * d["demand_hm3"] / d["cap_hm3"])


def test_explanation_falls_back_to_the_template_without_a_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", None)
    d = client.get("/api/model/explain", params={"crop": "Papa", "rotation_id": "gen-1"}).json()
    assert d["source"] == "plantilla" and d["text"].startswith("Por qué la recomendamos")


def test_point_outside_zone():
    assert client.get("/api/model/point", params={"lat": -12, "lon": -77}).json()["inside"] is False


def test_planned_crops_and_unknown_crop():
    ok = client.get("/api/model/rotations", params={"crop": "Papa", "crops": "Papa,Haba,Cebolla"}).json()
    assert all(set(r["sequence"]) <= {"Papa", "Haba", "Cebolla"} for r in ok)
    bad = client.get("/api/model/rotations", params={"crop": "Papa", "crops": "Papa,Mango"})
    assert bad.status_code == 404 and "Mango" in bad.json()["detail"]



def test_vulnerability_map_is_majes_only():
    v = client.get("/api/model/vulnerability", params={"zone": "majes"}).json()
    assert v["disponible"] and sum(v["cuadros"].values()) == len(v["puntos"]) > 3000
    assert client.get("/api/model/vulnerability", params={"zone": "tambo"}).json()["disponible"] is False


def test_rotations_in_english_keep_spanish_identifiers():
    es = client.get("/api/model/rotations", params={"crop": "Papa"}).json()
    en = client.get("/api/model/rotations", params={"crop": "Papa", "lang": "en"}).json()
    assert [r["sequence"] for r in en] == [r["sequence"] for r in es] and en[0]["sequence"][0] == "Papa"
    assert [r["confidence"] for r in en] == [r["confidence"] for r in es]
    assert en[0]["facts"]["modo"] == "libre" and en[0]["rationale"].startswith("Why we recommend it")
    assert "What we do not know" in en[0]["rationale"] and en[0]["water_balance"].startswith("Uses ")
    assert client.get("/api/model/rotations", params={"crop": "Papa", "lang": "fr"}).status_code == 422


def test_calendar_in_english_keeps_month_codes():
    params = {"sequence": "Haba,Maíz,Cebolla", "cap_pct": 88}
    es = client.get("/api/model/calendar", params=params).json()
    en = client.get("/api/model/calendar", params={**params, "lang": "en"}).json()
    assert en["campanas"] == es["campanas"] and en["campanas"][0]["mes_siembra"] == "set"
    assert en["resumen"].startswith("With 88 % of the normal water") and "Fava bean" in en["resumen"]
    assert en["supuestos"][0].startswith("One campaign per year")


def test_explanation_fallback_reason_follows_the_language(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", None)
    d = client.get("/api/model/explain", params={"crop": "Papa", "rotation_id": "gen-1", "lang": "en"}).json()
    assert d["source"] == "plantilla" and d["reason"] == "no API key configured" and d["text"].startswith("Why we recommend it")
