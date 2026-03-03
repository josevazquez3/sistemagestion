import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Obtener una novedad por ID */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = (await params).id;
  const novedad = await prisma.novedadLiquidacion.findUnique({
    where: { id },
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
    },
  });
  if (!novedad) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
  return NextResponse.json(novedad);
}

/** PUT - Editar novedad (incluyendo liquidado) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = (await params).id;
  const novedad = await prisma.novedadLiquidacion.findUnique({ where: { id } });
  if (!novedad) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.tipo != null) data.tipo = String(body.tipo);
    if (body.codigo != null) data.codigo = Number(body.codigo);
    if (body.fechaDesde != null) data.fechaDesde = new Date(body.fechaDesde);
    if (body.fechaHasta != null) data.fechaHasta = new Date(body.fechaHasta);
    if (body.diasTotal != null) data.diasTotal = Number(body.diasTotal);
    if (body.observacion != null) data.observacion = body.observacion?.trim() || null;
    if (body.periodoNombre != null) data.periodoNombre = body.periodoNombre?.trim() || null;
    if (typeof body.liquidado === "boolean") {
      data.liquidado = body.liquidado;
      data.fechaLiquidacion = body.liquidado ? new Date() : null;
    }

    const updated = await prisma.novedadLiquidacion.update({
      where: { id },
      data,
      include: {
        legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando novedad:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

/** DELETE - Eliminar novedad */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = (await params).id;
  const novedad = await prisma.novedadLiquidacion.findUnique({ where: { id } });
  if (!novedad) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
  await prisma.novedadLiquidacion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
