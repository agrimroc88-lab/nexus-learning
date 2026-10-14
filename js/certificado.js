// =====================================================================
// NEXUS LEARNING · CERTIFICADO EN PDF
// Carpeta: js/certificado.js
// Dibuja el certificado (A4 horizontal) con código QR de verificación.
// Para cambiar el diseño del certificado, solo se edita este archivo.
// Requiere: jsPDF y qrcode-generator (se cargan en curso.html).
// =====================================================================

const NexusCertificado = (function () {
  const PINO = [15, 61, 62];
  const PINO_CLARO = [28, 92, 93];
  const SENAL = [242, 193, 78];
  const TINTA = [23, 34, 32];
  const GRIS = [86, 101, 95];

  function urlVerificacion(codigo) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, "");
    return base + "verificar.html?codigo=" + encodeURIComponent(codigo);
  }

  function fechaLarga(valor) {
    const d = valor ? new Date(valor) : new Date();
    return d.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
  }

  function texto(doc, contenido, x, y, opciones) {
    const o = Object.assign({ tam: 12, color: TINTA, estilo: "normal", alinear: "center" }, opciones);
    doc.setFont("helvetica", o.estilo);
    doc.setFontSize(o.tam);
    doc.setTextColor(o.color[0], o.color[1], o.color[2]);
    doc.text(contenido, x, y, { align: o.alinear });
  }

  // Dibuja el QR con cuadrados (no necesita imágenes)
  function dibujarQR(doc, contenido, x, y, tamano) {
    const qr = qrcode(0, "M");
    qr.addData(contenido);
    qr.make();
    const n = qr.getModuleCount();
    const celda = tamano / n;
    doc.setFillColor(255, 255, 255);
    doc.rect(x - 2, y - 2, tamano + 4, tamano + 4, "F");
    doc.setFillColor(TINTA[0], TINTA[1], TINTA[2]);
    for (let fila = 0; fila < n; fila++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(fila, col)) {
          doc.rect(x + col * celda, y + fila * celda, celda + 0.02, celda + 0.02, "F");
        }
      }
    }
  }

  // Texto centrado en varias líneas; devuelve la "y" de la última línea
  function parrafo(doc, contenido, x, y, ancho, tam, alto) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tam);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    const lineas = doc.splitTextToSize(contenido, ancho).slice(0, 3);
    lineas.forEach(function (l, i) { doc.text(l, x, y + i * alto, { align: "center" }); });
    return y + (lineas.length - 1) * alto;
  }

  function horasTexto(h) {
    const n = Number(h) || 0;
    return n === 1 ? "1 hora" : n.toLocaleString("es-EC") + " horas";
  }

  function fechaCorta(iso) {
    // "2026-10-10" como fecha local (sin correr un día por la zona horaria)
    const p = String(iso).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      .toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
  }

  // Frase que describe cómo se realizó y con qué resultado
  function descripcion(d, esAsistencia) {
    const partes = [];
    partes.push((esAsistencia ? "Capacitación desarrollada" : "Curso desarrollado") +
      (d.modalidad ? " en modalidad " + d.modalidad : ""));
    if (d.fecha_capacitacion) partes.push("el " + fechaCorta(d.fecha_capacitacion));
    partes.push("con una duración de " + horasTexto(d.horas));
    let frase = partes.join(", ");
    if (!esAsistencia && d.nota !== null && d.nota !== undefined) {
      frase += ", habiendo aprobado la evaluación de conocimientos con una calificación de " +
        Number(d.nota).toLocaleString("es-EC", { maximumFractionDigits: 1 }) + " %";
    }
    return frase + ", como parte del programa de formación en Seguridad y Salud en el Trabajo.";
  }

  // Lista de subtemas: en una línea si son pocos; en dos columnas si son más.
  // Respeta el espacio de la firma y del código QR.
  function contenidos(doc, temas, cx, y) {
    texto(doc, "Contenidos desarrollados", cx, y + 4, { tam: 10, estilo: "bold", color: PINO });
    let yy = y + 10;
    const limite = 165;            // debajo empiezan firma, fecha y QR

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);

    if (temas.length <= 3) {
      doc.splitTextToSize(temas.join("  •  "), 210).slice(0, 2).forEach(function (l, i) {
        doc.text(l, cx, yy + i * 4.6, { align: "center" });
      });
      return;
    }

    const anchoCol = 84, x1 = cx - anchoCol - 2, x2 = cx + 4;   // la 2.ª columna termina antes del QR
    const filas = Math.max(1, Math.floor((limite - yy) / 4.6) + 1);
    let lista = temas.slice();
    if (lista.length > filas * 2) {
      lista = lista.slice(0, filas * 2 - 1);
      lista.push("Otros temas del programa");
    }
    const porColumna = Math.ceil(lista.length / 2);
    lista.forEach(function (t, i) {
      const x = i < porColumna ? x1 : x2;
      const fila = i < porColumna ? i : i - porColumna;
      let linea = doc.splitTextToSize(t, anchoCol - 5)[0];
      if (linea.length < t.length) linea = linea.replace(/\s*\S*$/, "") + "…";
      doc.setFillColor(SENAL[0], SENAL[1], SENAL[2]);
      doc.circle(x + 1.2, yy + fila * 4.6 - 1.1, 0.8, "F");
      doc.text(linea, x + 4, yy + fila * 4.6);
    });
  }

  function generar(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, CX = W / 2;

    // --- Marco ---
    doc.setFillColor(PINO[0], PINO[1], PINO[2]);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 10, W - 20, H - 20, 4, 4, "F");
    doc.setDrawColor(SENAL[0], SENAL[1], SENAL[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(15, 15, W - 30, H - 30, 3, 3, "S");

    // --- Marca ---
    doc.setFillColor(SENAL[0], SENAL[1], SENAL[2]);
    doc.circle(CX - 26, 30, 3.2, "F");
    doc.setDrawColor(SENAL[0], SENAL[1], SENAL[2]);
    doc.setLineWidth(1.4);
    doc.circle(CX - 18.5, 30, 3.2, "S");
    doc.line(CX - 22.8, 30, CX - 21.7, 30);
    texto(doc, "Nexus Learning", CX - 12, 31.6, { tam: 13, estilo: "bold", color: PINO, alinear: "left" });

    const esAsistencia = d.tipo === "asistencia";

    // --- Título ---
    texto(doc, esAsistencia ? "Certificado de asistencia" : "Certificado de aprobación", CX, 47, { tam: 28, estilo: "bold", color: PINO });
    texto(doc, "Se certifica que", CX, 57, { tam: 12, color: GRIS });

    // --- Nombre ---
    const nombre = String(d.nombres || "").toUpperCase();
    texto(doc, nombre, CX, 70, { tam: nombre.length > 34 ? 21 : 25, estilo: "bold" });
    doc.setDrawColor(SENAL[0], SENAL[1], SENAL[2]);
    doc.setLineWidth(0.6);
    doc.line(CX - 85, 74, CX + 85, 74);

    let linea = "con cédula o pasaporte N.º " + d.cedula;
    if (d.empresa) linea += ", de la empresa " + d.empresa + ",";
    texto(doc, linea, CX, 82, { tam: 11.5, color: GRIS });
    texto(doc, esAsistencia ? "asistió a la capacitación" : "aprobó el curso", CX, 88.5, { tam: 11.5, color: GRIS });

    // --- Curso (puede ocupar dos líneas) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const lineasCurso = doc.splitTextToSize(String(d.curso || ""), 220).slice(0, 2);
    doc.setTextColor(PINO[0], PINO[1], PINO[2]);
    doc.text(lineasCurso, CX, 98, { align: "center" });
    let y = 98 + (lineasCurso.length - 1) * 7.5;

    // --- Descripción ampliada: modalidad, fecha, duración y resultado ---
    y = parrafo(doc, descripcion(d, esAsistencia), CX, y + 8.5, 225, 10.5, 5);

    // --- Contenidos desarrollados (subtemas) ---
    const subtemas = (Array.isArray(d.subtemas) ? d.subtemas : []).map(function (t) { return String(t).trim(); }).filter(Boolean);
    if (subtemas.length) contenidos(doc, subtemas, CX, y + 3);

    // --- Firma (izquierda) ---
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.setLineWidth(0.3);
    doc.line(32, 174, 102, 174);
    texto(doc, "Responsable de capacitación", 67, 179, { tam: 10, estilo: "bold" });
    texto(doc, "VitalWork S.A.S.", 67, 184, { tam: 10, color: GRIS });

    // --- Fecha (centro) ---
    texto(doc, "Fecha de emisión", CX, 174, { tam: 10, color: GRIS });
    texto(doc, fechaLarga(d.emitido_en || d.fecha), CX, 180, { tam: 12, estilo: "bold" });

    // --- QR y código (derecha) ---
    const url = urlVerificacion(d.codigo);
    dibujarQR(doc, url, 240, 154, 28);
    texto(doc, "Código: " + d.codigo, 234, 170, { tam: 10, estilo: "bold", color: PINO_CLARO, alinear: "right" });
    texto(doc, "Escanea el código QR o verifica", 234, 176, { tam: 8.5, color: GRIS, alinear: "right" });
    texto(doc, "en la página de Nexus Learning", 234, 180.5, { tam: 8.5, color: GRIS, alinear: "right" });

    doc.save("Certificado_" + d.codigo + ".pdf");
  }

  return { generar: generar };
})();
