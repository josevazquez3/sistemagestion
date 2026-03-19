import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { eliminarArchivo } from "@/lib/blob";
import { EstadoLicencia } from "@prisma/client";
import path from "path";
import { unlink } from "fs/promises";

const ROLES_LICENCIAS = ["SUPER_ADMIN", "ADMIN", "RRHH"] as const;

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

/** DELETE - Eliminar físicamente una licencia y sus certificados (SUPER_ADMIN y ADMIN) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeEliminarFisico = roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r));
  if (!puedeEliminarFisico) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: {
      certificados: { select: { id: true, urlArchivo: true } },
      legajo: { select: { numeroLegajo: true, apellidos: true, nombres: true } },
    },
  });
  if (!licencia) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });
  }

  const urlsToDelete = licencia.certificados.map((c) => c.urlArchivo);
  await prisma.$transaction([
    prisma.observacionLicencia.deleteMany({ where: { licenciaId: id } }),
    prisma.certificado.deleteMany({ where: { licenciaId: id } }),
    prisma.licencia.delete({ where: { id } }),
  ]);

  for (const url of urlsToDelete) {
    if (!url) continue;
    try {
      await eliminarArchivo(url);
    } catch {}
    if (url.startsWith("/")) {
      try {
        const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
        await unlink(filePath);
      } catch {}
    }
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó físicamente una licencia",
      modulo: "Licencias",
      detalle: `Licencia #${id} - ${licencia.legajo.apellidos} ${licencia.legajo.nombres} (Leg. ${licencia.legajo.numeroLegajo})`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
