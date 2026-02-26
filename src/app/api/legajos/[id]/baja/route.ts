import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManageLegajos(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("RRHH");
}

/** POST - Dar de baja un legajo */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { fechaBaja, motivoBaja } = body;

  if (!fechaBaja || !motivoBaja?.trim()) {
    return NextResponse.json({ error: "Fecha de baja y motivo son obligatorios" }, { status: 400 });
  }

  const legajo = await prisma.legajo.findUnique({ where: { id } });
  if (!legajo) return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
  if (legajo.fechaBaja) return NextResponse.json({ error: "El legajo ya está dado de baja" }, { status: 400 });

  await prisma.legajo.update({
    where: { id },
    data: { fechaBaja: new Date(fechaBaja), motivoBaja: motivoBaja.trim() },
  });

  return NextResponse.json({ ok: true });
}
