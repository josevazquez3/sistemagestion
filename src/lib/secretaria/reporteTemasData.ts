import type { EstadoTema, TemaUso } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatearFechaUTC } from "@/lib/utils/fecha";

export type EstadoTemaReporte = "PENDIENTE" | "FINALIZADO" | "ELIMINADO";

/** Misma regla que el modal Tema usado: soft-delete, luego workflow del tema. */
export function estadoTemaReporte(t: {
  deletedAt: Date | null;
  estado: EstadoTema;
}): EstadoTemaReporte {
  if (t.deletedAt != null) return "ELIMINADO";
  if (t.estado === "FINALIZADO") return "FINALIZADO";
  return "PENDIENTE";
}

export type ReporteTemaRow = {
  temaId: number;
  temaNumero: number;
  tema: string;
  fechaOD: string | null;
  guiaMesa: string | null;
  cantOD: number;
  cantGuia: number;
  estado: EstadoTemaReporte;
};

export type TemaUsadoListItem = {
  id: number;
  numero: number;
  tema: string;
  /** Fecha OD del último uso, o guía mesa, o fecha de creación de ese uso, o fecha del tema. */
  fecha: string;
  estado: EstadoTemaReporte;
};

function pickLatestUso(usos: TemaUso[]): TemaUso | null {
  if (!usos?.length) return null;
  return [...usos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
}

function fechaReferenciaUltimoUso(temaFecha: Date, usos: TemaUso[]): string {
  const u = pickLatestUso(usos);
  if (u) {
    if (u.fechaOD) return formatearFechaUTC(u.fechaOD);
    if (u.guiaMesa) return formatearFechaUTC(u.guiaMesa);
    return formatearFechaUTC(u.createdAt);
  }
  return formatearFechaUTC(temaFecha);
}

async function fetchTemasHistorialCompletos() {
  return prisma.tema.findMany({
    include: { usos: true },
    orderBy: { numero: "asc" },
  });
}

/**
 * Historial completo de temas (misma base que la página Reporte Temas): todos los registros
 * `Tema` con `usos`, orden por número, sin filtrar soft-delete.
 */
export async function getReporteTemasRows(): Promise<ReporteTemaRow[]> {
  const temas = await fetchTemasHistorialCompletos();

  return temas.map((t) => {
    const u = pickLatestUso(t.usos);
    const cantOD = t.usos.filter((x) => x.fechaOD != null).length;
    const cantGuia = t.usos.filter((x) => x.guiaMesa != null).length;
    return {
      temaId: t.id,
      temaNumero: t.numero,
      tema: t.tema,
      fechaOD: u?.fechaOD ? formatearFechaUTC(u.fechaOD) : null,
      guiaMesa: u?.guiaMesa ? formatearFechaUTC(u.guiaMesa) : null,
      cantOD,
      cantGuia,
      estado: estadoTemaReporte(t),
    };
  });
}

/** Listado para el modal “Tema usado” (misma consulta que el reporte). */
export async function getTemaUsadoListItems(): Promise<TemaUsadoListItem[]> {
  const temas = await fetchTemasHistorialCompletos();

  return temas.map((t) => ({
    id: t.id,
    numero: t.numero,
    tema: t.tema,
    fecha: fechaReferenciaUltimoUso(t.fecha, t.usos),
    estado: estadoTemaReporte(t),
  }));
}
