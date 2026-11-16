from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.rate_limit import explain_rate_limit
from app.modules.simulation import explain as explain_module
from app.modules.simulation import service
from app.modules.simulation.domain import AREA_MAX_HA, AREA_MIN_HA, Scenario, SimulationRequest, SimulationResult, Zone

router = APIRouter(prefix="/api/model", tags=["model"])
Lang = Literal["es", "en"]   # language of the display texts; identifiers (crop names, codes) never change
# Satellite-derived map layers never change while the app runs: let browsers and proxies keep them for an hour.
MAP_CACHE = "public, max-age=3600"
SCENARIO_DOC = "'dry' = the lowest delivery seen in each month, 2013-2025 (same supply as /calendar); a cap_pct other than 100 wins over it"
NOT_FOUND = {"es": "Rotación no encontrada para estas prioridades", "en": "Rotation not found for these priorities"}


def _split(crops: str | None) -> list[str] | None:
    return [c.strip() for c in crops.split(",") if c.strip()] if crops else None


@router.get("/crops")
def list_crops() -> list[str]:
    return service.known_crops()


@router.get("/mixes")
def list_mixes() -> dict[str, dict[str, float]]:
    return service.default_mixes()


@router.post("/simulate", response_model=SimulationResult)
def simulate(request: SimulationRequest) -> SimulationResult:
    try:
        return service.simulate(request)
    except ValueError as err:
        raise HTTPException(status_code=422, detail=str(err)) from err


@router.get("/rotation-crops")
def rotation_crops() -> dict:
    return service.rotation_crops()


@router.get("/rotations")
def rotations(
    crop: str = Query(...),
    water: int = Query(80, ge=0, le=100),
    soil: int = Query(65, ge=0, le=100),
    income: int = Query(45, ge=0, le=100),
    salinity: float = Query(2.8, ge=0, le=30),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    zone: Zone = "majes",
    crops: str | None = Query(None, description="cultivos que el agricultor piensa sembrar, separados por coma"),
    cap_pct: float = Query(100, ge=50, le=120, description="agua del año en % de lo normal"),
    scenario: Scenario = Query("normal", description=SCENARIO_DOC),
    lang: Lang = "es",
) -> list[dict]:
    try:
        return service.generate_rotations(crop, water, soil, income, salinity, lat, lon, zone, _split(crops), cap_pct, lang, scenario)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err


@router.get("/explain", dependencies=[Depends(explain_rate_limit)])
def explain(
    crop: str = Query(...),
    rotation_id: str = Query(...),
    water: int = Query(80, ge=0, le=100),
    soil: int = Query(65, ge=0, le=100),
    income: int = Query(45, ge=0, le=100),
    salinity: float = Query(2.8, ge=0, le=30),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    zone: Zone = "majes",
    crops: str | None = Query(None, description="cultivos que el agricultor piensa sembrar, separados por coma"),
    cap_pct: float = Query(100, ge=50, le=120, description="agua del año en % de lo normal"),
    scenario: Scenario = Query("normal", description=SCENARIO_DOC),
    lang: Lang = "es",
) -> dict:
    try:
        rotations = service.generate_rotations(crop, water, soil, income, salinity, lat, lon, zone, _split(crops), cap_pct, lang, scenario)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    match = next((r for r in rotations if r["id"] == rotation_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND[lang])
    return explain_module.rewrite(match["rationale"], match["facts"], lang)


@router.get("/point")
def point(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), zone: Zone = "majes",
          lang: Lang = "es") -> dict:
    """What the MODIS satellite saw in the ~5.4 ha pixel that contains this point (zones with extracted data)."""
    return service.point_info(lat, lon, zone, lang)


@router.get("/irrigated")
def irrigated(response: Response, zone: Zone = "majes") -> list:
    """Centres of irrigated pixels (mean NDVI 2013-2024 >= 0.3), for the map overlay."""
    response.headers["Cache-Control"] = MAP_CACHE
    return service.irrigated_points(zone)


@router.get("/calendar")
def calendar(
    sequence: str = Query(..., description="cultivos de las próximas campañas, separados por coma"),
    cap_pct: float | None = Query(None, ge=50, le=120, description="flat share of the normal year (%); overrides `scenario` when not 100"),
    area_ha: float = Query(15_900, ge=AREA_MIN_HA, le=AREA_MAX_HA),
    scenario: Scenario = Query("normal", description="'dry' = the lowest delivery seen in each month, 2013-2025"),
    lang: Lang = "es",
) -> dict:
    """Month by month: water each campaign asks for vs the water that reaches each hectare."""
    try:
        return service.water_calendar(_split(sequence) or [], cap_pct, area_ha, lang, scenario)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err



@router.get("/vulnerability")
def vulnerability(response: Response, zone: Zone = "majes", lang: Lang = "es") -> dict:
    """Irrigated pixels classified by how much greenness they lost in the years with less water (Majes)."""
    response.headers["Cache-Control"] = MAP_CACHE
    return service.vulnerability(zone, lang)
