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
    texto(doc, esAsistencia ? "Certificado de asistencia" : "Certificado de aprobación", CX, 52, { tam: 30, estilo: "bold", color: PINO });
    texto(doc, "Se certifica que", CX, 66, { tam: 13, color: GRIS });

    // --- Nombre ---
    const nombre = String(d.nombres || "").toUpperCase();
    texto(doc, nombre, CX, 81, { tam: nombre.length > 34 ? 22 : 27, estilo: "bold" });
    doc.setDrawColor(SENAL[0], SENAL[1], SENAL[2]);
    doc.setLineWidth(0.6);
    doc.line(CX - 85, 85, CX + 85, 85);

    let linea = "con cédula o pasaporte N.º " + d.cedula;
    if (d.empresa) linea += ", de la empresa " + d.empresa + ",";
    texto(doc, linea, CX, 94, { tam: 12, color: GRIS });
    texto(doc, esAsistencia ? "asistió a la capacitación" : "aprobó el curso", CX, 102, { tam: 12, color: GRIS });

    // --- Curso (puede ocupar dos líneas) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    const lineasCurso = doc.splitTextToSize(String(d.curso || ""), 210);
    doc.setTextColor(PINO[0], PINO[1], PINO[2]);
    doc.text(lineasCurso, CX, 113, { align: "center" });
    const yDespues = 113 + (lineasCurso.length - 1) * 8;

    // --- Duración, modalidad y nota ---
    const horas = Number(d.horas);
    let detalle = "con una duración de " + (horas === 1 ? "1 hora" : horas.toLocaleString("es-EC") + " horas");
    if (d.modalidad) detalle += ", en modalidad " + d.modalidad;
    if (!esAsistencia && d.nota !== null && d.nota !== undefined) {
      detalle += ", y una calificación de " + Number(d.nota).toLocaleString("es-EC", { maximumFractionDigits: 1 }) + " %";
    }
    texto(doc, detalle + ".", CX, yDespues + 10, { tam: 12, color: GRIS });

    // --- Firma (izquierda) ---
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.setLineWidth(0.3);
    doc.line(32, 170, 102, 170);
    texto(doc, "Responsable de capacitación", 67, 176, { tam: 10, estilo: "bold" });
    texto(doc, "VitalWork S.A.S.", 67, 181, { tam: 10, color: GRIS });

    // --- Fecha (centro) ---
    texto(doc, "Fecha de emisión", CX, 170, { tam: 10, color: GRIS });
    texto(doc, fechaLarga(d.emitido_en || d.fecha), CX, 176, { tam: 12, estilo: "bold" });

    // --- QR y código (derecha) ---
    const url = urlVerificacion(d.codigo);
    dibujarQR(doc, url, 238, 146, 30);
    texto(doc, "Código: " + d.codigo, 229, 162, { tam: 10, estilo: "bold", color: PINO_CLARO, alinear: "right" });
    texto(doc, "Escanea el código QR o verifica", 229, 168, { tam: 8.5, color: GRIS, alinear: "right" });
    texto(doc, "en la página de Nexus Learning", 229, 172.5, { tam: 8.5, color: GRIS, alinear: "right" });

    doc.save("Certificado_" + d.codigo + ".pdf");
  }

  return { generar: generar };
})();
