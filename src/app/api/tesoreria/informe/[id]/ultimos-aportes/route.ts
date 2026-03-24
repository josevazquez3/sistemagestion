import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccess,
  ensureInformeTables,
  getRolesFromSession,
  parseDateOrNull,
  parseId,
} from "../../_shared";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const informeId = parseId((await params).id);
  if (informeId == null) {
    return NextResponse.json({ error: "ID de informe inválido" }, { status: 400 });
  }

  let body: { distritoNumero?: number; fechaOverride?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const distritoNumero = Number(body.distritoNumero);
  if (!distritoNumero || Number.isNaN(distritoNumero) || distritoNumero < 1 || distritoNumero > 10) {
    return NextResponse.json({ error: "distritoNumero debe ser entre 1 y 10" }, { status: 400 });
  }
  const fechaOverride =
    body.fechaOverride == null ? null : parseDateOrNull(body.fechaOverride);
  if (body.fechaOverride != null && !fechaOverride) {
    return NextResponse.json({ error: "fechaOverride inválida" }, { status: 400 });
  }

  try {
    const parent = await prisma.informeTesoreria.findUnique({ where: { id: informeId } });
    if (!parent) return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });

    const row = await prisma.informeUltimoAporte.upsert({
      where: {
        id: (
          await prisma.informeUltimoAporte.findFirst({
            where: { informeId, distritoNumero },
            select: { id: true },
          })
        )?.id ?? -1,
      },
      update: { fechaOverride },
      create: { informeId, distritoNumero, fechaOverride },
    });
    return NextResponse.json({
      ...row,
      fechaOverride: row.fechaOverride ? row.fechaOverride.toISOString() : null,
    });
  } catch (err) {
    console.error("informe/[id]/ultimos-aportes PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar override" },
      { status: 500 }
    );
  }
}
