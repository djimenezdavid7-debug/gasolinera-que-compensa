// Simulación: cuánto ahorra al año alguien que hace 30.000 km según su estrategia de repostaje.
// Uso: node analisis/simulacion_30000km.mjs   (lee docs/data/estaciones.json)
import { readFileSync } from "node:fs";
import { calcular } from "../docs/calculo.js";

const KM_ANO = 30000, CONSUMO = 6.5, LITROS = 40;
const REPOSTAJES = (KM_ANO * CONSUMO / 100) / LITROS;
const datos = JSON.parse(readFileSync(new URL("../docs/data/estaciones.json", import.meta.url), "utf8"));
const CIUDADES = { Madrid: [40.4168, -3.7038], Barcelona: [41.3874, 2.1686], Valencia: [39.4699, -0.3763],
  Sevilla: [37.3891, -5.9845], Zaragoza: [41.6488, -0.8891], Málaga: [36.7213, -4.4214], Bilbao: [43.263, -2.935],
  Murcia: [37.9922, -1.1307] };

function estaciones(comb) {
  const i = datos.campos.indexOf(comb);
  return datos.estaciones.filter((f) => f[i]).map((f) => ({ id: f[0], rotulo: f[1], localidad: f[3], lat: f[4], lon: f[5], precio: f[i] }));
}
// 25 puntos de partida por ciudad (rejilla de ±4 km alrededor del centro)
function origenes([lat, lon]) {
  const out = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
    out.push({ lat: lat + a * 0.018, lon: lon + b * 0.018 / Math.cos(lat * Math.PI / 180) });
  return out;
}
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

for (const comb of ["g95", "diesel"]) {
  const est = estaciones(comb);
  console.log(`\n=== ${comb === "g95" ? "Gasolina 95" : "Diésel"} · ${KM_ANO} km/año · ${CONSUMO} L/100 · repostajes de ${LITROS} L (${REPOSTAJES.toFixed(1)}/año) · precios ${datos.fecha}`);
  console.log("ciudad | ahorro/año vs la más cercana | trampa: la más barata del cartel cuesta de más/año | % puntos donde la del cartel NO es la mejor");
  const global = { a: [], t: [], p: [] };
  for (const [nombre, c] of Object.entries(CIUDADES)) {
    const a = [], t = [];
    for (const o of origenes(c)) {
      const r = calcular(est, o, null, { litros: LITROS, consumo: CONSUMO, radioKm: +(process.env.RADIO || 15) });
      if (!r) continue;
      a.push(r.ahorroVsCercana * REPOSTAJES);
      t.push(r.trampaCartel * REPOSTAJES);
    }
    const pct = 100 * t.filter((x) => x > 0.5).length / t.length;
    global.a.push(...a); global.t.push(...t); global.p.push(pct);
    console.log(`${nombre.padEnd(10)} | ${media(a).toFixed(0).padStart(4)} € (máx ${Math.max(...a).toFixed(0)} €) | ${media(t).toFixed(0).padStart(4)} € (máx ${Math.max(...t).toFixed(0)} €) | ${pct.toFixed(0)} %`);
  }
  console.log(`MEDIA      | ${media(global.a).toFixed(0)} € | ${media(global.t).toFixed(0)} € | ${media(global.p).toFixed(0)} %`);
}
