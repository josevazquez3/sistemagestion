import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteCuitDistrito,
  findCuitDistritoById,
  updateCuitDistrito,
} from "@/lib/tesoreria/cuitDistritosQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function mapRow(r: { id: number; distrito: string; cuit: string; createdAt: Date }) {
  return {
    id: r.id,
    distrito: r.distrito,
    cuit: r.cuit,
    createdAt: r.createdAt.toISOString(),
  };
}

/** PATCH - Actualizar { distrito, cuit } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idParam = (await params).id;
  const id = parseInt(idParam, 10);
  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const existente = await findCuitDistritoById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let body: { distrito?: string; cuit?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const distrito = (body.distrito ?? existente.distrito).trim();
  const cuit = (body.cuit ?? existente.cuit).trim();
  if (!distrito || !cuit) {
    return NextResponse.json(
      { error: "distrito y cuit son obligatorios" },
      { status: 400 }
    );
  }

  try {
    const actualizado = await updateCuitDistrito(id, distrito, cuit);
    if (!actualizado) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(mapRow(actualizado));
  } catch (err) {
    console.error("cuit-distritos PATCH:", err);
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

  const idParam = (await params).id;
  const id = parseInt(idParam, 10);
  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const existente = await findCuitDistritoById(id);
  if (!existente) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    await deleteCuitDistrito(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("cuit-distritos DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}
