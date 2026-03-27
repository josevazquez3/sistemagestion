import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../_shared";
import { EstadoTema } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body: {
    fecha?: string;
    tema?: string;
    observacion?: string | null;
    estado?: EstadoTema;
    numero?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const existente = await prisma.tema.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });

  const data: any = {};
  if (body.fecha !== undefined) {
    const d = parsearFechaSegura(String(body.fecha ?? "").trim());
    if (!d) return NextResponse.json({ error: "fecha inválida (DD/MM/YYYY)" }, { status: 400 });
    data.fecha = d;
  }
  if (body.tema !== undefined) {
    const t = String(body.tema ?? "").trim();
    if (!t) return NextResponse.json({ error: "tema no puede quedar vacío" }, { status: 400 });
    data.tema = t;
  }
  if (body.observacion !== undefined) {
    data.observacion = body.observacion != null ? String(body.observacion).trim() || null : null;
  }
  if (body.estado !== undefined) {
    if (body.estado !== "PENDIENTE" && body.estado !== "FINALIZADO") {
      return NextResponse.json({ error: "estado inválido" }, { status: 400 });
    }
    data.estado = body.estado;
  }

  const nuevoNumero = body.numero !== undefined ? Number(body.numero) : undefined;
  if (nuevoNumero !== undefined && (!Number.isFinite(nuevoNumero) || nuevoNumero < 1)) {
    return NextResponse.json({ error: "numero inválido" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (nuevoNumero !== undefined && nuevoNumero !== existente.numero) {
        const otro = await tx.tema.findFirst({
          where: { numero: nuevoNumero },
          select: { id: true },
        });
        if (otro) {
          // Hay UNIQUE en `numero`: no se puede asignar el número del otro mientras este registro
          // sigue ocupando el suyo. Usamos un temporal libre (max+1) y luego completamos el swap.
          const maxAgg = await tx.tema.aggregate({ _max: { numero: true } });
          const tempNum = (maxAgg._max.numero ?? 0) + 1;
          await tx.tema.update({ where: { id }, data: { numero: tempNum } });
          await tx.tema.update({ where: { id: otro.id }, data: { numero: existente.numero } });
        }
        data.numero = nuevoNumero;
      }
      return tx.tema.update({
        where: { id },
        data,
        include: {
          usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
          asignaciones: true,
          usos: true,
        },
      });
    });

    return NextResponse.json({
      ...updated,
      fecha: updated.fecha.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      usos: updated.usos.map((u) => ({
        ...u,
        fechaOD: u.fechaOD ? u.fechaOD.toISOString() : null,
        guiaMesa: u.guiaMesa ? u.guiaMesa.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      })),
      usuario: {
        ...updated.usuario,
        nombreCompleto: `${updated.usuario.nombre} ${updated.usuario.apellido}`.trim(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.tema.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}

