# Gasolinera que compensa – instrucciones para Claude
Conversación en español. Proyecto público (GitHub + GitHub Pages) para el LinkedIn de David (ver D:\ClaudeCode\LinkedIn-contenido):
web que calcula la gasolinera más barata DE VERDAD (precio × litros + combustible del desvío + tiempo opcional).

- Datos: API oficial `sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/`
  (12 MB, ~11.500 estaciones, CORS abierto). **urllib de Python recibe reset TLS; curl funciona** → `scripts/actualizar.py` usa curl.
  Solo `Tipo Venta == "P"` (las "R" son de venta restringida). Decimales con coma.
- `docs/` = web estática (sin frameworks; Leaflet 1.9.4 de cdnjs; Nominatim para direcciones). `docs/calculo.js` = núcleo
  (tests: `node --test tests/`, `package.json` con `"type": "module"`).
- GitHub Action horaria: tests + precios + despliegue a Pages SIN guardar los datos en el repo (`docs/data/` en .gitignore).
- Probar en local: `python scripts/actualizar.py` + `python -m http.server -d docs 8000`; prueba con Playwright (venv-radar)
  y geolocalización simulada.
- Ejemplo real (09-nov-2026, Puerta del Sol, 40 L G95): la mejor ahorra 5,26 € frente a la más cercana; la más barata del
  cartel (Ballenoil Alcorcón 1,499) sale 0,26 € más cara por el desvío.
- Pendiente: subir a GitHub (repo `gasolinera-que-compensa` del usuario djimenezdavid7-debug, Pages con "GitHub Actions"),
  publicación de LinkedIn, ideas del README (Telegram, OSRM, histórico).
