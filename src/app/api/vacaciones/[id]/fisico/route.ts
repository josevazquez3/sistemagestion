import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { isSuperAdmin } from "@/lib/auth.utils";

/** DELETE - Eliminar físicamente una solicitud de vacaciones (solo SUPER_ADMIN) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  let esSuperAdmin = isSuperAdmin(roles);
  const currentUserId = (session?.user as { id?: string })?.id;
  if (!esSuperAdmin && currentUserId) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: currentUserId },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.nombre);
    esSuperAdmin = roleNames.includes("SUPER_ADMIN");
  }
  if (!esSuperAdmin) {
    return NextResponse.json(
      { error: "Solo SUPER_ADMIN puede eliminar solicitudes de vacaciones de forma permanente." },
      { status: 403 }
    );
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const solicitud = await prisma.solicitudVacaciones.findUnique({
    where: { id },
    select: { id: true, legajoId: true, fechaDesde: true, fechaHasta: true },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  try {
    /** Quitar novedades de vacaciones que cubran el mismo período (evita huérfanos si fechaDesde difiere por TZ). */
    await prisma.$transaction([
      prisma.novedadLiquidacion.deleteMany({
        where: {
          legajoId: solicitud.legajoId,
          tipo: "VACACIONES",
          fechaDesde: { lte: solicitud.fechaHasta },
          fechaHasta: { gte: solicitud.fechaDesde },
        },
      }),
      prisma.notificacion.deleteMany({ where: { solicitudId: id } }),
      prisma.solicitudVacaciones.delete({ where: { id } }),
    ]);
  } catch (e) {
    console.error("[DELETE /api/vacaciones/[id]/fisico]", e);
    return NextResponse.json(
      { error: "Error al eliminar la solicitud" },
      { status: 500 }
    );
  }

  const detalle = `Solicitud #${id} (legajo ${solicitud.legajoId}, ${solicitud.fechaDesde.toISOString().slice(0, 10)} - ${solicitud.fechaHasta.toISOString().slice(0, 10)})`;
  const sessionUser = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: sessionUser?.id ?? "",
    userNombre: sessionUser?.name ?? "",
    userEmail: sessionUser?.email ?? "",
    accion: "Eliminó físicamente la solicitud de vacaciones",
    modulo: "Vacaciones",
    detalle,
    ip: undefined,
  });

  return NextResponse.json({ success: true });
}
