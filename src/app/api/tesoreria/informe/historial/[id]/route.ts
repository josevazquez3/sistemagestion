import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../_shared";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body: { nombreArchivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const nombreArchivo = String(body.nombreArchivo ?? "").trim();
  if (!nombreArchivo) return NextResponse.json({ error: "nombreArchivo es obligatorio" }, { status: 400 });

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; nombreArchivo: string; fechaArchivo: Date | null; createdAt: Date }>>(
      `UPDATE "HistorialInformeTesoreria"
       SET "nombreArchivo" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2
       RETURNING "id","nombreArchivo","fechaArchivo","createdAt"`,
      nombreArchivo,
      id
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json({
      id: row.id,
      nombreArchivo: row.nombreArchivo,
      fechaArchivo: row.fechaArchivo ? new Date(row.fechaArchivo).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al editar registro" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const res = await prisma.$executeRawUnsafe(
      `DELETE FROM "HistorialInformeTesoreria" WHERE "id" = $1`,
      id
    );
    if (!res) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al eliminar" }, { status: 500 });
  }
}

