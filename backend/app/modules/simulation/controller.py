from fastapi import APIRouter, HTTPException, Query

from app.modules.simulation import explain as explain_module
from app.modules.simulation import service
from app.modules.simulation.domain import SimulationRequest, SimulationResult

router = APIRouter(prefix="/api/model", tags=["model"])


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
    lat: float | None = None,
    lon: float | None = None,
    zone: str = "majes",
) -> list[dict]:
    try:
        return service.generate_rotations(crop, water, soil, income, salinity, lat, lon, zone)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err


@router.get("/explain")
def explain(
    crop: str = Query(...),
    rotation_id: str = Query(...),
    water: int = Query(80, ge=0, le=100),
    soil: int = Query(65, ge=0, le=100),
    income: int = Query(45, ge=0, le=100),
    salinity: float = Query(2.8, ge=0, le=30),
    lat: float | None = None,
    lon: float | None = None,
    zone: str = "majes",
) -> dict:
    try:
        rotations = service.generate_rotations(crop, water, soil, income, salinity, lat, lon, zone)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    match = next((r for r in rotations if r["id"] == rotation_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Rotación no encontrada para estas prioridades")
    return explain_module.rewrite(match["rationale"], match["facts"])


@router.get("/point")
def point(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), zone: str = "majes") -> dict:
    """What the MODIS satellite saw in the ~5.4 ha pixel that contains this point (zones with extracted data)."""
    return service.point_info(lat, lon, zone)


@router.get("/irrigated")
def irrigated(zone: str = "majes") -> list:
    """Centres of irrigated pixels (mean NDVI 2013-2024 >= 0.3), for the map overlay."""
    return service.irrigated_points(zone)
