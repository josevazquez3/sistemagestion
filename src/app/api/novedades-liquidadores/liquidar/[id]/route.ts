import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Marcar novedad como liquidada */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = (await params).id;
  const novedad = await prisma.novedadLiquidacion.findUnique({ where: { id } });
  if (!novedad) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });

  const updated = await prisma.novedadLiquidacion.update({
    where: { id },
    data: { liquidado: true, fechaLiquidacion: new Date() },
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
    },
  });
  return NextResponse.json(updated);
}
