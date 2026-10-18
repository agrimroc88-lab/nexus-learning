// =====================================================================
// NEXUS ACADEMY · CURSOS Y SALÓN DE CLASES (administradores y docentes)
// Carpeta: js/aula.js
//
// aula.html          → los cursos en tarjetas con su portada.
// aula.html?c=<id>   → Salón de clases de ese curso: todo el material
//                      en orden (video, PDF, enlaces, lecciones, juegos)
//                      para proyectar o compartir pantalla, y al final
//                      el QR y la clave de asistencia vigente.
// "Planificación y diseño del curso" lleva al editor (admin.html?curso=).
// Todo el texto de la base se pinta con textContent.
// =====================================================================

const $a = (id) => document.getElementById(id);
const au = { papel: null, cursos: [], curso: null, pasos: [], i: 0, claves: [] };

(async function iniciar() {
  const acceso = await exigirPersonal();
  if (!acceso) return;
  au.papel = acceso.papel;
  if (au.papel === "docente") {
    document.body.classList.add("modo-docente");
    $a("marca-texto").textContent = "Mis programas";
    $a("nav-cursos").textContent = "Mis programas";
    $a("aula-titulo").textContent = "Mis programas";
  }
  mostrarUsuario(acceso.usuario, acceso.papel);
  $a("cargando").hidden = true;

  const id = new URLSearchParams(location.search).get("c");
  if (id) await abrirSalon(id);
  else await listarCursos();
})();

$a("btn-salir").addEventListener("click", cerrarSesion);

function avisar(texto, tipo) {
  const a = $a("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "ok");
  a.hidden = false;
}

function crear(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}

function urlPublica(espacio, ruta) {
  return nexusDb.storage.from(espacio).getPublicUrl(ruta).data.publicUrl;
}

// ---------------------------------------------------------------------
// 1. Lista de cursos (tarjetas con portada)
// ---------------------------------------------------------------------
async function listarCursos() {
  $a("panel").hidden = false;
  const { data, error } = await nexusDb
    .from("cap_cursos")
    .select("id, titulo, descripcion, imagen, publicado, cap_lecciones(count)")
    .order("titulo");
  if (error) {
    console.error(error);
    return avisar("No se pudieron cargar los cursos. Detalle: " + (error.message || "error desconocido"), "error");
  }
  au.cursos = data || [];
  pintarCursos();
}

$a("buscar-curso").addEventListener("input", pintarCursos);

function sinTildes(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function pintarCursos() {
  const q = sinTildes($a("buscar-curso").value.trim());
  const ul = $a("cursos-aula");
  ul.innerHTML = "";
  const lista = au.cursos.filter(function (c) { return !q || sinTildes(c.titulo).includes(q); });
  if (!lista.length) {
    ul.appendChild(crear("li", "vacio-lista", au.cursos.length
      ? "Ningún curso coincide con la búsqueda."
      : (au.papel === "docente" ? "Aún no tienes programas asignados." : "Aún no hay cursos. Créalos en Planificación y diseño.")));
    return;
  }
  lista.forEach(function (c) {
    const li = document.createElement("li");
    const a = crear("a", "tarjeta-aula");
    a.href = "aula.html?c=" + encodeURIComponent(c.id);
    const portada = crear("span", "tarjeta-aula-portada");
    if (c.imagen) portada.style.backgroundImage = "url(\"" + urlPublica("portadas", c.imagen) + "\")";
    else portada.appendChild(crear("span", "tarjeta-aula-inicial", (c.titulo || "?").trim().charAt(0)));
    const n = c.cap_lecciones && c.cap_lecciones[0] ? c.cap_lecciones[0].count : 0;
    const cuerpo = crear("span", "tarjeta-aula-cuerpo");
    cuerpo.append(crear("strong", "", c.titulo),
      crear("small", "", (n === 1 ? "1 lección" : n + " lecciones") + (c.publicado ? "" : " · Inactivo")));
    const entrar = crear("span", "tarjeta-aula-entrar", "Entrar al salón →");
    a.append(portada, cuerpo, entrar);
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------------------
// 2. Salón de clases
// ---------------------------------------------------------------------
async function abrirSalon(id) {
  document.body.classList.add("con-escenario");
  $a("salon").hidden = false;
  $a("salon-contenido").textContent = "Cargando el material del curso…";

  // Curso (los campos nuevos pueden no existir si falta un SQL)
  let rc = await nexusDb.from("cap_cursos")
    .select("id, titulo, descripcion, subtemas, imagen, horas, video_url, archivo_pdf, enlaces").eq("id", id).maybeSingle();
  if (rc.error && /enlaces/i.test(rc.error.message || "")) {
    rc = await nexusDb.from("cap_cursos").select("id, titulo, descripcion, subtemas, imagen, horas, video_url, archivo_pdf").eq("id", id).maybeSingle();
  }
  if (rc.error && /video_url|archivo_pdf/i.test(rc.error.message || "")) {
    rc = await nexusDb.from("cap_cursos").select("id, titulo, descripcion, subtemas, imagen, horas").eq("id", id).maybeSingle();
  }
  if (rc.error || !rc.data) {
    if (rc.error) console.error(rc.error);
    $a("salon-contenido").textContent = "No se encontró el curso o no tienes acceso a él.";
    return;
  }
  au.curso = rc.data;
  document.title = au.curso.titulo + " · Salón de clases";
  $a("salon-curso").textContent = au.curso.titulo;

  const [rl, rk] = await Promise.all([
    nexusDb.from("cap_lecciones").select("orden, titulo, contenido, video_url, archivo_pdf, juego_id").eq("curso_id", id).order("orden"),
    nexusDb.rpc("cap_salon_claves", { p_curso: id })
  ]);
  const lecciones = rl.data || [];
  au.claves = rk.error ? null : (rk.data || []);   // null = no se pudo consultar (falta el SQL 30)

  const ids = lecciones.map(function (l) { return l.juego_id; }).filter(Boolean);
  let juegos = {};
  if (ids.length) {
    const rj = await nexusDb.from("cap_juegos").select("id, tipo, titulo, config").in("id", ids);
    (rj.data || []).forEach(function (j) { juegos[j.id] = j; });
  }

  au.pasos = armarPasos(au.curso, lecciones, juegos);
  pintarRecorrido();
  const desdeEnlace = parseInt((location.hash.match(/^#paso-(\d+)$/) || [])[1], 10);
  irA(desdeEnlace >= 1 && desdeEnlace <= au.pasos.length ? desdeEnlace - 1 : 0);
}

function esYoutube(url) { return Boolean(idYoutube(url)); }

function idYoutube(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// El orden de la clase: inicio → material del curso → cada lección (texto,
// video, PDF, juego) → cierre con QR de asistencia.
function armarPasos(curso, lecciones, juegos) {
  const p = [{ tipo: "inicio", etiqueta: "Inicio", titulo: "Bienvenida" }];
  if (curso.video_url) p.push({ tipo: "video", etiqueta: "Video", titulo: "Video del curso", url: curso.video_url });
  if (curso.archivo_pdf) p.push({ tipo: "pdf", etiqueta: "PDF", titulo: "Material del curso", ruta: curso.archivo_pdf });
  (Array.isArray(curso.enlaces) ? curso.enlaces : []).forEach(function (e, k) {
    if (!e || !e.url) return;
    p.push({ tipo: esYoutube(e.url) ? "video" : "enlace", etiqueta: esYoutube(e.url) ? "Video" : "Enlace",
      titulo: e.titulo || "Enlace adicional " + (k + 1), url: e.url });
  });
  lecciones.forEach(function (l, n) {
    const nombre = l.titulo || "Lección " + (n + 1);
    if ((l.contenido || "").trim() || (!l.video_url && !l.archivo_pdf && !l.juego_id)) {
      p.push({ tipo: "leccion", etiqueta: "Lección " + (n + 1), titulo: nombre, leccion: l });
    }
    if (l.video_url) p.push({ tipo: "video", etiqueta: "Video", titulo: nombre, url: l.video_url });
    if (l.archivo_pdf) p.push({ tipo: "pdf", etiqueta: "PDF", titulo: nombre, ruta: l.archivo_pdf });
    if (l.juego_id && juegos[l.juego_id]) p.push({ tipo: "juego", etiqueta: "Juego", titulo: juegos[l.juego_id].titulo, juego: juegos[l.juego_id] });
  });
  p.push({ tipo: "cierre", etiqueta: "Cierre", titulo: "Asistencia y certificado" });
  return p;
}

function pintarRecorrido() {
  const ol = $a("lista-pasos");
  ol.innerHTML = "";
  au.pasos.forEach(function (paso, k) {
    const li = document.createElement("li");
    const b = crear("button", "paso-recorrido tipo-" + paso.tipo);
    b.type = "button";
    b.append(crear("span", "paso-etiqueta", paso.etiqueta), crear("span", "paso-titulo", paso.titulo));
    b.addEventListener("click", function () { irA(k); });
    li.appendChild(b);
    ol.appendChild(li);
  });
}

function irA(k) {
  au.i = Math.max(0, Math.min(au.pasos.length - 1, k));
  const paso = au.pasos[au.i];
  history.replaceState(null, "", location.pathname + location.search + "#paso-" + (au.i + 1));
  $a("lista-pasos").querySelectorAll(".paso-recorrido").forEach(function (b, n) {
    b.classList.toggle("activo", n === au.i);
    b.classList.toggle("visto", n < au.i);
    if (n === au.i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });
  const activo = $a("lista-pasos").children[au.i];
  if (activo) activo.scrollIntoView({ block: "nearest" });
  $a("salon-paso").textContent = (au.i + 1) + " de " + au.pasos.length + " · " + paso.titulo;
  $a("btn-anterior").disabled = au.i === 0;
  $a("btn-siguiente").disabled = au.i === au.pasos.length - 1;
  pintarPaso(paso);
}

function pintarPaso(paso) {
  const caja = $a("salon-contenido");
  caja.innerHTML = "";
  caja.className = "salon-contenido escena-" + paso.tipo;
  caja.scrollTop = 0;
  if (paso.tipo === "inicio") return escenaInicio(caja);
  if (paso.tipo === "video") return escenaVideo(caja, paso);
  if (paso.tipo === "pdf") return escenaPdf(caja, paso);
  if (paso.tipo === "enlace") return escenaEnlace(caja, paso);
  if (paso.tipo === "leccion") return escenaLeccion(caja, paso);
  if (paso.tipo === "juego") return escenaJuego(caja, paso);
  if (paso.tipo === "cierre") return escenaCierre(caja);
}

function escenaInicio(caja) {
  const c = au.curso;
  const portada = crear("div", "inicio-portada");
  if (c.imagen) portada.style.backgroundImage = "url(\"" + urlPublica("portadas", c.imagen) + "\")";
  const textos = crear("div", "inicio-textos");
  textos.append(crear("p", "inicio-eyebrow", "Nexus Academy · Capacitación"), crear("h2", "inicio-titulo", c.titulo));
  if (c.descripcion) textos.appendChild(crear("p", "inicio-descripcion", c.descripcion));
  const temas = (c.subtemas || []).filter(Boolean);
  if (temas.length) {
    textos.appendChild(crear("h3", "inicio-subtitulo", "Lo que veremos hoy"));
    const ul = crear("ul", "inicio-temas");
    temas.forEach(function (t) { ul.appendChild(crear("li", "", t)); });
    textos.appendChild(ul);
  }
  const resumen = au.pasos.reduce(function (r, p) { r[p.tipo] = (r[p.tipo] || 0) + 1; return r; }, {});
  const partes = [];
  if (resumen.video) partes.push(resumen.video + (resumen.video === 1 ? " video" : " videos"));
  if (resumen.pdf) partes.push(resumen.pdf + " PDF");
  if (resumen.leccion) partes.push(resumen.leccion + (resumen.leccion === 1 ? " lección" : " lecciones"));
  if (resumen.juego) partes.push(resumen.juego + (resumen.juego === 1 ? " juego" : " juegos"));
  if (partes.length) textos.appendChild(crear("p", "inicio-resumen", "Material de esta clase: " + partes.join(" · ")));
  caja.append(portada, textos);
}

function escenaVideo(caja, paso) {
  const id = idYoutube(paso.url);
  caja.appendChild(crear("h2", "escena-titulo", paso.titulo));
  if (!id) return escenaEnlace(caja, paso, true);
  const marco = crear("div", "video-marco");
  const iframe = document.createElement("iframe");
  iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
  iframe.title = "Video: " + paso.titulo;
  iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  marco.appendChild(iframe);
  const abrir = crear("a", "enlace-escena", "Abrir en YouTube");
  abrir.href = "https://www.youtube.com/watch?v=" + id;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  caja.append(marco, abrir);
}

function escenaPdf(caja, paso) {
  const url = urlPublica("diapositivas", paso.ruta);
  const cab = crear("div", "escena-cabecera");
  const abrir = crear("a", "boton secundario boton-chico", "Abrir PDF en pestaña nueva");
  abrir.href = url;
  abrir.target = "_blank";
  abrir.rel = "noopener";
  cab.append(crear("h2", "escena-titulo", paso.titulo), abrir);
  const visor = document.createElement("iframe");
  visor.className = "pdf-visor";
  visor.src = url + "#view=FitH";
  visor.title = "PDF: " + paso.titulo;
  caja.append(cab, visor);
}

function escenaEnlace(caja, paso, sinTitulo) {
  if (!sinTitulo) caja.appendChild(crear("h2", "escena-titulo", paso.titulo));
  const tarjeta = crear("div", "enlace-tarjeta");
  const a = crear("a", "boton", "Abrir enlace");
  a.href = paso.url;
  a.target = "_blank";
  a.rel = "noopener";
  tarjeta.append(crear("p", "enlace-url", paso.url), a,
    crear("p", "ayuda", "Se abre en una pestaña nueva. Si compartes una sola pestaña en Zoom o Meet, cambia a esa pestaña para mostrarla."));
  caja.appendChild(tarjeta);
}

function escenaLeccion(caja, paso) {
  caja.appendChild(crear("p", "inicio-eyebrow", paso.etiqueta));
  caja.appendChild(crear("h2", "escena-titulo grande", paso.titulo));
  const cuerpo = crear("div", "leccion-proyectada");
  pintarTexto(cuerpo, paso.leccion.contenido || "");
  if (!cuerpo.children.length) cuerpo.appendChild(crear("p", "ayuda", "Esta lección no tiene texto. Agrégalo en Planificación y diseño del curso → Lecciones."));
  caja.appendChild(cuerpo);
}

// Párrafos y listas, igual que en la página del participante
function pintarTexto(contenedor, texto) {
  const esLista = function (l) { return /^([-•]|\d+[.)])\s+/.test(l); };
  const lista = function (lineas) {
    const ul = document.createElement(/^\d/.test(lineas[0]) ? "ol" : "ul");
    lineas.forEach(function (l) { ul.appendChild(crear("li", "", l.replace(/^([-•]|\d+[.)])\s+/, ""))); });
    return ul;
  };
  texto.split(/\n\s*\n/).forEach(function (bloque) {
    const lineas = bloque.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lineas.length) return;
    if (lineas.every(esLista)) contenedor.appendChild(lista(lineas));
    else if (lineas.length > 1 && lineas.slice(1).every(esLista)) contenedor.append(crear("p", "", lineas[0]), lista(lineas.slice(1)));
    else contenedor.appendChild(crear("p", "", lineas.join("\n")));
  });
}

function escenaJuego(caja, paso) {
  const zona = document.createElement("div");
  caja.appendChild(zona);
  NexusJuegos.montar(zona, paso.juego);
}

// Cierre: QR permanente del programa + claves vigentes hoy
async function escenaCierre(caja) {
  const enlace = location.origin + location.pathname.replace(/[^/]*$/, "") + "programa.html?p=" + encodeURIComponent(au.curso.id);
  const cont = crear("div", "cierre");
  const qrCaja = crear("div", "cierre-qr", "Generando QR…");
  const textos = crear("div", "cierre-textos");
  textos.append(crear("p", "inicio-eyebrow", "Registro de asistencia"),
    crear("h2", "escena-titulo grande", "Escanea el código QR"),
    crear("p", "cierre-paso", "1. Abre la cámara del celular y escanea el código."),
    crear("p", "cierre-paso", "2. Escribe la clave de la capacitación."),
    crear("p", "cierre-paso", "3. Completa tus datos" + (au.claves && au.claves.some(function (k) { return k.evaluacion; }) ? ", responde la evaluación" : "") + " y descarga tu certificado."));

  const claves = crear("div", "cierre-claves");
  if (au.claves === null) {
    claves.appendChild(crear("p", "ayuda", "Para ver aquí la clave de hoy, el administrador debe ejecutar el SQL 30 en Supabase."));
  } else if (!au.claves.length) {
    claves.appendChild(crear("p", "cierre-sin-clave", au.papel === "admin"
      ? "No hay claves vigentes ahora para este curso. Créala en Empresas → la capacitación → Nueva clave."
      : "No hay claves vigentes ahora para este curso. Pide la clave al administrador."));
  } else {
    au.claves.forEach(function (k) {
      const f = crear("div", "clave-vigente");
      f.append(crear("span", "clave-empresa", k.empresa + (k.tipo === "virtual" ? " · virtual" : "")),
        crear("strong", "clave-codigo", k.codigo),
        crear("small", "", "Vigente hasta " + new Date(k.valido_hasta).toLocaleString("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
      claves.appendChild(f);
    });
  }
  textos.appendChild(claves);
  cont.append(qrCaja, textos);
  caja.appendChild(cont);

  try {
    await cargarQr();
    const qr = qrcode(0, "M");
    qr.addData(enlace);
    qr.make();
    qrCaja.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch (e) {
    qrCaja.textContent = "";
    qrCaja.appendChild(crear("p", "ayuda", "No se pudo generar el QR. Comparte este enlace: " + enlace));
  }
}

function cargarQr() {
  if (typeof qrcode !== "undefined") return Promise.resolve();
  return new Promise(function (ok, falla) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.onload = ok;
    s.onerror = function () { s.remove(); falla(new Error("qr")); };
    document.head.appendChild(s);
  });
}

// ---------------------------------------------------------------------
// Controles del salón
// ---------------------------------------------------------------------
$a("btn-anterior").addEventListener("click", function () { irA(au.i - 1); });
$a("btn-siguiente").addEventListener("click", function () { irA(au.i + 1); });
$a("btn-qr").addEventListener("click", function () { irA(au.pasos.length - 1); });
$a("btn-planificar").addEventListener("click", function () {
  location.href = "admin.html?curso=" + encodeURIComponent(au.curso ? au.curso.id : "");
});
$a("btn-cerrar-salon").addEventListener("click", function () {
  if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  location.href = "aula.html";
});
$a("btn-recorrido").addEventListener("click", function () {
  const oculto = $a("salon").classList.toggle("sin-recorrido");
  $a("btn-recorrido").setAttribute("aria-pressed", oculto ? "false" : "true");
});

function alternarPantalla() {
  const salon = $a("salon");
  if (document.fullscreenElement) return document.exitFullscreen().catch(function () {});
  const pedir = salon.requestFullscreen || salon.webkitRequestFullscreen;
  if (!pedir) return avisarSalon("Tu navegador no permite pantalla completa aquí. Usa la tecla F11.");
  Promise.resolve(pedir.call(salon)).catch(function () { avisarSalon("No se pudo activar la pantalla completa. Usa la tecla F11."); });
}
$a("btn-pantalla").addEventListener("click", alternarPantalla);
document.addEventListener("fullscreenchange", function () {
  const activa = Boolean(document.fullscreenElement);
  $a("btn-pantalla").textContent = activa ? "Salir de pantalla completa" : "⛶ Pantalla completa";
  $a("salon").classList.toggle("en-pantalla-completa", activa);
});

function avisarSalon(texto) {
  const p = crear("p", "aviso error salon-aviso", texto);
  $a("salon-contenido").prepend(p);
  setTimeout(function () { p.remove(); }, 6000);
}

// Teclado: flechas para avanzar (fuera de campos de texto) y F para pantalla completa
document.addEventListener("keydown", function (ev) {
  if ($a("salon").hidden) return;
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
  if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); irA(au.i + 1); }
  else if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); irA(au.i - 1); }
  else if ((ev.key === "f" || ev.key === "F") && !ev.ctrlKey && !ev.metaKey) { alternarPantalla(); }
});
