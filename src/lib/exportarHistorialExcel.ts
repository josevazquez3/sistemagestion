import * as XLSX from "xlsx";
import { formatearFecha } from "@/lib/vacaciones.utils";
import type { SolicitudHistorial, TotalesAnio } from "@/app/actions/vacaciones";

const COLOR_APROBADA = "C6EFCE";
const COLOR_PENDIENTE = "FFEB9C";
const COLOR_BAJA = "FFC7CE";

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
export function exportarHistorialExcel(
  solicitudes: SolicitudHistorial[],
  totalesPorAnio: TotalesAnio[],
  nombreEmpleado: string,
  anioFiltrado?: number
): Buffer {
  const fechaGeneracion = formatearFecha(new Date());

  const wb = XLSX.utils.book_new();

  // --- HOJA 1: Solicitudes ---
  const encabezadoSolicitudes = [
    ["Empleado", nombreEmpleado, "Fecha de generación", fechaGeneracion],
    ["Año", "Desde", "Hasta", "Días solicitados", "Días restantes", "Estado"],
    ...solicitudes.map((s) => [
      anioDeFecha(s.fechaDesde),
      formatearFecha(s.fechaDesde),
      formatearFecha(s.fechaHasta),
      s.diasSolicitados,
      s.diasRestantes,
      estadoATexto(s.estado),
    ]),
  ];

  const wsSolicitudes = XLSX.utils.aoa_to_sheet(encabezadoSolicitudes);

  if (wsSolicitudes["!ref"]) {
    const range = XLSX.utils.decode_range(wsSolicitudes["!ref"]);
    for (let r = 2; r <= range.e.r; r++) {
      const solicitud = solicitudes[r - 2];
      if (solicitud) {
        const color =
          solicitud.estado === "APROBADA"
            ? COLOR_APROBADA
            : solicitud.estado === "PENDIENTE"
              ? COLOR_PENDIENTE
              : COLOR_BAJA;
        ["A", "B", "C", "D", "E", "F"].forEach((col, i) => {
          const addr = XLSX.utils.encode_cell({ r, c: i });
          if (wsSolicitudes[addr]) {
            (wsSolicitudes[addr] as XLSX.CellObject).s = {
              fill: { fgColor: { rgb: color } },
            };
          }
        });
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsSolicitudes, "Solicitudes");

  // --- HOJA 2: Resumen por año ---
  const valorNull = "—";
  const filasResumen = [
    ["Empleado", nombreEmpleado, "Fecha de generación", fechaGeneracion],
    [
      "Año",
      "Disponibles",
      "Pendientes",
      "Aprobados",
      "Dados de baja",
      "Usados",
      "Restantes",
    ],
    ...totalesPorAnio.map((t) => [
      t.anio,
      t.diasDisponibles ?? valorNull,
      t.diasPendientes,
      t.diasAprobados,
      t.diasBaja,
      t.diasUsados,
      t.diasRestantes ?? valorNull,
    ]),
  ];

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
    filasResumen.push([
      "TOTALES",
      totales.diasDisponibles || valorNull,
      totales.diasPendientes,
      totales.diasAprobados,
      totales.diasBaja,
      totales.diasUsados,
      totales.diasRestantes || valorNull,
    ]);
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(filasResumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen por año");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
