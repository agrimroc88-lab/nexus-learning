// =====================================================================
// NEXUS LEARNING · MIS CERTIFICADOS (estudiantes)
// Carpeta: js/mis-certificados.js
//
// La persona escribe su cédula y su fecha de nacimiento (la que registró
// al inscribirse) y descarga de nuevo sus certificados. La comprobación
// y el límite de intentos están en Supabase (cap_mis_certificados).
// =====================================================================

const $m = (id) => document.getElementById(id);

$m("form-buscar").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  const cedula = $m("m-cedula").value.replace(/\s/g, "");
  const nacimiento = $m("m-nacimiento").value;
  const error = $m("m-error");
  error.hidden = true;

  if (cedula.length < 5 || !nacimiento) {
    error.textContent = "Escribe tu cédula y tu fecha de nacimiento.";
    error.hidden = false;
    return;
  }

  const boton = $m("btn-buscar");
  boton.disabled = true;
  boton.textContent = "Buscando…";
  const { data, error: e } = await nexusDb.rpc("cap_mis_certificados", { p_cedula: cedula, p_nacimiento: nacimiento });
  boton.disabled = false;
  boton.textContent = "Buscar mis certificados";

  if (e || !data || !data.ok) {
    if (e) console.error(e);
    error.textContent = (data && data.mensaje) || "No se pudo hacer la búsqueda. Revisa tu conexión e inténtalo de nuevo.";
    error.hidden = false;
    return;
  }
  pintar(data.certificados || []);
});

function pintar(lista) {
  $m("form-buscar").hidden = true;
  $m("resultado").hidden = false;
  $m("m-titulo").textContent = lista.length === 0
    ? "Aún no tienes certificados emitidos"
    : (lista.length === 1 ? "Tienes 1 certificado" : "Tienes " + lista.length + " certificados");

  const ol = $m("m-lista");
  ol.innerHTML = "";
  lista.forEach(function (c) {
    const li = document.createElement("li");
    li.className = "item-jornada";
    const info = document.createElement("div");
    const t = document.createElement("strong");
    t.textContent = c.curso;
    const d = document.createElement("small");
    const partes = [c.tipo === "asistencia" ? "Asistencia" : "Aprobación", formatearHoras(c.horas)];
    if (c.empresa) partes.push(c.empresa);
    partes.push(new Date(c.emitido_en).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }));
    d.textContent = partes.join(" · ") + " · Código " + c.codigo;
    info.append(t, d);

    const acciones = document.createElement("div");
    acciones.className = "accion-jornada";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "boton boton-chico";
    b.textContent = "Descargar";
    b.addEventListener("click", function () {
      try { NexusCertificado.generar(c); }
      catch (err) { console.error(err); alert("No se pudo generar el PDF. Recarga la página e inténtalo de nuevo."); }
    });
    acciones.appendChild(b);
    li.append(info, acciones);
    ol.appendChild(li);
  });
}

$m("btn-otra").addEventListener("click", function () {
  $m("resultado").hidden = true;
  $m("form-buscar").hidden = false;
  $m("m-cedula").value = "";
  $m("m-nacimiento").value = "";
  $m("m-cedula").focus();
});

function formatearHoras(horas) {
  const n = Number(horas);
  return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
}
