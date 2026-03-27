import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../../_shared";
import { TipoAsignacion } from "@prisma/client";

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

  let body: { asignaciones?: Array<{ tipo: TipoAsignacion; otroTexto?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const asignaciones = Array.isArray(body.asignaciones) ? body.asignaciones : [];

  for (const a of asignaciones) {
    if (
      a.tipo !== "AL_ORDEN_DEL_DIA" &&
      a.tipo !== "AL_INFORME_GUIA" &&
      a.tipo !== "GIRAR_A_DISTRITOS" &&
      a.tipo !== "ARCHIVAR" &&
      a.tipo !== "OTROS"
    ) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    if (a.tipo === "OTROS" && !String(a.otroTexto ?? "").trim()) {
      return NextResponse.json({ error: "otroTexto es obligatorio si tipo == OTROS" }, { status: 400 });
    }
  }

  const tema = await prisma.tema.findUnique({ where: { id: temaId }, select: { id: true, estado: true } });
  if (!tema) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  if (tema.estado === "FINALIZADO") {
    return NextResponse.json({ error: "El tema está finalizado" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.temaAsignacion.deleteMany({ where: { temaId } });
    if (asignaciones.length > 0) {
      await tx.temaAsignacion.createMany({
        data: asignaciones.map((a) => ({
          temaId,
          tipo: a.tipo,
          otroTexto: a.tipo === "OTROS" ? String(a.otroTexto ?? "").trim() : null,
        })),
      });
    }
  });

  const updated = await prisma.tema.findUnique({
    where: { id: temaId },
    include: { asignaciones: true, usos: true, usuario: { select: { id: true, nombre: true, apellido: true, email: true } } },
  });

  return NextResponse.json({
    ...updated!,
    fecha: updated!.fecha.toISOString(),
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
    usos: updated!.usos.map((u) => ({
      ...u,
      fechaOD: u.fechaOD ? u.fechaOD.toISOString() : null,
      guiaMesa: u.guiaMesa ? u.guiaMesa.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    })),
    usuario: {
      ...updated!.usuario,
      nombreCompleto: `${updated!.usuario.nombre} ${updated!.usuario.apellido}`.trim(),
    },
  });
}

