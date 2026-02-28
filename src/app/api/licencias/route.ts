import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { TipoLicencia } from "@prisma/client";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Listar licencias. Si se pasa legajoId, filtra por ese legajo. */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const legajoId = searchParams.get("legajoId");
  const tipo = searchParams.get("tipo") as TipoLicencia | null;
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: {
    legajoId?: string;
    tipoLicencia?: TipoLicencia;
    fechaInicio?: { gte?: Date; lte?: Date };
  } = {};

  if (legajoId) where.legajoId = legajoId;
  if (tipo) where.tipoLicencia = tipo;
  if (desde) where.fechaInicio = { ...where.fechaInicio, gte: new Date(desde) };
  if (hasta) where.fechaInicio = { ...where.fechaInicio, lte: new Date(hasta) };

  const licencias = await prisma.licencia.findMany({
    where,
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      certificados: { select: { id: true, nombreArchivo: true, tipoArchivo: true, etapa: true, urlArchivo: true } },
    },
    orderBy: { fechaInicio: "desc" },
  });

  return NextResponse.json({ data: licencias });
}

/** POST - Crear nueva licencia */
export async function POST(req: Request) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      legajoId,
      tipoLicencia,
      fechaInicio,
      fechaFin,
      observaciones,
      diasMarcados = [],
    } = body;

    if (!legajoId || !tipoLicencia || !fechaInicio) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: legajoId, tipoLicencia, fechaInicio" },
        { status: 400 }
      );
    }

    const legajo = await prisma.legajo.findUnique({ where: { id: legajoId } });
    if (!legajo) {
      return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
    }

    const licencia = await prisma.licencia.create({
      data: {
        legajoId,
        tipoLicencia,
        fechaInicio: new Date(fechaInicio),
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        observaciones: observaciones || null,
        diasMarcados: Array.isArray(diasMarcados) ? diasMarcados : [],
      },
      include: {
        legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: "Creó una licencia",
        modulo: "Licencias",
        detalle: `${tipoLicencia} - ${legajo.apellidos} ${legajo.nombres}`,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });
    } catch {}

    return NextResponse.json(licencia);
  } catch (e) {
    console.error("Error creando licencia:", e);
    return NextResponse.json({ error: "Error al crear licencia" }, { status: 500 });
  }
}
