// node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, distanciaKm, desvioKm } from "../docs/calculo.js";

const origen = { lat: 40.4168, lon: -3.7038 }; // Puerta del Sol
// punto a ~d km al este del origen
const aEste = (d) => ({ lat: origen.lat, lon: origen.lon + d / (111.32 * Math.cos((origen.lat * Math.PI) / 180)) });

test("distancia aproximada correcta", () => {
  assert.ok(Math.abs(distanciaKm(origen, aEste(10)) - 10) < 0.05);
});

test("sin destino el desvío es ida y vuelta por el factor de carretera", () => {
  assert.ok(Math.abs(desvioKm(origen, aEste(5), null, 1.3) - 13) < 0.1);
});

test("con destino, una gasolinera en plena ruta no tiene desvío", () => {
  assert.ok(desvioKm(origen, aEste(5), aEste(10), 1.3) < 0.01);
});

test("la más barata del cartel puede salir más cara (la trampa)", () => {
  const estaciones = [
    { id: "cerca", rotulo: "Cerca", ...aEste(1), precio: 1.55 },
    { id: "lejos", rotulo: "Lejos", ...aEste(14), precio: 1.50 },
  ];
  // 40 L: ahorro en precio = 0,05*40 = 2 €; desvío extra lejos ≈ 2*13*1.3 = 33,8 km -> 2,2 L * 1,50 = 3,3 € -> no compensa
  const r = calcular(estaciones, origen, null, { litros: 40, consumo: 6.5 });
  assert.equal(r.masBarataCartel.id, "lejos");
  assert.equal(r.mejor.id, "cerca");
  assert.ok(r.trampaCartel > 1);
});

test("si la diferencia de precio es grande, sí compensa ir lejos", () => {
  const estaciones = [
    { id: "cerca", rotulo: "Cerca", ...aEste(1), precio: 1.75 },
    { id: "lejos", rotulo: "Lejos", ...aEste(5), precio: 1.45 },
  ];
  const r = calcular(estaciones, origen, null, { litros: 50, consumo: 6 });
  assert.equal(r.mejor.id, "lejos");
  assert.ok(r.ahorroVsCercana > 0);
});

test("respeta el radio y devuelve null si no hay nada", () => {
  const r = calcular([{ id: "x", ...aEste(50), precio: 1.4 }], origen, null, { radioKm: 15 });
  assert.equal(r, null);
});

test("el valor del tiempo penaliza los desvíos", () => {
  const estaciones = [
    { id: "cerca", rotulo: "Cerca", ...aEste(1), precio: 1.60 },
    { id: "lejos", rotulo: "Lejos", ...aEste(4), precio: 1.52 },
  ];
  const sinTiempo = calcular(estaciones, origen, null, { litros: 50, consumo: 5 });
  const conTiempo = calcular(estaciones, origen, null, { litros: 50, consumo: 5, valorHora: 30 });
  assert.equal(sinTiempo.mejor.id, "lejos");
  assert.equal(conTiempo.mejor.id, "cerca");
});
