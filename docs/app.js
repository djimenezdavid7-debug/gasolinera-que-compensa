import { calcular } from "./calculo.js";

const API_MINISTERIO = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const NOMBRES = { g95: "Gasolina 95", g98: "Gasolina 98", diesel: "Diésel", dieselp: "Diésel premium", glp: "GLP" };
const $ = (id) => document.getElementById(id);
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const precioL = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " €/L";
const km = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " km";

let datos = null;          // {campos, estaciones, fecha}
let origen = null;         // {lat, lon, texto}
let mapa = null, capa = null, ultimo = null;

function estado(texto, error = false) {
  $("estado").textContent = texto;
  $("estado").className = "estado" + (error ? " error" : "");
}

// ---------- datos ----------
async function cargarDatos() {
  try {
    const r = await fetch("data/estaciones.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    datos = await r.json();
  } catch {
    // Plan B: directamente de la API oficial (permite CORS), 12 MB
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
  $("fechaDatos").textContent = `Última actualización: ${datos.fecha}.`;
  estado(`${datos.estaciones.length.toLocaleString("es-ES")} gasolineras cargadas. Dinos dónde estás.`);
}

function estacionesDe(combustible) {
  const i = datos.campos.indexOf(combustible);
  return datos.estaciones
    .filter((f) => f[i] && f[4] != null)
    .map((f) => ({ id: f[0], rotulo: f[1] || "Gasolinera", direccion: f[2], localidad: f[3], lat: f[4], lon: f[5],
                   horario: f[6], precio: f[i] }));
}

// ---------- ubicación ----------
async function geocodificar(texto) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&accept-language=es&q=" +
              encodeURIComponent(texto);
  const r = await fetch(url);
  const j = await r.json();
  if (!j.length) throw new Error(`No encuentro «${texto}»`);
  return { lat: +j[0].lat, lon: +j[0].lon, texto: j[0].display_name.split(",").slice(0, 2).join(",") };
}

function miUbicacion() {
  if (!navigator.geolocation) return estado("Tu navegador no permite la ubicación: escribe una dirección.", true);
  estado("Buscando tu ubicación…");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      origen = { lat: p.coords.latitude, lon: p.coords.longitude, texto: "Tu ubicación" };
      $("origenTexto").value = "📍 Tu ubicación";
      estado("Ubicación lista.");
      calcularYMostrar();
    },
    () => estado("No he podido obtener tu ubicación: escribe una dirección.", true),
    { enableHighAccuracy: true, timeout: 10000 });
}

// ---------- cálculo y pintado ----------
async function calcularYMostrar() {
  if (!datos) return estado("Aún cargando precios…", true);
  const btn = $("btnCalcular");
  btn.disabled = true;
  try {
    const textoO = $("origenTexto").value.trim();
    if (!origen || (textoO && !textoO.startsWith("📍") && textoO !== origen.texto)) {
      if (!textoO) throw new Error("Dinos dónde estás (o pulsa «Mi ubicación»).");
      estado("Buscando la dirección…");
      origen = await geocodificar(textoO);
    }
    const textoD = $("destinoTexto").value.trim();
    const destino = textoD ? await geocodificar(textoD) : null;
    const combustible = $("combustible").value;
    const res = calcular(estacionesDe(combustible), origen, destino, {
      litros: +$("litros").value, consumo: +$("consumo").value, radioKm: +$("radio").value,
      valorHora: +$("valorHora").value, factorCarretera: +$("factor").value,
    });
    if (!res) throw new Error("No hay gasolineras con ese combustible en el radio elegido. Amplía «Buscar hasta».");
    ultimo = { res, combustible, destino };
    pintar(res, combustible, destino);
    estado("");
  } catch (e) {
    estado(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

const enlaceRuta = (e, destino) =>
  `https://www.google.com/maps/dir/?api=1&origin=${origen.lat},${origen.lon}&destination=${destino ? destino.lat + "," + destino.lon : e.lat + "," + e.lon}` +
  (destino ? `&waypoints=${e.lat},${e.lon}` : "") + "&travelmode=driving";

function pintar(res, combustible, destino) {
  const { mejor, masBarataCartel: barata, masCercana: cercana, opciones } = res;
  $("resultado").hidden = false;

  const vsCercana = res.ahorroVsCercana > 0.05
    ? `Te ahorras <span class="ahorro">${eur(res.ahorroVsCercana)}</span> frente a la más cercana (${cercana.rotulo}, ${precioL(cercana.precio)}).`
    : "Es también la más cercana: no hace falta desviarse.";
  $("veredicto").innerHTML = `
    <div>✅ La que más te compensa para ${opciones.litros} L de ${NOMBRES[combustible]}:</div>
    <div class="grande">${mejor.rotulo} · ${precioL(mejor.precio)}</div>
    <div>${mejor.direccion}, ${mejor.localidad} · desvío ${km(mejor.desvio)} · coste total ${eur(mejor.costeReal)}</div>
    <div style="margin-top:6px">${vsCercana}</div>
    <div style="margin-top:8px"><a href="${enlaceRuta(mejor, destino)}" target="_blank" rel="noopener">🧭 Cómo llegar</a></div>`;

  const trampa = $("trampa");
  if (barata.id !== mejor.id && res.trampaCartel > 0.05) {
    trampa.hidden = false;
    trampa.innerHTML = `⚠️ <strong>La más barata del cartel te sale más cara.</strong> ${barata.rotulo} (${barata.localidad})
      anuncia ${precioL(barata.precio)}, pero está a ${km(barata.desvio)} de desvío: gastas ${barata.litrosDesvio.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L
      en ir y volver y al final pagas <strong>${eur(res.trampaCartel)} más</strong>.`;
  } else {
    trampa.hidden = true;
  }

  $("ranking").innerHTML = res.ranking.slice(0, 10).map((e, i) => {
    const etq = [e.id === barata.id ? '<span class="etq r">más barata del cartel</span>' : "",
                 e.id === cercana.id ? '<span class="etq v">más cercana</span>' : ""].join("");
    const extra = opciones.valorHora ? ` + tiempo ${eur(e.costeTiempo)}` : "";
    return `<li class="${i === 0 ? "mejor" : ""}">
      <span class="pos">${i + 1}</span>
      <div><div class="nombre">${e.rotulo} ${etq}</div>
        <div class="det">${precioL(e.precio)} · ${e.localidad} · desvío ${km(e.desvio)} (${eur(e.costeDesvio)}${extra}) ·
          <a href="${enlaceRuta(e, destino)}" target="_blank" rel="noopener">ruta</a></div></div>
      <div class="coste">${eur(e.costeReal)}<small>${i === 0 ? "la mejor" : "+" + eur(e.costeReal - mejor.costeReal)}</small></div>
    </li>`;
  }).join("");

  pintarMapa(res, destino);
  $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
}

function pintarMapa(res, destino) {
  if (!window.L) return;
  if (!mapa) {
    mapa = L.map("mapa");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
  }
  if (capa) capa.remove();
  capa = L.layerGroup().addTo(mapa);
  const puntos = [[origen.lat, origen.lon]];
  L.circleMarker([origen.lat, origen.lon], { radius: 8, color: "#2563eb", fillOpacity: .9 }).bindPopup("Estás aquí").addTo(capa);
  if (destino) {
    L.circleMarker([destino.lat, destino.lon], { radius: 8, color: "#7c3aed", fillOpacity: .9 }).bindPopup("Destino").addTo(capa);
    puntos.push([destino.lat, destino.lon]);
  }
  res.ranking.slice(0, 10).reverse().forEach((e) => {
    const esMejor = e.id === res.mejor.id, esBarata = e.id === res.masBarataCartel.id;
    L.circleMarker([e.lat, e.lon], { radius: esMejor ? 11 : 7, color: esMejor ? "#12805c" : esBarata ? "#c2410c" : "#6b7280",
      fillOpacity: .85 }).bindPopup(`<b>${e.rotulo}</b><br>${precioL(e.precio)}<br>Coste real ${eur(e.costeReal)}`).addTo(capa);
    puntos.push([e.lat, e.lon]);
  });
  mapa.fitBounds(puntos, { padding: [30, 30] });
  setTimeout(() => mapa.invalidateSize(), 50);
}

async function compartir() {
  if (!ultimo) return;
  const { res } = ultimo;
  const texto = res.trampaCartel > 0.05
    ? `⛽ La gasolinera más barata de mi zona me habría salido ${eur(res.trampaCartel)} MÁS CARA por el desvío. Calcula la tuya:`
    : `⛽ He encontrado la gasolinera que de verdad me compensa (${eur(res.ahorroVsCercana)} menos que la de al lado). Calcula la tuya:`;
  const url = location.href.split("#")[0];
  try {
    if (navigator.share) await navigator.share({ title: "Gasolinera que compensa", text: texto, url });
    else { await navigator.clipboard.writeText(`${texto} ${url}`); estado("Texto copiado: pégalo donde quieras."); }
  } catch { /* cancelado */ }
}

// ---------- eventos ----------
$("btnUbicacion").addEventListener("click", miUbicacion);
$("btnCalcular").addEventListener("click", calcularYMostrar);
$("btnCompartir").addEventListener("click", compartir);
$("origenTexto").addEventListener("input", () => { if (origen && origen.texto === "Tu ubicación") origen = null; });
["origenTexto", "destinoTexto"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") calcularYMostrar(); }));
cargarDatos().catch(() => estado("No se han podido cargar los precios. Prueba a recargar.", true));
