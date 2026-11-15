import sys
from pathlib import Path

from app.modules.simulation.domain import CropWater, SimulationRequest, SimulationResult

# The simulator lives in <repo>/model (stdlib only); it is not a package, so add it to the path.
_MODEL_DIR = Path(__file__).resolve().parents[4] / "model"
if str(_MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(_MODEL_DIR))

import agua_parcela  # noqa: E402
import generador  # noqa: E402
import pixeles  # noqa: E402
import simulador_tope as sim  # noqa: E402

ASSUMPTIONS = {
    "es": [
        "Meses de siembra de ajo, haba y maíz son supuestos; cebolla, papa, quinua y zapallo vienen de la siembra mensual de Majes (Midagri).",
        "El margen económico es sintético: no hay costos de producción oficiales para Majes.",
        "La eficiencia de riego por defecto (0,5) viene de calibrar con ET satelital (0,41–0,56); el supuesto anterior de 0,75 no está calibrado.",
    ],
    "en": [
        "Sowing months of garlic, fava bean and maize are assumptions; onion, potato, quinoa and squash come from the monthly sowing records of Majes (Midagri).",
        "The economic margin is synthetic: there are no official production costs for Majes.",
        "The default irrigation efficiency (0.5) comes from calibrating with satellite ET (0.41–0.56); the earlier 0.75 assumption is not calibrated.",
    ],
}
ERRORS = {
    "es": {"unknown": "Cultivos sin datos en el modelo: {crops}", "crop": "Cultivo sin datos en el modelo: {crop}",
           "empty_mix": "La mezcla debe sumar más de 0", "none": "(ninguno)"},
    "en": {"unknown": "Crops without data in the model: {crops}", "crop": "Crop without data in the model: {crop}",
           "empty_mix": "The mix must add up to more than 0", "none": "(none)"},
}


def _err(lang: str, key: str, **values) -> str:
    return ERRORS.get(lang, ERRORS["es"])[key].format(**values)


def known_crops() -> list[str]:
    return sorted(set(sim.load_crops()) | set(sim.MEASURED))


def default_mixes() -> dict[str, dict[str, float]]:
    return sim.MIXES


def simulate(req: SimulationRequest) -> SimulationResult:
    crops = sim.load_crops()
    unknown = [c for c in req.mix if c not in crops and c not in sim.MEASURED]
    if unknown:
        raise ValueError(_err(req.lang, "unknown", crops=", ".join(unknown)))
    if sum(req.mix.values()) <= 0:
        raise ValueError(_err(req.lang, "empty_mix"))
    et0 = sim.load_et0_monthly("hargreaves" if req.et0_method == "hargreaves" else "pm")
    cap_hm3 = sim.CAP_NORMAL_HM3 * req.cap_pct / 100
    r = sim.simulate(req.mix, crops, et0, req.water_source, cap_hm3, req.area_ha, req.efficiency)
    total = sum(req.mix.values())
    per_crop = [
        CropWater(
            crop=c,
            share_pct=round(100 * p / total, 2),
            water_m3_ha=sim.water_m3_ha(c, crops, et0, req.water_source, req.efficiency),
        )
        for c, p in req.mix.items()
    ]
    return SimulationResult(
        demand_hm3=r["demanda_hm3"],
        cap_hm3=r["tope_hm3"],
        balance_hm3=r["saldo_hm3"],
        use_pct=r["uso_pct"],
        synthetic_margin_millions_s=r["margen_millones_s"],
        margin_coverage_pct=r["margen_cubre_pct"],
        per_crop=per_crop,
        assumptions=ASSUMPTIONS.get(req.lang, ASSUMPTIONS["es"]),
    )


def rotation_crops() -> dict:
    return {"crops": generador.CANDIDATES, "not_available": generador.NOT_AVAILABLE}


def generate_rotations(crop: str, water: int, soil: int, income: int, salinity: float,
                       lat: float | None = None, lon: float | None = None, zone: str = "majes",
                       crops: list[str] | None = None, cap_pct: float = 100.0, lang: str = "es") -> list[dict]:
    if crop not in generador.CANDIDATES:
        raise ValueError(_err(lang, "crop", crop=crop))
    site = pixeles.site(lat, lon, zone) if lat is not None and lon is not None else None
    unknown = [c for c in (crops or []) if c not in generador.CANDIDATES]
    if unknown:
        raise ValueError(_err(lang, "unknown", crops=", ".join(unknown)))
    return generador.generate(crop, w_water=water, w_soil=soil, w_income=income, ece=salinity, site=site,
                              allowed=crops or None, cap_pct=cap_pct, lang=lang)


def point_info(lat: float, lon: float, zone: str, lang: str = "es") -> dict:
    return pixeles.point_info(lat, lon, zone, lang=lang)


def irrigated_points(zone: str) -> list:
    return pixeles.irrigated_points(zone=zone)


def water_calendar(sequence: list[str], cap_pct: float, area_ha: float, lang: str = "es") -> dict:
    unknown = [c for c in sequence if c not in generador.CANDIDATES]
    if unknown or not sequence:
        raise ValueError(_err(lang, "unknown", crops=", ".join(unknown) or _err(lang, "none")))
    return agua_parcela.calendar(sequence, cap_pct, area_ha, lang=lang)



def vulnerability(zone: str, lang: str = "es") -> dict:
    return pixeles.vulnerability(zone, lang=lang)
