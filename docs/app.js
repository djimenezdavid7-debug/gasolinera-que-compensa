import { calcular } from "./calculo.js";

const API_MINISTERIO = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const NOMBRES = { g95: "Gasolina 95", g98: "Gasolina 98", diesel: "Diésel", dieselp: "Diésel premium", glp: "GLP" };
const $ = (id) => document.getElementById(id);
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const precioL = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " €/L";
const km = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " km";
const litrosTxt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " L";
const limpiar = (t) => (t || "").replace(/\s+/g, " ").trim();
const titulo = (t) => limpiar(t).toLowerCase().replace(/(^|[\s\-/(])\p{L}/gu, (m) => m.toUpperCase());

let datos = null;   // {campos, estaciones, fecha}
let origen = null;  // {lat, lon, texto}
let mapa = null, capa = null, ultimo = null;
const prefs = { combustible: "g95", litros: 40, consumo: 6.5 };

function estado(texto, error = false) {
  $("estado").textContent = texto;
  $("estado").className = "estado" + (error ? " error" : "");
}

// ---------- preferencias (se recuerdan en este navegador) ----------
function cargarPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem("gqc-prefs") || "{}")); } catch { /* sin almacenamiento */ }
  $("litros").value = prefs.litros;
  $("consumo").value = prefs.consumo;
  document.querySelectorAll(".chips").forEach((g) => marcarChip(g, String(prefs[g.dataset.campo])));
}
function guardarPrefs() {
  try { localStorage.setItem("gqc-prefs", JSON.stringify(prefs)); } catch { /* sin almacenamiento */ }
}
function marcarChip(grupo, valor) {
  grupo.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === valor));
}

// ---------- datos ----------
async function cargarDatos() {
  try {
    const r = await fetch("data/estaciones.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    datos = await r.json();
  } catch {
    estado("Descargando precios directamente del Ministerio (tarda un poco)…");
    const r = await fetch(API_MINISTERIO, { headers: { Accept: "application/json" } });
    const j = await r.json();
    const num = (t) => { const v = parseFloat(String(t || "").replace(",", ".")); return Number.isFinite(v) ? v : null; };
    const campos = { g95: "Precio Gasolina 95 E5", g98: "Precio Gasolina 98 E5", diesel: "Precio Gasoleo A",
                     dieselp: "Precio Gasoleo Premium", glp: "Precio Gases licuados del petróleo" };
    datos = {
      fecha: j.Fecha,
      campos: ["id", "rotulo", "direccion", "localidad", "lat", "lon", "horario", ...Object.keys(campos)],
      estaciones: j.ListaEESSPrecio.filter((e) => e["Tipo Venta"] === "P").map((e) => [
        e.IDEESS, e["Rótulo"], e["Dirección"], e.Localidad, num(e.Latitud), num(e["Longitud (WGS84)"]), e.Horario,
        ...Object.values(campos).map((c) => num(e[c]))]),
    };
  }
  $("fechaDatos").textContent = `Precios del ${datos.fecha}.`;
  estado(`${datos.estaciones.length.toLocaleString("es-ES")} gasolineras con precio de hoy. ¿Dónde estás?`);
}

function estacionesDe(combustible) {
  const i = datos.campos.indexOf(combustible);
  return datos.estaciones
    .filter((f) => f[i] && f[4] != null)
    .map((f) => ({ id: f[0], rotulo: titulo(f[1]) || "Gasolinera", direccion: titulo(f[2]), localidad: titulo(f[3]),
                   lat: f[4], lon: f[5], horario: f[6], precio: f[i] }));
}

// ---------- ubicación ----------
async function geocodificar(texto) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&accept-language=es&q=" +
              encodeURIComponent(texto);
  const j = await (await fetch(url)).json();
  if (!j.length) throw new Error(`No encuentro «${texto}». Prueba con calle y ciudad.`);
  return { lat: +j[0].lat, lon: +j[0].lon, texto: j[0].display_name.split(",").slice(0, 2).join(",") };
}

function miUbicacion() {
  if (!navigator.geolocation) { mostrarDireccion(); return estado("Tu navegador no da la ubicación: escribe una dirección.", true); }
  estado("Buscando dónde estás…");
  $("btnUbicacion").disabled = true;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      $("btnUbicacion").disabled = false;
      origen = { lat: p.coords.latitude, lon: p.coords.longitude, texto: "tu ubicación" };
      calcularYMostrar();
    },
    () => {
      $("btnUbicacion").disabled = false;
      mostrarDireccion();
      estado("No he podido usar tu ubicación. Escribe una dirección y pulsa Buscar.", true);
    },
    { enableHighAccuracy: true, timeout: 12000 });
}

function mostrarDireccion() {
  $("cajaDireccion").hidden = false;
  $("origenTexto").focus();
}

async function buscarDireccion() {
  const t = $("origenTexto").value.trim();
  if (!t) return estado("Escribe una dirección.", true);
  try {
    estado("Buscando la dirección…");
    origen = await geocodificar(t);
    calcularYMostrar();
  } catch (e) { estado(e.message, true); }
}

// ---------- cálculo y pintado ----------
async function calcularYMostrar() {
  if (!datos) return estado("Aún cargando precios, un segundo…", true);
  if (!origen) return;
  try {
    const textoD = $("destinoTexto").value.trim();
    const destino = textoD ? await geocodificar(textoD) : null;
    prefs.litros = +$("litros").value || 40;
    prefs.consumo = +$("consumo").value || 6.5;
    guardarPrefs();
    const res = calcular(estacionesDe(prefs.combustible), origen, destino, {
      litros: prefs.litros, consumo: prefs.consumo, radioKm: +$("radio").value || 15, valorHora: +$("valorHora").value || 0,
    });
    if (!res) throw new Error("No hay gasolineras con ese combustible cerca. Amplía «Buscar hasta» en «Afinar más».");
    ultimo = { res, destino };
    pintar(res, destino);
    estado(`Calculado desde ${origen.texto}. Cambia combustible o litros y se recalcula solo.`);
  } catch (e) {
    estado(e.message, true);
  }
}

const enlaceRuta = (e, destino) =>
  `https://www.google.com/maps/dir/?api=1&origin=${origen.lat},${origen.lon}&destination=${destino ? destino.lat + "," + destino.lon : e.lat + "," + e.lon}` +
  (destino ? `&waypoints=${e.lat},${e.lon}` : "") + "&travelmode=driving";

function pintar(res, destino) {
  const { mejor, masBarataCartel: barata, masCercana: cercana, opciones } = res;
  const primeraVez = $("resultado").hidden;
  $("resultado").hidden = false;

  const ahorro = res.ahorroVsCercana > 0.05;
  $("veredicto").innerHTML = `
    <div class="kicker">✅ La que más te compensa · ${litrosTxt(opciones.litros)} de ${NOMBRES[prefs.combustible]}</div>
    <div class="nombre-grande">${mejor.rotulo}</div>
    <div class="donde">${mejor.direccion} · ${mejor.localidad}</div>
    <div class="cifras">
      <div class="cifra"><b>${precioL(mejor.precio)}</b><span>precio</span></div>
      <div class="cifra"><b>${km(mejor.desvio)}</b><span>${destino ? "extra en tu ruta" : "ida y vuelta"}</span></div>
      <div class="cifra destacada"><b>${ahorro ? eur(res.ahorroVsCercana) : "✓"}</b>
        <span>${ahorro ? "ahorras vs. la más cercana" : "es también la más cercana"}</span></div>
    </div>
    <a class="ir" href="${enlaceRuta(mejor, destino)}" target="_blank" rel="noopener">🧭 Llévame ahí</a>`;

  const trampa = $("trampa");
  if (barata.id !== mejor.id && res.trampaCartel > 0.05) {
    trampa.hidden = false;
    trampa.innerHTML = `<div class="titulo">⚠️ Ojo: la más barata del cartel te sale más cara</div>
      ${barata.rotulo} (${barata.localidad}) anuncia ${precioL(barata.precio)}, pero son ${km(barata.desvio)} de desvío:
      gastarías ${litrosTxt(barata.litrosDesvio)} en ir y volver y pagarías <strong>${eur(res.trampaCartel)} más</strong> en total.`;
  } else {
    trampa.hidden = true;
  }

  $("ranking").innerHTML = res.ranking.slice(0, 10).map((e, i) => {
    const etq = [e.id === barata.id ? '<span class="etq r">más barata del cartel</span>' : "",
                 e.id === cercana.id ? '<span class="etq v">más cercana</span>' : ""].join("");
    return `<li class="${i === 0 ? "mejor" : ""}">
      <span class="pos">${i + 1}</span>
      <div><div class="nombre">${e.rotulo}${etq}</div>
        <div class="det">${precioL(e.precio)} · ${e.localidad} · ${km(e.desvio)} ·
          <a href="${enlaceRuta(e, destino)}" target="_blank" rel="noopener">ir</a></div></div>
      <div class="coste">${eur(e.costeReal)}<small>${i === 0 ? "la mejor" : "+" + eur(e.costeReal - mejor.costeReal)}</small></div>
    </li>`;
  }).join("");

  pintarMapa(res, destino);
  if (primeraVez) $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
}

function pintarMapa(res, destino) {
  if (!window.L) return;
  if (!mapa) {
    mapa = L.map("mapa", { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
  }
  if (capa) capa.remove();
  capa = L.layerGroup().addTo(mapa);
  const puntos = [[origen.lat, origen.lon]];
  L.circleMarker([origen.lat, origen.lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 })
    .bindPopup("Estás aquí").addTo(capa);
  if (destino) {
    L.circleMarker([destino.lat, destino.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#7c3aed", fillOpacity: 1 })
      .bindPopup("Destino").addTo(capa);
    puntos.push([destino.lat, destino.lon]);
  }
  const lista = res.ranking.slice(0, 10);
  if (!lista.some((e) => e.id === res.masBarataCartel.id)) lista.push(res.masBarataCartel);
  lista.reverse().forEach((e) => {
    const esMejor = e.id === res.mejor.id, esBarata = e.id === res.masBarataCartel.id;
    L.circleMarker([e.lat, e.lon], { radius: esMejor ? 12 : esBarata ? 9 : 6, color: "#fff", weight: 2,
      fillColor: esMejor ? "#0f8a62" : esBarata ? "#c2410c" : "#7b8781", fillOpacity: 1 })
      .bindPopup(`<b>${e.rotulo}</b><br>${precioL(e.precio)} · coste real ${eur(e.costeReal)}`).addTo(capa);
    puntos.push([e.lat, e.lon]);
  });
  mapa.fitBounds(puntos, { padding: [28, 28] });
  setTimeout(() => mapa.invalidateSize(), 60);
}

async function compartir() {
  const url = location.href.split("#")[0];
  let texto = "⛽ ¿La gasolinera más barata te sale más cara? Calcula cuál te compensa de verdad:";
  if (ultimo) {
    const { res } = ultimo;
    texto = res.trampaCartel > 0.05
      ? `⛽ La gasolinera más barata de mi zona me habría salido ${eur(res.trampaCartel)} MÁS CARA por el desvío. Mira la tuya:`
      : `⛽ He encontrado la gasolinera que de verdad me compensa: ${eur(res.ahorroVsCercana)} menos que la de al lado. Mira la tuya:`;
  }
  try {
    if (navigator.share) await navigator.share({ title: "Gasolinera que compensa", text: texto, url });
    else { await navigator.clipboard.writeText(`${texto} ${url}`); estado("Enlace copiado: pégalo donde quieras."); }
  } catch { /* cancelado */ }
}

// ---------- eventos ----------
document.querySelectorAll(".chips").forEach((grupo) => grupo.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  const campo = grupo.dataset.campo;
  prefs[campo] = campo === "combustible" ? b.dataset.v : +b.dataset.v;
  marcarChip(grupo, b.dataset.v);
  if (campo !== "combustible") $(campo).value = b.dataset.v;
  guardarPrefs();
  calcularYMostrar();
}));
["litros", "consumo"].forEach((id) => $(id).addEventListener("change", () => {
  document.querySelectorAll(`.chips[data-campo="${id}"]`).forEach((g) => marcarChip(g, String(+$(id).value)));
  calcularYMostrar();
}));
["radio", "valorHora"].forEach((id) => $(id).addEventListener("change", calcularYMostrar));
$("destinoTexto").addEventListener("change", calcularYMostrar);
$("btnUbicacion").addEventListener("click", miUbicacion);
$("btnDireccion").addEventListener("click", mostrarDireccion);
$("btnBuscar").addEventListener("click", buscarDireccion);
$("origenTexto").addEventListener("keydown", (e) => { if (e.key === "Enter") buscarDireccion(); });
$("btnCompartir").addEventListener("click", compartir);
cargarPrefs();
cargarDatos().catch(() => estado("No se han podido cargar los precios. Recarga la página.", true));
