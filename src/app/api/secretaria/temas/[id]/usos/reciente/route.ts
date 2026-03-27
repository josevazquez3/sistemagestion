import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../../../_shared";

function serializeTema(t: {
  id: number;
  numero: number;
  fecha: Date;
  tema: string;
  observacion: string | null;
  usuarioId: string;
  estado: "PENDIENTE" | "FINALIZADO";
  createdAt: Date;
  updatedAt: Date;
  usuario: { id: string; nombre: string; apellido: string; email: string };
  asignaciones: { id: number; tipo: string; otroTexto: string | null; createdAt: Date; temaId: number }[];
  usos: {
    id: number;
    temaId: number;
    fechaOD: Date | null;
    guiaMesa: Date | null;
    createdAt: Date;
  }[];
}) {
  return {
    ...t,
    fecha: t.fecha.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    usos: t.usos.map((u) => ({
      ...u,
      fechaOD: u.fechaOD ? u.fechaOD.toISOString() : null,
      guiaMesa: u.guiaMesa ? u.guiaMesa.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    })),
    usuario: {
      ...t.usuario,
      nombreCompleto: `${t.usuario.nombre} ${t.usuario.apellido}`.trim(),
    },
  };
}

export async function PUT(
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

  const parseOrNull = (v: unknown): Date | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const d = parsearFechaSegura(s);
    return d;
  };

  const fechaOD = parseOrNull(rawOD);
  const guiaMesa = parseOrNull(rawGuia);

  if (rawOD != null && String(rawOD).trim() !== "" && !fechaOD) {
    return NextResponse.json({ error: "fechaOD inválida (DD/MM/YYYY)" }, { status: 400 });
  }
  if (rawGuia != null && String(rawGuia).trim() !== "" && !guiaMesa) {
    return NextResponse.json({ error: "guiaMesa inválida (DD/MM/YYYY)" }, { status: 400 });
  }

  const temaExiste = await prisma.tema.findUnique({ where: { id: temaId }, select: { id: true } });
  if (!temaExiste) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });

  try {
    const usoReciente = await prisma.temaUso.findFirst({
      where: { temaId },
      orderBy: { createdAt: "desc" },
    });

    if (usoReciente) {
      await prisma.temaUso.update({
        where: { id: usoReciente.id },
        data: {
          fechaOD,
          guiaMesa,
        },
      });
    } else {
      await prisma.temaUso.create({
        data: {
          temaId,
          fechaOD,
          guiaMesa,
        },
      });
    }

    const actualizado = await prisma.tema.findUnique({
      where: { id: temaId },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
        asignaciones: true,
        usos: true,
      },
    });

    if (!actualizado) {
      return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
    }

    return NextResponse.json(serializeTema(actualizado));
  } catch (err) {
    console.error("temas usos reciente PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar uso" },
      { status: 500 }
    );
  }
}
