from fastapi import APIRouter, HTTPException, Query

from app.modules.rotations.domain import (
    ClimateParams,
    Priorities,
    RankRequest,
    RankedRotation,
)
from app.modules.rotations import service
from app.modules.rotations.domain import ROTATIONS_DB

router = APIRouter(prefix="/api/rotations", tags=["rotations"])


@router.get("/crops")
def list_crops() -> list[str]:
    return list(ROTATIONS_DB.keys())


@router.post("/rank", response_model=list[RankedRotation])
def rank(request: RankRequest) -> list[RankedRotation]:
    if request.crop not in ROTATIONS_DB:
        raise HTTPException(status_code=404, detail=f"Cultivo '{request.crop}' sin rotaciones registradas")
    return service.rank_for_zone(request.crop, request.zone, request.priorities, request.climate)


@router.get("/rank", response_model=list[RankedRotation])
def rank_query(
    crop: str = Query(...),
    zone: str = "majes",
    water: int = 80,
    soil: int = 65,
    income: int = 45,
    t2m: float = 19.4,
    salinity: float = 2.8,
) -> list[RankedRotation]:
    return service.rank_for_zone(
        crop=crop,
        zone_key=zone,
        priorities=Priorities(water=water, soil=soil, income=income),
        climate=ClimateParams(t2m=t2m, salinity=salinity),
    )
