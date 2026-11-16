"""ALL pixels of the Majes pampa box (NDVI 250 m and yearly ET 500 m) from Microsoft Planetary Computer.

No account, no queue. It reads the whole window of the box (the earlier scripts read the same window
and kept only 36 pixels). Aggregates per year in memory and saves compact arrays:
    ndvi_pampa_pixeles_anual.npz   years, mean, peak, cnt   (years x rows x cols, NDVI -1..1)
    et_pampa_pixeles_anual.npz     years, et                 (years x rows x cols, mm/year, NaN = no data)
    ndvi_pampa_fechas.csv          one row per 16-day composite (valid pixels, irrigated pixels, mean NDVI)

Setup:  python3 -m venv .venv && .venv/bin/pip install pystac-client planetary-computer rasterio numpy
Run:    .venv/bin/python pampa_completa_pc.py            (about 5 min for NDVI, measured on the 36-point version)
Test:   .venv/bin/python pampa_completa_pc.py --limit 3
Then:   python3 analizar_pampa.py   (needs numpy)

NDVI keeps only pixels with pixel_reliability 0 or 1. ET keeps values < 65529 (65533 = barren, desert, no ET).
Terra only (MOD13Q1, MOD16A3GF).  The box is the one used by the team repo.
"""
import argparse, csv, warnings
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import planetary_computer as pc
import rasterio
from pystac_client import Client
from rasterio.warp import transform as warp_transform
from rasterio.windows import Window

HERE = Path(__file__).parent
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
LAT, LON = (-16.47, -16.26), (-72.36, -72.09)        # south, north / west, east
BBOX = (LON[0], LAT[0], LON[1], LAT[1])
TILE = "h11v10"
IRRIGATED = 0.3                                       # NDVI threshold (assumption)


def window_for(ds):
    lons = [LON[0], LON[1], LON[0], LON[1]]
    lats = [LAT[0], LAT[0], LAT[1], LAT[1]]
    xs, ys = warp_transform("EPSG:4326", ds.crs, lons, lats)
    rc = [ds.index(x, y) for x, y in zip(xs, ys)]
    r0, r1 = min(r for r, _ in rc), max(r for r, _ in rc)
    c0, c1 = min(c for _, c in rc), max(c for _, c in rc)
    return Window(c0, r0, c1 - c0 + 1, r1 - r0 + 1)


CACHE = HERE / ".cache_ndvi"          # one .npy per date: a rerun resumes where it stopped


def read_ndvi(item, win, ref_tr):
    date = item.properties["start_datetime"][:10]
    f = CACHE / f"{date}.npy"
    if f.exists():
        return date, np.load(f), 0
    for attempt in range(4):             # a stalled connection must not freeze the whole run
        try:
            res = _read_ndvi(item, win, ref_tr)
            CACHE.mkdir(exist_ok=True)
            np.save(f, res[1])
            return res
        except Exception as e:
            print(f"  reintento {attempt + 1} en {date}: {type(e).__name__}", flush=True)
    raise RuntimeError(f"No se pudo leer {date}")


def _read_ndvi(item, win, ref_tr):
    s = pc.sign(item)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="1",
                      GDAL_HTTP_TIMEOUT="40", GDAL_HTTP_CONNECTTIMEOUT="15"):
        with rasterio.open(s.assets["250m_16_days_NDVI"].href) as ds:
            if ds.transform != ref_tr:
                raise RuntimeError(f"Grid differs in {item.id}")
            nd = ds.read(1, window=win).astype(np.float32)
        with rasterio.open(s.assets["250m_16_days_pixel_reliability"].href) as ds:
            qa = ds.read(1, window=win)
    good = np.isin(qa, (0, 1)) & (nd != -3000)
    return item.properties["start_datetime"][:10], np.where(good, nd * 0.0001, np.nan).astype(np.float32), int((~good).sum())


def do_ndvi(start, end, limit, workers):
    cat = Client.open(STAC)
    items = [i for i in cat.search(collections=["modis-13Q1-061"], bbox=BBOX, datetime=f"{start}/{end}").items()
             if TILE in i.id and i.id.startswith("MOD13Q1") and start <= i.properties["start_datetime"][:10] <= end]
    items.sort(key=lambda i: i.properties["start_datetime"])
    if limit:
        items = items[:limit]
    print(f"NDVI: {len(items)} fechas")
    with rasterio.open(pc.sign(items[0]).assets["250m_16_days_NDVI"].href) as ds:
        win, ref_tr = window_for(ds), ds.transform
    print(f"  ventana: {int(win.height)} filas x {int(win.width)} columnas = {int(win.height * win.width):,} píxeles")
    res = []
    with ThreadPoolExecutor(workers) as ex:
        for k, r in enumerate(ex.map(lambda it: read_ndvi(it, win, ref_tr), items), 1):
            res.append(r)
            if k % 25 == 0 or k == len(items):
                print(f"  {k}/{len(items)}", flush=True)
    with open(HERE / "ndvi_pampa_fechas.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fecha", "pix_validos", "pix_malos", "pix_regados", "ndvi_medio_regados"])
        for d, a, bad in res:
            irr = a >= IRRIGATED
            w.writerow([d, int(np.isfinite(a).sum()), bad, int(irr.sum()), round(float(a[irr].mean()), 4) if irr.any() else ""])
    years = sorted({d[:4] for d, _, _ in res})
    mean, peak, cnt = [], [], []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for y in years:
            stack = np.stack([a for d, a, _ in res if d[:4] == y])
            mean.append(np.nanmean(stack, axis=0)); peak.append(np.nanmax(stack, axis=0)); cnt.append(np.isfinite(stack).sum(axis=0))
    np.savez_compressed(HERE / "ndvi_pampa_pixeles_anual.npz", years=np.array(years, int), mean=np.array(mean, np.float32),
                        peak=np.array(peak, np.float32), cnt=np.array(cnt, np.int16))
    print("  guardado ndvi_pampa_pixeles_anual.npz y ndvi_pampa_fechas.csv")


def do_et(start, end):
    cat = Client.open(STAC)
    best = {}
    for it in cat.search(collections=["modis-16A3GF-061"], bbox=BBOX, datetime=f"{start}/{end}").items():
        if TILE not in it.id or not it.id.startswith("MOD16A3GF"):
            continue
        y = it.properties["start_datetime"][:4]
        if y not in best or it.id.split(".")[-1] > best[y].id.split(".")[-1]:
            best[y] = it
    years = sorted(best)
    print(f"ET: años {years[0]}-{years[-1]} ({len(years)})")
    arrs, shape = [], None
    for y in years:
        s = pc.sign(best[y])
        with rasterio.open(s.assets["ET_500m"].href) as ds:
            win = window_for(ds)
            a = ds.read(1, window=win).astype(np.float32)
        if shape and a.shape != shape:
            raise RuntimeError("Window shape differs between years")
        shape = a.shape
        arrs.append(np.where(a < 65529, a * 0.1, np.nan).astype(np.float32))
        print(f"  {y}: {int(np.isfinite(arrs[-1]).sum())} de {a.size} píxeles con ET", flush=True)
    np.savez_compressed(HERE / "et_pampa_pixeles_anual.npz", years=np.array(years, int), et=np.array(arrs, np.float32))
    print("  guardado et_pampa_pixeles_anual.npz")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2013-01-01")
    ap.add_argument("--end", default="2025-12-31")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--skip-ndvi", action="store_true")
    ap.add_argument("--skip-et", action="store_true")
    a = ap.parse_args()
    if not a.skip_et:
        do_et(a.start, a.end)
    if not a.skip_ndvi:
        do_ndvi(a.start, a.end, a.limit, a.workers)
