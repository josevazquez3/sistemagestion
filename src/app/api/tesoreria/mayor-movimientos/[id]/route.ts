import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fechaSeguraParaPrisma } from "@/lib/utils/fecha";
import {
  deleteMayorMovimiento,
  findMayorCuentaById,
  findMayorMovimientoById,
  updateMayorMovimiento,
} from "@/lib/tesoreria/mayorRawQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function serialize(m: {
  id: number;
  cuentaId: number;
  fecha: Date | null;
  concepto: string;
  importe: number;
  origen: string;
  origenId: number | null;
  createdAt: Date;
  cuentaNombre: string;
}) {
  return {
    id: m.id,
    cuentaId: m.cuentaId,
    cuentaNombre: m.cuentaNombre,
    fecha: m.fecha ? m.fecha.toISOString() : null,
    concepto: m.concepto,
    importe: m.importe,
    origen: m.origen,
    origenId: m.origenId,
    createdAt: m.createdAt.toISOString(),
  };
}

/** PATCH */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const existente = await findMayorMovimientoById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let body: {
    cuentaId?: number;
    fecha?: string | null;
    concepto?: string;
    importe?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  let cuentaId = existente.cuentaId;
  if (body.cuentaId !== undefined) {
    cuentaId = Number(body.cuentaId);
    const c = await findMayorCuentaById(cuentaId);
    if (!c) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 400 });
    }
  }

  const concepto =
    body.concepto !== undefined
      ? String(body.concepto).trim()
      : existente.concepto;
  if (!concepto) {
    return NextResponse.json({ error: "concepto no puede quedar vacío" }, { status: 400 });
  }

  const importe =
    body.importe !== undefined ? Number(body.importe) : existente.importe;
  if (Number.isNaN(importe)) {
    return NextResponse.json({ error: "importe inválido" }, { status: 400 });
  }

  let fecha: Date | null = existente.fecha;
  if (body.fecha !== undefined) {
    fecha = body.fecha ? fechaSeguraParaPrisma(body.fecha) : null;
  }

  try {
    const actualizado = await updateMayorMovimiento(
      id,
      cuentaId,
      concepto,
      importe,
      fecha
    );
    if (!actualizado) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(serialize(actualizado));
  } catch (err) {
    console.error("mayor-movimientos PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

/** DELETE */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const existente = await findMayorMovimientoById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    await deleteMayorMovimiento(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("mayor-movimientos DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}
