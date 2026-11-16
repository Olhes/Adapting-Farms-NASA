"""The botanical-family rule ("do not repeat a family in consecutive campaigns") must not depend on the direction.

The rules file says the rule applies to every family of the catalog (aplica_a) with a minimum separation of one
campaign, and lists no exception. Alfalfa is Fabaceae like fava bean, so Faba -> Alfalfa and Alfalfa -> Faba are both
breaches. The only pair of the same crop that is not a breach is Alfalfa -> Alfalfa: it is perennial, not a repeat.
"""
import itertools
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import generador  # noqa: E402
import rotacion  # noqa: E402


def _same_family(a, b, lang="en"):
    bad, _ = rotacion.check([b], previous=a, lang=lang)
    return any("same family" in x or "misma familia" in x for x in bad)


def test_faba_and_alfalfa_are_flagged_in_both_directions():
    assert _same_family("Haba", "Alfalfa")
    assert _same_family("Alfalfa", "Haba")
    assert _same_family("Haba", "Alfalfa", "es") and _same_family("Alfalfa", "Haba", "es")


def test_alfalfa_after_alfalfa_is_perennial_not_a_repeat():
    assert not _same_family("Alfalfa", "Alfalfa")


def test_the_family_check_is_symmetric_for_every_pair_of_candidates():
    for a, b in itertools.product(generador.CANDIDATES, repeat=2):
        if a == b == "Alfalfa":
            continue
        assert _same_family(a, b) == _same_family(b, a), (a, b)


def test_no_generated_rotation_puts_two_crops_of_one_family_side_by_side():
    for current in ("Papa", "Haba", "Alfalfa"):
        for r in generador.generate(current):
            seq = r["sequence"]
            if r["id"] == "actual":
                continue
            for a, b in zip(seq, seq[1:]):
                assert not _same_family(a, b), (current, seq)
