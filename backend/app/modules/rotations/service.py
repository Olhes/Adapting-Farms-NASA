from app.modules.parcels import service as parcels_service
from app.modules.rotations.domain import (
    ClimateParams,
    Priorities,
    RankedRotation,
    rank_rotations,
)


def rank_for_zone(
    crop: str,
    zone_key: str,
    priorities: Priorities,
    climate: ClimateParams,
) -> list[RankedRotation]:
    zone = parcels_service.resolve_zone(zone_key)
    if zone is None:
        # Fallback igual que el frontend: si la zona no existe, usa los
        # multiplicadores por defecto de 'majes'
        zone = parcels_service.resolve_zone("majes")
    return rank_rotations(
        crop=crop,
        water_stress=zone.water_stress,
        soil_stress=zone.soil_stress,
        priorities=priorities,
        climate=climate,
    )
