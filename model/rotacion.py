"""Rotation rule check: does a sequence of campaigns break the documented agronomic rules?

Rules come from the teammate's Green Orbit package (data/reglas_rotacion_greenorbit.json, each with its source and
confidence): do not repeat a botanical family back to back, wait 3+ years before Solanaceae (INIA, nematodes) and
Alliaceae again, prefer a legume after a cereal. Assumption: one campaign per year (Majes can sow more than once a
year, so the waits are a lower bound). Alfalfa/artichoke are perennial and are not treated as one-campaign crops.
"""
import json
from pathlib import Path

import i18n

RULES = json.loads((Path(__file__).parent / "data" / "reglas_rotacion_greenorbit.json").read_text(encoding="utf-8"))
ALIAS = {"maíz": "maiz_amilaceo", "paprika": "paprika", "papa": "papa", "cebolla": "cebolla", "ajo": "ajo", "haba": "haba",
         "alfalfa": "alfalfa", "quinua": "quinua", "zapallo": "zapallo", "arveja": "arveja", "cebada": "cebada", "trigo": "trigo"}
FAMILY = {crop: fam for fam, crops in RULES["familias"].items() for crop in crops}
FAMILY["zapallo"] = "Cucurbitaceae"   # botanical fact; the rules file does not list pumpkin
WAIT = {"Solanaceae": 3, "Amaryllidaceae": 3}          # minimum years, from the rules file
CEREALS = set(RULES["familias"]["Poaceae"])
LEGUMES = set(RULES["familias"]["Fabaceae"]) - {"alfalfa"}
TXT = {
    "es": {"same": "{a} → {b}: misma familia ({fam}) en campañas seguidas",
           "legume": "{a} → {b}: leguminosa después de cereal",
           "wait": "{a} y {b}: {fam} se repite a {n} campaña(s); se recomienda esperar {wait}+ años"},
    "en": {"same": "{a} → {b}: same family ({fam}) in consecutive campaigns",
           "legume": "{a} → {b}: legume after a cereal",
           "wait": "{a} and {b}: {fam} repeats after {n} campaign(s); waiting {wait}+ years is recommended"},
}


def family(name):
    return FAMILY.get(ALIAS.get(name.lower(), name.lower()))


def check(sequence, previous=None, lang="es"):
    """Return (violations, bonuses) for a sequence of crop names; `previous` is the crop sown before it."""
    seq = ([previous] if previous else []) + list(sequence)
    fams = [family(c) for c in seq]
    txt, name = TXT.get(lang, TXT["es"]), (lambda c: i18n.crop(c, lang))
    bad, good = [], []
    for i in range(1, len(seq)):
        # The rule applies to every family, in both directions. The only pair that is not a repeat is alfalfa after
        # alfalfa: it is perennial, so staying on it is not a rotation step.
        perennial_stay = ALIAS.get(seq[i].lower()) == ALIAS.get(seq[i - 1].lower()) == "alfalfa"
        if fams[i] and fams[i] == fams[i - 1] and not perennial_stay:
            bad.append(txt["same"].format(a=name(seq[i - 1]), b=name(seq[i]), fam=fams[i]))
        a, b = ALIAS.get(seq[i - 1].lower()), ALIAS.get(seq[i].lower())
        if a in CEREALS and b in LEGUMES:
            good.append(txt["legume"].format(a=name(seq[i - 1]), b=name(seq[i])))
    for fam, wait in WAIT.items():
        idx = [i for i, f in enumerate(fams) if f == fam]
        for x, y in zip(idx, idx[1:]):
            if y - x < wait:
                bad.append(txt["wait"].format(a=name(seq[x]), b=name(seq[y]), fam=fam, n=y - x, wait=wait))
    return bad, good
