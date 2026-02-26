import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as fs from "fs";
import * as path from "path";
import { formatearFecha } from "@/lib/vacaciones.utils";
import { nombreArchivoHistorial } from "@/lib/exportarHistorialExcel";
import type { SolicitudHistorial, TotalesAnio } from "@/app/actions/vacaciones";

const VALOR_NULL = "—";
const COLOR_VERDE = [22, 163, 74] as [number, number, number]; // #16A34A
const COLOR_NARANJA = [217, 119, 6] as [number, number, number]; // #D97706
const COLOR_ROJO = [220, 38, 38] as [number, number, number]; // #DC2626
const COLOR_GRIS_FONDO = [243, 244, 246] as [number, number, number]; // #F3F4F6

function estadoATexto(estado: SolicitudHistorial["estado"]): string {
  switch (estado) {
    case "APROBADA":
      return "Aprobada";
    case "PENDIENTE":
      return "Pendiente";
    case "BAJA":
      return "Baja";
    default:
      return String(estado);
  }
}

function anioDeFecha(fecha: Date): number {
  return new Date(fecha).getFullYear();
}

/**
 * Genera el nombre del archivo PDF para la exportación de historial.
 */
export function nombreArchivoHistorialPDF(
  nombreEmpleado: string,
  anioFiltrado?: number
): string {
  return nombreArchivoHistorial(nombreEmpleado, anioFiltrado, "pdf");
}

/**
 * Exporta el historial de vacaciones a PDF.
 * Retorna un Buffer listo para enviar como descarga.
 */
export function exportarHistorialPDF(
  solicitudes: SolicitudHistorial[],
  totalesPorAnio: TotalesAnio[],
  nombreEmpleado: string,
  anioFiltrado?: number
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fechaGeneracion = formatearFecha(new Date());
  const periodo =
    anioFiltrado !== undefined ? `Año ${anioFiltrado}` : "Todos los años";
  const margin = 14;
  let y = 20;

  // --- Logo (si existe) ---
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      const logoBase64 = fs.readFileSync(logoPath).toString("base64");
      doc.addImage(logoBase64, "PNG", margin, 10, 40, 40);
      y = 55;
    } catch {
      y = 20;
    }
  }

  // --- Encabezado ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HISTORIAL DE VACACIONES", 105, y, { align: "center" });
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(nombreEmpleado, 105, y, { align: "center" });
  y += 6;

  doc.setFontSize(10);
  doc.text(`Período: ${periodo}`, 105, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.text(`Generado el ${fechaGeneracion}`, 210 - margin, y, {
    align: "right",
  });
  y += 12;

  doc.setDrawColor(200);
  doc.line(margin, y, 210 - margin, y);
  y += 10;

  // --- SECCIÓN: RESUMEN POR AÑO ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN POR AÑO", margin, y);
  y += 8;

  const headResumen = [
    "Año",
    "Disponibles",
    "Pendientes",
    "Aprobados",
    "Baja",
    "Usados",
    "Restantes",
  ];
  const bodyResumen = totalesPorAnio.map((t) => [
    String(t.anio),
    t.diasDisponibles !== null ? String(t.diasDisponibles) : VALOR_NULL,
    String(t.diasPendientes),
    String(t.diasAprobados),
    String(t.diasBaja),
    String(t.diasUsados),
    t.diasRestantes !== null ? String(t.diasRestantes) : VALOR_NULL,
  ]);

  if (totalesPorAnio.length > 0) {
    const totales = totalesPorAnio.reduce(
      (acc, t) => ({
        diasDisponibles: acc.diasDisponibles + (t.diasDisponibles ?? 0),
        diasPendientes: acc.diasPendientes + t.diasPendientes,
        diasAprobados: acc.diasAprobados + t.diasAprobados,
        diasBaja: acc.diasBaja + t.diasBaja,
        diasUsados: acc.diasUsados + t.diasUsados,
        diasRestantes: acc.diasRestantes + (t.diasRestantes ?? 0),
      }),
      {
        diasDisponibles: 0,
        diasPendientes: 0,
        diasAprobados: 0,
        diasBaja: 0,
        diasUsados: 0,
        diasRestantes: 0,
      }
    );
    bodyResumen.push([
      "TOTALES",
      totales.diasDisponibles ? String(totales.diasDisponibles) : VALOR_NULL,
      String(totales.diasPendientes),
      String(totales.diasAprobados),
      String(totales.diasBaja),
      String(totales.diasUsados),
      totales.diasRestantes ? String(totales.diasRestantes) : VALOR_NULL,
    ]);
  }

  autoTable(doc, {
    head: [headResumen],
    body: bodyResumen,
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fontStyle: "bold" },
    didParseCell: (data) => {
      if (data.row.index === bodyResumen.length - 1 && bodyResumen.length > 0) {
        data.cell.styles.fillColor = COLOR_GRIS_FONDO;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // --- SECCIÓN: DETALLE DE SOLICITUDES ---
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE DE SOLICITUDES", margin, y);
  y += 8;

  const headDetalle = ["Año", "Desde", "Hasta", "Días", "Restantes", "Estado"];
  const bodyDetalle = solicitudes.map((s) => [
    String(anioDeFecha(s.fechaDesde)),
    formatearFecha(s.fechaDesde),
    formatearFecha(s.fechaHasta),
    String(s.diasSolicitados),
    String(s.diasRestantes),
    estadoATexto(s.estado),
  ]);

  autoTable(doc, {
    head: [headDetalle],
    body: bodyDetalle,
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fontStyle: "bold" },
    columnStyles: {
      5: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const estado = solicitudes[data.row.index]?.estado;
        if (estado === "APROBADA") {
          data.cell.styles.textColor = COLOR_VERDE;
        } else if (estado === "PENDIENTE") {
          data.cell.styles.textColor = COLOR_NARANJA;
        } else if (estado === "BAJA") {
          data.cell.styles.textColor = COLOR_ROJO;
        }
      }
    },
  });

  // --- Pie de página en cada hoja ---
  const docAny = doc as jsPDF & {
    internal?: {
      getNumberOfPages?: () => number;
      pageSize?: { width?: number; height?: number };
    };
    getNumberOfPages?: () => number;
  };
  const totalPages =
    docAny.getNumberOfPages?.() ??
    docAny.internal?.getNumberOfPages?.() ??
    1;
  const pageWidth = docAny.internal?.pageSize?.width ?? 210;
  const pageHeight = docAny.internal?.pageSize?.height ?? 297;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(nombreEmpleado, margin, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });
    doc.setTextColor(0);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
