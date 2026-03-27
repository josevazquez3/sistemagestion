import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import { canAccess, ensureTemasTables, getSessionUser } from "./_shared";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const temas = await prisma.tema.findMany({
    where: { deletedAt: null },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
      asignaciones: true,
      usos: true,
    },
    orderBy: { numero: "asc" },
  });

  return NextResponse.json(
    temas.map((t) => ({
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
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!user.id) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  await ensureTemasTables();

  let body: { fecha?: string; tema?: string; observacion?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const fecha = parsearFechaSegura(String(body.fecha ?? "").trim());
  if (!fecha) return NextResponse.json({ error: "fecha inválida (DD/MM/YYYY)" }, { status: 400 });

  const tema = String(body.tema ?? "").trim();
  if (!tema) return NextResponse.json({ error: "tema es obligatorio" }, { status: 400 });

  const observacion = body.observacion != null ? String(body.observacion).trim() || null : null;

  const max = await prisma.tema.aggregate({ _max: { numero: true } });
  const numero = (max._max.numero ?? 0) + 1;

  const creado = await prisma.tema.create({
    data: {
      numero,
      fecha,
      tema,
      observacion,
      usuarioId: user.id,
    },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
      asignaciones: true,
      usos: true,
    },
  });

  return NextResponse.json(
    {
      ...creado,
      fecha: creado.fecha.toISOString(),
      createdAt: creado.createdAt.toISOString(),
      updatedAt: creado.updatedAt.toISOString(),
      usos: creado.usos.map((u) => ({
        ...u,
        fechaOD: u.fechaOD ? u.fechaOD.toISOString() : null,
        guiaMesa: u.guiaMesa ? u.guiaMesa.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      })),
      usuario: {
        ...creado.usuario,
        nombreCompleto: `${creado.usuario.nombre} ${creado.usuario.apellido}`.trim(),
      },
    },
    { status: 201 }
  );
}

