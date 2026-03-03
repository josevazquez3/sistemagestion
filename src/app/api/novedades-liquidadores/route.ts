import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Listar novedades con legajo. Query: periodo=YYYY-MM, liquidado=true|false|all */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") ?? "";
  const liquidadoParam = searchParams.get("liquidado") ?? "all";

  const where: Prisma.NovedadLiquidacionWhereInput = {};

  if (liquidadoParam !== "all") {
    where.liquidado = liquidadoParam === "true";
  }

  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [año, mes] = periodo.split("-").map(Number);
    const inicioMes = new Date(año, mes - 1, 1);
    const finMes = new Date(año, mes, 0, 23, 59, 59);
    where.OR = [
      { fechaDesde: { gte: inicioMes, lte: finMes } },
      { fechaHasta: { gte: inicioMes, lte: finMes } },
      { fechaDesde: { lte: inicioMes }, fechaHasta: { gte: finMes } },
    ];
  }

  const data = await prisma.novedadLiquidacion.findMany({
    where,
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
    },
    orderBy: [{ liquidado: "asc" }, { creadoEn: "desc" }],
  });
  return NextResponse.json({ data });
}

/** POST - Crear novedad manual */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { legajoId, tipo, codigo, fechaDesde, fechaHasta, diasTotal, observacion, periodoNombre } = body;
    if (!legajoId || !tipo) {
      return NextResponse.json({ error: "legajoId y tipo son obligatorios" }, { status: 400 });
    }
    const desde = fechaDesde ? new Date(fechaDesde) : new Date();
    const hasta = fechaHasta ? new Date(fechaHasta) : new Date();
    const dias = typeof diasTotal === "number" ? diasTotal : 1;

    const novedad = await prisma.novedadLiquidacion.create({
      data: {
        legajoId,
        tipo: String(tipo),
        codigo: codigo != null ? Number(codigo) : null,
        fechaDesde: desde,
        fechaHasta: hasta,
        diasTotal: dias,
        observacion: observacion?.trim() || null,
        periodoNombre: periodoNombre?.trim() || null,
      },
      include: {
        legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      },
    });
    return NextResponse.json(novedad);
  } catch (e) {
    console.error("Error creando novedad:", e);
    return NextResponse.json({ error: "Error al crear la novedad" }, { status: 500 });
  }
}
