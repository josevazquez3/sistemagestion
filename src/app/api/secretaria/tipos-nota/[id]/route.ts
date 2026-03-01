import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** PUT - Actualizar tipo de nota */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const tipo = await prisma.tipoNota.findUnique({ where: { id } });
  if (!tipo) {
    return NextResponse.json({ error: "Tipo de nota no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { nombre, descripcion, activo } = body;

    const data: { nombre?: string; descripcion?: string | null; activo?: boolean } = {};
    if (typeof nombre === "string" && nombre.trim()) data.nombre = nombre.trim();
    if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
    if (typeof activo === "boolean") data.activo = activo;

    const updated = await prisma.tipoNota.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando tipo de nota:", e);
    return NextResponse.json(
      { error: "Error al actualizar tipo de nota" },
      { status: 500 }
    );
  }
}

/** DELETE - Eliminar tipo de nota (solo si no tiene modelos) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const tipo = await prisma.tipoNota.findUnique({
    where: { id },
    include: { _count: { select: { modelos: true } } },
  });

  if (!tipo) {
    return NextResponse.json({ error: "Tipo de nota no encontrado" }, { status: 404 });
  }

  if (tipo._count.modelos > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar: tiene modelos asociados" },
      { status: 400 }
    );
  }

  await prisma.tipoNota.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
