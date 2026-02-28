import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { EstadoLicencia } from "@prisma/client";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Obtener una licencia por ID */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      certificados: true,
    },
  });

  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });
  return NextResponse.json(licencia);
}

/** PUT - Actualizar o finalizar licencia */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({ where: { id } });
  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  const body = await req.json();

  // Finalizar licencia
  if (body.estado === EstadoLicencia.FINALIZADA) {
    const updated = await prisma.licencia.update({
      where: { id },
      data: {
        estado: EstadoLicencia.FINALIZADA,
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : licencia.fechaFin,
        fechaCierre: body.fechaCierre ? new Date(body.fechaCierre) : new Date(),
        observacionesCierre: body.observacionesCierre ?? null,
      },
      include: {
        legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
        certificados: true,
      },
    });
    const user = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: "Finalizó una licencia",
        modulo: "Licencias",
        detalle: `Licencia ID ${id}`,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });
    } catch {}
    return NextResponse.json(updated);
  }

  // Actualización parcial (fechaFin, observaciones, etc.)
  const data: {
    fechaFin?: Date | null;
    observaciones?: string | null;
    diasMarcados?: string[];
  } = {};
  if (body.fechaFin !== undefined) data.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
  if (body.observaciones !== undefined) data.observaciones = body.observaciones ?? null;
  if (body.diasMarcados !== undefined && Array.isArray(body.diasMarcados)) data.diasMarcados = body.diasMarcados;

  const updated = await prisma.licencia.update({
    where: { id },
    data: data as Parameters<typeof prisma.licencia.update>[0]["data"],
    include: {
      legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } },
      certificados: true,
    },
  });
  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Editó una licencia",
      modulo: "Licencias",
      detalle: `Licencia ID ${id}`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
  } catch {}
  return NextResponse.json(updated);
}
