"""/explain hardening (bounded cache, key in a header, logged fallback, rate limit), CORS, gzip and cache headers."""
import io
import json
import logging
import time
import urllib.error

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.config import Settings, settings
from app.main import app
from app.modules.simulation import explain

client = TestClient(app)
KEY = "SECRET-KEY-123"
FACTS = {"agua_m3_ha_campana": 8950}
TEMPLATE = "Why we recommend it: uses 8,950 m3 per hectare."


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    rate_limit.explain_limiter.reset()
    explain._CACHE.clear()
    explain._MODEL.clear()
    monkeypatch.setattr(settings, "gemini_api_key", None)
    yield
    rate_limit.explain_limiter.reset()
    explain._CACHE.clear()
    explain._MODEL.clear()


# ---------- bounded cache ----------

def test_explanation_cache_is_an_lru_of_a_few_hundred_entries():
    assert 100 <= explain.CACHE_MAX <= 1000
    for i in range(explain.CACHE_MAX + 50):
        explain._cache_put(f"k{i}", {"text": str(i)})
    assert len(explain._CACHE) == explain.CACHE_MAX
    assert explain._cache_get("k0") is None and explain._cache_get(f"k{explain.CACHE_MAX + 49}") is not None


def test_a_cache_hit_keeps_the_entry_alive():
    for i in range(explain.CACHE_MAX):
        explain._cache_put(f"k{i}", {"text": str(i)})
    assert explain._cache_get("k0") is not None          # touch the oldest entry
    explain._cache_put("new", {"text": "new"})           # evicts the least recently used one, which is now k1
    assert explain._cache_get("k0") is not None and explain._cache_get("k1") is None


# ---------- API key never in a URL ----------

class _Reply:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return io.BytesIO(json.dumps(self.payload).encode())

    def __exit__(self, *exc):
        return False


def _gemini_reply(text):
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}


def test_api_key_travels_in_a_header_on_both_routes_and_never_in_the_url(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", KEY)
    seen = []

    def fake_urlopen(req, timeout=None):
        seen.append(req)
        if len(seen) == 1:   # the first service rejects the key, so the second route is tried too
            raise urllib.error.HTTPError(req.full_url, 401, "bad key", {}, io.BytesIO(b"{}"))
        return _Reply(_gemini_reply("Why we recommend it: uses 8,950 m3 per hectare."))

    monkeypatch.setattr(explain.urllib.request, "urlopen", fake_urlopen)
    out = explain.rewrite(TEMPLATE, FACTS, "en")
    assert out["source"] == "gemini" and len(seen) >= 2
    for req in seen:
        assert KEY not in req.full_url and "key=" not in req.full_url
        assert req.get_header("X-goog-api-key") == KEY


# ---------- logged fallback ----------

def test_unparseable_error_body_is_logged_and_falls_back_to_the_template(monkeypatch, caplog):
    monkeypatch.setattr(settings, "gemini_api_key", KEY)

    def fake_urlopen(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 500, "boom", {}, io.BytesIO(b"<html>not json</html>"))

    monkeypatch.setattr(explain.urllib.request, "urlopen", fake_urlopen)
    with caplog.at_level(logging.WARNING, logger=explain.log.name):
        out = explain.rewrite(TEMPLATE, FACTS, "en")
    assert out == {"text": TEMPLATE, "source": "plantilla", "reason": "the AI service did not answer (500)"}
    assert any("not json" in r.getMessage() or "error body" in r.getMessage() for r in caplog.records)
    assert all(KEY not in r.getMessage() for r in caplog.records)


def test_service_failure_is_logged_without_the_key(monkeypatch, caplog):
    monkeypatch.setattr(settings, "gemini_api_key", KEY)

    def fake_urlopen(req, timeout=None):
        raise urllib.error.URLError("network down")

    monkeypatch.setattr(explain.urllib.request, "urlopen", fake_urlopen)
    with caplog.at_level(logging.WARNING, logger=explain.log.name):
        out = explain.rewrite(TEMPLATE, FACTS, "en")
    assert out["source"] == "plantilla" and caplog.records
    assert all(KEY not in r.getMessage() for r in caplog.records)


# ---------- rate limit ----------

def test_rate_limiter_is_per_client_and_forgets_after_the_window():
    now = [0.0]
    limiter = rate_limit.RateLimiter(limit=2, window=60, clock=lambda: now[0])
    assert limiter.check("a") is None and limiter.check("a") is None
    assert limiter.check("a") == pytest.approx(60)           # seconds until a slot frees up
    assert limiter.check("b") is None
    now[0] = 61
    assert limiter.check("a") is None


def test_rate_limiter_tracks_a_bounded_number_of_clients():
    limiter = rate_limit.RateLimiter(limit=1, window=60, max_clients=50)
    for i in range(500):
        limiter.check(f"ip{i}")
    assert limiter.tracked() <= 50


def test_default_limit_is_20_per_minute():
    assert settings.explain_rate_limit_per_minute == 20 and rate_limit.explain_limiter.limit == 20


def test_explain_returns_429_after_the_limit_and_other_endpoints_are_not_limited(monkeypatch):
    monkeypatch.setattr(rate_limit.explain_limiter, "limit", 3)
    params = {"crop": "Papa", "rotation_id": "gen-1"}
    codes = [client.get("/api/model/explain", params=params).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    blocked = client.get("/api/model/explain", params=params)
    assert int(blocked.headers["retry-after"]) >= 1 and "Too many" in blocked.json()["detail"]
    assert client.get("/api/model/point", params={"lat": -16.3, "lon": -72.2}).status_code == 200


def test_forwarded_header_is_ignored_unless_trusted(monkeypatch):
    monkeypatch.setattr(rate_limit.explain_limiter, "limit", 1)
    params = {"crop": "Papa", "rotation_id": "gen-1"}
    assert client.get("/api/model/explain", params=params, headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/api/model/explain", params=params, headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 429
    rate_limit.explain_limiter.reset()
    monkeypatch.setattr(settings, "trust_forwarded_for", True)
    assert client.get("/api/model/explain", params=params, headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/api/model/explain", params=params, headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200


# ---------- CORS ----------

def test_default_cors_origins_are_not_a_wildcard():
    assert "*" not in Settings().cors_origin_list and Settings().cors_origin_list


def test_cors_origins_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("FIELD_SHIFT_CORS_ORIGINS", "https://a.example, https://b.example")
    assert Settings().cors_origin_list == ["https://a.example", "https://b.example"]


def test_unlisted_origin_gets_no_cors_headers_and_credentials_are_never_allowed():
    allowed = Settings().cors_origin_list[0]
    ok = client.get("/health", headers={"Origin": allowed})
    assert ok.headers["access-control-allow-origin"] == allowed
    assert "access-control-allow-credentials" not in ok.headers
    evil = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers and "access-control-allow-credentials" not in evil.headers
    pre = client.options("/api/model/calendar", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in pre.headers


# ---------- gzip and cache headers on the map endpoints ----------

@pytest.mark.parametrize("path", ["/api/model/vulnerability", "/api/model/irrigated"])
def test_map_endpoints_are_gzipped_and_cacheable(path):
    r = client.get(path, headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers["content-encoding"] == "gzip"
    assert r.headers["cache-control"].startswith("public, max-age=")


def test_dynamic_endpoints_are_not_marked_cacheable():
    assert "cache-control" not in client.get("/api/model/calendar", params={"sequence": "Papa"}).headers


def test_vulnerability_is_fast_once_computed():
    client.get("/api/model/vulnerability")
    start = time.perf_counter()
    assert client.get("/api/model/vulnerability").status_code == 200
    assert time.perf_counter() - start < 0.3
