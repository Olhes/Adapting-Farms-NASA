"""
Etiquetado (target) de cultivo ideal para Valle de Tambo: papa, arroz, maiz duro.

Idea: cada fila (dia) = "fecha de siembra". Se simula el ciclo completo del cultivo
con el clima de los dias SIGUIENTES (ventana hacia adelante) y se calcula:
  rendimiento = Ypot * f_temperatura * f_radiacion   (t/ha)
  agua        = sum(Kc * ET0) - 0.8*lluvia (+ percolacion y preparacion en arroz)  (m3/ha)
  ingreso_neto = rendimiento*precio - costo - agua*precio_agua                    (S/ha)
target = cultivo con mayor ingreso_neto.

IMPORTANTE: los parametros de abajo son SUPUESTOS editables. Los marcados [FUENTE]
vienen de datos publicos; el resto son supuestos agronomicos/economicos a validar
con MIDAGRI/SIEA o con agricultores de Tambo.
"""
import numpy as np
import pandas as pd

LAT, ELEV = -17.1, 721.31          # del encabezado NASA POWER
PRECIO_AGUA = 0.05                  # S/ por m3 (costo sombra, SUPUESTO)

CULTIVOS = {
    # N = dias del ciclo; etapas (ini, des, med, fin) en dias; kc (ini, med, fin)
    # temp = (T base, T optima min, T optima max, T maxima) sobre T media del ciclo
    "arroz": dict(
        N=145, etapas=(30, 30, 55, 30), kc=(1.05, 1.20, 0.75),
        temp=(12, 20, 30, 38), tmin_opt=None, rs_ref=24.0,
        ypot=13.0,      # t/ha [FUENTE: SENAMHI 2025-26 reporta 13.8-14.1 t/ha siembra oct; promedio Tambo 8-12]
        precio=1.44,    # S/kg cascara [FUENTE: MIDAGRI Marco Orientador, precio chacra NACIONAL, prom. 7 jun-19 jul (ventana desde 07/06/2024); 2026 hubo caida]
        costo=10500,    # S/ha (SUPUESTO)
        extra_agua_mm=200 + 3.0 * 145,  # preparacion de terreno + percolacion 3 mm/dia (SUPUESTO)
    ),
    "papa": dict(
        N=130, etapas=(25, 30, 45, 30), kc=(0.50, 1.15, 0.75),
        temp=(7, 14, 19, 28), tmin_opt=(13, 20, 0.6), rs_ref=16.0,
        ypot=32.0,      # t/ha (SUPUESTO)
        precio=1.24,    # S/kg [FUENTE: MIDAGRI Marco Orientador, precio chacra NACIONAL, prom. 7 jun-19 jul (ventana desde 07/06/2024); muy volatil]
        costo=15000,    # S/ha (SUPUESTO)
        extra_agua_mm=0.0,
    ),
    "maiz_duro": dict(
        N=140, etapas=(25, 40, 45, 30), kc=(0.30, 1.20, 0.60),
        temp=(10, 21, 28, 35), tmin_opt=None, rs_ref=24.0,
        ypot=10.0,      # t/ha (SUPUESTO; promedio nacional ~4.9, costa con riego mas alto)
        precio=1.41,    # S/kg [FUENTE: MIDAGRI Marco Orientador, precio chacra NACIONAL, prom. 7 jun-19 jul (ventana desde 07/06/2024)]
        costo=7000,     # S/ha (SUPUESTO)
        extra_agua_mm=0.0,
    ),
}


def es(t):  # presion de vapor de saturacion (kPa)
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def et0_penman_monteith(df):
    """FAO-56 Penman-Monteith diario (mm/dia)."""
    t, tmax, tmin = df.T2M, df.T2M_MAX, df.T2M_MIN
    rs, u2 = df.ALLSKY_SFC_SW_DWN, df.WS2M
    ea = es(df.T2MDEW)
    e_s = (es(tmax) + es(tmin)) / 2
    delta = 4098 * es(t) / (t + 237.3) ** 2
    P = 101.3 * ((293 - 0.0065 * ELEV) / 293) ** 5.26
    gamma = 0.000665 * P
    # radiacion extraterrestre
    J = df.date.dt.dayofyear.values
    phi = np.deg2rad(LAT)
    dr = 1 + 0.033 * np.cos(2 * np.pi * J / 365)
    dec = 0.409 * np.sin(2 * np.pi * J / 365 - 1.39)
    ws = np.arccos(-np.tan(phi) * np.tan(dec))
    Ra = (24 * 60 / np.pi) * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    Rso = (0.75 + 2e-5 * ELEV) * Ra
    rel = np.clip(rs / Rso, 0.3, 1.0)
    Rns = 0.77 * rs
    Rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * np.sqrt(ea)) * (1.35 * rel - 0.35)
    Rn = Rns - Rnl
    num = 0.408 * delta * Rn + gamma * 900 / (t + 273) * u2 * (e_s - ea)
    return (num / (delta + gamma * (1 + 0.34 * u2))).clip(lower=0)


def curva_kc(c):
    ini, des, med, fin = c["etapas"]
    k_ini, k_med, k_fin = c["kc"]
    return np.concatenate([
        np.full(ini, k_ini),
        np.linspace(k_ini, k_med, des),
        np.full(med, k_med),
        np.linspace(k_med, k_fin, fin),
    ])


def trapecio(x, p):
    b, o1, o2, m = p
    return np.where(x <= b, 0, np.where(x < o1, (x - b) / (o1 - b),
           np.where(x <= o2, 1, np.where(x < m, (m - x) / (m - o2), 0))))


def ventana_adelante(x, w, N):
    """suma_k w[k]*x[i+k]; NaN si la ventana no esta completa."""
    out = np.full(len(x), np.nan)
    out[: len(x) - N + 1] = np.correlate(x, w, mode="valid")
    return out


def main(entrada="nasa_power_completo.csv"):
    df = pd.read_csv(f"/mnt/user-data/outputs/{entrada}", parse_dates=["date"])
    calc = df.copy()
    calc["ALLSKY_SFC_SW_DWN"] = calc.ALLSKY_SFC_SW_DWN.interpolate(limit=10)
    df["ET0"] = et0_penman_monteith(calc).round(3)
    et0 = df.ET0.values
    lluvia_ef = 0.8 * calc.PRECTOTCORR.values
    tmean, tmin, rs = calc.T2M.values, calc.T2M_MIN.values, calc.ALLSKY_SFC_SW_DWN.values

    for nombre, c in CULTIVOS.items():
        N = c["N"]
        prom = np.ones(N) / N
        kc = curva_kc(c)
        f_t = trapecio(ventana_adelante(tmean, prom, N), c["temp"])
        if c["tmin_opt"]:
            lo, hi, piso = c["tmin_opt"]
            tn = ventana_adelante(tmin, prom, N)
            f_t = f_t * np.clip(1 - (1 - piso) * (tn - lo) / (hi - lo), piso, 1)
        f_r = np.clip(ventana_adelante(rs, prom, N) / c["rs_ref"], 0.5, 1.0)
        etc_mm = ventana_adelante(et0, kc, N)
        lluvia_mm = ventana_adelante(lluvia_ef, np.ones(N), N)
        agua_mm = np.maximum(etc_mm - lluvia_mm, 0) + c["extra_agua_mm"]
        rend = c["ypot"] * f_t * f_r
        agua_m3 = agua_mm * 10
        bruto = rend * 1000 * c["precio"]
        neto = bruto - c["costo"] - agua_m3 * PRECIO_AGUA
        df[f"rend_{nombre}_t_ha"] = rend.round(2)
        df[f"agua_{nombre}_m3_ha"] = agua_m3.round(0)
        df[f"ingreso_bruto_{nombre}"] = bruto.round(0)
        df[f"ingreso_neto_{nombre}"] = neto.round(0)

    netos = df[[f"ingreso_neto_{n}" for n in CULTIVOS]].copy()
    netos.columns = list(CULTIVOS)
    ok = netos.notna().all(axis=1)
    df["target"] = np.where(ok, np.array(list(CULTIVOS))[np.nan_to_num(netos.values, nan=-1e12).argmax(axis=1)], None)
    orden = np.sort(netos.values, axis=1)
    df["margen_vs_segundo"] = np.where(ok, orden[:, -1] - orden[:, -2], np.nan).round(0)
    return df


if __name__ == "__main__":
    out = main()
    out["date"] = out.date.dt.strftime("%Y-%m-%d")
    out.to_csv("/mnt/user-data/outputs/nasa_power_con_target.csv", index=False)
    lab = out.dropna(subset=["target"])
    lab[lab.date < "2019-01-01"].to_csv("/mnt/user-data/outputs/train_con_target.csv", index=False)
    lab[lab.date >= "2019-01-01"].to_csv("/mnt/user-data/outputs/test_con_target.csv", index=False)
    print(len(out), len(lab), lab.date.min(), lab.date.max())
