from typing import Literal

from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    mix: dict[str, float] = Field(..., description="Percentage of area per crop; normalised internally")
    cap_pct: float = Field(100.0, ge=50, le=120, description="Available water as % of the normal delivery")
    area_ha: float = Field(15_900, gt=0)
    efficiency: float = Field(0.5, gt=0.2, le=1.0)
    et0_method: Literal["pm", "hargreaves"] = "pm"
    water_source: Literal["calculada", "medida"] = "calculada"


class CropWater(BaseModel):
    crop: str
    share_pct: float
    water_m3_ha: float | None


class SimulationResult(BaseModel):
    demand_hm3: float
    cap_hm3: float
    balance_hm3: float
    use_pct: float
    synthetic_margin_millions_s: float
    margin_coverage_pct: float
    per_crop: list[CropWater]
    assumptions: list[str]
