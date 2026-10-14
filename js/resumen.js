// =====================================================================
// NEXUS LEARNING · RESUMEN (solo administradores)
// Carpeta: js/resumen.js
// Muestra las cifras de cap_resumen(): certificados del mes, personas
// capacitadas, certificados por mes, avance por empresa y programas.
// =====================================================================

const $r = (id) => document.getElementById(id);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

(async function iniciar() {
  const usuario = await exigirAdministrador();
  if (!usuario) return;
  mostrarUsuario(usuario, "admin");
  $r("cargando").hidden = true;
  $r("panel").hidden = false;
  $r("r-fecha").textContent = "Actualizado al " + new Date().toLocaleString("es-EC", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const { data, error } = await nexusDb.rpc("cap_resumen");
  if (error || !data) {
    console.error(error);
    const a = $r("aviso");
    a.className = "aviso error";
    a.textContent = "No se pudo cargar el resumen. Si es la primera vez, ejecuta en Supabase el archivo sql/capacitaciones_20_resumen.sql.";
    a.hidden = false;
    return;
  }
  pintarTotales(data.totales);
  pintarMeses(data.por_mes || []);
  pintarEmpresas(data.por_empresa || []);
  pintarProgramas(data.por_programa || []);
})();

$r("btn-salir").addEventListener("click", cerrarSesion);

const numero = (n) => Number(n || 0).toLocaleString("es-EC");

function pintarTotales(t) {
  $r("t-mes").textContent = numero(t.certificados_mes);
  $r("t-total").textContent = numero(t.certificados);
  $r("t-personas").textContent = numero(t.personas);
  $r("t-empresas").textContent = numero(t.empresas);
  $r("t-claves").textContent = numero(t.claves_vigentes);
  $r("t-nota").textContent = t.nota_promedio === null || t.nota_promedio === undefined
    ? "—" : Number(t.nota_promedio).toLocaleString("es-EC", { maximumFractionDigits: 1 }) + " %";
}

function nombreMes(ym, largo) {
  const p = ym.split("-");
  const m = MESES[Number(p[1]) - 1];
  return largo ? m + " " + p[0] : m;
}

// Gráfico de barras en SVG (una sola serie: el color de la marca).
// Etiqueta solo en el mes más alto y en el actual; el resto, al pasar el cursor.
function pintarMeses(meses) {
  const caja = $r("grafico-meses");
  caja.innerHTML = "";
  const W = 720, H = 240, M = { arriba: 22, abajo: 28, izq: 8, der: 8 };
  const alto = H - M.arriba - M.abajo;
  const max = Math.max(1, ...meses.map((m) => m.total));
  const paso = (W - M.izq - M.der) / Math.max(1, meses.length);
  const ancho = Math.min(36, paso * 0.62);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Certificados emitidos por mes en los últimos 12 meses");

  // Línea base
  const base = document.createElementNS(ns, "line");
  base.setAttribute("x1", M.izq); base.setAttribute("x2", W - M.der);
  base.setAttribute("y1", H - M.abajo); base.setAttribute("y2", H - M.abajo);
  base.setAttribute("class", "eje");
  svg.appendChild(base);

  const tip = document.createElement("div");
  tip.className = "tooltip-grafico";
  tip.hidden = true;

  const iMax = meses.reduce((im, m, i) => (m.total > meses[im].total ? i : im), 0);
  meses.forEach(function (m, i) {
    const cx = M.izq + paso * i + paso / 2;
    const h = m.total === 0 ? 0 : Math.max(4, (m.total / max) * alto);
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "barra-mes" + (i === meses.length - 1 ? " actual" : ""));

    // Zona sensible más grande que la barra (para el cursor y el dedo)
    const zona = document.createElementNS(ns, "rect");
    zona.setAttribute("x", cx - paso / 2); zona.setAttribute("y", M.arriba);
    zona.setAttribute("width", paso); zona.setAttribute("height", alto);
    zona.setAttribute("class", "zona");
    g.appendChild(zona);

    if (h > 0) {
      const barra = document.createElementNS(ns, "path");
      const x = cx - ancho / 2, y = H - M.abajo - h, r = Math.min(4, h, ancho / 2);
      barra.setAttribute("d", "M" + x + "," + (H - M.abajo) + " V" + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
        " H" + (x + ancho - r) + " Q" + (x + ancho) + "," + y + " " + (x + ancho) + "," + (y + r) + " V" + (H - M.abajo) + " Z");
      barra.setAttribute("class", "barra");
      g.appendChild(barra);
    }
    if ((i === iMax && m.total > 0) || i === meses.length - 1) {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", cx); t.setAttribute("y", H - M.abajo - h - 6);
      t.setAttribute("class", "valor");
      t.textContent = numero(m.total);
      g.appendChild(t);
    }
    const etiqueta = document.createElementNS(ns, "text");
    etiqueta.setAttribute("x", cx); etiqueta.setAttribute("y", H - 8);
    etiqueta.setAttribute("class", "mes");
    etiqueta.textContent = nombreMes(m.mes);
    g.appendChild(etiqueta);

    g.addEventListener("pointerenter", function () {
      tip.textContent = nombreMes(m.mes, true) + ": " + numero(m.total) + (m.total === 1 ? " certificado" : " certificados");
      tip.hidden = false;
      const caja2 = caja.getBoundingClientRect();
      tip.style.left = Math.min(caja2.width - 80, Math.max(80, (cx / W) * caja2.width)) + "px";
      tip.style.top = Math.max(0, ((H - M.abajo - h) / H) * caja2.height - 8) + "px";
    });
    g.addEventListener("pointerleave", function () { tip.hidden = true; });
    svg.appendChild(g);
  });

  caja.append(svg, tip);

  // Vista en tabla (accesible)
  const tbody = $r("tabla-meses");
  tbody.innerHTML = "";
  meses.forEach(function (m) {
    const tr = document.createElement("tr");
    [nombreMes(m.mes, true), numero(m.total)].forEach(function (v) {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function pintarEmpresas(lista) {
  const tbody = $r("tabla-empresas");
  tbody.innerHTML = "";
  if (lista.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Aún no hay empresas registradas.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  lista.forEach(function (e) {
    const tr = document.createElement("tr");
    if (!e.activa) tr.className = "inactiva";
    const nombre = document.createElement("td");
    nombre.textContent = e.nombre + (e.activa ? "" : " (inactiva)");
    const caps = document.createElement("td");
    caps.textContent = numero(e.capacitaciones);
    const personas = document.createElement("td");
    personas.textContent = numero(e.personas);

    const avance = document.createElement("td");
    if (e.trabajadores) {
      const pct = Math.min(100, Math.round((e.personas * 100) / e.trabajadores));
      const barra = document.createElement("div");
      barra.className = "medidor";
      barra.setAttribute("role", "img");
      barra.setAttribute("aria-label", pct + " % de " + e.trabajadores + " trabajadores");
      const relleno = document.createElement("span");
      relleno.style.width = pct + "%";
      barra.appendChild(relleno);
      const texto = document.createElement("small");
      texto.textContent = pct + " % de " + numero(e.trabajadores);
      avance.append(barra, texto);
    } else {
      avance.textContent = "Sin nº de trabajadores";
      avance.className = "apagado";
    }

    const ultima = document.createElement("td");
    ultima.textContent = e.ultima ? new Date(e.ultima).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) : "—";
    tr.append(nombre, caps, personas, avance, ultima);
    tbody.appendChild(tr);
  });
}

function pintarProgramas(lista) {
  const ol = $r("lista-programas");
  ol.innerHTML = "";
  if (lista.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = "Aún no hay certificados emitidos.";
    ol.appendChild(li);
    return;
  }
  const max = Math.max(1, ...lista.map((p) => p.total));
  lista.forEach(function (p) {
    const li = document.createElement("li");
    const fila = document.createElement("div");
    fila.className = "programa-fila";
    const t = document.createElement("span");
    t.textContent = p.titulo;
    const n = document.createElement("strong");
    n.textContent = numero(p.total);
    fila.append(t, n);
    const barra = document.createElement("div");
    barra.className = "medidor";
    const relleno = document.createElement("span");
    relleno.style.width = Math.max(2, Math.round((p.total * 100) / max)) + "%";
    barra.appendChild(relleno);
    li.append(fila, barra);
    ol.appendChild(li);
  });
}
