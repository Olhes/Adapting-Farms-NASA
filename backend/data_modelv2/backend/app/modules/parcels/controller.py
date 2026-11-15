from fastapi import APIRouter, HTTPException

from app.modules.parcels.domain import ParcelZoneOut
from app.modules.parcels import service

router = APIRouter(prefix="/api/parcels", tags=["parcels"])


@router.get("", response_model=list[ParcelZoneOut])
def get_zones() -> list[ParcelZoneOut]:
    return service.list_zones()


@router.get("/{key}", response_model=ParcelZoneOut)
def get_zone(key: str) -> ParcelZoneOut:
    zone = service.get_zone(key)
    if zone is None:
        raise HTTPException(status_code=404, detail=f"Zona '{key}' no encontrada")
    return zone
