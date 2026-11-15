from app.modules.climate.domain import ClimateDefaults, ClimateParamsIn

ZONE_CLIMATE_DEFAULTS: dict[str, dict[str, float]] = {
    "majes":  {"t2m": 19.4, "prec": 0.40, "rh": 74.7, "rad": 20.95, "wind": 2.14, "salinity": 2.8},
    "chili":  {"t2m": 18.6, "prec": 0.35, "rh": 76.0, "rad": 21.10, "wind": 2.30, "salinity": 2.4},
    "camana": {"t2m": 20.1, "prec": 0.30, "rh": 72.5, "rad": 20.80, "wind": 2.05, "salinity": 2.8},
    "siguas": {"t2m": 17.8, "prec": 0.45, "rh": 78.0, "rad": 20.60, "wind": 2.40, "salinity": 2.2},
}


def get_defaults(zone: str = "majes") -> ClimateDefaults:
    values = ZONE_CLIMATE_DEFAULTS.get(zone, ZONE_CLIMATE_DEFAULTS["majes"])
    return ClimateDefaults(zone=zone, **values)


def sanitize(params: ClimateParamsIn) -> ClimateParamsIn:
    """Punto de entrada para validar/normalizar parámetros climáticos."""
    return ClimateParamsIn(
        t2m=params.t2m, prec=params.prec, rh=params.rh,
        rad=params.rad, wind=params.wind, salinity=params.salinity,
    )
