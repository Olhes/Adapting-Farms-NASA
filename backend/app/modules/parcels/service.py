from app.modules.parcels.domain import ZONES, ParcelZone, ParcelZoneOut, PolygonPoint


def list_zones() -> list[ParcelZoneOut]:
    return [_to_out(z) for z in ZONES.values()]


def get_zone(key: str) -> ParcelZoneOut | None:
    zone = ZONES.get(key)
    return _to_out(zone) if zone else None


def resolve_zone(key: str) -> ParcelZone | None:
    """Devuelve la entidad de dominio (no el DTO) para uso interno de otros módulos."""
    return ZONES.get(key)


def _to_out(zone: ParcelZone) -> ParcelZoneOut:
    lat, lng = zone.coords
    return ParcelZoneOut(
        key=zone.key,
        name=zone.name,
        center=PolygonPoint(lat=lat, lng=lng),
        polygon=[PolygonPoint(lat=la, lng=ln) for la, ln in zone.polygon],
        water_stress=zone.water_stress,
        soil_stress=zone.soil_stress,
    )
