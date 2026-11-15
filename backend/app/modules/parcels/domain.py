from dataclasses import dataclass, field

from pydantic import BaseModel, Field


@dataclass(frozen=True)
class ParcelZone:
    """Zona de riego / parcela con su geometría satelital y estrés edáfico."""

    key: str
    name: str
    coords: tuple[float, float]          # (lat, lng) centro de la parcela
    polygon: tuple[tuple[float, float], ...]
    water_stress: float                  # multiplicador de demanda hídrica
    soil_stress: float                   # multiplicador de estrés de suelo


# Espejo de ZONE_GEO / ZONE_MULTIPLIERS / ZONE_NAMES del frontend
ZONES: dict[str, ParcelZone] = {
    "majes": ParcelZone(
        key="majes",
        name="Majes - El Pedregal",
        coords=(-16.350, -72.200),
        polygon=(
            (-16.364, -72.224), (-16.364, -72.176),
            (-16.336, -72.170), (-16.336, -72.230),
        ),
        water_stress=1.15,
        soil_stress=1.10,
    ),
    "chili": ParcelZone(
        key="chili",
        name="Valle de Chili",
        coords=(-16.300, -71.620),
        polygon=(
            (-16.314, -71.644), (-16.314, -71.596),
            (-16.286, -71.590), (-16.286, -71.650),
        ),
        water_stress=0.92,
        soil_stress=0.90,
    ),
    "camana": ParcelZone(
        key="camana",
        name="Valle de Camaná",
        coords=(-16.620, -72.710),
        polygon=(
            (-16.634, -72.734), (-16.634, -72.686),
            (-16.606, -72.680), (-16.606, -72.740),
        ),
        water_stress=0.80,
        soil_stress=1.00,
    ),
    "siguas": ParcelZone(
        key="siguas",
        name="Santa Rita de Siguas",
        coords=(-16.494, -72.094),
        polygon=(
            (-16.508, -72.118), (-16.508, -72.070),
            (-16.480, -72.064), (-16.480, -72.124),
        ),
        water_stress=1.10,
        soil_stress=1.05,
    ),
}


# --- Esquemas de respuesta (contrato API) ---

class PolygonPoint(BaseModel):
    lat: float
    lng: float


class ParcelZoneOut(BaseModel):
    key: str
    name: str
    center: PolygonPoint
    polygon: list[PolygonPoint] = Field(default_factory=list)
    water_stress: float
    soil_stress: float
