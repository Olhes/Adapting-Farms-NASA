"""Calibration check: does the simulator reproduce the satellite evapotranspiration of the Majes pampa?

Compares the crop ET the model computes for the CURRENT mix (Autodema 2016) with the yearly ET from
satellites (USGS SSEBop and NASA MOD16, 2013-2025 means, hm3) and with the water delivered (Pitay).

Limits: one mix (2016), irrigated area uncertain (15,900 licensed vs ~17,500 from NDVI), satellite ET is itself a
model (weak under desert irrigation), and it includes soil evaporation and non-crop vegetation.
Paprika and vine have no Kc in the dataset: their measured applied water x 0.75 is used as a rough ETc.
"""
import statistics as st

import simulador_tope as s

SSEBOP = [152.3, 138.4, 139.7, 133.0, 131.2, 142.6, 134.2, 133.2, 138.3, 137.1, 133.9, 139.1, 134.7]
MOD16 = [119.7, 119.2, 130.3, 110.3, 147.5, 137.6, 141.7, 150.9, 143.3, 136.7, 154.4, 164.8, 156.6]
DELIVERED = 333.8   # hm3/yr, mean 2013-2025


def modeled_etc_hm3(area_ha, method):
    crops, mix = s.load_crops(), s.MIXES["Actual (Autodema 2016)"]
    et0, tot = s.load_et0_monthly(method), sum(s.MIXES["Actual (Autodema 2016)"].values())
    total = 0.0
    for c, pct in mix.items():
        share = pct / tot
        if c in crops and c in s.SOWING:
            mm = sum(w * sum(s.seasonal_profile(crops[c]["kc"], crops[c]["ciclo"], x, et0)) for x, w in s.SOWING[c]["months"])
            total += share * area_ha * mm * 10 / 1e6
        elif c in s.MEASURED:
            total += share * area_ha * s.MEASURED[c] * 0.75 / 1e6
    return total


if __name__ == "__main__":
    sat = st.mean([st.mean(SSEBOP), st.mean(MOD16)])
    print(f"Satellite ET: SSEBop {st.mean(SSEBOP):.1f} | MOD16 {st.mean(MOD16):.1f} | delivered {DELIVERED} hm3")
    print(f"Implied irrigation efficiency (ET / delivered): {sat / DELIVERED:.2f}\n")
    for area in (15900, 17500):
        for method in ("hargreaves", "pm"):
            e = modeled_etc_hm3(area, method)
            print(f"area {area:,} ha | ET0 {method:10s} | modeled ETc {e:5.0f} hm3 | vs satellite {100 * (e / sat - 1):+4.0f} % "
                  f"| efficiency that reproduces delivery {e / DELIVERED:.2f}")
