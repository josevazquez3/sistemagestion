import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  canAccess,
  ensureInformeTables,
  getRolesFromSession,
  parseDateOrNull,
  parseId,
} from "../_shared";

function serializeInforme(i: {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  createdAt: Date;
  updatedAt: Date;
  chequesADepositar?: unknown;
  saldoBancoRioOverride?: unknown;
  saldoFondoFijoOverride?: unknown;
  egresos: Array<{ importe: unknown }>;
  compromisos: Array<{ importe: unknown }>;
  textBoxes: Array<unknown>;
  ultimosAportes: Array<{ fechaOverride: Date | null }>;
}) {
  return {
    ...i,
    fechaDesde: i.fechaDesde.toISOString(),
    fechaHasta: i.fechaHasta.toISOString(),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    chequesADepositar:
      i.chequesADepositar != null ? Number(i.chequesADepositar) : null,
    saldoBancoRioOverride:
      i.saldoBancoRioOverride != null ? Number(i.saldoBancoRioOverride) : null,
    saldoFondoFijoOverride:
      i.saldoFondoFijoOverride != null ? Number(i.saldoFondoFijoOverride) : null,
    egresos: (i.egresos as Array<Record<string, unknown>>).map(
      (x: Record<string, unknown>) => ({ ...x, importe: Number(x.importe) })
    ),
    compromisos: (i.compromisos as Array<Record<string, unknown>>).map(
      (x: Record<string, unknown>) => ({ ...x, importe: Number(x.importe) })
    ),
    textBoxes: i.textBoxes,
    ultimosAportes: (i.ultimosAportes as Array<Record<string, unknown>>).map(
      (x: Record<string, unknown>) => ({
      ...x,
      fechaOverride:
        x.fechaOverride && x.fechaOverride instanceof Date
          ? x.fechaOverride.toISOString()
          : null,
    })
    ),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prismaAny = prisma as any;
    const informe = await prismaAny.informeTesoreria.findUnique({
      where: { id },
      include: {
        egresos: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        compromisos: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        textBoxes: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        ultimosAportes: { orderBy: [{ distritoNumero: "asc" }] },
      },
    });
    if (!informe) {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }
    return NextResponse.json(serializeInforme(informe));
  } catch (err) {
    console.error("informe/[id] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener informe" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body: { fechaDesde?: string; fechaHasta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const fechaDesde = parseDateOrNull(body.fechaDesde);
  const fechaHasta = parseDateOrNull(body.fechaHasta);
  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json(
      { error: "fechaDesde y fechaHasta son obligatorias" },
      { status: 400 }
    );
  }
  if (fechaDesde.getTime() > fechaHasta.getTime()) {
    return NextResponse.json(
      { error: "fechaDesde no puede ser mayor a fechaHasta" },
      { status: 400 }
    );
  }

  try {
    const prismaAny = prisma as any;
    const actualizado = await prismaAny.informeTesoreria.update({
      where: { id },
      data: { fechaDesde, fechaHasta },
      include: {
        egresos: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        compromisos: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        textBoxes: { orderBy: [{ orden: "asc" }, { id: "asc" }] },
        ultimosAportes: { orderBy: [{ distritoNumero: "asc" }] },
      },
    });
    return NextResponse.json(serializeInforme(actualizado));
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }
    console.error("informe/[id] PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar informe" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prismaAny = prisma as any;
    await prismaAny.informeTesoreria.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }
    console.error("informe/[id] DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar informe" },
      { status: 500 }
    );
  }
}
