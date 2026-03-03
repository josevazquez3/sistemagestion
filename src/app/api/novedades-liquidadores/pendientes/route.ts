import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Empleados con días pendientes de liquidar (para dashboard y tabla Días Liquidados) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const novedadesPendientes = await prisma.novedadLiquidacion.findMany({
    where: { liquidado: false },
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
    },
    orderBy: [{ legajo: { apellidos: "asc" } }, { fechaDesde: "asc" }],
  });

  const agrupado = new Map<
    string,
    { legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string }; items: typeof novedadesPendientes; diasTotal: number }
  >();
  for (const n of novedadesPendientes) {
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

  return NextResponse.json({ data });
}
