import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../../_shared";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compromisoId: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const { id, compromisoId } = await params;
  const informeId = parseId(id);
  const cid = parseId(compromisoId);
  if (informeId == null || cid == null) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  let body: { numero?: string | null; concepto?: string; importe?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const data: {
    numero?: string | null;
    concepto?: string;
    importe?: Decimal;
  } = {};
  if (body.numero !== undefined) data.numero = body.numero?.trim() ? body.numero.trim() : null;
  if (body.concepto !== undefined) {
    const c = body.concepto.trim();
    if (!c) return NextResponse.json({ error: "concepto no puede quedar vacío" }, { status: 400 });
    data.concepto = c;
  }
  if (body.importe !== undefined) {
    const n = Number(body.importe);
    if (Number.isNaN(n)) return NextResponse.json({ error: "importe inválido" }, { status: 400 });
    data.importe = new Decimal(n);
  }

  try {
    const existing = await prisma.informeCompromiso.findFirst({
      where: { id: cid, informeId },
    });
    if (!existing) return NextResponse.json({ error: "Compromiso no encontrado" }, { status: 404 });
    const updated = await prisma.informeCompromiso.update({
      where: { id: cid },
      data,
    });
    return NextResponse.json({ ...updated, importe: Number(updated.importe) });
  } catch (err) {
    console.error("informe/[id]/compromisos/[compromisoId] PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar compromiso" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; compromisoId: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const { id, compromisoId } = await params;
  const informeId = parseId(id);
  const cid = parseId(compromisoId);
  if (informeId == null || cid == null) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  try {
    const existing = await prisma.informeCompromiso.findFirst({
      where: { id: cid, informeId },
    });
    if (!existing) return NextResponse.json({ error: "Compromiso no encontrado" }, { status: 404 });
    await prisma.informeCompromiso.delete({ where: { id: cid } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("informe/[id]/compromisos/[compromisoId] DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar compromiso" },
      { status: 500 }
    );
  }
}
