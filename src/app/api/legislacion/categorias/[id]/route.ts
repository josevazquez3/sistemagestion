import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
const ROLES_WRITE = ["ADMIN", "SECRETARIA"] as const;

function canWrite(roles: string[]) {
  return ROLES_WRITE.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** PUT - Actualizar categoría */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const existente = await prisma.categoriaLegislacion.findUnique({
    where: { id },
  });
  if (!existente) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { nombre, descripcion, activo } = body;

    const data: { nombre?: string; descripcion?: string | null; activo?: boolean } = {};
    if (typeof nombre === "string" && nombre.trim()) data.nombre = nombre.trim();
    if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
    if (typeof activo === "boolean") data.activo = activo;

    const categoria = await prisma.categoriaLegislacion.update({
      where: { id },
      data,
    });

    return NextResponse.json(categoria);
  } catch (e) {
    console.error("Error actualizando categoría:", e);
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
      { status: 500 }
    );
  }
}

/** DELETE - Eliminar categoría (solo si no tiene documentos) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const categoria = await prisma.categoriaLegislacion.findUnique({
    where: { id },
    include: { _count: { select: { documentos: true } } },
  });
  if (!categoria) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }
  if (categoria._count.documentos > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar una categoría que tiene documentos asociados" },
      { status: 400 }
    );
  }

  await prisma.categoriaLegislacion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
