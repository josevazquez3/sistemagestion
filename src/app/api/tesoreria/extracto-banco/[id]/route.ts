import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** PATCH - Asignar cuenta y/o código operativo al movimiento */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { cuentaId?: number | null; codOperativo?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const movimiento = await prisma.movimientoExtracto.findUnique({ where: { id } });
  if (!movimiento) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  const data: {
    cuentaId?: number | null;
    codOperativo?: string | null;
    codOperativoEditado?: boolean;
  } = {};
  if (body.cuentaId !== undefined) {
    const cuentaId = body.cuentaId === null ? null : Number(body.cuentaId);
    if (cuentaId !== null && isNaN(cuentaId)) {
      return NextResponse.json({ error: "cuentaId inválido" }, { status: 400 });
    }
    data.cuentaId = cuentaId;
  }
  if (body.codOperativo !== undefined) {
    const codOperativo = body.codOperativo === null || body.codOperativo === "" ? null : String(body.codOperativo).trim();
    data.codOperativo = codOperativo;
    data.codOperativoEditado = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
  }

  const actualizado = await prisma.movimientoExtracto.update({
    where: { id },
    data,
    select: {
      id: true,
      codOperativo: true,
      codOperativoEditado: true,
      cuentaId: true,
    },
  });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: data.codOperativo !== undefined ? "Editó código operativo de movimiento" : "Asignó cuenta bancaria a movimiento",
      modulo: "Tesorería",
      detalle: `Movimiento ${id}${data.cuentaId !== undefined ? `, cuentaId: ${data.cuentaId ?? "null"}` : ""}${data.codOperativo !== undefined ? `, codOperativo: ${data.codOperativo ?? "null"}` : ""}`,
    });
  } catch {}

  return NextResponse.json({ ok: true, movimiento: actualizado });
}

/** DELETE - Eliminar movimiento */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const movimiento = await prisma.movimientoExtracto.findUnique({ where: { id } });
  if (!movimiento) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  await prisma.mayorMovimiento.deleteMany({
    where: { origen: "EXTRACTO", origenId: id },
  });
  await prisma.movimientoExtracto.delete({ where: { id } });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó movimiento del extracto bancario",
      modulo: "Tesorería",
      detalle: String(id),
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
