import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../_shared";

export async function POST(
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

  let body: { numero?: number; contenido?: string; orden?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const numero = Number(body.numero);
  const orden = Number(body.orden ?? 0);
  const contenido = (body.contenido ?? "").trim();
  if (!numero || Number.isNaN(numero)) {
    return NextResponse.json({ error: "numero inválido" }, { status: 400 });
  }
  if (Number.isNaN(orden)) {
    return NextResponse.json({ error: "orden inválido" }, { status: 400 });
  }
  if (!contenido) {
    return NextResponse.json({ error: "contenido es obligatorio" }, { status: 400 });
  }

  try {
    const parent = await prisma.informeTesoreria.findUnique({ where: { id: informeId } });
    if (!parent) return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });

    const created = await prisma.informeTextBox.create({
      data: { informeId, numero, contenido, orden },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("informe/[id]/textboxes POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear text box" },
      { status: 500 }
    );
  }
}
