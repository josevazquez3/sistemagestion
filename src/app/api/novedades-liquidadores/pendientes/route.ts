import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function rangosSeSolapan(aDesde: Date, aHasta: Date, bDesde: Date, bHasta: Date): boolean {
  return aDesde <= bHasta && aHasta >= bDesde;
}

/** GET - Empleados con días pendientes de liquidar (para dashboard y tabla Días Liquidados) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const novedadesPendientes = await prisma.novedadLiquidacion.findMany({
    where: { liquidado: false },
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
    },
    orderBy: [{ legajo: { apellidos: "asc" } }, { fechaDesde: "asc" }],
  });

  const legajosConNovedadVacaciones = [
    ...new Set(
      novedadesPendientes.filter((n) => n.tipo === "VACACIONES").map((n) => n.legajoId)
    ),
  ];
  const solicitudesVacacionesAprobadas =
    legajosConNovedadVacaciones.length > 0
      ? await prisma.solicitudVacaciones.findMany({
          where: {
            estado: "APROBADA",
            legajoId: { in: legajosConNovedadVacaciones },
          },
          select: { legajoId: true, fechaDesde: true, fechaHasta: true },
        })
      : [];

  function vacacionesConRespaldoEnSolicitud(
    legajoId: string,
    nDesde: Date,
    nHasta: Date
  ): boolean {
    return solicitudesVacacionesAprobadas.some(
      (p) =>
        p.legajoId === legajoId &&
        rangosSeSolapan(p.fechaDesde, p.fechaHasta, nDesde, nHasta)
    );
  }

  const novedadesValidas = novedadesPendientes.filter((n) => {
    if (n.tipo !== "VACACIONES") return true;
    return vacacionesConRespaldoEnSolicitud(n.legajoId, n.fechaDesde, n.fechaHasta);
  });

  const agrupado = new Map<
    string,
    { legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string }; items: typeof novedadesValidas; diasTotal: number }
  >();
  for (const n of novedadesValidas) {
    const key = n.legajoId;
    if (!agrupado.has(key)) {
      agrupado.set(key, {
        legajo: n.legajo,
        items: [],
        diasTotal: 0,
      });
    }
    const g = agrupado.get(key)!;
    g.items.push(n);
    g.diasTotal += n.diasTotal;
  }

  const data = Array.from(agrupado.entries()).map(([, v]) => ({
    legajoId: v.legajo.id,
    legajo: v.legajo,
    items: v.items,
    diasPendientes: v.diasTotal,
  }));

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
