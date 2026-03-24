import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../../_shared";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; textboxId: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const { id, textboxId } = await params;
  const informeId = parseId(id);
  const tid = parseId(textboxId);
  if (informeId == null || tid == null) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  let body: { contenido?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const contenido = (body.contenido ?? "").trim();
  if (!contenido) {
    return NextResponse.json({ error: "contenido no puede quedar vacío" }, { status: 400 });
  }

  try {
    const existing = await prisma.informeTextBox.findFirst({
      where: { id: tid, informeId },
    });
    if (!existing) return NextResponse.json({ error: "Text box no encontrado" }, { status: 404 });
    const updated = await prisma.informeTextBox.update({
      where: { id: tid },
      data: { contenido },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("informe/[id]/textboxes/[textboxId] PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar text box" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; textboxId: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const { id, textboxId } = await params;
  const informeId = parseId(id);
  const tid = parseId(textboxId);
  if (informeId == null || tid == null) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  try {
    const existing = await prisma.informeTextBox.findFirst({
      where: { id: tid, informeId },
    });
    if (!existing) return NextResponse.json({ error: "Text box no encontrado" }, { status: 404 });
    await prisma.informeTextBox.delete({ where: { id: tid } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("informe/[id]/textboxes/[textboxId] DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar text box" },
      { status: 500 }
    );
  }
}
