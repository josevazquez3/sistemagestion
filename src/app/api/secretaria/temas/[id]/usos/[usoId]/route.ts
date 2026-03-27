import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../../../_shared";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; usoId: string }> }
) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const { id, usoId } = await params;
  const temaId = parseId(id);
  const uid = parseId(usoId);
  if (temaId == null || uid == null) return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });

  const uso = await prisma.temaUso.findFirst({ where: { id: uid, temaId }, select: { id: true } });
  if (!uso) return NextResponse.json({ error: "Uso no encontrado" }, { status: 404 });

  await prisma.temaUso.delete({ where: { id: uid } });
  return new NextResponse(null, { status: 204 });
}

