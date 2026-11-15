from pydantic import BaseModel, Field


class ClimateParamsIn(BaseModel):
    """Variables climáticas locales (NASA POWER CSV)."""

    t2m: float = Field(default=19.4, description="Temperatura media del aire (T2M) °C")
    prec: float = Field(default=0.40, description="Precipitación (PRECTOT) mm/día")
    rh: float = Field(default=74.7, description="Humedad relativa (RH2M) %")
    rad: float = Field(default=20.95, description="Radiación solar (SW_DWN) MJ/m²/día")
    wind: float = Field(default=2.14, description="Velocidad del viento (WS2M) m/s")
    salinity: float = Field(default=2.8, ge=0.0, description="Salinidad del suelo (CE) dS/m")


class ClimateDefaults(ClimateParamsIn):
    """Defaults por zona de riego (promedio histórico Arequipa)."""

    zone: str = "majes"
