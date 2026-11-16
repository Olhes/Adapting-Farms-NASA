"""Penman-Monteith against the worked example of the FAO-56 paper (Example 18, Uccle / Brussels, 6 July).

Published inputs and results: https://www.fao.org/4/x0490e/x0490e08.htm
  latitude 50 deg 48' N, altitude 100 m, Tmax 21.5 C, Tmin 12.3 C, RHmax 84 %, RHmin 63 %, wind 10 km/h at 10 m
  (u2 = 2.078 m/s), sunshine 9.25 h  ->  Ra 41.09, Rs 22.07 MJ/m2/day, ea 1.409 kPa, ETo 3.9 mm/day (2.81 + 1.07 = 3.88).

The function under test lives in pipeline/recalcular_et0.py, a script that reads the POWER file as soon as it is
imported. To test the function without running the script, this file compiles only the function definitions from the
source. The function takes the dew point and the solar radiation, not RH and sunshine, so the test converts the
example's inputs with the FAO-56 equations and does not touch the model.
"""
import ast
import math
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "recalcular_et0.py"
LAT_DEG, Z, DOY = 50.8, 100.0, 187          # 6 July is day 187 of a non-leap year
TX, TN, RH_MAX, RH_MIN, SUNSHINE_H, U2 = 21.5, 12.3, 84.0, 63.0, 9.25, 2.078


@pytest.fixture(scope="module")
def pm():
    """The Penman-Monteith helpers of the script, with its LAT constant set to the example's latitude."""
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    wanted = {"es_kpa", "ra_mj", "penman_monteith"}
    funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in wanted]
    assert {f.name for f in funcs} == wanted, "the script no longer defines the functions this test extracts"
    ns = {"math": math, "LAT": LAT_DEG}
    exec(compile(ast.Module(body=funcs, type_ignores=[]), str(SCRIPT), "exec"), ns)
    return ns


def _example_inputs(pm):
    ea = (pm["es_kpa"](TN) * RH_MAX / 100 + pm["es_kpa"](TX) * RH_MIN / 100) / 2        # FAO-56 eq. 17
    lat, dec = math.radians(LAT_DEG), 0.409 * math.sin(2 * math.pi * DOY / 365 - 1.39)
    daylight = 24 / math.pi * math.acos(-math.tan(lat) * math.tan(dec))                  # N, eq. 34
    ra = pm["ra_mj"](DOY)
    rs = (0.25 + 0.5 * SUNSHINE_H / daylight) * ra                                      # Angstrom, eq. 35
    ln = math.log(ea / 0.6108)
    tdew = 237.3 * ln / (17.27 - ln)                                                    # dew point that gives that ea
    return ea, ra, rs, tdew


def test_intermediate_values_match_the_published_ones(pm):
    ea, ra, rs, _ = _example_inputs(pm)
    assert ra == pytest.approx(41.09, abs=0.05)
    assert rs == pytest.approx(22.07, abs=0.05)
    assert ea == pytest.approx(1.409, abs=0.002)
    es = (pm["es_kpa"](TX) + pm["es_kpa"](TN)) / 2
    assert es == pytest.approx(1.997, abs=0.002)


def test_reference_et_matches_fao56_example_18(pm):
    _, _, rs, tdew = _example_inputs(pm)
    et0 = pm["penman_monteith"](DOY, TX, TN, tdew, U2, rs, Z)
    assert et0 == pytest.approx(3.88, abs=0.05)
    assert round(et0, 1) == 3.9
