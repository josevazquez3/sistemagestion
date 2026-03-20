import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TipoMovimientoFondo } from "@prisma/client";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "", 10);
  const anio = parseInt(searchParams.get("anio") ?? "", 10);

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const fechaInicio = new Date(anio, mes - 1, 1);
  const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999);

  const [movimientosExtracto, cobrosCertificacion, reintegrosFondoFijo] = await Promise.all([
    prisma.movimientoExtracto.findMany({
      where: {
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
      include: { cuenta: { select: { nombre: true } } },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    }),
    prisma.cobroCertificacion.findMany({
      where: { mes, anio },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    }),
    prisma.fondoFijo.findMany({
      where: { mes, anio, tipo: TipoMovimientoFondo.INGRESO },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    }),
  ]);

  return NextResponse.json({
    data: {
      movimientosExtracto: movimientosExtracto.map((m) => ({
        id: m.id,
        fecha: m.fecha.toISOString(),
        codigoOperacion: (m.codOperativo ?? "").trim(),
        concepto: m.concepto,
        importe: round2(Number(m.importePesos)),
        cuentaNombre: m.cuenta?.nombre ?? null,
      })),
      cobrosCertificacion: cobrosCertificacion.map((c) => ({
        id: c.id,
        fecha: c.fecha.toISOString(),
        detalle: (c.concepto ?? "").trim() || "—",
        importe: round2(Number(c.importe)),
      })),
      /** Reintegros (salida de banco hacia fondo fijo) — clasificación en frontend */
      reintegrosFondoFijo: reintegrosFondoFijo.map((f) => ({
        id: f.id,
        fecha: f.fecha.toISOString(),
        detalle: f.concepto?.trim() ? `INGRESO F. FIJO - ${f.concepto.trim()}` : "INGRESO F. FIJO",
        importe: round2(Math.abs(Number(f.importePesos))),
      })),
    },
  });
}
