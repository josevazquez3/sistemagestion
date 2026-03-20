import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** Mes calendario en Argentina + rango [inicio, fin] para solapamiento con períodos de novedad. */
function inicioFinMesArgentina(): { inicio: Date; fin: Date; mes: number; anio: number } {
  const s = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const datePart = s.split(" ")[0] ?? "";
  const [y, m] = datePart.split("-").map((x) => Number(x));
  const anio = Number.isFinite(y) ? y : new Date().getFullYear();
  const mes = Number.isFinite(m) ? m : new Date().getMonth() + 1;
  const inicio = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  const fin = new Date(anio, mes, 0, 23, 59, 59, 999);
  return { inicio, fin, mes, anio };
}

/**
 * Novedades que intersectan el mes actual: fechaDesde <= finMes AND fechaHasta >= inicioMes.
 * (Mejor que filtrar solo por fechaDesde: incluye novedades que empezaron antes y siguen en el mes.)
 */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { inicio, fin, mes, anio } = inicioFinMesArgentina();

  const novedades = await prisma.novedadLiquidacion.findMany({
    where: {
      liquidado: false,
      fechaDesde: { lte: fin },
      fechaHasta: { gte: inicio },
    },
    select: { tipo: true, diasTotal: true },
  });

  const porTipo: Record<string, number> = {};
  let diasTotales = 0;
  for (const n of novedades) {
    const d = n.diasTotal ?? 1;
    porTipo[n.tipo] = (porTipo[n.tipo] ?? 0) + d;
    diasTotales += d;
  }

  return NextResponse.json({
    mes,
    anio,
    cantidad: novedades.length,
    diasTotales,
    porTipo,
  });
}
