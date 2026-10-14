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
  // Base de datos de NEXUS: permite entrar aquí con la cédula y la
  // contraseña de NEXUS (se validan en NEXUS; aquí no se guardan).
  // Clave pública (anon) por diseño, la misma que usa NEXUS en js/supabase.js.
  nexusSupabaseUrl: "https://ydqwkxpkjwydxownwapv.supabase.co",
  nexusSupabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcXdreHBrand5ZHhvd253YXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzY4ODQsImV4cCI6MjA5OTgxMjg4NH0.QWuQaipGukrMipJ1Z3TmP3t66ggsHzb1Fe-QROJiXrw"
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

// =====================================================================
// APARIENCIA (colores, foto y textos del banner)
// La define el administrador en apariencia.html y se guarda en Supabase
// (tabla cap_apariencia). Se recuerda en el navegador para aplicarla al
// instante en la siguiente visita, y luego se actualiza desde la base.
// =====================================================================
const NEXUS_APARIENCIA_MEMORIA = "nexus_apariencia";

// Mezcla dos colores #RRGGBB (p = cuánto del segundo, de 0 a 1)
function nexusMezclar(c1, c2, p) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const canal = function (desp) {
    const x = (a >> desp) & 255, y = (b >> desp) & 255;
    return Math.round(x + (y - x) * p);
  };
  return "#" + [16, 8, 0].map(function (d) { return canal(d).toString(16).padStart(2, "0"); }).join("");
}

function aplicarApariencia(ap) {
  if (!ap) return;
  const raiz = document.documentElement.style;
  const hex = /^#[0-9A-Fa-f]{6}$/;
  // Vacío = se quita el ajuste y vuelve el color original de estilos.css
  if (hex.test(ap.color_principal || "")) {
    raiz.setProperty("--pino", ap.color_principal);
    raiz.setProperty("--pino-claro", nexusMezclar(ap.color_principal, "#FFFFFF", 0.18));
    raiz.setProperty("--pino-noche", nexusMezclar(ap.color_principal, "#000000", 0.28));
  } else {
    ["--pino", "--pino-claro", "--pino-noche"].forEach(function (v) { raiz.removeProperty(v); });
  }
  if (hex.test(ap.color_acento || "")) raiz.setProperty("--senal", ap.color_acento);
  else raiz.removeProperty("--senal");
  if (hex.test(ap.color_fondo || "")) raiz.setProperty("--zona", ap.color_fondo);
  else raiz.removeProperty("--zona");
}

// 1. Lo recordado: sin esperar a la base (evita el parpadeo de colores)
try { aplicarApariencia(JSON.parse(localStorage.getItem(NEXUS_APARIENCIA_MEMORIA))); } catch (e) { /* sin memoria */ }

// 2. Lo vigente en la base. Avisa a la página con el evento "nexus:apariencia".
nexusDb.from("cap_apariencia").select("*").eq("id", 1).maybeSingle().then(function (r) {
  if (r.error || !r.data) return;
  aplicarApariencia(r.data);
  try { localStorage.setItem(NEXUS_APARIENCIA_MEMORIA, JSON.stringify(r.data)); } catch (e) { /* sin memoria */ }
  document.dispatchEvent(new CustomEvent("nexus:apariencia", { detail: r.data }));
});

// Lo último conocido (para las páginas que lo necesitan al cargar)
function aparienciaGuardada() {
  try { return JSON.parse(localStorage.getItem(NEXUS_APARIENCIA_MEMORIA)); } catch (e) { return null; }
}
