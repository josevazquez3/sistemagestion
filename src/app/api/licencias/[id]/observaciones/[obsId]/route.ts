import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** PUT - Editar observación de nómina */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const licenciaId = parseInt((await params).id, 10);
  const obsId = parseInt((await params).obsId, 10);
  if (isNaN(licenciaId) || isNaN(obsId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const obs = await prisma.observacionLicencia.findFirst({
    where: { id: obsId, licenciaId },
  });
  if (!obs) return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });

  const body = await req.json();
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";

  const updated = await prisma.observacionLicencia.update({
    where: { id: obsId },
    data: { texto: texto || "" },
  });
  return NextResponse.json(updated);
}

/** DELETE - Eliminar observación de nómina */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const licenciaId = parseInt((await params).id, 10);
  const obsId = parseInt((await params).obsId, 10);
  if (isNaN(licenciaId) || isNaN(obsId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const obs = await prisma.observacionLicencia.findFirst({
    where: { id: obsId, licenciaId },
  });
  if (!obs) return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });

  await prisma.observacionLicencia.delete({ where: { id: obsId } });
  return NextResponse.json({ success: true });
}
