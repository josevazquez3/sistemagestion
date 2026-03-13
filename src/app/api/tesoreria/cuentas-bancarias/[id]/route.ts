import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** PATCH - Añadir código operativo a la cuenta (concatena sin duplicar) */
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

  let body: { addCodOperativo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const addCodOperativoTrim = (body.addCodOperativo ?? "").trim();
  if (!addCodOperativoTrim) {
    return NextResponse.json({ error: "addCodOperativo es obligatorio" }, { status: 400 });
  }

  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id } });
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const actual = cuenta.codOperativo ?? "";
  const partes = actual.split(/\s+/).filter(Boolean);
  if (partes.includes(addCodOperativoTrim)) {
    return NextResponse.json(cuenta);
  }

  const nuevo = actual ? `${actual} ${addCodOperativoTrim}` : addCodOperativoTrim;
  const actualizada = await prisma.cuentaBancaria.update({
    where: { id },
    data: { codOperativo: nuevo },
  });
  return NextResponse.json(actualizada);
}

/** PUT - Actualizar cuenta */
export async function PUT(
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

  let body: { codigo?: string; codOperativo?: string | null; nombre?: string; activo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id } });
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const codigo = (body.codigo ?? cuenta.codigo).trim();
  const nombre = (body.nombre ?? cuenta.nombre).trim();
  const codOperativo = body.codOperativo !== undefined ? ((body.codOperativo ?? "").trim() || null) : cuenta.codOperativo;
  if (!codigo || !nombre) {
    return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });
  }

  const existente = await prisma.cuentaBancaria.findFirst({
    where: { codigo, codOperativo, NOT: { id } },
  });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe otra cuenta con ese código y código operativo" },
      { status: 409 }
    );
  }

  const actualizada = await prisma.cuentaBancaria.update({
    where: { id },
    data: {
      codigo,
      codOperativo,
      nombre,
      activo: body.activo ?? cuenta.activo,
    },
  });
  return NextResponse.json(actualizada);
}

/** DELETE - Eliminar cuenta */
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

  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id } });
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  await prisma.cuentaBancaria.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
