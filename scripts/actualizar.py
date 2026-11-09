"""
Descarga los precios oficiales de carburantes (Ministerio, datos abiertos) y los guarda en un JSON compacto
para la web: docs/data/estaciones.json (~1 MB en lugar de 12 MB).

Uso: python scripts/actualizar.py [salida.json]
Sin dependencias externas (solo biblioteca estándar). Lo ejecuta la GitHub Action cada hora.
"""
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

API = ("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/"
       "PreciosCarburantes/EstacionesTerrestres/")

# combustible (clave corta usada en la web) -> campo de la API
COMBUSTIBLES = {
    "g95": "Precio Gasolina 95 E5",
    "g98": "Precio Gasolina 98 E5",
    "diesel": "Precio Gasoleo A",
    "dieselp": "Precio Gasoleo Premium",
    "glp": "Precio Gases licuados del petróleo",
}
CAMPOS = ["id", "rotulo", "direccion", "localidad", "lat", "lon", "horario"] + list(COMBUSTIBLES)


def num(texto):
    """'1,649' -> 1.649 ; '' -> None"""
    texto = (texto or "").strip().replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def descargar():
    # El servidor del Ministerio corta la conexión TLS de urllib (comprobado 09-nov-2026) pero acepta curl.
    if shutil.which("curl"):
        r = subprocess.run(["curl", "-sS", "--fail", "--retry", "3", "-m", "240", "-H", "Accept: application/json", API],
                           capture_output=True, check=True)
        return json.loads(r.stdout.decode("utf-8"))
    req = urllib.request.Request(API, headers={"Accept": "application/json", "User-Agent": "gasolinera-que-compensa"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def compactar(datos):
    filas = []
    for e in datos["ListaEESSPrecio"]:
        if e.get("Tipo Venta") != "P":          # R = venta restringida a socios/flotas: no sirve al público
            continue
        lat, lon = num(e.get("Latitud")), num(e.get("Longitud (WGS84)"))
        if lat is None or lon is None:
            continue
        precios = [num(e.get(campo)) for campo in COMBUSTIBLES.values()]
        if not any(precios):
            continue
        filas.append([e.get("IDEESS"), (e.get("Rótulo") or "").strip(), (e.get("Dirección") or "").strip().title(),
                      (e.get("Localidad") or "").strip().title(), round(lat, 6), round(lon, 6),
                      (e.get("Horario") or "").strip()] + precios)
    return {"fecha": datos.get("Fecha"), "fuente": "Ministerio para la Transición Ecológica - datos abiertos",
            "campos": CAMPOS, "estaciones": filas}


def main():
    salida = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "docs" / "data" / "estaciones.json")
    datos = descargar()
    if datos.get("ResultadoConsulta") != "OK":
        sys.exit(f"La API respondió: {datos.get('ResultadoConsulta')}")
    compacto = compactar(datos)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(compacto, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(compacto['estaciones'])} gasolineras · {compacto['fecha']} -> {salida} ({salida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
