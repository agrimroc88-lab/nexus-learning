// =====================================================================
// NEXUS LEARNING · VERIFICACIÓN DE CERTIFICADOS
// Carpeta: js/verificar.js
// Consulta a Supabase si un código de certificado existe.
// La cédula llega parcialmente oculta desde la base de datos.
// =====================================================================

const formVerificar = document.getElementById("form-verificar");
const campoCodigo = document.getElementById("codigo");
const errorCodigo = document.getElementById("error-codigo");
const resultadoVerificar = document.getElementById("resultado");

// Si la página se abrió desde el QR o desde el inicio, el código viene en la dirección
(function codigoDesdeEnlace() {
  const codigo = new URLSearchParams(location.search).get("codigo");
  if (codigo) {
    campoCodigo.value = codigo.toUpperCase();
    verificar(codigo);
  } else {
    campoCodigo.focus();
  }
})();

campoCodigo.addEventListener("input", function () { errorCodigo.textContent = ""; });

formVerificar.addEventListener("submit", function (ev) {
  ev.preventDefault();
  const codigo = campoCodigo.value.trim();
  if (codigo.length < 6) {
    errorCodigo.textContent = "Escribe el código completo, por ejemplo VW-2026-A1B2C3D4.";
    campoCodigo.focus();
    return;
  }
  // Actualiza la dirección para poder compartir el enlace del resultado
  history.replaceState(null, "", "?codigo=" + encodeURIComponent(codigo.toUpperCase()));
  verificar(codigo);
});

async function verificar(codigo) {
  const boton = document.getElementById("btn-verificar");
  boton.disabled = true;
  boton.textContent = "Verificando…";
  resultadoVerificar.innerHTML = "";

  const { data, error } = await nexusDb.rpc("cap_verificar_certificado", {
    p_codigo: codigo.trim().toUpperCase()
  });

  boton.disabled = false;
  boton.textContent = "Verificar";

  if (error) {
    console.error(error);
    errorCodigo.textContent = "No se pudo consultar en este momento. Revisa tu conexión e inténtalo de nuevo.";
    return;
  }

  resultadoVerificar.appendChild(data ? fichaValida(data) : fichaInvalida(codigo));
}

// ---------------------------------------------------------------------
// Tarjetas de resultado (se construyen con textContent por seguridad)
// ---------------------------------------------------------------------
function cabecera(clase, titulo, subtitulo, icono) {
  const ficha = document.createElement("article");
  ficha.className = "ficha " + clase;

  const cab = document.createElement("div");
  cab.className = "ficha-cabecera";

  const sello = document.createElement("span");
  sello.className = "sello";
  sello.innerHTML = icono; // ícono fijo escrito aquí, no viene de la base de datos

  const textos = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.textContent = titulo;
  const p = document.createElement("p");
  p.textContent = subtitulo;
  textos.append(h2, p);

  cab.append(sello, textos);
  ficha.appendChild(cab);
  return ficha;
}

const ICONO_OK = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0F3D3E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_NO = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="#B3402A" stroke-width="3" stroke-linecap="round"/></svg>';

function fichaValida(c) {
  const ficha = cabecera("valida", "Certificado válido", "Emitido por Nexus Learning, de VitalWork S.A.S.", ICONO_OK);

  const dl = document.createElement("dl");
  dl.className = "ficha-datos";

  const horas = Number(c.horas);
  const esAsistencia = c.tipo === "asistencia";
  const filas = [
    ["Otorgado a", c.nombres, "ancho nombre"],
    ["Cédula o pasaporte", c.cedula],
    ["Empresa", c.empresa || "No registrada"],
    [esAsistencia ? "Capacitación" : "Curso aprobado", c.curso, "ancho"],
    ["Tipo de certificado", esAsistencia ? "Asistencia" : "Aprobación"],
    ["Modalidad", c.modalidad ? c.modalidad.charAt(0).toUpperCase() + c.modalidad.slice(1) : "Virtual"],
    ["Duración", horas === 1 ? "1 hora" : horas.toLocaleString("es-EC") + " horas"]
  ];
  if (!esAsistencia && c.nota !== null && c.nota !== undefined) {
    filas.push(["Calificación", Number(c.nota).toLocaleString("es-EC", { maximumFractionDigits: 1 }) + " %"]);
  }
  filas.push(["Fecha de emisión", new Date(c.emitido_en).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })]);
  filas.push(["Código", c.codigo]);

  filas.forEach(function (fila) {
    const div = document.createElement("div");
    const clases = (fila[2] || "").split(" ");
    if (clases.includes("ancho")) div.className = "ancho";
    const dt = document.createElement("dt");
    dt.textContent = fila[0];
    const dd = document.createElement("dd");
    dd.textContent = fila[1];
    if (clases.includes("nombre")) dd.className = "nombre";
    div.append(dt, dd);
    dl.appendChild(div);
  });

  ficha.appendChild(dl);
  return ficha;
}

function fichaInvalida(codigo) {
  const ficha = cabecera("invalida", "No encontramos este certificado", "Código consultado: " + codigo.toUpperCase(), ICONO_NO);
  const p = document.createElement("p");
  p.className = "ficha-texto";
  p.textContent = "Revisa que el código esté escrito exactamente como aparece en el certificado, incluidos los guiones. Si el problema continúa, el certificado podría no ser auténtico o haber sido anulado.";
  ficha.appendChild(p);
  return ficha;
}
