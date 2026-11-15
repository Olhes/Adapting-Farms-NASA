from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

Confidence = Literal["ALTA", "MEDIA", "BAJA"]


@dataclass(frozen=True)
class Rotation:
    """Rotación de cultivos de 4 campañas con métricas agronómicas."""

    id: str
    sequence: tuple[str, ...]
    water: int            # 1-5 ahorro de agua
    soil: int             # 1-5 salud del suelo
    income: int           # 1-5 ingreso
    pareto_x: int         # 0-100 ingreso relativo
    pareto_y: int         # 0-100 salud suelo relativa
    pareto_optimal: bool
    confidence: Confidence
    rationale: str
    soil_impact: str
    water_balance: str


ROTATIONS_DB: dict[str, list[Rotation]] = {
    "Papa": [
        Rotation("papa-1", ("Papa", "Haba", "Maíz", "Alfalfa"), 5, 5, 3, 58, 86, True, "ALTA",
                 "La inclusión de Haba (leguminosa) inmediatamente después de la Papa repone el nitrógeno extraído sin fertilización sintética excesiva. Cerrar con Alfalfa mejora la infiltración de agua y reduce la salinidad superficial en suelos áridos.",
                 "+18% Materia Orgánica proyectada a 4 años; corta ciclo de nematodos de la papa.",
                 "Ahorro de ~2,400 m³/ha frente a rotaciones intensivas de hortalizas."),
        Rotation("papa-2", ("Papa", "Maíz", "Haba", "Cebolla"), 3, 4, 4, 74, 69, True, "MEDIA",
                 "El Maíz aprovecha el nitrógeno residual tras la cosecha de Papa y estructura el perfil radicular antes de introducir Haba. La Cebolla al cierre maximiza el margen comercial aprovechando la mejora biológica previa.",
                 "+11% estabilidad de agregados; balance neutro de nitrógeno con aporte de leguminosa en año 3.",
                 "Consumo moderado (+650 m³/ha en campaña final por demanda hídrica de cebolla)."),
        Rotation("papa-3", ("Papa", "Haba", "Cebolla", "Maíz"), 4, 4, 5, 88, 64, True, "MEDIA",
                 "Fijación biológica temprana con Haba en el segundo año para sostener la rentabilidad de la Cebolla en el tercero, cerrando con Maíz forrajero o grano para capturar nutrientes remanentes.",
                 "+9% carbono lábil; requiere monitoreo de conductividad eléctrica antes de cebolla.",
                 "Ahorro de ~1,150 m³/ha respecto al monocultivo continuo de hortalizas."),
        Rotation("papa-4", ("Papa", "Papa", "Maíz", "Maíz"), 2, 1, 5, 78, 18, False, "BAJA",
                 "Secuencia extractiva de alto riesgo agronómico: repetir Papa dos campañas seguidas multiplica inóculos de Globodera (nematodo quiste) y agota el nitrógeno disponible sin descanso ni cobertura.",
                 "-22% materia orgánica y compactación subsuperficial; alta probabilidad de caída de rendimiento en año 2.",
                 "Ineficiencia hídrica por baja retención de humedad en suelo degradado."),
    ],
    "Maíz": [
        Rotation("maiz-1", ("Maíz", "Haba", "Papa", "Alfalfa"), 4, 5, 4, 64, 85, True, "ALTA",
                 "Después del alto consumo de nitrógeno del Maíz, la Haba fija entre 80 y 110 kg N/ha preparando el terreno para la Papa. La Alfalfa final regenera la porosidad y controla sales.",
                 "+17% retención de humedad y fijación simbiótica de nitrógeno validada en valles costeros.",
                 "Ahorro de ~1,950 m³/ha optimizando láminas de riego por goteo."),
        Rotation("maiz-2", ("Maíz", "Cebolla", "Haba", "Trigo"), 4, 4, 4, 78, 71, True, "MEDIA",
                 "Alternancia de raíces fasciculadas (Maíz y Trigo) con bulbo (Cebolla) y pivotante (Haba) que evita la formación de pie de arado y diversifica los ingresos anuales.",
                 "+12% cobertura de rastrojo con Trigo en año 4; reduce erosión eólica.",
                 "Ahorro de ~1,600 m³/ha gracias al bajo requerimiento hídrico del Trigo."),
        Rotation("maiz-3", ("Maíz", "Haba", "Cebolla", "Papa"), 3, 3, 5, 90, 58, True, "MEDIA",
                 "Esquema orientado a flujo de caja con dos cultivos comerciales de alta demanda regional sostenidos por la fijación nitrogenada de Haba en el segundo año.",
                 "+6% materia orgánica; exige incorporación de compost antes de la Papa.",
                 "Demanda hídrica media-alta en años 3 y 4."),
        Rotation("maiz-4", ("Maíz", "Maíz", "Papa", "Cebolla"), 2, 2, 5, 81, 22, False, "BAJA",
                 "Alta extracción de macro y micronutrientes sin leguminosas ni descanso. Incrementa la dependencia de urea sintética y eleva la salinización en zonas de riego restringido.",
                 "-16% actividad microbiana y pérdida de estructura granular.",
                 "Déficit hídrico severo en campañas de estiaje."),
    ],
    "Cebolla": [
        Rotation("ceb-1", ("Cebolla", "Haba", "Maíz", "Alfalfa"), 5, 5, 3, 56, 88, True, "ALTA",
                 "La Cebolla deja raíces superficiales y alta sensibilidad a salinidad; rotar con Haba y cerrar con Alfalfa lava sales del bulbo húmedo y recupera la fertilidad biológica.",
                 "+20% infiltración y reducción de conductividad eléctrica superficial.",
                 "Ahorro de ~2,600 m³/ha frente a sucesión continua de hortalizas."),
        Rotation("ceb-2", ("Cebolla", "Papa", "Haba", "Maíz"), 3, 4, 5, 85, 66, True, "MEDIA",
                 "Aprovecha la preparación fina de suelo tras Cebolla para establecer Papa, incorporando Haba en el tercer año para restaurar el balance de nitrógeno antes del Maíz.",
                 "+10% equilibrio NPK; rompe ciclo de fusarium basal de la cebolla.",
                 "Consumo equilibrado con pico moderado en año 2."),
        Rotation("ceb-3", ("Cebolla", "Cebolla", "Papa", "Maíz"), 1, 1, 5, 76, 16, False, "BAJA",
                 "Repetir Cebolla dispara la incidencia de raíz rosada y trips, reduciendo el calibre comercial y exigiendo riegos frecuentes que agravan la salinidad.",
                 "-24% salud biológica del suelo y acumulación de sales solubles.",
                 "Sobreconsumo hídrico (+3,100 m³/ha) por lavados forzados."),
    ],
    "Haba": [
        Rotation("haba-1", ("Haba", "Papa", "Maíz", "Alfalfa"), 5, 5, 4, 68, 87, True, "ALTA",
                 "Secuencia modelo INIA: el nitrógeno fijado por la Haba impulsa directamente el rendimiento de la Papa en el año 2, seguido de Maíz y Alfalfa regenerativa.",
                 "+19% nitrógeno disponible orgánico y mejora sostenida de carbono del suelo.",
                 "Ahorro de ~2,200 m³/ha con alta eficiencia por kilogramo producido."),
        Rotation("haba-2", ("Haba", "Cebolla", "Maíz", "Trigo"), 4, 4, 5, 86, 70, True, "MEDIA",
                 "Capitaliza el aporte nitrogenado inicial de la Haba en un cultivo de alto valor como la Cebolla, estabilizando el perfil con gramíneas (Maíz y Trigo).",
                 "+13% cobertura vegetal y menor compactación superficial.",
                 "Ahorro de ~1,750 m³/ha en el ciclo completo de 4 años."),
        Rotation("haba-3", ("Haba", "Haba", "Papa", "Papa"), 2, 2, 3, 54, 24, False, "BAJA",
                 "Repetir bloques de dos años del mismo cultivo favorece enfermedades fúngicas de raíz y reduce la eficiencia de fijación biológica en la segunda campaña de leguminosa.",
                 "-12% diversidad microbiana por baja variedad de exudados radiculares.",
                 "Uso subóptimo del agua en años 3 y 4."),
    ],
    "Alfalfa": [
        Rotation("alf-1", ("Alfalfa", "Papa", "Maíz", "Haba"), 4, 5, 4, 70, 89, True, "ALTA",
                 "Al roturar Alfalfa se libera una reserva extraordinaria de materia orgánica y nitrógeno que maximiza el rendimiento de Papa y Maíz sin degradar el suelo.",
                 "+22% materia orgánica acumulada y descompactación profunda por raíz pivotante.",
                 "Ahorro de ~2,050 m³/ha al sustituir alfalfa permanente por cultivos anuales."),
        Rotation("alf-2", ("Alfalfa", "Cebolla", "Maíz", "Haba"), 4, 4, 5, 88, 73, True, "MEDIA",
                 "Aprovecha la baja salinidad y alta porosidad dejada por la Alfalfa para obtener cebolla de exportación en el segundo año, cerrando con Haba.",
                 "+15% estabilidad estructural y excelente drenaje interno.",
                 "Ahorro de ~1,850 m³/ha frente al mantenimiento de alfalfa de corte."),
        Rotation("alf-3", ("Alfalfa", "Alfalfa", "Alfalfa", "Alfalfa"), 1, 3, 3, 48, 38, False, "BAJA",
                 "Mantener Alfalfa continua en zonas áridas como Majes consume hasta 18,000 m³/ha/año y eleva el nivel freático, agravando la salinización en parcelas bajas.",
                 "Buena cobertura, pero alto riesgo de ascenso capilar de sales.",
                 "Consumo hídrico crítico; penalizado bajo escenarios de escasez en Condoroma."),
    ],
}


# --- Esquemas de request/response ---

class Priorities(BaseModel):
    water: int = Field(ge=0, le=100)
    soil: int = Field(ge=0, le=100)
    income: int = Field(ge=0, le=100)


class ClimateParams(BaseModel):
    t2m: float = 19.4        # temperatura media NASA POWER (T2M)
    salinity: float = 2.8    # salinidad suelo local (CE dS/m)


class RankRequest(BaseModel):
    crop: str
    zone: str = "majes"
    priorities: Priorities
    climate: ClimateParams = ClimateParams()


class RankedRotation(BaseModel):
    id: str
    sequence: list[str]
    confidence: Confidence
    rationale: str
    soil_impact: str
    water_balance: str
    adj_water: int
    adj_soil: int
    adj_income: int
    score: float
    match_pct: int
    pareto_x: int
    pareto_y: int
    pareto_optimal: bool


def rank_rotations(
    crop: str,
    water_stress: float,
    soil_stress: float,
    priorities: Priorities,
    climate: ClimateParams,
) -> list[RankedRotation]:
    """Lógica pura de ranking (espejo de recalculateAll() del frontend)."""
    rotations = ROTATIONS_DB.get(crop) or ROTATIONS_DB["Papa"]

    heat_penalty = max(0.0, (climate.t2m - 19.4) * 0.15)
    salinity_penalty = max(0.0, (climate.salinity - 2.8) * 0.25)

    w_water = priorities.water / 100
    w_soil = priorities.soil / 100
    w_income = priorities.income / 100

    def clamp(v: float, lo: int = 1, hi: int = 5) -> int:
        return max(lo, min(hi, round(v)))

    ranked: list[RankedRotation] = []
    for item in rotations:
        adj_water = clamp(item.water - heat_penalty * (5 - item.water) * 0.35 * water_stress)
        adj_soil = clamp(
            item.soil - (soil_stress - 1) * 2 - salinity_penalty * (5 - item.soil) * 0.2
        )
        adj_income = item.income

        score = adj_water * w_water + adj_soil * w_soil + adj_income * w_income
        max_possible = 5 * (w_water + w_soil + w_income) or 1
        match_pct = max(42, min(98, round((score / max_possible) * 100)))

        ranked.append(RankedRotation(
            id=item.id,
            sequence=list(item.sequence),
            confidence=item.confidence,
            rationale=item.rationale,
            soil_impact=item.soil_impact,
            water_balance=item.water_balance,
            adj_water=adj_water,
            adj_soil=adj_soil,
            adj_income=adj_income,
            score=round(score, 2),
            match_pct=match_pct,
            pareto_x=item.pareto_x,
            pareto_y=item.pareto_y,
            pareto_optimal=item.pareto_optimal,
        ))

    ranked.sort(key=lambda r: r.score, reverse=True)
    return ranked
