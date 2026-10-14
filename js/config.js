// =====================================================================
// NEXUS LEARNING · CONFIGURACIÓN Y CONEXIÓN A SUPABASE
// Carpeta: js/config.js
//
// Estos dos datos son PÚBLICOS por diseño: la seguridad real la dan las
// reglas (RLS) y funciones configuradas en Supabase.
// ⚠️ NUNCA pongas aquí la "secret key" ni la "service_role key".
// =====================================================================

const NEXUS_CONFIG = {
  supabaseUrl: "https://yfmefiytswvxsqmnmrvg.supabase.co",
  supabaseKey: "sb_publishable_F3cIyhfFGoPurU4D0sNVWQ_jLugMPCO",
  nombrePlataforma: "Nexus Learning",
  empresa: "VitalWork S.A.S.",
  // Los administradores pueden ingresar con su cédula. Por dentro, su
  // cuenta en Supabase es "CEDULA@" + este dominio (no recibe correos).
  dominioCedula: "nexuslearning.local",
  // Ecosistema: dirección de NEXUS (Seguridad y Salud Ocupacional).
  // Si cambia el dominio, se cambia solo aquí.
  nexusUrl: "https://agrimroc88-lab.github.io/Nexus/",
  // Foto del encabezado de la página de inicio (opcional).
  // Ejemplo: "img/portada.jpg". Vacío = fondo de color de la marca.
  imagenPortada: ""
};

// Llena todos los enlaces marcados con data-nexus="ruta" con la dirección de NEXUS
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-nexus]").forEach(function (a) {
    a.href = NEXUS_CONFIG.nexusUrl + (a.getAttribute("data-nexus") || "");
  });
});

// Convierte lo que escribe la persona (cédula o correo) en el correo de la cuenta
function nexusCorreoDeUsuario(texto) {
  const t = String(texto || "").trim().toLowerCase();
  if (t.includes("@")) return t;
  const cedula = t.replace(/\D/g, "");
  return cedula ? cedula + "@" + NEXUS_CONFIG.dominioCedula : "";
}

// Lo que se muestra en pantalla: la cédula si la cuenta es por cédula
function nexusUsuarioVisible(correo) {
  const sufijo = "@" + NEXUS_CONFIG.dominioCedula;
  return correo && correo.endsWith(sufijo) ? "Cédula " + correo.slice(0, -sufijo.length) : correo;
}

// Portada de un curso: la imagen subida o, si no hay, una portada de color
// con las iniciales del título (siempre la misma para el mismo título).
const NEXUS_TONOS = [
  ["#0F3D3E", "#1C5C5D"], ["#14532D", "#2F7A4A"], ["#1E3A5F", "#2F5D8A"],
  ["#5B3A1A", "#8A5A2B"], ["#3F2D56", "#62478A"], ["#7A2E1F", "#A64A33"]
];
function pintarPortada(caja, titulo, url) {
  caja.innerHTML = "";
  caja.classList.add("portada");
  if (url) {
    caja.style.background = "";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    caja.appendChild(img);
    return;
  }
  let h = 0;
  for (const c of String(titulo)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tono = NEXUS_TONOS[h % NEXUS_TONOS.length];
  caja.style.background = "linear-gradient(135deg, " + tono[0] + ", " + tono[1] + ")";
  const iniciales = String(titulo).split(/\s+/).filter(function (p) { return p.length > 2; })
    .slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join("") || "NL";
  const span = document.createElement("span");
  span.textContent = iniciales;
  caja.appendChild(span);
}

// Crea la conexión que usarán todas las páginas.
// Requiere que el HTML cargue antes la librería de Supabase.
if (!window.supabase) {
  console.error("Nexus Learning: falta cargar la librería de Supabase antes de config.js");
}
const nexusDb = window.supabase.createClient(NEXUS_CONFIG.supabaseUrl, NEXUS_CONFIG.supabaseKey);
