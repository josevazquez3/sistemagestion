import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../../_shared";
import { parsearFechaSegura } from "@/lib/utils/fecha";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const temaId = parseId((await params).id);
  if (temaId == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body: { fechaOD?: string | null; guiaMesa?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const rawOD = body.fechaOD;
  const rawGuia = body.guiaMesa;

  const fechaOD =
    rawOD === null || rawOD === undefined || String(rawOD).trim() === ""
      ? null
      : parsearFechaSegura(String(rawOD).trim());
  const guiaMesa =
    rawGuia === null || rawGuia === undefined || String(rawGuia).trim() === ""
      ? null
      : parsearFechaSegura(String(rawGuia).trim());

  if (rawOD != null && String(rawOD).trim() !== "" && !fechaOD) {
    return NextResponse.json({ error: "fechaOD inválida" }, { status: 400 });
  }
  if (rawGuia != null && String(rawGuia).trim() !== "" && !guiaMesa) {
    return NextResponse.json({ error: "guiaMesa inválida" }, { status: 400 });
  }

  const tema = await prisma.tema.findUnique({ where: { id: temaId }, select: { id: true, estado: true } });
  if (!tema) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  // Permite registrar uso incluso si está FINALIZADO (reactivación vía PUT en el cliente).

  const uso = await prisma.temaUso.create({
    data: { temaId, fechaOD, guiaMesa },
  });

  return NextResponse.json({
    ...uso,
    fechaOD: uso.fechaOD ? uso.fechaOD.toISOString() : null,
    guiaMesa: uso.guiaMesa ? uso.guiaMesa.toISOString() : null,
    createdAt: uso.createdAt.toISOString(),
  }, { status: 201 });
}

