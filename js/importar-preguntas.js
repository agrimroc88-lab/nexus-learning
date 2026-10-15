// =====================================================================
// NEXUS LEARNING · CARGAR VARIAS PREGUNTAS A LA VEZ
// Carpeta: js/importar-preguntas.js
//
// Dos formas, con revisión antes de guardar:
//   1. Pegar texto (desde Word, PDF, WhatsApp…):
//        1. ¿Pregunta?
//        a) opción
//        *b) opción correcta        (o al final: "Respuesta: b")
//   2. Subir un Excel/CSV con columnas: Pregunta | A | B | C | D | Correcta
// Usa el curso abierto en admin.js (adm, cargarPreguntas, avisar).
// La administran administradores y docentes (las reglas RLS lo permiten).
// =====================================================================

const imp = { preguntas: [] };
const MAX_OPCIONES = 4;
const LETRAS = ["a", "b", "c", "d"];

el("btn-importar").addEventListener("click", function () {
  const b = el("bloque-importar");
  b.hidden = !b.hidden;
  if (!b.hidden) { reiniciarImportacion(); el("imp-texto").focus(); }
});
el("btn-cancelar-importar").addEventListener("click", function () { el("bloque-importar").hidden = true; });
el("btn-revisar-importar").addEventListener("click", function () {
  revisar(leerTexto(el("imp-texto").value));
});
el("imp-texto").addEventListener("input", function () { el("imp-revision").hidden = true; });

function reiniciarImportacion() {
  el("imp-texto").value = "";
  el("imp-archivo").value = "";
  el("imp-revision").hidden = true;
  imp.preguntas = [];
}

// ---------------------------------------------------------------------
// 1. Texto pegado
// ---------------------------------------------------------------------
function leerTexto(texto) {
  const lista = [];
  let actual = null;
  const reOpcion = /^\s*(\*)?\s*([a-dA-D])\s*[).:\-]\s*(.+?)\s*(\*|\(\s*correct[ao]\s*\)|✓|✔)?\s*$/;
  const reRespuesta = /^\s*(respuesta|correcta|resp\.?)(\s+correcta)?\s*[:\-]\s*([a-dA-D])\b/i;

  String(texto || "").replace(/\r/g, "").split("\n").forEach(function (linea) {
    if (!linea.trim()) return;
    const r = reRespuesta.exec(linea);
    if (r && actual) { actual.correctaLetra = r[3].toLowerCase(); return; }
    const o = reOpcion.exec(linea);
    if (o && actual) {
      actual.opciones.push(o[3].trim());
      if (o[1] || o[4]) actual.marcadas.push(actual.opciones.length - 1);
      return;
    }
    // Cualquier otra línea: una pregunta nueva (sin el número inicial)
    actual = {
      enunciado: linea.trim().replace(/^(pregunta\s*)?\d+\s*[).:\-]\s*/i, ""),
      opciones: [], marcadas: [], correctaLetra: null
    };
    lista.push(actual);
  });

  return lista.map(function (q) {
    let correcta = q.marcadas.length === 1 ? q.marcadas[0] : -1;
    if (q.correctaLetra) correcta = LETRAS.indexOf(q.correctaLetra);
    return { enunciado: q.enunciado, opciones: q.opciones, correcta: correcta, marcadasVarias: q.marcadas.length > 1 };
  });
}

// ---------------------------------------------------------------------
// 2. Archivo Excel o CSV
// ---------------------------------------------------------------------
// Lector/generador de Excel: se descarga solo cuando se usa (ahorra ~900 KB al abrir la página)
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (ok, falla) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = ok;
    s.onerror = function () { s.remove(); falla(new Error("xlsx")); };
    document.head.appendChild(s);
  });
}

el("imp-archivo").addEventListener("change", async function () {
  const archivo = el("imp-archivo").files[0];
  if (!archivo) return;
  try { await cargarXLSX(); } catch (e) { return avisar("No se pudo cargar el lector de Excel. Revisa tu conexión.", "error"); }
  try {
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", raw: false });
    revisar(leerFilas(filas));
  } catch (e) {
    console.error(e);
    avisar("No se pudo leer el archivo. Usa la plantilla de Excel (.xlsx) o un CSV.", "error");
  }
});

function leerFilas(filas) {
  const lista = [];
  filas.forEach(function (f, i) {
    const celdas = f.map(function (c) { return String(c).trim(); });
    if (!celdas.some(Boolean)) return;
    if (i === 0 && /pregunta/i.test(celdas[0])) return;   // encabezado
    const opciones = celdas.slice(1, 1 + MAX_OPCIONES).filter(Boolean);
    const marca = (celdas[5] || "").toLowerCase();
    let correcta = LETRAS.indexOf(marca.charAt(0));
    if (/^[1-4]$/.test(marca)) correcta = Number(marca) - 1;
    lista.push({ enunciado: celdas[0], opciones: opciones, correcta: correcta });
  });
  return lista;
}

el("btn-plantilla").addEventListener("click", async function () {
  try { await cargarXLSX(); } catch (e) { return avisar("No se pudo cargar el generador de Excel. Revisa tu conexión.", "error"); }
  const hoja = XLSX.utils.aoa_to_sheet([
    ["Pregunta", "Opción A", "Opción B", "Opción C", "Opción D", "Correcta (A, B, C o D)"],
    ["¿Qué es un peligro?", "Una sanción", "Una fuente con potencial de causar daño", "Un accidente", "", "B"],
    ["¿Quién debe usar el equipo de protección personal?", "Solo el supervisor", "Solo los visitantes", "Todo trabajador expuesto al riesgo", "", "C"]
  ]);
  hoja["!cols"] = [{ wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 22 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Preguntas");
  XLSX.writeFile(libro, "plantilla_preguntas.xlsx");
});

// ---------------------------------------------------------------------
// Revisión: muestra lo detectado y marca los errores
// ---------------------------------------------------------------------
function problemas(q) {
  const p = [];
  if (q.enunciado.length < 5) p.push("falta el texto de la pregunta");
  if (q.enunciado.length > 500) p.push("la pregunta es demasiado larga (máx. 500 caracteres)");
  if (q.opciones.length < 2) p.push("necesita al menos 2 opciones");
  if (q.opciones.length > MAX_OPCIONES) p.push("tiene más de 4 opciones");
  if (q.marcadasVarias) p.push("tiene más de una opción marcada como correcta");
  else if (q.correcta < 0 || q.correcta >= q.opciones.length) p.push("no se sabe cuál es la correcta");
  return p;
}

function revisar(lista) {
  imp.preguntas = lista.map(function (q) { return Object.assign(q, { errores: problemas(q) }); });
  const buenas = imp.preguntas.filter(function (q) { return q.errores.length === 0; }).length;
  const malas = imp.preguntas.length - buenas;

  const resumen = el("imp-resumen");
  if (imp.preguntas.length === 0) {
    resumen.className = "aviso error";
    resumen.textContent = "No se detectó ninguna pregunta. Revisa el formato (mira el ejemplo del recuadro).";
  } else {
    resumen.className = "aviso " + (malas ? "error" : "ok");
    resumen.textContent = buenas + (buenas === 1 ? " pregunta lista" : " preguntas listas") + " para agregar" +
      (malas ? " · " + malas + " con problemas (no se agregarán hasta que las corrijas)." : ".");
  }

  const ol = el("imp-lista");
  ol.innerHTML = "";
  imp.preguntas.forEach(function (q) {
    const li = document.createElement("li");
    li.className = q.errores.length ? "con-error" : "";
    const t = document.createElement("strong");
    t.textContent = q.enunciado || "(sin texto)";
    li.appendChild(t);
    const ul = document.createElement("ul");
    q.opciones.forEach(function (o, i) {
      const op = document.createElement("li");
      op.textContent = LETRAS[i] + ") " + o;
      if (i === q.correcta) op.className = "correcta";
      ul.appendChild(op);
    });
    li.appendChild(ul);
    if (q.errores.length) {
      const e = document.createElement("small");
      e.textContent = "Revisar: " + q.errores.join("; ") + ".";
      li.appendChild(e);
    }
    ol.appendChild(li);
  });

  el("btn-guardar-importar").disabled = buenas === 0;
  el("btn-guardar-importar").textContent = "Agregar " + buenas + (buenas === 1 ? " pregunta" : " preguntas");
  el("imp-revision").hidden = false;
  el("imp-revision").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

el("btn-guardar-importar").addEventListener("click", async function () {
  if (!adm.curso) return;
  const buenas = imp.preguntas.filter(function (q) { return q.errores.length === 0; });
  if (buenas.length === 0) return;

  let orden = siguienteOrden(adm.preguntas);
  const filas = buenas.map(function (q) {
    return { curso_id: adm.curso.id, orden: orden++, enunciado: q.enunciado, opciones: q.opciones, respuesta_correcta: q.correcta };
  });

  const boton = el("btn-guardar-importar");
  boton.disabled = true;
  const { error } = await nexusDb.from("cap_preguntas").insert(filas);
  boton.disabled = false;
  if (error) return errorSupabase(error, "No se pudieron agregar las preguntas.");

  el("bloque-importar").hidden = true;
  avisar(filas.length + (filas.length === 1 ? " pregunta agregada." : " preguntas agregadas."));
  await cargarPreguntas();
});
