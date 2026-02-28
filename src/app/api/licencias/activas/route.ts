import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EstadoLicencia } from "@prisma/client";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Listar todas las licencias activas (para Dashboard y Nómina) */
export async function GET() {
  try {
    const session = await auth();
    const roles = (session?.user as { roles?: string[] })?.roles ?? [];
    if (!canManageLicencias(roles)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const licencias = await prisma.licencia.findMany({
      where: { estado: EstadoLicencia.ACTIVA },
      include: {
        legajo: {
          select: {
            id: true,
            numeroLegajo: true,
            nombres: true,
            apellidos: true,
          },
        },
        observacionesNomina: {
          orderBy: { creadoEn: "desc" },
          take: 1,
        },
      },
      orderBy: { fechaInicio: "asc" },
    });

    return NextResponse.json(
      { data: Array.isArray(licencias) ? licencias : [] },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error) {
    console.error("[GET /api/licencias/activas] Error:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        detalle: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
