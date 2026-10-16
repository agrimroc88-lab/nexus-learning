// =====================================================================
// NEXUS ACADEMY · JUEGOS PARA LA CHARLA (docentes y administradores)
// Carpeta: js/charla.js
//
// Lista los juegos de cada programa (los asignados a sus lecciones) y la
// biblioteca completa. "Presentar" abre el juego en grande para
// proyectarlo y jugarlo con el grupo. charla.html#<id> abre un juego
// directamente. Los estudiantes no tienen acceso a los juegos.
// =====================================================================

const $c = (id) => document.getElementById(id);
const ch = { juegos: [], programas: [] };

(async function iniciar() {
  const acceso = await exigirPersonal();
  if (!acceso) return;
  if (acceso.papel === "docente") {
    document.body.classList.add("modo-docente");
    $c("marca-texto").textContent = "Mis programas";
    $c("nav-cursos").textContent = "Mis programas";
  }
  mostrarUsuario(acceso.usuario, acceso.papel);
  $c("cargando").hidden = true;
  $c("panel").hidden = false;
  await cargar();
  const id = decodeURIComponent(location.hash.slice(1));
  const juego = id && ch.juegos.find(function (j) { return j.id === id; });
  if (juego) presentar(juego);
})();

$c("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $c("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
}

async function cargar() {
  const [rj, rc, rl] = await Promise.all([
    nexusDb.from("cap_juegos").select("id, tipo, titulo, config").order("titulo"),
    nexusDb.from("cap_cursos").select("id, titulo").order("titulo"),
    nexusDb.from("cap_lecciones").select("curso_id, orden, titulo, juego_id").not("juego_id", "is", null).order("orden")
  ]);
  const error = rj.error || rc.error || rl.error;
  if (error) {
    console.error(error);
    return avisar("No se pudieron cargar los juegos. Detalle: " + (error.message || "error desconocido"), "error");
  }
  ch.juegos = rj.data || [];
  const porId = {};
  ch.juegos.forEach(function (j) { porId[j.id] = j; });
  ch.programas = (rc.data || []).map(function (c) {
    return {
      titulo: c.titulo,
      items: (rl.data || []).filter(function (l) { return l.curso_id === c.id && porId[l.juego_id]; })
        .map(function (l) { return { leccion: l.titulo, orden: l.orden, juego: porId[l.juego_id] }; })
    };
  }).filter(function (p) { return p.items.length; });
  pintar();
}

$c("buscar-juego").addEventListener("input", pintar);

function coincide(texto, q) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q);
}

function pintar() {
  const q = $c("buscar-juego").value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Por programa
  const cont = $c("por-programa");
  cont.innerHTML = "";
  ch.programas.forEach(function (p) {
    const items = p.items.filter(function (it) {
      return !q || coincide(p.titulo, q) || coincide(it.juego.titulo, q) || coincide(it.leccion, q);
    });
    if (!items.length) return;
    const bloque = document.createElement("section");
    bloque.className = "programa-charla";
    const h = document.createElement("h2");
    h.textContent = p.titulo;
    const ul = document.createElement("ul");
    ul.className = "lista-juegos-charla";
    items.forEach(function (it) { ul.appendChild(filaJuego(it.juego, "Lección " + it.orden + ": " + it.leccion)); });
    bloque.append(h, ul);
    cont.appendChild(bloque);
  });
  if (!cont.children.length && !q) {
    const p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = "Ningún programa tiene juegos asignados todavía. Se asignan en Cursos → Lecciones → \"Juego para la charla\". Mientras tanto, puedes usar cualquiera de la biblioteca.";
    cont.appendChild(p);
  }

  // Biblioteca completa
  const ul = $c("biblioteca");
  ul.innerHTML = "";
  const lista = ch.juegos.filter(function (j) { return !q || coincide(j.titulo, q) || coincide(NexusJuegos.NOMBRES[j.tipo] || "", q); });
  lista.forEach(function (j) {
    const usos = ch.programas.filter(function (p) { return p.items.some(function (it) { return it.juego.id === j.id; }); }).length;
    ul.appendChild(filaJuego(j, usos ? "En " + usos + (usos === 1 ? " programa" : " programas") : "Sin asignar a un programa"));
  });
  if (!lista.length) {
    const li = document.createElement("li");
    li.className = "vacio-lista";
    li.textContent = q ? "Ningún juego coincide con la búsqueda." : "Aún no hay juegos en la biblioteca.";
    ul.appendChild(li);
  }
}

function filaJuego(j, detalle) {
  const li = document.createElement("li");
  li.className = "juego-charla";
  const tipo = document.createElement("span");
  tipo.className = "juego-tipo";
  tipo.textContent = NexusJuegos.NOMBRES[j.tipo] || "Juego";
  const info = document.createElement("div");
  info.className = "item-info";
  const t = document.createElement("strong");
  t.textContent = j.titulo;
  const s = document.createElement("small");
  s.textContent = detalle;
  info.append(t, s);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "boton boton-chico";
  b.textContent = "Presentar";
  b.addEventListener("click", function () { presentar(j); });
  li.append(tipo, info, b);
  return li;
}

// ---------------------------------------------------------------------
// Escenario: el juego en grande
// ---------------------------------------------------------------------
function presentar(j) {
  $c("escenario-titulo").textContent = j.titulo;
  $c("escenario").hidden = false;
  document.body.classList.add("con-escenario");
  NexusJuegos.montar($c("escenario-juego"), j);
  history.replaceState(null, "", "#" + j.id);
}

function cerrarEscenario() {
  if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  $c("escenario").hidden = true;
  $c("escenario-juego").innerHTML = "";
  document.body.classList.remove("con-escenario");
  history.replaceState(null, "", location.pathname);
}

$c("btn-cerrar-escenario").addEventListener("click", cerrarEscenario);
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && !$c("escenario").hidden && !document.fullscreenElement) cerrarEscenario();
});

$c("btn-pantalla").addEventListener("click", function () {
  const esc = $c("escenario");
  if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  else if (esc.requestFullscreen) esc.requestFullscreen().catch(function () { avisar("Este navegador no permite pantalla completa. Usa la tecla F11.", "error"); });
});
document.addEventListener("fullscreenchange", function () {
  $c("btn-pantalla").textContent = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa";
});
