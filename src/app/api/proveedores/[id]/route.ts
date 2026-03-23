import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const proveedor = String(body?.proveedor ?? "").trim();
    if (!proveedor) {
      return NextResponse.json({ error: "El campo Proveedor es obligatorio." }, { status: 400 });
    }

    const updated = await prisma.proveedor.update({
      where: { id: proveedorId },
      data: {
        proveedor,
        nombreContacto: body?.nombreContacto?.trim() || null,
        alias: body?.alias?.trim() || null,
        cuit: body?.cuit?.trim() || null,
        cuentaDebitoTipoNum: body?.cuentaDebitoTipoNum?.trim() || null,
        banco: body?.banco?.trim() || null,
        direccion: body?.direccion?.trim() || null,
        ciudad: body?.ciudad?.trim() || null,
        telefono: body?.telefono?.trim() || null,
        email: body?.email?.trim() || null,
        formaPago: body?.formaPago?.trim() || null,
        cbu: body?.cbu?.trim() || null,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar proveedor." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    await prisma.proveedor.delete({ where: { id: proveedorId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar proveedor." }, { status: 500 });
  }
}
