import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => (typeof id === "number" ? id : typeof id === "string" ? parseInt(id, 10) : NaN))
    .filter((n) => !Number.isNaN(n) && Number.isInteger(n));
}

/** DELETE - Eliminar múltiples movimientos; recalcula saldos del período */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const ids = parseIds(body.ids);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Se requiere un array de IDs" }, { status: 400 });
  }

  const primeros = await prisma.fondoFijo.findMany({
    where: { id: { in: ids } },
    select: { mes: true, anio: true },
    take: 1,
  });
  const mes = primeros[0]?.mes;
  const anio = primeros[0]?.anio;

  const resultado = await prisma.fondoFijo.deleteMany({
    where: { id: { in: ids } },
  });

  if (mes != null && anio != null) {
    await recalcularSaldos(prisma, mes, anio);
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Eliminó ${resultado.count} movimiento(s) del Fondo Fijo (masivo)`,
      modulo: "Tesorería",
      detalle: ids.join(", "),
    });
  } catch {}

  return NextResponse.json({ ok: true, eliminados: resultado.count });
}
