import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteMayorCuenta,
  findMayorCuentaById,
  updateMayorCuenta,
} from "@/lib/tesoreria/mayorRawQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function serialize(c: { id: number; nombre: string; orden: number; createdAt: Date }) {
  return {
    id: c.id,
    nombre: c.nombre,
    orden: c.orden,
    createdAt: c.createdAt.toISOString(),
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

  const existente = await findMayorCuentaById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let body: { nombre?: string; orden?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const nombre =
    body.nombre !== undefined ? String(body.nombre).trim() : existente.nombre;
  if (!nombre) {
    return NextResponse.json({ error: "nombre no puede quedar vacío" }, { status: 400 });
  }

  const orden =
    body.orden !== undefined ? Number(body.orden) : existente.orden;

  try {
    const actualizado = await updateMayorCuenta(id, nombre, orden);
    if (!actualizado) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(serialize(actualizado));
  } catch (err) {
    console.error("mayor-cuentas PATCH:", err);
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

  const existente = await findMayorCuentaById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    await deleteMayorCuenta(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("mayor-cuentas DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}
