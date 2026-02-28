import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TipoLicencia } from "@prisma/client";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;
const TIPOS_VALIDOS: TipoLicencia[] = ["ART", "ENFERMEDAD", "ESTUDIO", "MATERNIDAD", "PATERNIDAD"];

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Historial completo de certificados (todos los legajos). Filtros: legajoId, tipoLicencia */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const legajoId = searchParams.get("legajoId");
  const tipoParam = searchParams.get("tipoLicencia");

  const where: { legajoId?: string; licencia?: { tipoLicencia: TipoLicencia } } = {};
  if (legajoId) where.legajoId = legajoId;
  if (tipoParam && TIPOS_VALIDOS.includes(tipoParam as TipoLicencia)) {
    where.licencia = { tipoLicencia: tipoParam as TipoLicencia };
  }

  const certificados = await prisma.certificado.findMany({
    where,
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      licencia: { select: { id: true, tipoLicencia: true, fechaInicio: true, estado: true } },
    },
    orderBy: { fechaCarga: "desc" },
  });

  return NextResponse.json({ data: certificados });
}
