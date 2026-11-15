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
