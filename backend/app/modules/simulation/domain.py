import math
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Pitay water is shared by the Majes pampa (~15,900 ha licensed, ~21,000 ha seen by satellite). Outside this range the
# per-hectare figures stop meaning anything (area_ha=1 would give 333,830,000 m3/ha).
AREA_MIN_HA = 1_000
AREA_MAX_HA = 100_000
Zone = Literal["majes", "tambo"]   # the zones with extracted satellite data (model/pixeles.py ZONES)
Scenario = Literal["normal", "dry"]


class SimulationRequest(BaseModel):
    mix: dict[str, float] = Field(..., description="Percentage of area per crop; normalised internally")
    cap_pct: float = Field(100.0, ge=50, le=120, description="Available water as % of the normal delivery")
    area_ha: float = Field(15_900, ge=AREA_MIN_HA, le=AREA_MAX_HA)
    efficiency: float = Field(
        0.5, gt=0.2, le=1.0,
        description="Water factor: ratio of satellite-estimated ET to delivered water; includes conveyance and "
                    "application losses and any ET estimation error. It is not a measured irrigation efficiency.")
    et0_method: Literal["pm", "hargreaves"] = Field(
        "hargreaves",
        description="Central ET0 method. The result is a range between two standard ET0 methods "
                    "(Hargreaves-Samani and FAO-56 Penman-Monteith) and always carries both ends; the default "
                    "central value is Hargreaves-Samani, the lower of the two.")
    water_source: Literal["calculada", "medida"] = "calculada"
    lang: Literal["es", "en"] = "es"

    @field_validator("mix")
    @classmethod
    def shares_are_finite_and_not_negative(cls, mix: dict[str, float]) -> dict[str, float]:
        bad = [crop for crop, share in mix.items() if not math.isfinite(share) or share < 0]
        if bad:
            raise ValueError(f"Mix shares must be finite numbers >= 0 (check: {', '.join(bad)})")
        return mix


class CropWater(BaseModel):
    crop: str
    share_pct: float
    water_m3_ha: float | None


class Range(BaseModel):
    low: float
    high: float


class SimulationResult(BaseModel):
    demand_hm3: float
    cap_hm3: float
    balance_hm3: float
    use_pct: float
    synthetic_margin_millions_s: float
    margin_coverage_pct: float
    per_crop: list[CropWater]
    assumptions: list[str]
    et0_method: str
    demand_range_hm3: Range
    caveats: list[str]
