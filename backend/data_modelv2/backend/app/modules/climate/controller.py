from fastapi import APIRouter, Query

from app.modules.climate.domain import ClimateDefaults, ClimateParamsIn
from app.modules.climate import service

router = APIRouter(prefix="/api/climate", tags=["climate"])


@router.get("/defaults", response_model=ClimateDefaults)
def get_defaults(zone: str = Query("majes")) -> ClimateDefaults:
    return service.get_defaults(zone)


@router.post("/validate", response_model=ClimateParamsIn)
def validate(params: ClimateParamsIn) -> ClimateParamsIn:
    return service.sanitize(params)
