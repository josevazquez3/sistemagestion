import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const [config, aggregate, ultimo] = await Promise.all([
      prisma.extractoBancoConfig.findFirst({
        select: { saldoInicial: true, fechaSaldoInicial: true },
      }),
      prisma.movimientoExtracto.aggregate({
        _sum: { importePesos: true },
      }),
      prisma.movimientoExtracto.findFirst({
        select: { fecha: true },
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
      }),
    ]);

    const saldoInicial = Number(config?.saldoInicial ?? 0);
    const sumaMovimientos = Number(aggregate._sum?.importePesos ?? 0);
    const saldo = saldoInicial + sumaMovimientos;

    return NextResponse.json({
      saldo,
      fechaSaldoInicial: config?.fechaSaldoInicial ?? null,
      fechaUltimoMovimiento: ultimo?.fecha ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Error obteniendo saldo bancario" }, { status: 500 });
  }
}
