// =====================================================================
// NEXUS ACADEMY · INFORME DE CAPACITACIÓN POR EMPRESA (PDF)
// Carpeta: js/reporte-empresa.js
//
// NexusReporte.generar(empresa, { desde, hasta }) arma un PDF A4 con:
//   1. Datos de la empresa y período
//   2. Cifras: capacitaciones, horas, personas, certificados, cobertura
//   3. Capacitaciones realizadas (tabla)
//   4. Personas capacitadas (horas acumuladas)
//   5. Anexo: nómina de cada capacitación con estado y código de
//      certificado (evidencia para auditoría)
// Lo usa empresas.html (solo administradores; las reglas RLS lo permiten).
// Requiere jsPDF (ya cargado en empresas.html).
// =====================================================================

const NexusReporte = (function () {
  const AZUL = [18, 58, 122];
  const AZUL_NOCHE = [10, 43, 93];
  const DORADO = [227, 179, 65];
  const TINTA = [20, 32, 58];
  const GRIS = [85, 98, 122];
  const NIEBLA = [218, 226, 238];
  const FONDO = [245, 247, 251];
  const VERDE = [31, 122, 77];
  const ROJO = [179, 64, 42];
  const MODALIDAD = { presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" };
  const M = 14, W = 210, H = 297, ANCHO = W - 2 * M;

  // ---------- datos ----------
  // Trae todas las filas (Supabase entrega como máximo 1000 por consulta)
  async function todo(crear) {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await crear().range(desde, desde + 999);
      if (error) throw error;
      filas.push.apply(filas, data || []);
      if (!data || data.length < 1000) return filas;
    }
  }

  async function porConvocatorias(tabla, columnas, ids) {
    const filas = [];
    for (let i = 0; i < ids.length; i += 80) {            // de 80 en 80 para no alargar la URL
      const grupo = ids.slice(i, i + 80);
      filas.push.apply(filas, await todo(function () {
        return nexusDb.from(tabla).select(columnas).in("convocatoria_id", grupo).order("id");
      }));
    }
    return filas;
  }

  function fechaDe(c) { return c.fecha_capacitacion || String(c.creado_en).slice(0, 10); }

  async function cargar(empresa, desde, hasta) {
    let convs = await todo(function () {
      return nexusDb.from("cap_convocatorias")
        .select("id, modalidad, horas, fecha_capacitacion, creado_en, cap_cursos(titulo, horas)")
        .eq("empresa_id", empresa.id).order("id");
    });
    convs = convs.filter(function (c) {
      const f = fechaDe(c);
      return (!desde || f >= desde) && (!hasta || f <= hasta);
    }).sort(function (a, b) { return fechaDe(a) < fechaDe(b) ? -1 : fechaDe(a) > fechaDe(b) ? 1 : 0; });

    const ids = convs.map(function (c) { return c.id; });
    if (ids.length === 0) return { convs: [], insc: [], certs: [], intentos: [] };
    const [insc, certs, intentos] = await Promise.all([
      porConvocatorias("cap_inscripciones", "id, convocatoria_id, cedula, nombres, modalidad", ids),
      porConvocatorias("cap_certificados", "id, convocatoria_id, inscripcion_id, cedula, codigo, tipo, nota", ids),
      porConvocatorias("cap_intentos", "convocatoria_id, inscripcion_id, nota", ids)
    ]);
    return { convs: convs, insc: insc, certs: certs, intentos: intentos };
  }

  function analizar(d) {
    const resumenConvs = d.convs.map(function (c) {
      const horas = Number(c.horas || (c.cap_cursos && c.cap_cursos.horas) || 0);
      const inscritos = d.insc.filter(function (i) { return i.convocatoria_id === c.id; });
      const certs = d.certs.filter(function (x) { return x.convocatoria_id === c.id; });
      const personas = inscritos.map(function (i) {
        const cert = certs.find(function (x) { return x.inscripcion_id === i.id || x.cedula === i.cedula; });
        const suyos = d.intentos.filter(function (x) { return x.inscripcion_id === i.id; });
        let estado = "Pendiente";
        if (cert) estado = cert.tipo === "asistencia" ? "Asistencia" : "Aprobado";
        else if (suyos.length) estado = "No aprobado";
        const mejor = suyos.reduce(function (m, x) { return Math.max(m, Number(x.nota)); }, -1);
        return {
          nombres: i.nombres, cedula: i.cedula, estado: estado,
          nota: cert && cert.nota !== null ? Number(cert.nota) : (mejor >= 0 ? mejor : null),
          codigo: cert ? cert.codigo : ""
        };
      }).sort(function (a, b) { return a.nombres.localeCompare(b.nombres, "es"); });
      const notas = certs.filter(function (x) { return x.tipo !== "asistencia" && x.nota !== null; }).map(function (x) { return Number(x.nota); });
      return {
        id: c.id, fecha: fechaDe(c), titulo: c.cap_cursos ? c.cap_cursos.titulo : "(programa eliminado)",
        modalidad: MODALIDAD[c.modalidad] || c.modalidad, horas: horas,
        inscritos: inscritos.length, certificados: certs.length,
        pendientes: Math.max(0, inscritos.length - certs.length),
        promedio: notas.length ? notas.reduce(function (s, n) { return s + n; }, 0) / notas.length : null,
        personas: personas
      };
    });

    // Personas capacitadas: una fila por cédula con al menos un certificado
    const porCedula = {};
    resumenConvs.forEach(function (c) {
      c.personas.forEach(function (p) {
        if (!p.codigo) return;
        const r = porCedula[p.cedula] || (porCedula[p.cedula] = { nombres: p.nombres, cedula: p.cedula, capacitaciones: 0, horas: 0 });
        r.capacitaciones++;
        r.horas += c.horas;
      });
    });
    const personas = Object.keys(porCedula).map(function (k) { return porCedula[k]; })
      .sort(function (a, b) { return a.nombres.localeCompare(b.nombres, "es"); });

    const todasNotas = d.certs.filter(function (x) { return x.tipo !== "asistencia" && x.nota !== null; }).map(function (x) { return Number(x.nota); });
    return {
      convs: resumenConvs,
      personas: personas,
      totales: {
        capacitaciones: resumenConvs.length,
        horas: resumenConvs.reduce(function (s, c) { return s + c.horas; }, 0),
        horasPersona: personas.reduce(function (s, p) { return s + p.horas; }, 0),
        personas: personas.length,
        certificados: d.certs.length,
        inscritos: d.insc.length,
        promedio: todasNotas.length ? todasNotas.reduce(function (s, n) { return s + n; }, 0) / todasNotas.length : null
      }
    };
  }

  // ---------- dibujo ----------
  function num(n, dec) {
    return Number(n).toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: dec === undefined ? 1 : dec });
  }
  function fechaCorta(iso) {
    const p = String(iso).slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }
  function fechaLarga(iso) {
    return new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
  }

  function crearDoc() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const ctx = { doc: doc, y: M };
    ctx.color = function (c, tipo) {
      if (tipo === "texto") doc.setTextColor(c[0], c[1], c[2]);
      else if (tipo === "relleno") doc.setFillColor(c[0], c[1], c[2]);
      else doc.setDrawColor(c[0], c[1], c[2]);
    };
    ctx.texto = function (t, x, y, o) {
      o = Object.assign({ tam: 10, color: TINTA, estilo: "normal", alinear: "left" }, o);
      doc.setFont("helvetica", o.estilo);
      doc.setFontSize(o.tam);
      ctx.color(o.color, "texto");
      doc.text(t, x, y, { align: o.alinear, maxWidth: o.max });
    };
    ctx.espacio = function (alto) {   // salta de página si no cabe
      if (ctx.y + alto > H - 18) { doc.addPage(); ctx.y = M + 4; return true; }
      return false;
    };
    ctx.titulo = function (t, sub) {
      ctx.espacio(sub ? 20 : 14);
      ctx.y += 4;
      ctx.color(DORADO, "relleno");
      doc.rect(M, ctx.y - 4.2, 1.6, 5.6, "F");
      ctx.texto(t, M + 4, ctx.y, { tam: 13, estilo: "bold", color: AZUL });
      ctx.y += 5;
      if (sub) { ctx.texto(sub, M + 4, ctx.y, { tam: 8.5, color: GRIS }); ctx.y += 5; }
      ctx.y += 1;
    };
    return ctx;
  }

  // Tabla con encabezado repetido en cada página. cols: [{ t, w, al }]
  function tabla(ctx, cols, filas, opciones) {
    const doc = ctx.doc;
    opciones = opciones || {};
    const tam = opciones.tam || 8.5;
    const lineaH = tam * 0.45;
    function encabezado() {
      ctx.color(AZUL, "relleno");
      doc.rect(M, ctx.y, ANCHO, 7, "F");
      let x = M;
      cols.forEach(function (c) {
        const tx = c.al === "right" ? x + c.w - 2 : c.al === "center" ? x + c.w / 2 : x + 2;
        ctx.texto(c.t, tx, ctx.y + 4.7, { tam: 8, estilo: "bold", color: [255, 255, 255], alinear: c.al || "left" });
        x += c.w;
      });
      ctx.y += 7;
    }
    if (filas.length === 0) {
      ctx.espacio(10);
      ctx.texto(opciones.vacio || "Sin registros.", M, ctx.y + 5, { tam: 9, color: GRIS });
      ctx.y += 9;
      return;
    }
    ctx.espacio(16);
    encabezado();
    filas.forEach(function (f, n) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(tam);
      const celdas = cols.map(function (c, i) {
        let lineas = doc.splitTextToSize(String(f[i] === null || f[i] === undefined ? "" : f[i]), c.w - 4);
        if (lineas.length > 2) { lineas = lineas.slice(0, 2); lineas[1] = lineas[1].replace(/.{0,2}$/, "…"); }
        return lineas;
      });
      const alto = Math.max(6, 2.6 + Math.max.apply(null, celdas.map(function (l) { return l.length; })) * lineaH + 1.4);
      if (ctx.espacio(alto)) encabezado();
      if (n % 2 === 1) { ctx.color(FONDO, "relleno"); doc.rect(M, ctx.y, ANCHO, alto, "F"); }
      let x = M;
      cols.forEach(function (c, i) {
        const tx = c.al === "right" ? x + c.w - 2 : c.al === "center" ? x + c.w / 2 : x + 2;
        const estilo = opciones.colorCelda ? opciones.colorCelda(f, i) : null;
        ctx.texto(celdas[i], tx, ctx.y + 4.1, { tam: tam, alinear: c.al || "left", color: estilo || TINTA, estilo: estilo ? "bold" : "normal" });
        x += c.w;
      });
      ctx.y += alto;
      ctx.color(NIEBLA, "linea");
      doc.setLineWidth(0.2);
      doc.line(M, ctx.y, M + ANCHO, ctx.y);
    });
    ctx.y += 3;
  }

  function cifras(ctx, lista) {
    const doc = ctx.doc;
    const porFila = 3, gap = 4, w = (ANCHO - gap * (porFila - 1)) / porFila, h = 20;
    lista.forEach(function (c, i) {
      const col = i % porFila, fila = Math.floor(i / porFila);
      const x = M + col * (w + gap), y = ctx.y + fila * (h + gap);
      ctx.color(c.destacada ? AZUL : FONDO, "relleno");
      doc.roundedRect(x, y, w, h, 2, 2, "F");
      ctx.texto(c.valor, x + 4, y + 9.5, { tam: 16, estilo: "bold", color: c.destacada ? [255, 255, 255] : AZUL });
      ctx.texto(c.etiqueta, x + 4, y + 15.5, { tam: 8, color: c.destacada ? [207, 219, 239] : GRIS });
    });
    ctx.y += Math.ceil(lista.length / porFila) * (h + gap) + 2;
  }

  function cabecera(ctx, empresa, periodo) {
    const doc = ctx.doc;
    ctx.color(AZUL_NOCHE, "relleno");
    doc.rect(0, 0, W, 30, "F");
    ctx.color(DORADO, "relleno");
    doc.rect(0, 30, W, 1.2, "F");
    // Marca (dos anillos)
    ctx.color(DORADO, "relleno");
    doc.circle(M + 3, 13, 2.6, "F");
    ctx.color(DORADO, "linea");
    doc.setLineWidth(1.1);
    doc.circle(M + 9.4, 13, 2.6, "S");
    ctx.texto("Nexus Academy", M + 15, 14.5, { tam: 13, estilo: "bold", color: [255, 255, 255] });
    ctx.texto("Plataforma de capacitación · VitalWork S.A.S.", M + 15, 20, { tam: 8, color: [207, 219, 239] });
    ctx.texto("INFORME DE CAPACITACIÓN", W - M, 14.5, { tam: 11, estilo: "bold", color: DORADO, alinear: "right" });
    ctx.texto("Emitido el " + new Date().toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" }), W - M, 20, { tam: 8, color: [207, 219, 239], alinear: "right" });

    ctx.y = 42;
    ctx.texto(empresa.nombre, M, ctx.y, { tam: 18, estilo: "bold", color: TINTA, max: ANCHO });
    ctx.y += 7;
    const datos = [];
    if (empresa.ruc) datos.push("RUC " + empresa.ruc);
    if (empresa.num_trabajadores) datos.push(num(empresa.num_trabajadores, 0) + " trabajadores");
    if (empresa.contacto) datos.push("Contacto: " + empresa.contacto);
    if (datos.length) { ctx.texto(datos.join("   ·   "), M, ctx.y, { tam: 9, color: GRIS, max: ANCHO }); ctx.y += 5; }
    ctx.texto("Período: " + periodo, M, ctx.y, { tam: 9, estilo: "bold", color: AZUL });
    ctx.y += 8;
  }

  function pies(ctx, sitio) {
    const doc = ctx.doc;
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      ctx.color(NIEBLA, "linea");
      doc.setLineWidth(0.3);
      doc.line(M, H - 12, W - M, H - 12);
      ctx.texto("Cada certificado se puede verificar con su código en " + sitio + "verificar.html", M, H - 7.5, { tam: 7.5, color: GRIS });
      ctx.texto("Página " + i + " de " + total, W - M, H - 7.5, { tam: 7.5, color: GRIS, alinear: "right" });
    }
  }

  async function generar(empresa, opciones) {
    opciones = opciones || {};
    const desde = opciones.desde || null, hasta = opciones.hasta || null;
    const datos = analizar(await cargar(empresa, desde, hasta));
    const t = datos.totales;
    const periodo = desde && hasta ? "del " + fechaLarga(desde) + " al " + fechaLarga(hasta)
      : desde ? "desde el " + fechaLarga(desde) : hasta ? "hasta el " + fechaLarga(hasta) : "todas las capacitaciones registradas";

    const ctx = crearDoc();
    const doc = ctx.doc;
    cabecera(ctx, empresa, periodo);

    // 1. Cifras
    const lista = [
      { valor: num(t.capacitaciones, 0), etiqueta: "Capacitaciones realizadas" },
      { valor: num(t.horas), etiqueta: "Horas de capacitación impartidas" },
      { valor: num(t.personas, 0), etiqueta: "Personas capacitadas (con certificado)" },
      { valor: num(t.certificados, 0), etiqueta: "Certificados emitidos" },
      { valor: num(t.horasPersona), etiqueta: "Horas-persona de formación" },
      { valor: t.promedio === null ? "—" : num(t.promedio) + " %", etiqueta: "Nota promedio de aprobación" }
    ];
    if (empresa.num_trabajadores) {
      const pct = Math.min(100, Math.round(t.personas * 100 / empresa.num_trabajadores));
      lista[2].destacada = true;
      lista[2].etiqueta = "Personas capacitadas · " + pct + " % del personal";
    } else {
      lista[2].destacada = true;
    }
    cifras(ctx, lista);

    if (empresa.num_trabajadores) {
      const pct = Math.min(1, t.personas / empresa.num_trabajadores);
      ctx.texto("Cobertura del personal: " + num(t.personas, 0) + " de " + num(empresa.num_trabajadores, 0) +
        " trabajadores han recibido al menos una capacitación con certificado.", M, ctx.y, { tam: 9, color: TINTA, max: ANCHO });
      ctx.y += 3.5;
      ctx.color(NIEBLA, "relleno");
      doc.roundedRect(M, ctx.y, ANCHO, 3.5, 1.7, 1.7, "F");
      if (pct > 0) { ctx.color(VERDE, "relleno"); doc.roundedRect(M, ctx.y, Math.max(3.5, ANCHO * pct), 3.5, 1.7, 1.7, "F"); }
      ctx.y += 9;
    }

    // 2. Capacitaciones
    ctx.titulo("Capacitaciones realizadas", "Inscritos: personas que se registraron. Pendientes: inscritos que aún no obtienen certificado.");
    tabla(ctx, [
      { t: "Fecha", w: 21 }, { t: "Programa", w: 55 }, { t: "Modalidad", w: 19 }, { t: "Horas", w: 12, al: "right" },
      { t: "Inscritos", w: 16, al: "right" }, { t: "Certificados", w: 21, al: "right" }, { t: "Pendientes", w: 19, al: "right" },
      { t: "Nota prom.", w: 19, al: "right" }
    ], datos.convs.map(function (c) {
      return [fechaCorta(c.fecha), c.titulo, c.modalidad, num(c.horas), num(c.inscritos, 0), num(c.certificados, 0),
        num(c.pendientes, 0), c.promedio === null ? "—" : num(c.promedio)];
    }), { vacio: "No hay capacitaciones en el período seleccionado." });

    // 3. Personas
    ctx.titulo("Personas capacitadas", "Una fila por persona: capacitaciones con certificado y horas acumuladas en el período.");
    tabla(ctx, [
      { t: "N.º", w: 10, al: "right" }, { t: "Apellidos y nombres", w: 86 }, { t: "Cédula", w: 30 },
      { t: "Capacitaciones", w: 28, al: "right" }, { t: "Horas", w: 28, al: "right" }
    ], datos.personas.map(function (p, i) {
      return [i + 1, p.nombres, p.cedula, num(p.capacitaciones, 0), num(p.horas)];
    }), { vacio: "Aún no hay personas con certificado en el período." });

    // 4. Anexo: nómina de cada capacitación
    if (datos.convs.length) {
      doc.addPage();
      ctx.y = M + 4;
      ctx.texto("Anexo · Nómina por capacitación", M, ctx.y, { tam: 15, estilo: "bold", color: AZUL });
      ctx.y += 6;
      ctx.texto("Estado de cada participante y código de su certificado.", M, ctx.y, { tam: 9, color: GRIS });
      ctx.y += 4;
      datos.convs.forEach(function (c) {
        ctx.titulo(c.titulo, fechaCorta(c.fecha) + " · " + c.modalidad + " · " + num(c.horas) + " h · " +
          num(c.certificados, 0) + " de " + num(c.inscritos, 0) + " con certificado");
        tabla(ctx, [
          { t: "N.º", w: 9, al: "right" }, { t: "Apellidos y nombres", w: 68 }, { t: "Cédula", w: 25 },
          { t: "Estado", w: 25 }, { t: "Nota", w: 14, al: "right" }, { t: "Código del certificado", w: 41 }
        ], c.personas.map(function (p, i) {
          return [i + 1, p.nombres, p.cedula, p.estado, p.nota === null ? "—" : num(p.nota), p.codigo || "—"];
        }), {
          tam: 8,
          vacio: "Nadie se ha registrado en esta capacitación.",
          colorCelda: function (f, i) {
            if (i !== 3) return null;
            return f[3] === "Aprobado" || f[3] === "Asistencia" ? VERDE : f[3] === "No aprobado" ? ROJO : null;
          }
        });
      });
    }

    pies(ctx, opciones.sitio || "");
    const nombre = "informe_capacitacion_" + empresa.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() + ".pdf";
    doc.save(nombre);
    return t;
  }

  return { generar: generar };
})();
