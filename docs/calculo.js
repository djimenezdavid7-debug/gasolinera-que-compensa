// Núcleo del cálculo: ¿qué gasolinera te sale más barata DE VERDAD?
// Sin dependencias; lo usa la web (app.js) y los tests (node tests/calculo.test.mjs).

export const POR_DEFECTO = {
  litros: 40,            // lo que vas a repostar
  consumo: 6.5,          // L/100 km de tu coche
  factorCarretera: 1.3,  // la carretera es ~30 % más larga que la línea recta (aprox. en ciudad)
  radioKm: 15,           // solo gasolineras a menos de X km en línea recta
  valorHora: 0,          // €/h que vale tu tiempo (0 = no contar el tiempo)
  velocidadKmh: 35,      // velocidad media del desvío, para el tiempo
};

const R = 6371; // km

export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Km EXTRA que haces por ir a esa gasolinera.
// - Sin destino: vas y vuelves desde donde estás.
// - Con destino: lo que alarga el viaje origen -> gasolinera -> destino respecto a ir directo.
export function desvioKm(origen, estacion, destino, factor) {
  if (!destino) return 2 * distanciaKm(origen, estacion) * factor;
  const extra = distanciaKm(origen, estacion) + distanciaKm(estacion, destino) - distanciaKm(origen, destino);
  return Math.max(0, extra) * factor;
}

// estaciones: [{id, rotulo, lat, lon, precio, ...}] (solo las que tienen precio del combustible elegido)
export function calcular(estaciones, origen, destino = null, opciones = {}) {
  const o = { ...POR_DEFECTO, ...opciones };
  const centro = destino ? { lat: (origen.lat + destino.lat) / 2, lon: (origen.lon + destino.lon) / 2 } : origen;
  const radio = destino ? Math.max(o.radioKm, distanciaKm(origen, destino) / 2 + o.radioKm) : o.radioKm;

  const candidatas = estaciones
    .filter((e) => e.precio > 0)
    .map((e) => ({ ...e, lineaRecta: distanciaKm(centro, e) }))
    .filter((e) => e.lineaRecta <= radio)
    .map((e) => {
      const desvio = desvioKm(origen, e, destino, o.factorCarretera);
      const litrosDesvio = (desvio * o.consumo) / 100;
      const costeDesvio = litrosDesvio * e.precio;
      const costeTiempo = (desvio / o.velocidadKmh) * o.valorHora;
      const costeRepostaje = e.precio * o.litros;
      return { ...e, desvio, litrosDesvio, costeDesvio, costeTiempo, costeRepostaje,
               costeReal: costeRepostaje + costeDesvio + costeTiempo };
    });

  if (!candidatas.length) return null;

  const porCosteReal = [...candidatas].sort((a, b) => a.costeReal - b.costeReal);
  const mejor = porCosteReal[0];
  const masBarataCartel = candidatas.reduce((m, e) => (e.precio < m.precio || (e.precio === m.precio && e.costeReal < m.costeReal) ? e : m));
  const masCercana = candidatas.reduce((m, e) => (e.desvio < m.desvio ? e : m));

  return {
    opciones: o,
    ranking: porCosteReal,
    mejor,
    masBarataCartel,
    masCercana,
    ahorroVsCercana: masCercana.costeReal - mejor.costeReal,
    trampaCartel: masBarataCartel.costeReal - mejor.costeReal, // > 0: la más barata del cartel te sale más cara
  };
}
