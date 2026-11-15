"""Rotation rule check: does a sequence of campaigns break the documented agronomic rules?

Rules come from the teammate's Green Orbit package (data/reglas_rotacion_greenorbit.json, each with its source and
confidence): do not repeat a botanical family back to back, wait 3+ years before Solanaceae (INIA, nematodes) and
Alliaceae again, prefer a legume after a cereal. Assumption: one campaign per year (Majes can sow more than once a
year, so the waits are a lower bound). Alfalfa/artichoke are perennial and are not treated as one-campaign crops.
"""
import json
from pathlib import Path

RULES = json.loads((Path(__file__).parent / "data" / "reglas_rotacion_greenorbit.json").read_text())
ALIAS = {"maíz": "maiz_amilaceo", "paprika": "paprika", "papa": "papa", "cebolla": "cebolla", "ajo": "ajo", "haba": "haba",
         "alfalfa": "alfalfa", "quinua": "quinua", "zapallo": "zapallo", "arveja": "arveja", "cebada": "cebada", "trigo": "trigo"}
FAMILY = {crop: fam for fam, crops in RULES["familias"].items() for crop in crops}
FAMILY["zapallo"] = "Cucurbitaceae"   # botanical fact; the rules file does not list pumpkin
WAIT = {"Solanaceae": 3, "Amaryllidaceae": 3}          # minimum years, from the rules file
CEREALS = set(RULES["familias"]["Poaceae"])
LEGUMES = set(RULES["familias"]["Fabaceae"]) - {"alfalfa"}


def family(name):
    return FAMILY.get(ALIAS.get(name.lower(), name.lower()))


def check(sequence, previous=None):
    """Return (violations, bonuses) for a sequence of crop names; `previous` is the crop sown before it."""
    seq = ([previous] if previous else []) + list(sequence)
    fams = [family(c) for c in seq]
    bad, good = [], []
    for i in range(1, len(seq)):
        if fams[i] and fams[i] == fams[i - 1] and ALIAS.get(seq[i].lower()) != "alfalfa":
            bad.append(f"{seq[i - 1]} → {seq[i]}: misma familia ({fams[i]}) en campañas seguidas")
        a, b = ALIAS.get(seq[i - 1].lower()), ALIAS.get(seq[i].lower())
        if a in CEREALS and b in LEGUMES:
            good.append(f"{seq[i - 1]} → {seq[i]}: leguminosa después de cereal")
    for fam, wait in WAIT.items():
        idx = [i for i, f in enumerate(fams) if f == fam]
        for x, y in zip(idx, idx[1:]):
            if y - x < wait:
                bad.append(f"{seq[x]} y {seq[y]}: {fam} se repite a {y - x} campaña(s); se recomienda esperar {wait}+ años")
    return bad, good
