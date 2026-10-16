// =====================================================================
// NEXUS ACADEMY · APARIENCIA DEL SITIO (solo administradores)
// Carpeta: js/apariencia.js
//
// Edita la fila única de cap_apariencia: colores, foto y textos del
// banner. config.js la aplica en todas las páginas. La foto se guarda en
// el espacio "portadas", carpeta "sitio/".
// =====================================================================

const $p = (id) => document.getElementById(id);

// Valores originales del diseño (iguales a css/estilos.css e index.html)
const ORIGINAL = {
  color_principal: "#123A7A",
  color_acento: "#E3B341",
  color_fondo: "#E8EEF7",
  banner_etiqueta: "Capacitación en Seguridad y Salud Ocupacional",
  banner_titulo: "Capacitación laboral que se puede comprobar",
  banner_texto: "Escribe la clave de acceso que te dio tu empresa o escanea el código QR de la capacitación."
};
const COLORES = [["c-principal", "t-principal", "color_principal"], ["c-acento", "t-acento", "color_acento"], ["c-fondo", "t-fondo", "color_fondo"]];

let actual = null;        // fila guardada en la base
let urlFotoNueva = null;  // vista previa de una foto elegida y aún no guardada

(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;
  mostrarUsuario(usuario, "admin");

  const { data, error } = await nexusDb.from("cap_apariencia").select("*").eq("id", 1).maybeSingle();
  $p("cargando").hidden = true;
  $p("panel").hidden = false;
  if (error || !data) {
    console.error(error);
    return avisar("No se encontró la configuración de apariencia. Ejecuta en Supabase el archivo sql/capacitaciones_16_apariencia.sql.", "error");
  }
  actual = data;
  llenar(data);
})();

$p("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $p("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
  a.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(avisar.t);
  if (tipo !== "error") avisar.t = setTimeout(function () { a.hidden = true; }, 4000);
}

// ---------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------
function llenar(ap) {
  COLORES.forEach(function (c) { $p(c[0]).value = (ap[c[2]] || ORIGINAL[c[2]]).toLowerCase(); });
  $p("b-etiqueta").value = ap.banner_etiqueta || "";
  $p("b-titulo").value = ap.banner_titulo || "";
  $p("b-texto").value = ap.banner_texto || "";
  $p("b-etiqueta").placeholder = ORIGINAL.banner_etiqueta;
  $p("b-titulo").placeholder = ORIGINAL.banner_titulo;
  $p("b-texto").placeholder = ORIGINAL.banner_texto;
  $p("b-imagen").value = "";
  $p("b-quitar").checked = false;
  $p("b-quitar-caja").hidden = !ap.banner_imagen;
  urlFotoNueva = null;
  actualizarVista();
}

// Lo que hay ahora en el formulario, con el formato de la tabla
function leerFormulario() {
  const ap = {};
  COLORES.forEach(function (c) {
    const v = $p(c[0]).value.toUpperCase();
    ap[c[2]] = v === ORIGINAL[c[2]].toUpperCase() ? null : v;   // igual al original = vacío
  });
  ap.banner_etiqueta = $p("b-etiqueta").value.trim() || null;
  ap.banner_titulo = $p("b-titulo").value.trim() || null;
  ap.banner_texto = $p("b-texto").value.trim() || null;
  return ap;
}

document.querySelectorAll("#form-apariencia input, #form-apariencia textarea").forEach(function (c) {
  if (c.type !== "file") c.addEventListener("input", actualizarVista);
});
$p("b-quitar").addEventListener("change", actualizarVista);
$p("b-imagen").addEventListener("change", function () {
  const archivo = $p("b-imagen").files[0];
  if (urlFotoNueva) URL.revokeObjectURL(urlFotoNueva);
  urlFotoNueva = archivo ? URL.createObjectURL(archivo) : null;
  actualizarVista();
});

$p("btn-colores-originales").addEventListener("click", function () {
  COLORES.forEach(function (c) { $p(c[0]).value = ORIGINAL[c[2]].toLowerCase(); });
  actualizarVista();
});

// ---------------------------------------------------------------------
// Vista previa en vivo (también colorea esta misma página)
// ---------------------------------------------------------------------
function actualizarVista() {
  const ap = leerFormulario();
  COLORES.forEach(function (c) { $p(c[1]).textContent = $p(c[0]).value.toUpperCase(); });

  const principal = ap.color_principal || ORIGINAL.color_principal;
  const acento = ap.color_acento || ORIGINAL.color_acento;
  const fondo = ap.color_fondo || ORIGINAL.color_fondo;
  const vp = $p("vista-previa").style;
  vp.setProperty("--vp-principal", principal);
  vp.setProperty("--vp-noche", nexusMezclar(principal, "#000000", 0.28));
  vp.setProperty("--vp-claro", nexusMezclar(principal, "#FFFFFF", 0.18));
  vp.setProperty("--vp-acento", acento);
  vp.setProperty("--vp-fondo", fondo);

  $p("vp-etiqueta").textContent = ap.banner_etiqueta || ORIGINAL.banner_etiqueta;
  $p("vp-titulo").textContent = ap.banner_titulo || ORIGINAL.banner_titulo;
  $p("vp-texto").textContent = ap.banner_texto || ORIGINAL.banner_texto;

  let foto = null;
  if (urlFotoNueva) foto = urlFotoNueva;
  else if (actual && actual.banner_imagen && !$p("b-quitar").checked) {
    foto = nexusDb.storage.from("portadas").getPublicUrl(actual.banner_imagen).data.publicUrl;
  }
  $p("vp-banner").style.backgroundImage = foto ? "url(\"" + foto + "\")" : "";
  $p("vp-banner").classList.toggle("con-foto", !!foto);

  aplicarApariencia(ap);
  revisarContraste(principal, acento, fondo);
}

// Contraste según WCAG: evita combinaciones que no se puedan leer
function luminancia(hex) {
  const c = [1, 3, 5].map(function (i) {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const l1 = luminancia(a), l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function revisarContraste(principal, acento, fondo) {
  const problemas = [];
  if (contraste(principal, "#FFFFFF") < 4.5) problemas.push("El color principal es muy claro: el texto blanco encima no se leerá. Elige un tono más oscuro.");
  if (contraste(acento, principal) < 3) problemas.push("El color de acento y el principal se parecen demasiado: el texto de los botones no se leerá. Elige un acento más claro o más vivo.");
  if (luminancia(fondo) < 0.6) problemas.push("El fondo del área de cursos es muy oscuro. Elige un tono más claro.");
  const caja = $p("aviso-contraste");
  caja.textContent = problemas.join(" ");
  caja.hidden = problemas.length === 0;
  return problemas.length === 0;
}

// ---------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------
$p("form-apariencia").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  if (!actual) return;
  const ap = leerFormulario();
  if (!revisarContraste(ap.color_principal || ORIGINAL.color_principal, ap.color_acento || ORIGINAL.color_acento, ap.color_fondo || ORIGINAL.color_fondo)) {
    return avisar("Corrige los colores marcados en rojo antes de guardar.", "error");
  }

  const archivo = $p("b-imagen").files[0] || null;
  if (archivo) {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return avisar("La foto debe ser JPG, PNG o WEBP.", "error");
    if (archivo.size > 2 * 1024 * 1024) return avisar("La foto pesa más de 2 MB. Redúcela e inténtalo de nuevo.", "error");
  }

  const boton = $p("btn-guardar");
  boton.disabled = true;
  boton.textContent = archivo ? "Subiendo foto…" : "Guardando…";

  const anterior = actual.banner_imagen;
  let nueva = null;
  try {
    if (archivo) {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[archivo.type];
      nueva = "sitio/" + ((crypto.randomUUID && crypto.randomUUID()) || Date.now()) + "." + ext;
      const subida = await nexusDb.storage.from("portadas").upload(nueva, archivo, { contentType: archivo.type, upsert: false });
      if (subida.error) throw subida.error;
      ap.banner_imagen = nueva;
    } else if (anterior && $p("b-quitar").checked) {
      ap.banner_imagen = null;
    }
    ap.actualizado_en = new Date().toISOString();

    const r = await nexusDb.from("cap_apariencia").update(ap).eq("id", 1).select().single();
    if (r.error) throw r.error;
    actual = r.data;
  } catch (e) {
    console.error(e);
    if (nueva) await nexusDb.storage.from("portadas").remove([nueva]);
    boton.disabled = false;
    boton.textContent = "Guardar apariencia";
    return avisar("No se pudo guardar. Detalle: " + (e.message || "error desconocido"), "error");
  }

  // La foto anterior ya no se usa
  if (anterior && anterior !== actual.banner_imagen) {
    await nexusDb.storage.from("portadas").remove([anterior]);
  }
  try { localStorage.setItem(NEXUS_APARIENCIA_MEMORIA, JSON.stringify(actual)); } catch (e) { /* sin memoria */ }

  boton.disabled = false;
  boton.textContent = "Guardar apariencia";
  llenar(actual);
  avisar("Apariencia guardada. Ya se ve en todo el sitio.");
});
