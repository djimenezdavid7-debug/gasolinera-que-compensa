# ⛽ Gasolinera que compensa

**La gasolinera más barata del cartel no siempre es la que te ahorra dinero.**

Si está a 10 km, el combustible que gastas en ir y volver puede comerse todo el ahorro. Esta web calcula qué
gasolinera te sale **más barata de verdad**: precio × litros + lo que gastas en el desvío (+ tu tiempo, si quieres).

👉 **Pruébala:** https://djimenezdavid7-debug.github.io/gasolinera-que-compensa/

## Qué hace

- Usa los **precios oficiales** de las ~11.000 gasolineras de España (datos abiertos del Ministerio), actualizados cada hora.
- Calcula el **coste real** de repostar en cada una según tus litros y el consumo de tu coche.
- Si vas a algún sitio, calcula el desvío **sobre tu ruta** (repostar de camino casi no cuesta nada).
- Te avisa cuando **la más barata del cartel te sale más cara** que otra más cercana.
- Gratis, sin registro y sin anuncios. **Todo se calcula en tu navegador**: tu ubicación no sale de tu móvil.

## Cómo calcula

```
coste real = precio × litros
           + (km de desvío × consumo / 100) × precio      ← lo que quemas en ir
           + (km de desvío / velocidad) × valor de tu hora ← opcional
km de desvío = sin destino: ida y vuelta desde donde estás
               con destino: (origen→gasolinera→destino) − (origen→destino)
```

Las distancias son en línea recta × 1,3 (factor típico de rodeo de la carretera en ciudad; se puede cambiar).
Es una aproximación honesta: no sustituye a un navegador GPS, pero sirve para no cruzar media ciudad por 2 céntimos.

## Estructura

| Ruta | Qué es |
|---|---|
| `docs/` | La web (HTML + JS sin frameworks). `calculo.js` es el núcleo del cálculo. |
| `scripts/og.py` | Genera `docs/og.png`, la imagen al compartir el enlace. |
| `scripts/actualizar.py` | Descarga la API oficial y la compacta (12 MB → ~1 MB). Solo biblioteca estándar. |
| `tests/` | Tests del cálculo (`node --test tests/calculo.test.mjs`). |
| `.github/workflows/publicar.yml` | Cada hora: tests + precios nuevos + publicación en GitHub Pages. |

## Usarlo en local

```bash
python scripts/actualizar.py          # descarga los precios a docs/data/estaciones.json
python -m http.server -d docs 8000    # abre http://localhost:8000
node --test tests/calculo.test.mjs                 # tests
```

## Ideas siguientes

- Aviso por Telegram cuando baja el precio en tus gasolineras.
- Distancias reales por carretera (OSRM) para las 5 mejores.
- Histórico: ¿qué día de la semana es más barato repostar en tu zona?

## Datos y licencia

Precios: [Ministerio para la Transición Ecológica y el Reto Demográfico](https://geoportalgasolineras.es), datos abiertos.
Mapas y búsqueda de direcciones: © [OpenStreetMap](https://www.openstreetmap.org/copyright).
Código bajo licencia MIT. Hecho por [David Jiménez](https://djimenezdavid7-debug.github.io) con ayuda de IA (Claude Code).
