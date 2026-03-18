import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  primerDiaMesNoonUTC,
  ultimoDiaMesNoonUTC,
  formatearFechaUTC,
} from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function formatFecha(d: Date): string {
  return formatearFechaUTC(d);
}

/** GET - Empleados con vacaciones APROBADAS en el período, agrupados por legajo con total de días */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") ?? "";

  let inicioMes: Date;
  let finMes: Date;

  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [año, mes] = periodo.split("-").map(Number);
    inicioMes = primerDiaMesNoonUTC(año, mes);
    finMes = ultimoDiaMesNoonUTC(año, mes);
  } else {
    const hoy = new Date();
    const y = hoy.getUTCFullYear();
    const m = hoy.getUTCMonth() + 1;
    inicioMes = primerDiaMesNoonUTC(y, m);
    finMes = ultimoDiaMesNoonUTC(y, m);
  }

  const solicitudes = await prisma.solicitudVacaciones.findMany({
    where: {
      estado: "APROBADA",
      OR: [
        { fechaDesde: { gte: inicioMes, lte: finMes } },
        { fechaHasta: { gte: inicioMes, lte: finMes } },
        { fechaDesde: { lte: inicioMes }, fechaHasta: { gte: finMes } },
      ],
    },
    include: {
      legajo: {
        select: { id: true, numeroLegajo: true, nombres: true, apellidos: true },
      },
    },
    orderBy: [{ legajo: { apellidos: "asc" } }, { fechaDesde: "asc" }],
  });

  type EmpleadoItem = {
    legajoId: string;
    numeroLegajo: number;
    apellidoNombre: string;
    diasTotales: number;
    periodos: string[];
    liquidado: boolean;
    novedadId: string | null;
    primeraFechaDesde: string;
    primeraFechaHasta: string;
  };

  const mapaEmpleados = new Map<string, EmpleadoItem>();

  for (const sol of solicitudes) {
    const key = sol.legajoId;
    const periodoStr = `${formatFecha(sol.fechaDesde)} al ${formatFecha(sol.fechaHasta)}`;

    if (!mapaEmpleados.has(key)) {
      const novedad = await prisma.novedadLiquidacion.findFirst({
        where: {
          legajoId: key,
          tipo: "VACACIONES",
          fechaDesde: { gte: inicioMes, lte: finMes },
        },
      });

      mapaEmpleados.set(key, {
        legajoId: key,
        numeroLegajo: sol.legajo.numeroLegajo,
        apellidoNombre: `${(sol.legajo.apellidos || "").toUpperCase()}, ${(sol.legajo.nombres || "").toUpperCase()}`,
        diasTotales: sol.diasSolicitados,
        periodos: [periodoStr],
        liquidado: novedad?.liquidado ?? false,
        novedadId: novedad?.id ?? null,
        primeraFechaDesde: sol.fechaDesde.toISOString(),
        primeraFechaHasta: sol.fechaHasta.toISOString(),
      });
    } else {
      const emp = mapaEmpleados.get(key)!;
      emp.diasTotales += sol.diasSolicitados;
      emp.periodos.push(periodoStr);
    }
  }

  const empleados = Array.from(mapaEmpleados.values()).sort((a, b) =>
    a.apellidoNombre.localeCompare(b.apellidoNombre)
  );
  return NextResponse.json({ empleados });
}
