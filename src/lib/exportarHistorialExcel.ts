import ExcelJS from "exceljs";
import { formatearFecha } from "@/lib/vacaciones.utils";
import type { SolicitudHistorial, TotalesAnio } from "@/app/actions/vacaciones";

const COLOR_APROBADA = "FFC6EFCE";
const COLOR_PENDIENTE = "FFFFEB9C";
const COLOR_BAJA = "FFFFC7CE";

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
 * Genera el nombre del archivo para la exportación de historial.
 * @param extension - Extensión del archivo (por defecto "xlsx")
 */
export function nombreArchivoHistorial(
  nombreEmpleado: string,
  anioFiltrado?: number,
  extension: "xlsx" | "pdf" = "xlsx"
): string {
  const apellido = nombreEmpleado.includes(", ")
    ? nombreEmpleado.split(",")[0].trim()
    : nombreEmpleado.trim().split(/\s+/).pop() ?? nombreEmpleado;
  const apellidoSanitizado = apellido.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]/g, "");
  const anioStr = anioFiltrado ?? "todos";
  return `historial_vacaciones_${apellidoSanitizado}_${anioStr}.${extension}`;
}

/**
 * Exporta el historial de vacaciones a un archivo Excel.
 * Retorna un Buffer listo para enviar como descarga.
 */
export async function exportarHistorialExcel(
  solicitudes: SolicitudHistorial[],
  totalesPorAnio: TotalesAnio[],
  nombreEmpleado: string,
  anioFiltrado?: number
): Promise<Buffer> {
  const fechaGeneracion = formatearFecha(new Date());
  const wb = new ExcelJS.Workbook();

  // --- HOJA 1: Solicitudes ---
  const wsSolicitudes = wb.addWorksheet("Solicitudes");
  wsSolicitudes.addRow(["Empleado", nombreEmpleado, "Fecha de generación", fechaGeneracion]);
  wsSolicitudes.addRow(["Año", "Desde", "Hasta", "Días solicitados", "Días restantes", "Estado"]);

  for (const s of solicitudes) {
    const row = wsSolicitudes.addRow([
      anioDeFecha(s.fechaDesde),
      formatearFecha(s.fechaDesde),
      formatearFecha(s.fechaHasta),
      s.diasSolicitados,
      s.diasRestantes,
      estadoATexto(s.estado),
    ]);
    const color =
      s.estado === "APROBADA"
        ? COLOR_APROBADA
        : s.estado === "PENDIENTE"
          ? COLOR_PENDIENTE
          : COLOR_BAJA;
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color },
      };
    }
  }

  // --- HOJA 2: Resumen por año ---
  const valorNull = "—";
  const wsResumen = wb.addWorksheet("Resumen por año");
  wsResumen.addRow(["Empleado", nombreEmpleado, "Fecha de generación", fechaGeneracion]);
  wsResumen.addRow([
    "Año",
    "Disponibles",
    "Pendientes",
    "Aprobados",
    "Dados de baja",
    "Usados",
    "Restantes",
  ]);

  for (const t of totalesPorAnio) {
    wsResumen.addRow([
      t.anio,
      t.diasDisponibles ?? valorNull,
      t.diasPendientes,
      t.diasAprobados,
      t.diasBaja,
      t.diasUsados,
      t.diasRestantes ?? valorNull,
    ]);
  }

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
    wsResumen.addRow([
      "TOTALES",
      totales.diasDisponibles || valorNull,
      totales.diasPendientes,
      totales.diasAprobados,
      totales.diasBaja,
      totales.diasUsados,
      totales.diasRestantes || valorNull,
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
