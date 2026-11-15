"""Satellite facts for one point of the Majes pampa: which MODIS pixel contains it and what NASA saw there.

The NDVI (MOD13Q1, 250 m, ~5.4 ha per pixel) and ET (MOD16A3GF, 500 m) arrays in data/ are windows of tile h11v10
in the MODIS sinusoidal grid. Pixel coordinates are recomputed with the sinusoidal formulas (no external library)
and checked against the array shapes; row/column agree with AppEEARS Line/Sample (see check_against_appeears).
"""
import math
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent / "data"
R = 6371007.181                       # MODIS sphere radius (m)
TILE = 1111950.5197665                # tile width (m)
H, V = 11, 10                         # tile h11v10
# exact upper-left corner and pixel sizes read from the files' geotransform (rounded constants are ~1 m off,
# which flips the row when a box edge falls on a pixel boundary)
ULX, ULY = -7783653.637667, -1111950.519667
# box used by the extraction (pipeline/extraer_zona.py) and file suffix in data/
ZONES = {"majes": ((-16.47, -16.26), (-72.36, -72.09), "pampa"),
         "tambo": ((-17.22, -17.00), (-71.88, -71.66), "tambo")}
# years with less water delivered (Condoroma / Pitay): only meaningful for Majes; Tambo has another water source
DRY = {"majes": {2014: "entrega 12 % menor", 2016: "entrega 8 % menor", 2023: "entrega 7 % menor"}, "tambo": {}}


def _fwd(lat, lon):
    phi = math.radians(lat)
    return R * math.radians(lon) * math.cos(phi), R * phi


def _inv(x, y):
    phi = y / R
    return math.degrees(phi), math.degrees(x / (R * math.cos(phi)))


@lru_cache
def _grid(pix, zone="majes"):
    lat_box, lon_box, _ = ZONES[zone]
    rows, cols = [], []
    for la in lat_box:
        for lo in lon_box:
            x, y = _fwd(la, lo)
            rows.append(math.floor((ULY - y) / pix))
            cols.append(math.floor((x - ULX) / pix))
    return min(rows), max(rows) - min(rows) + 1, min(cols), max(cols) - min(cols) + 1


@lru_cache
def _ndvi(zone="majes"):
    d = np.load(DATA / f"ndvi_{ZONES[zone][2]}_pixeles_anual.npz")
    return list(d["years"]), d["mean"]


@lru_cache
def _et(zone="majes"):
    e = np.load(DATA / f"et_{ZONES[zone][2]}_pixeles_anual.npz")
    return list(e["years"]), e["et"]


NDVI_PIX, ET_PIX = 231.65635826395845, 463.3127165279169


def _index(lat, lon, pix, zone="majes"):
    r0, nr, c0, nc = _grid(pix, zone)
    x, y = _fwd(lat, lon)
    i, j = math.floor((ULY - y) / pix) - r0, math.floor((x - ULX) / pix) - c0
    return (i, j) if 0 <= i < nr and 0 <= j < nc else None


def _square(i, j, pix, zone="majes"):
    r0, _, c0, _ = _grid(pix, zone)
    x0, y0 = ULX + (c0 + j) * pix, ULY - (r0 + i) * pix
    return [list(_inv(x0, y0)), list(_inv(x0 + pix, y0)), list(_inv(x0 + pix, y0 - pix)), list(_inv(x0, y0 - pix))]


def available(zone):
    return zone in ZONES and (DATA / f"ndvi_{ZONES[zone][2]}_pixeles_anual.npz").exists()


def point_info(lat, lon, zone="majes"):
    if not available(zone):
        return {"inside": False, "message": "Todavía no tenemos datos satelitales de esta zona."}
    years, mean = _ndvi(zone)
    idx = _index(lat, lon, NDVI_PIX, zone)
    if idx is None:
        return {"inside": False, "message": "Fuera del área con datos satelitales de esta zona."}
    i, j = idx
    series = {int(y): (None if np.isnan(mean[k, i, j]) else round(float(mean[k, i, j]), 3)) for k, y in enumerate(years)}
    normal = [v for y, v in series.items() if v is not None and y < 2025]
    avg = float(np.mean(normal)) if normal else None
    dry = {}
    for y, why in DRY[zone].items():
        others = [v for yy, v in series.items() if v is not None and yy < 2025 and yy != y]
        if series.get(y) is not None and others:
            dry[y] = {"cambio_pct": round(100 * (series[y] / float(np.mean(others)) - 1), 1), "por_que": why}
    et_years, et = _et(zone)
    ej = _index(lat, lon, ET_PIX, zone)
    et_mean = None
    if ej is not None:
        vals = et[[k for k, y in enumerate(et_years) if y < 2025], ej[0], ej[1]]
        et_mean = None if np.all(np.isnan(vals)) else round(float(np.nanmean(vals)))
    kind = "sin dato" if avg is None else ("regado" if avg >= 0.3 else ("mixto (parte regada)" if avg >= 0.2 else "desierto o sin riego"))
    return {"inside": True, "pixel_ha": round(NDVI_PIX ** 2 / 1e4, 2), "square": _square(i, j, NDVI_PIX, zone),
            "ndvi_medio_2013_2024": None if avg is None else round(avg, 3), "tipo": kind, "ndvi_por_anio": series,
            "anios_secos": dry, "et_mm_anual": et_mean,
            "fuente": "MODIS MOD13Q1 (NDVI, 250 m) y MOD16A3GF (ET, 500 m), NASA, vía Planetary Computer"}


def irrigated_points(step=1, zone="majes"):
    """Centres of pixels with mean NDVI >= 0.3 (2013-2024): where the zone is irrigated."""
    if not available(zone):
        return []
    years, mean = _ndvi(zone)
    base = np.nanmean(mean[[k for k, y in enumerate(years) if y < 2025]], axis=0)
    r0, nr, c0, nc = _grid(NDVI_PIX, zone)
    out = []
    for i in range(0, nr, step):
        for j in range(0, nc, step):
            if base[i, j] >= 0.3:
                x, y = ULX + (c0 + j + 0.5) * NDVI_PIX, ULY - (r0 + i + 0.5) * NDVI_PIX
                la, lo = _inv(x, y)
                out.append([round(la, 5), round(lo, 5), round(float(base[i, j]), 2)])
    return out


def check_against_appeears(csv_path):
    """Row/col computed here must equal AppEEARS Line_Y/Sample_X for the same lat/lon."""
    import csv
    bad = 0
    for r in csv.DictReader(open(csv_path)):
        x, y = _fwd(float(r["Latitude"]), float(r["Longitude"]))
        row, col = math.floor((ULY - y) / NDVI_PIX), math.floor((x - ULX) / NDVI_PIX)
        bad += (row, col) != (int(float(r["MOD13Q1_061_Line_Y_250m"])), int(float(r["MOD13Q1_061_Sample_X_250m"])))
    return bad


@lru_cache
def zone_et_mean(zone="majes"):
    """Mean yearly ET (mm) of the zone's pixels with ET data, 2013-2024: the reference for 'your plot uses more/less'."""
    years, et = _et(zone)
    return float(np.nanmean(et[[k for k, y in enumerate(years) if y < 2025]]))


def site(lat, lon, zone="majes"):
    """What the generator needs from the tapped pixel: kind, sensitivity to dry years, local ET vs zone mean."""
    info = point_info(lat, lon, zone)
    if not info.get("inside"):
        return None
    dry = [d["cambio_pct"] for d in info["anios_secos"].values()]
    ratio = None
    if info["et_mm_anual"]:
        ratio = max(0.7, min(1.3, info["et_mm_anual"] / zone_et_mean(zone)))
    return {"tipo": info["tipo"], "ndvi": info["ndvi_medio_2013_2024"],
            "caida_anios_secos_pct": round(sum(dry) / len(dry), 1) if dry else None,
            "peor_anio_seco_pct": min(dry) if dry else None,
            "et_mm": info["et_mm_anual"], "et_zona_mm": round(zone_et_mean(zone)), "factor_agua": ratio}
