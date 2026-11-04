/* =====================================================================
   NEXUS LEARNING · atd-admin.js
   Pestañas «Respuestas A-T-D» e «Informe» en la nómina de una
   capacitación que pide el cuestionario A-T-D en línea (SQL 41).

   El informe es el mismo «Diagnóstico inicial · Test A-T-D» de NEXUS
   (misma estructura, gráficos, textos y conclusiones), con el nombre y
   el logo de la EMPRESA de la capacitación.
   Solo administradores (la tabla tiene RLS de administrador).
   ===================================================================== */
(function () {
  "use strict";

  const CAT = {
    genero: { masculino: "Masculino", femenino: "Femenino", "lgbtiq+": "LGBTIQ+" },
    afiliacion: { publica: "Pública", privada: "Privada" },
    estado_civil: { soltero: "Soltero", casado: "Casado", divorciado: "Divorciado", viudo: "Viudo/a", union_hecho: "Unión de hecho" },
    nivel_instruccion: { educacion_basica: "Educación básica", bachiller: "Bachiller", tercer_nivel: "Tercer nivel", cuarto_nivel: "Cuarto nivel" },
    etnia: { mestizo: "Mestizo", blanco: "Blanco", indigena: "Indígena", montubio: "Montubio", afroecuatoriano: "Afroecuatoriano", otro: "Otro" },
    discapacidad: { no_aplica: "No aplica", auditiva: "Auditiva", fisica: "Física", intelectual: "Intelectual", lenguaje: "Lenguaje", psicosocial: "Psicosocial", visual: "Visual" },
    enfermedad_preexistente: { catastrofica: "Catastrófica", cronica_no_transmisible: "Crónica no transmisible", cronica_transmisible: "Crónica transmisible", aguda: "Aguda", no_diagnosticada: "No diagnosticada" },
    droga: {
      no_consume: "No consume", alcohol: "Alcohol", anfetaminas: "Anfetaminas", base_cocaina: "Base de cocaína",
      cannabis: "Cannabis (marihuana, hachís, THC)", cocaina: "Cocaína", drogas_sintesis: "Drogas de síntesis (Éxtasis, MDMA, Ketamina)",
      hongos: "Hongos", inhalantes: "Inhalantes", lsd: "LSD", mezcalina: "Mezcalina", opiaceos: "Opiáceos (Heroína, Morfina, Metadona)",
      psilocibina: "Psilocibina", tabaco: "Tabaco", otra: "Otra"
    },
    frecuencia_consumo: {
      no_consume: "No consume", "5_a_7_semana": "De 5 a 7 días a la semana", "2_a_4_semana": "De 2 a 4 veces a la semana",
      "2_a_7_semana": "De 2 a 7 veces a la semana", al_menos_1_semana: "Al menos una vez a la semana",
      "2_a_12_anio": "De 2 a 12 veces al año", "1_anio": "Una vez al año"
    },
    reconoce_problema: { si: "Sí", no: "No", no_aplica: "No aplica" },
    factor_psicosocial: {
      no_aplica: "No aplica", agobio_tension_trabajo: "Agobio y tensión en el trabajo", acoso_laboral: "Acoso laboral",
      cansancio_intenso: "Cansancio intenso, agobio", companeros_consumidores: "Compañeros consumidores", contratos_precarios: "Contratos precarios",
      curiosidad_efectos: "Curiosidad sobre los efectos de las drogas", dificultad_resolucion_problemas: "Dificultad en la resolución de problemas",
      elevados_niveles_tension_estres: "Elevados niveles de tensión y estrés laboral", expendio_drogas_trabajo: "Existencia de expendio de drogas en el trabajo",
      familiares_consumidores: "Familiares consumidores", insatisfaccion_tipo_trabajo: "Insatisfacción con el tipo de trabajo",
      insatisfaccion_trato_recibido: "Insatisfacción con el trato recibido", inseguridad_futuro_laboral: "Inseguridad en cuanto al futuro laboral",
      largas_ausencias_hogar: "Largas ausencias del hogar por motivos laborales", mala_situacion_economica: "Mala situación económica en la familia",
      peligrosidad_tarea: "Peligrosidad en el desempeño de la tarea", problemas_conciliacion: "Problemas de conciliación trabajo-hogar",
      sentimiento_poco_capacitado: "Sentimiento de estar poco capacitado", sindrome_burnout: "Síndrome del \"Burnout\"",
      tareas_rutinarias: "Tareas rutinarias o monótonas", trabajos_nocturnos: "Trabajos nocturnos o a destajo",
      turnos_rotativos: "Turnos rotatorios y cambiantes", otro_evento_social: "Otro (eventos sociales, reuniones, etc.)"
    }
  };

  const DIMENSIONES = [
    { clave: "area_cargo", titulo: "Cargo o área", catalogo: null },
    { clave: "genero", titulo: "Género", catalogo: CAT.genero },
    { clave: "estado_civil", titulo: "Estado civil", catalogo: CAT.estado_civil },
    { clave: "nivel_instruccion", titulo: "Nivel de instrucción", catalogo: CAT.nivel_instruccion },
    { clave: "afiliacion", titulo: "Afiliación a la seguridad social", catalogo: CAT.afiliacion },
    { clave: "etnia", titulo: "Autoidentificación étnica", catalogo: CAT.etnia },
    { clave: "discapacidad", titulo: "Discapacidad", catalogo: CAT.discapacidad },
    { clave: "enfermedad_preexistente", titulo: "Enfermedades pre-existentes", catalogo: CAT.enfermedad_preexistente },
    { clave: "droga_principal", titulo: "Droga principal que consume", catalogo: CAT.droga },
    { clave: "frecuencia_consumo", titulo: "Frecuencia de consumo", catalogo: CAT.frecuencia_consumo },
    { clave: "reconoce_problema", titulo: "¿Reconoce tener un problema de consumo?", catalogo: CAT.reconoce_problema },
    { clave: "factor_psicosocial", titulo: "Factor psicosocial asociado al consumo", catalogo: CAT.factor_psicosocial }
  ];

  const RECOMENDACIONES_BASE = [
    "Continuar con acciones preventivas, como programas y charlas para disminuir el riesgo de uso y consumo prolongado de alcohol, tabaco y otras drogas.",
    "Capacitar anualmente al personal de la empresa sobre la prevención y reducción del consumo de alcohol, tabaco y otras drogas en espacios laborales, con la finalidad de establecer un ambiente adecuado.",
    "Sensibilización con enfoque psicoeducativo y preventivo sobre el alcohol, tabaco y otras drogas, que incluya estrategias que promuevan estilos de vida saludables en la población laboral.",
    "Campaña de concientización sobre las secuelas y desventajas del consumo de alcohol, organizada por el personal de la empresa.",
    "Evaluaciones psicológicas individuales dentro de un periodo de corto o mediano plazo (6 o 12 meses), con la finalidad de conocer conflictos personales, familiares, conyugales o laborales que mantenga el personal, y prevenir un consumo de drogas severo."
  ];

  const PALETA = ["#1b5e20", "#EB9500", "#2E7D32", "#F4B942", "#0d47a1", "#8e24aa", "#c62828", "#546e7a", "#00838f", "#6d4c41"];
  const CLAVE_FIRMA = "nexus_atd_firma";

  const st = { conv: null, ids: [], empresa: null, filas: [], inscritos: [] };
  const el = (id) => document.getElementById(id);

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct(n, total) { return total > 0 ? Math.round((n * 100) / total) : 0; }
  function etq(cat, v) { return (cat && cat[v]) || v || "—"; }

  // ------------------------------------------------------------------
  // Montaje en la nómina
  // ------------------------------------------------------------------
  async function montar(conv, ids, empresa, inscritos) {
    st.conv = conv; st.ids = ids; st.empresa = empresa; st.inscritos = inscritos || [];
    const barra = el("nomina-pestanas");
    barra.hidden = true;
    mostrarPestana("asistencia");

    // Se muestra si alguna de estas capacitaciones pide el test en línea o ya tiene respuestas
    const r = await nexusDb.from("cap_test_atd").select("*").in("convocatoria_id", ids).order("nombres");
    if (r.error) return;   // sin SQL 41 o sin permiso: no hay pestañas
    st.filas = r.data || [];
    const conCuestionario = (typeof emp !== "undefined" && emp.convs ? emp.convs : []).some(function (x) {
      return ids.indexOf(x.id) >= 0 && x.cuestionario === "atd";
    }) || conv.cuestionario === "atd";
    if (!conCuestionario && !st.filas.length) return;
    barra.hidden = false;
    el("tab-atd-respuestas").textContent = "Respuestas A-T-D (" + st.filas.length + ")";
    pintarRespuestas();
    prepararInforme();
  }

  function mostrarPestana(cual) {
    document.querySelectorAll("#nomina-pestanas .pestana").forEach(function (b) {
      b.classList.toggle("activa", b.dataset.tab === cual);
    });
    const asis = cual === "asistencia";
    ["nomina-cifras", "nomina-herramientas", "nomina-tabla-caja"].forEach(function (id) { el(id).hidden = !asis; });
    el("panel-atd-respuestas").hidden = cual !== "respuestas";
    el("panel-atd-informe").hidden = cual !== "informe";
  }

  document.addEventListener("click", function (ev) {
    const b = ev.target.closest("#nomina-pestanas .pestana");
    if (b) mostrarPestana(b.dataset.tab);
  });

  // ------------------------------------------------------------------
  // Respuestas
  // ------------------------------------------------------------------
  function edad(f) { return f.anio_nacimiento ? f.anio - f.anio_nacimiento : null; }

  function pintarRespuestas() {
    const filtro = (el("buscar-atd").value || "").trim().toLowerCase();
    const cedulas = new Set(st.filas.map(function (f) { return f.cedula; }));
    const pendientes = st.inscritos.filter(function (i) { return !cedulas.has(i.cedula); });
    const consumen = st.filas.filter(function (f) { return f.droga_principal !== "no_consume"; }).length;
    const tratamiento = st.filas.filter(function (f) { return f.desea_tratamiento; }).length;

    const cifras = el("atd-cifras");
    cifras.innerHTML = "";
    [["Respondieron", st.filas.length, st.inscritos.length ? "de " + st.inscritos.length + " inscritos" : ""],
     ["Sin cuestionario", pendientes.length, pendientes.length ? "aún no reciben su certificado" : ""],
     ["Reportan consumo", consumen, pct(consumen, st.filas.length) + " %"],
     ["Desean tratamiento", tratamiento, ""]].forEach(function (d) {
      const div = document.createElement("div");
      div.className = "cifra";
      div.innerHTML = "<strong>" + esc(d[1]) + "</strong><span>" + esc(d[0]) + "</span>" + (d[2] ? "<small>" + esc(d[2]) + "</small>" : "");
      cifras.appendChild(div);
    });
    el("atd-pendientes").hidden = !pendientes.length;
    el("atd-pendientes").textContent = pendientes.length
      ? "Sin cuestionario: " + pendientes.map(function (i) { return i.nombres; }).join(", ") + "."
      : "";

    const tbody = el("atd-filas");
    tbody.innerHTML = "";
    const filas = st.filas.filter(function (f) {
      return !filtro || (f.nombres || "").toLowerCase().includes(filtro) || f.cedula.includes(filtro) || (f.area_cargo || "").toLowerCase().includes(filtro);
    });
    if (!filas.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="vacio-lista">' + (st.filas.length ? "Nadie coincide con la búsqueda." : "Todavía nadie ha llenado el cuestionario.") + "</td></tr>";
      return;
    }
    filas.forEach(function (f) {
      const tr = document.createElement("tr");
      [f.nombres, f.cedula, f.area_cargo, etq(CAT.genero, f.genero), edad(f) ?? "—",
       etq(CAT.droga, f.droga_principal), etq(CAT.frecuencia_consumo, f.frecuencia_consumo),
       etq(CAT.reconoce_problema, f.reconoce_problema), etq(CAT.factor_psicosocial, f.factor_psicosocial),
       f.desea_tratamiento ? "Sí" + (f.telefono ? " · " + f.telefono : "") : "No",
       new Date(f.creado_en).toLocaleDateString("es-EC")].forEach(function (v) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function excel() {
    try { await window.cargarXLSX(); } catch (e) { return alert("No se pudo cargar el generador de Excel. Revisa tu conexión."); }
    const filas = st.filas.map(function (f) {
      return {
        "Nombres": f.nombres, "Cédula": f.cedula, "Cargo o puesto": f.area_cargo, "Año de nacimiento": f.anio_nacimiento, "Edad": edad(f),
        "Afiliación": etq(CAT.afiliacion, f.afiliacion), "Estado civil": etq(CAT.estado_civil, f.estado_civil), "Género": etq(CAT.genero, f.genero),
        "Instrucción": etq(CAT.nivel_instruccion, f.nivel_instruccion), "N.º hijos": f.num_hijos, "Etnia": etq(CAT.etnia, f.etnia),
        "Discapacidad": etq(CAT.discapacidad, f.discapacidad), "% discapacidad": f.pct_discapacidad, "Trabajador sustituto": f.trabajador_sustituto ? "Sí" : "No",
        "Enfermedad pre-existente": etq(CAT.enfermedad_preexistente, f.enfermedad_preexistente),
        "Droga principal": etq(CAT.droga, f.droga_principal), "Otra (cuál)": f.droga_principal_otra || "", "Otra droga": etq(CAT.droga, f.otra_droga),
        "Frecuencia": etq(CAT.frecuencia_consumo, f.frecuencia_consumo), "Último consumo": f.ultimo_consumo || "",
        "Reconoce problema": etq(CAT.reconoce_problema, f.reconoce_problema), "Factor psicosocial": etq(CAT.factor_psicosocial, f.factor_psicosocial),
        "Desea tratamiento": f.desea_tratamiento ? "Sí" : "No", "Teléfono": f.telefono || "", "Dirección": f.direccion || "",
        "Fecha": new Date(f.creado_en).toLocaleString("es-EC")
      };
    });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), "Respuestas A-T-D");
    const nombre = ("Test_ATD_" + (st.empresa ? st.empresa.nombre : "") + "_" + new Date().getFullYear()).replace(/[^\w\-]+/g, "_");
    XLSX.writeFile(libro, nombre + ".xlsx");
  }

  // ------------------------------------------------------------------
  // Informe
  // ------------------------------------------------------------------
  function prepararInforme() {
    let firma = {};
    try { firma = JSON.parse(localStorage.getItem(CLAVE_FIRMA)) || {}; } catch (e) { /* nada */ }
    if (!el("atd-quien").value) el("atd-quien").value = firma.quien || "";
    if (!el("atd-cargo").value) el("atd-cargo").value = firma.cargo || "";
    if (!el("atd-registro").value) el("atd-registro").value = firma.registro || "";
    const anios = Array.from(new Set(st.filas.map(function (f) { return f.anio; }))).sort().reverse();
    if (!anios.length) anios.push(new Date().getFullYear());
    el("atd-anio").innerHTML = anios.map(function (a) { return '<option value="' + a + '">' + a + "</option>"; }).join("");
    const reco = el("atd-recomendaciones");
    if (!reco.dataset.editado) reco.value = RECOMENDACIONES_BASE.map(function (r, i) { return (i + 1) + ". " + r; }).join("\n\n");
    el("atd-sin-logo").hidden = Boolean(st.empresa && st.empresa.logo);
  }

  function contarDimension(filas, dim) {
    const conteo = new Map();
    filas.forEach(function (r) {
      const v = r[dim.clave];
      if (v == null || v === "") return;
      conteo.set(v, (conteo.get(v) || 0) + 1);
    });
    return Array.from(conteo.entries()).map(function (kv) {
      return { valor: kv[0], etiqueta: dim.catalogo ? (dim.catalogo[kv[0]] || kv[0]) : kv[0], n: kv[1], pct: pct(kv[1], filas.length) };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  function calcularEdades(filas, anio) {
    const edades = filas.filter(function (r) { return r.anio_nacimiento; }).map(function (r) { return anio - r.anio_nacimiento; });
    if (!edades.length) return null;
    const promedio = (edades.reduce(function (s, e) { return s + e; }, 0) / edades.length).toFixed(1);
    const buckets = [
      { etiqueta: "< 18 años", n: edades.filter(function (e) { return e < 18; }).length },
      { etiqueta: "18 – 35 años", n: edades.filter(function (e) { return e >= 18 && e <= 35; }).length },
      { etiqueta: "36 – 59 años", n: edades.filter(function (e) { return e >= 36 && e <= 59; }).length },
      { etiqueta: "> 60 años", n: edades.filter(function (e) { return e >= 60; }).length }
    ].filter(function (b) { return b.n > 0; }).map(function (b) { return Object.assign(b, { pct: pct(b.n, edades.length) }); });
    return { promedio: promedio, buckets: buckets, n: edades.length };
  }

  function estadisticas(filas, anio) {
    const total = filas.length;
    const consumeAlgo = filas.filter(function (r) { return r.droga_principal && r.droga_principal !== "no_consume"; }).length;
    const desean = filas.filter(function (r) { return r.desea_tratamiento; }).length;
    const reconocen = filas.filter(function (r) { return r.reconoce_problema === "si"; }).length;
    return {
      anio: anio, total: total,
      dimensiones: DIMENSIONES.map(function (d) { return Object.assign({}, d, { datos: contarDimension(filas, d) }); }),
      edad: calcularEdades(filas, anio),
      consumeAlgo: consumeAlgo, pctConsumeAlgo: pct(consumeAlgo, total),
      desean: desean, pctDesean: pct(desean, total),
      reconocenProblema: reconocen, pctReconocen: pct(reconocen, total)
    };
  }

  function graficoPastel(items) {
    const visibles = items.filter(function (i) { return i.valor > 0; });
    if (!visibles.length) return '<p class="if-nota">Sin datos para graficar.</p>';
    const ancho = 360, alto = 260;
    const radio = Math.min(ancho, alto - 70) / 2 - 6;
    const cx = ancho / 2, cy = (alto - 70) / 2 + 6;
    const total = visibles.reduce(function (s, i) { return s + i.valor; }, 0);
    let ang = -90;
    const rad = function (g) { return (g * Math.PI) / 180; };
    const trozos = visibles.map(function (item, idx) {
      const p = item.valor / total;
      const a0 = ang, a1 = ang + p * 360;
      ang = a1;
      const color = PALETA[idx % PALETA.length];
      const x1 = cx + radio * Math.cos(rad(a0)), y1 = cy + radio * Math.sin(rad(a0));
      const x2 = cx + radio * Math.cos(rad(a1)), y2 = cy + radio * Math.sin(rad(a1));
      const pc = Math.round(p * 100);
      const am = rad((a0 + a1) / 2);
      const path = visibles.length === 1
        ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + radio + '" fill="' + color + '"/>'
        : '<path d="M' + cx + "," + cy + " L" + x1.toFixed(1) + "," + y1.toFixed(1) + " A" + radio + "," + radio + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + x2.toFixed(1) + "," + y2.toFixed(1) + ' Z" fill="' + color + '"/>';
      const txt = pc >= 5 ? '<text x="' + (cx + radio * 0.65 * Math.cos(am)).toFixed(1) + '" y="' + (cy + radio * 0.65 * Math.sin(am)).toFixed(1) + '" font-size="10" font-weight="bold" text-anchor="middle" fill="#fff">' + pc + "%</text>" : "";
      return { path: path, txt: txt, color: color, etiqueta: item.etiqueta, pct: pc };
    });
    const leyenda = trozos.map(function (t) {
      return '<span style="display:inline-flex;align-items:center;gap:3px;margin:0 8px 4px 0;"><span style="display:inline-block;width:8px;height:8px;background:' + t.color + ';border-radius:2px;"></span><span style="font-size:8.5px;color:#333;">' + esc(t.etiqueta) + " (" + t.pct + "%)</span></span>";
    }).join("");
    return '<svg viewBox="0 0 ' + ancho + " " + (alto - 60) + '" width="100%" style="max-width:' + ancho + 'px;display:block;margin:0 auto;">' +
      trozos.map(function (t) { return t.path; }).join("") + trozos.map(function (t) { return t.txt; }).join("") +
      '</svg><div style="text-align:center;margin-top:2px;">' + leyenda + "</div>";
  }

  function parrafo(dim, datos, numero) {
    if (!datos.length) return "";
    const top = datos.slice(0, 3);
    const frases = {
      droga_principal: function () {
        const no = datos.find(function (d) { return d.valor === "no_consume"; });
        const consumen = datos.filter(function (d) { return d.valor !== "no_consume"; }).slice(0, 2);
        const partes = consumen.map(function (d) { return "un " + d.pct + "% consume " + d.etiqueta.toLowerCase(); });
        return "El gráfico " + numero + " indica la principal droga consumida por el personal: " + partes.join(", ") +
          ", mientras que un " + (no ? no.pct : 100) + "% del personal no consume ningún tipo de droga.";
      },
      frecuencia_consumo: function () {
        const no = datos.find(function (d) { return d.valor === "no_consume"; });
        const consumen = datos.filter(function (d) { return d.valor !== "no_consume"; });
        if (!consumen.length) return "El gráfico " + numero + " indica que ningún trabajador reportó consumo con una frecuencia definida.";
        return "El gráfico " + numero + " muestra la frecuencia de consumo del personal: " +
          consumen.map(function (d) { return "un " + d.pct + "% " + d.etiqueta.toLowerCase(); }).join(", ") +
          (no ? ", y el " + no.pct + "% no consume ningún tipo de sustancia." : ".");
      },
      reconoce_problema: function () {
        const si = datos.find(function (d) { return d.valor === "si"; });
        return "El gráfico " + numero + " muestra que el " + (si ? si.pct : 0) + "% del personal reconoce tener un problema relacionado con el consumo de sustancias.";
      },
      factor_psicosocial: function () {
        const no = datos.find(function (d) { return d.valor === "no_aplica"; });
        const f = datos.filter(function (d) { return d.valor !== "no_aplica"; }).slice(0, 2);
        if (!f.length) return "El gráfico " + numero + " indica que no se identificaron factores psicosociales asociados al consumo.";
        return "El gráfico " + numero + " indica los siguientes factores psicosociales que el personal relaciona con el consumo: " +
          f.map(function (d) { return "el " + d.pct + '% considera "' + d.etiqueta.toLowerCase() + '"'; }).join(", ") + " como principal factor" +
          (no ? ', y el ' + no.pct + '% "no aplica" debido a que no consume ninguna sustancia.' : ".");
      }
    };
    if (frases[dim.clave]) return frases[dim.clave]();
    if (top.length === 1) return "El gráfico " + numero + " muestra que el " + top[0].pct + '% del personal corresponde a "' + esc(top[0].etiqueta) + '".';
    return "El gráfico " + numero + " muestra que el " + top[0].pct + '% del personal corresponde a "' + esc(top[0].etiqueta) + '", mientras que ' +
      top.slice(1).map(function (d) { return "un " + d.pct + '% "' + esc(d.etiqueta) + '"'; }).join(", ") + ".";
  }

  function conclusiones(e) {
    const out = [];
    const buscar = function (clave, valor) {
      const dim = e.dimensiones.find(function (d) { return d.clave === clave; });
      return dim ? dim.datos.find(function (d) { return d.valor === valor; }) : null;
    };
    const primero = function (clave, excluir) {
      const dim = e.dimensiones.find(function (d) { return d.clave === clave; });
      return dim ? dim.datos.find(function (d) { return d.valor !== excluir; }) : null;
    };
    const no = buscar("droga_principal", "no_consume");
    if (no) out.push("El " + no.pct + "% del personal señaló que no consume ningún tipo de droga, siendo un porcentaje " + (no.pct >= 70 ? "alto" : no.pct >= 40 ? "moderado" : "bajo") + " libre de consumo.");
    const droga = primero("droga_principal", "no_consume");
    if (droga) out.push("La principal sustancia de consumo reportada es " + droga.etiqueta.toLowerCase() + ", con un " + droga.pct + "% del personal evaluado.");
    const factor = primero("factor_psicosocial", "no_aplica");
    if (factor) out.push("El " + factor.pct + '% del personal considera "' + factor.etiqueta.toLowerCase() + '" como el principal factor psicosocial asociado al consumo.');
    if (e.reconocenProblema > 0) out.push("El " + e.pctReconocen + "% del personal reconoce tener un problema relacionado con el consumo de sustancias, población prioritaria para intervención.");
    if (e.desean > 0) out.push("El " + e.pctDesean + "% del personal manifestó su deseo de recibir tratamiento, casos que se gestionan de forma individual y confidencial en el listado de seguimiento.");
    const baja = buscar("frecuencia_consumo", "2_a_12_anio");
    if (baja) out.push("El " + baja.pct + "% de los trabajadores consume de 2 a 12 veces al año, una frecuencia baja dentro del patrón de consumo.");
    return out;
  }

  function fechaLarga(d) {
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function documentoInforme(e, datos) {
    const empresa = datos.empresa;
    const logo = datos.logo ? '<img src="' + esc(datos.logo) + '" class="if-portada-logo" alt="">' : "";
    const logoMini = datos.logo ? '<img src="' + esc(datos.logo) + '" class="if-membrete-logo" alt="">' : "";
    const fuente = '<p class="if-fuente">FUENTE: ' + esc(empresa.toUpperCase()) + ", " + e.anio + ".</p>";
    let n = 1;
    const bloques = e.dimensiones.map(function (dim) {
      if (!dim.datos.length) return "";
      const k = n++;
      return '<h3 class="if-subseccion">' + esc(dim.titulo.toUpperCase()) + '</h3><p class="if-fuerte">Gráfico ' + k + ".-</p>" +
        graficoPastel(dim.datos.map(function (d) { return { etiqueta: d.etiqueta, valor: d.n }; })) +
        "<p>" + parrafo(dim, dim.datos, k) + "</p>" + fuente;
    }).join("");
    const concl = conclusiones(e);
    const reco = (datos.recomendaciones || "").trim();
    return '<section class="if-portada">' +
      '<div class="if-portada-banda"></div><div class="if-portada-marca">' + logo + "</div>" +
      '<div class="if-portada-centro"><p class="if-portada-unidad">Unidad de Seguridad y Salud Ocupacional</p>' +
      '<p class="if-portada-servicio">Vigilancia de la Salud en el Trabajo</p><div class="if-portada-regla"></div>' +
      '<h1 class="if-portada-titulo">Programa integral de prevención y reducción<br>del uso y consumo de alcohol, tabaco y otras drogas</h1>' +
      '<p class="if-portada-mes">Diagnóstico inicial · Año ' + e.anio + '</p><div class="if-portada-regla"></div>' +
      '<p class="if-portada-empresa">' + esc(empresa) + "</p></div>" +
      '<div class="if-portada-pie"><table class="if-portada-datos"><tr><th>Elaborado por</th><td>' + esc(datos.quien || "No identificado") +
      "</td></tr><tr><th>Fecha de elaboración</th><td>" + fechaLarga(new Date()) + "</td></tr></table></div>" +
      '<div class="if-portada-banda if-portada-banda-baja"></div></section>' +
      '<section class="if-contenido">' +
      '<header class="if-membrete">' + logoMini + '<div class="if-membrete-texto"><strong>' + esc(empresa) +
      "</strong><br>Unidad de Seguridad y Salud Ocupacional · Servicios Médicos</div>" +
      '<div class="if-membrete-ref">Diagnóstico inicial · Test A-T-D<br>Año ' + e.anio + "</div></header>" +
      "<p>La empresa <strong>" + esc(empresa.toUpperCase()) + "</strong>, en base al Acuerdo Interinstitucional expedido por el Ministerio del Trabajo, el Ministerio de Salud Pública y la Secretaría Técnica de Drogas (Acuerdo Ministerial MDT-2024-196), realizó durante el año " + e.anio + " el registro y levantamiento de información con el personal, desarrollando el <strong>diagnóstico inicial</strong> de consumo de alcohol, tabaco y otras drogas.</p>" +
      "<p>En el diagnóstico se analizan las diferentes variables que pueden intervenir en el uso y consumo de alcohol, tabaco y otras drogas: la principal droga de consumo, su frecuencia, las condiciones que motivan al consumo, y las recomendaciones y conclusiones respectivas. A continuación se desarrolla el análisis gráfico de las diferentes variables evaluadas.</p>" +
      '<h2 class="if-seccion">Distribución de empleados participantes</h2>' +
      (e.edad ? '<h3 class="if-subseccion">Distribución por edad</h3>' + graficoPastel(e.edad.buckets.map(function (b) { return { etiqueta: b.etiqueta, valor: b.n }; })) +
        "<p>La edad promedio de las personas evaluadas fue de " + e.edad.promedio + " años.</p>" : "") +
      bloques +
      (concl.length ? '<h2 class="if-seccion">Análisis y conclusiones</h2><ul class="if-lista">' + concl.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>" : "") +
      (reco ? '<h2 class="if-seccion">Recomendaciones</h2>' + reco.split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("") : "") +
      '<p style="margin-top:10mm;">Responsable del Diagnóstico Inicial:</p>' +
      '<div class="if-firmas"><div class="if-firma"><div class="if-firma-linea"></div>' +
      '<p class="if-firma-nombre">' + esc(datos.quien || "No identificado") + "</p>" +
      (datos.cargo ? '<p class="if-firma-rotulo">' + esc(datos.cargo) + "</p>" : "") +
      (datos.registro ? '<p class="if-firma-rotulo">N.° de Registro: ' + esc(datos.registro) + "</p>" : "") +
      '<p class="if-firma-rotulo">Departamento Médico</p><p class="if-firma-rotulo">' + esc(empresa) + "</p></div></div>" +
      "</section>";
  }

  const CSS_INFORME = [
    "@page{size:A4 portrait;margin:16mm 15mm 18mm 20mm}",
    "html,body{margin:0;background:#fff}",
    "body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.45;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    ".if-portada{display:flex;flex-direction:column;height:261mm;page-break-after:always;text-align:center}",
    ".if-portada-banda{height:6mm;background:#1b5e20;flex-shrink:0}",
    ".if-portada-banda-baja{height:3mm;background:#EB9500}",
    ".if-portada-marca{padding-top:14mm;flex-shrink:0;min-height:20mm}",
    ".if-portada-logo{max-width:66mm;max-height:34mm}",
    ".if-portada-centro{display:flex;flex-direction:column;justify-content:center;flex:1;padding:0 22mm}",
    ".if-portada-unidad{margin:0;font-size:10.5pt;letter-spacing:.9pt;color:#555;text-transform:uppercase}",
    ".if-portada-servicio{margin:2mm 0 0;font-size:11pt;color:#555}",
    ".if-portada-regla{width:48mm;height:0;margin:13mm auto;border-top:1.2pt solid #1b5e20}",
    ".if-portada-titulo{margin:0;font-size:22pt;font-weight:bold;line-height:1.4;color:#00450d}",
    ".if-portada-mes{margin:9mm 0 0;font-size:16pt;font-weight:bold;letter-spacing:1.8pt;text-transform:uppercase}",
    ".if-portada-empresa{margin:0;font-size:13.5pt;font-weight:bold;letter-spacing:.7pt;text-transform:uppercase}",
    ".if-portada-pie{padding-bottom:6mm;flex-shrink:0}",
    ".if-portada-datos{width:112mm;margin:0 auto;font-size:9.5pt;text-align:left;border-collapse:collapse}",
    ".if-portada-datos th,.if-portada-datos td{padding:2.4mm 3.2mm;border:.5pt solid #b7d2b7}",
    ".if-portada-datos th{width:42%;font-weight:bold;color:#00450d;background:#e6f0e6}",
    ".if-contenido p{margin:0 0 3mm;text-align:justify}",
    ".if-membrete{display:flex;gap:5mm;align-items:center;padding-bottom:3mm;margin-bottom:7mm;border-bottom:1.2pt solid #1b5e20}",
    ".if-membrete-logo{max-width:24mm;max-height:14mm}",
    ".if-membrete-texto{flex:1;font-size:9pt;line-height:1.35;text-align:left}",
    ".if-membrete-ref{font-size:8.5pt;color:#555;text-align:right}",
    ".if-seccion{padding-bottom:1.3mm;margin:8mm 0 3.5mm;font-size:11.5pt;font-weight:bold;color:#00450d;border-bottom:.5pt solid #b7d2b7;page-break-after:avoid}",
    ".if-subseccion{margin:6mm 0 2mm;font-size:10.5pt;page-break-after:avoid}",
    ".if-fuente{font-size:8pt;color:#555;margin-bottom:5mm!important}",
    ".if-lista{margin:0 0 3mm 7mm;padding:0}.if-lista li{margin-bottom:1.6mm}",
    ".if-nota{font-style:italic;color:#555}.if-fuerte{font-weight:bold}",
    "svg{page-break-inside:avoid}",
    ".if-firmas{display:flex;gap:18mm;justify-content:space-around;margin-top:30mm;text-align:center;page-break-inside:avoid}",
    ".if-firma{flex:1;max-width:74mm}",
    ".if-firma-rotulo{margin:0 0 1.5mm!important;font-size:8pt;letter-spacing:.6pt;color:#00450d;text-align:center!important;text-transform:uppercase}",
    ".if-firma-linea{height:0;margin-bottom:2.5mm;border-top:.75pt solid #1b5e20}",
    ".if-firma-nombre{margin:0!important;font-size:10pt;font-weight:bold;text-align:center!important}"
  ].join("\n");

  function generarInforme() {
    const anio = parseInt(el("atd-anio").value, 10) || new Date().getFullYear();
    const filas = st.filas.filter(function (f) { return f.anio === anio; });
    if (!filas.length) return alert("No hay respuestas del cuestionario para ese año.");
    const datos = {
      empresa: st.empresa ? st.empresa.nombre : "Empresa",
      logo: st.empresa && st.empresa.logo ? nexusDb.storage.from("portadas").getPublicUrl(st.empresa.logo).data.publicUrl : "",
      quien: el("atd-quien").value.trim(),
      cargo: el("atd-cargo").value.trim(),
      registro: el("atd-registro").value.trim(),
      recomendaciones: el("atd-recomendaciones").value
    };
    try { localStorage.setItem(CLAVE_FIRMA, JSON.stringify({ quien: datos.quien, cargo: datos.cargo, registro: datos.registro })); } catch (e) { /* nada */ }

    const v = window.open("", "_blank");
    if (!v) return alert("El navegador bloqueó la ventana del informe. Permite las ventanas emergentes para esta página.");
    const titulo = "Informe A-T-D · " + datos.empresa + " · " + anio;
    v.document.open();
    v.document.write("<!doctype html><html lang='es'><head><meta charset='utf-8'><title>" + esc(titulo) + "</title><style>" + CSS_INFORME +
      "</style></head><body>" + documentoInforme(estadisticas(filas, anio), datos) + "</body></html>");
    v.document.close();
    const imprimir = function () { v.focus(); v.print(); };
    const imgs = Array.from(v.document.images);
    if (!imgs.length) return setTimeout(imprimir, 300);
    let faltan = imgs.length;
    const listo = function () { if (--faltan <= 0) setTimeout(imprimir, 200); };
    imgs.forEach(function (i) { if (i.complete) listo(); else { i.onload = listo; i.onerror = listo; } });
  }

  // Conexión de controles (existen en empresas.html)
  function conectar() {
    if (!el("nomina-pestanas")) return;
    el("buscar-atd").addEventListener("input", pintarRespuestas);
    el("btn-excel-atd").addEventListener("click", excel);
    el("btn-informe-atd").addEventListener("click", generarInforme);
    el("atd-recomendaciones").addEventListener("input", function () { this.dataset.editado = "1"; });
  }
  conectar();

  window.NexusAtdAdmin = { montar: montar, _doc: documentoInforme, _stats: estadisticas };
})();
