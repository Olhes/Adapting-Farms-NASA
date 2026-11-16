import sys
from pathlib import Path

from app.modules.simulation.domain import CropWater, Range, SimulationRequest, SimulationResult

# The simulator lives in <repo>/model (stdlib only); it is not a package, so add it to the path.
_MODEL_DIR = Path(__file__).resolve().parents[4] / "model"
if str(_MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(_MODEL_DIR))

import agua_parcela  # noqa: E402
import generador  # noqa: E402
import i18n  # noqa: E402
import pixeles  # noqa: E402
import simulador_tope as sim  # noqa: E402

ASSUMPTIONS = {
    "es": [
        "Los meses de siembra de {fallback} son supuestos (no vienen de la siembra mensual de Majes); {data} vienen de la siembra mensual de Majes (Midagri), ponderada por superficie.",
        "El margen económico es sintético: no hay costos de producción oficiales para Majes.",
        "El factor de eficiencia por defecto (0,5) es el cociente entre la ET estimada por satélite y el agua entregada (0,41–0,56); incluye pérdidas de conducción y de aplicación y cualquier error de estimación de la ET. No es una eficiencia de riego medida.",
        "Las cifras de agua son un rango entre dos métodos estándar de ET0 (Hargreaves-Samani y Penman-Monteith FAO-56); el valor central usa Hargreaves-Samani, el más bajo de los dos.",
    ],
    "en": [
        "The sowing months of {fallback} are assumptions (not from the Majes monthly sowing records); {data} come from the monthly sowing records of Majes (Midagri), weighted by area.",
        "The economic margin is synthetic: there are no official production costs for Majes.",
        "The default efficiency factor (0.5) is the ratio of satellite-estimated ET to delivered water (0.41–0.56); it includes conveyance and application losses and any ET estimation error. It is not a measured irrigation efficiency.",
        "Water figures are a range between two standard ET0 methods (Hargreaves-Samani and FAO-56 Penman-Monteith); the central value uses Hargreaves-Samani, the lower of the two.",
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


def _assumptions(lang: str) -> list[str]:
    """Which sowing months are data-derived and which are fallback assumptions, from the model itself."""
    fallback = [c for c, v in sim.SOWING.items() if v["basis"] == "fallback" and c != "Alfalfa"]   # alfalfa is perennial
    data = [c for c, v in sim.SOWING.items() if v["basis"] == "data"]
    lang = lang if lang in ASSUMPTIONS else "es"
    return [a.format(fallback=i18n.crops(fallback, lang), data=i18n.crops(data, lang)) for a in ASSUMPTIONS[lang]]


def simulate(req: SimulationRequest) -> SimulationResult:
    crops = sim.load_crops()
    unknown = [c for c in req.mix if c not in crops and c not in sim.MEASURED]
    if unknown:
        raise ValueError(_err(req.lang, "unknown", crops=", ".join(unknown)))
    if sum(req.mix.values()) <= 0:
        raise ValueError(_err(req.lang, "empty_mix"))
    cap_hm3 = sim.CAP_NORMAL_HM3 * req.cap_pct / 100

    def run(method: str) -> dict:
        return sim.simulate(req.mix, crops, sim.load_et0_monthly(method), req.water_source, cap_hm3, req.area_ha, req.efficiency)

    r = run(req.et0_method)
    ends = [run(m)["demanda_hm3"] for m in (sim.ET0_LOW, sim.ET0_HIGH)]
    et0 = sim.load_et0_monthly(req.et0_method)
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
        assumptions=_assumptions(req.lang),
        caveats=agua_parcela.caveats(req.lang),
        et0_method=req.et0_method,
        demand_range_hm3=Range(low=min(ends), high=max(ends)),
    )


def rotation_crops() -> dict:
    sowing = {c: {"basis": v["basis"], "source": v["source"], "months": [{"month": m, "weight": round(w, 3)} for m, w in v["months"]]}
              for c, v in sim.SOWING.items()}
    return {"crops": generador.CANDIDATES, "not_available": generador.NOT_AVAILABLE, "sowing": sowing}


def generate_rotations(crop: str, water: int, soil: int, income: int, salinity: float,
                       lat: float | None = None, lon: float | None = None, zone: str = "majes",
                       crops: list[str] | None = None, cap_pct: float = 100.0, lang: str = "es",
                       scenario: str = "normal") -> list[dict]:
    if crop not in generador.CANDIDATES:
        raise ValueError(_err(lang, "crop", crop=crop))
    site = pixeles.site(lat, lon, zone) if lat is not None and lon is not None else None
    unknown = [c for c in (crops or []) if c not in generador.CANDIDATES]
    if unknown:
        raise ValueError(_err(lang, "unknown", crops=", ".join(unknown)))
    return generador.generate(crop, w_water=water, w_soil=soil, w_income=income, ece=salinity, site=site,
                              allowed=crops or None, cap_pct=cap_pct, lang=lang, scenario=scenario)


def point_info(lat: float, lon: float, zone: str, lang: str = "es") -> dict:
    return pixeles.point_info(lat, lon, zone, lang=lang)


def irrigated_points(zone: str) -> list:
    return pixeles.irrigated_points(zone=zone)


def water_calendar(sequence: list[str], cap_pct: float | None, area_ha: float, lang: str = "es",
                   scenario: str = "normal") -> dict:
    unknown = [c for c in sequence if c not in generador.CANDIDATES]
    if unknown or not sequence:
        raise ValueError(_err(lang, "unknown", crops=", ".join(unknown) or _err(lang, "none")))
    return agua_parcela.calendar(sequence, cap_pct, area_ha, lang=lang, scenario=scenario)



def vulnerability(zone: str, lang: str = "es") -> dict:
    return pixeles.vulnerability(zone, lang=lang)
