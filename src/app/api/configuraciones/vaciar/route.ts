import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

/** Orden de eliminación: tablas dependientes primero. NO se eliminan usuarios ni roles/permisos. */
const VACIAR_ORDER = [
  prisma.documentoLegislacion.deleteMany(),
  prisma.categoriaLegislacion.deleteMany(),
  prisma.acta.deleteMany(),
  prisma.auditoriaLog.deleteMany(),
  prisma.observacionLicencia.deleteMany(),
  prisma.certificado.deleteMany(),
  prisma.licencia.deleteMany(),
  prisma.notificacion.deleteMany(),
  prisma.solicitudVacaciones.deleteMany(),
  prisma.configuracionVacaciones.deleteMany(),
  prisma.telefonoContacto.deleteMany(),
  prisma.contactoAdicional.deleteMany(),
  prisma.legajo.deleteMany(),
  // NO eliminar: prisma.userRole, prisma.userPermission, prisma.user, prisma.role, prisma.permission
];

export async function DELETE() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    await prisma.$transaction(VACIAR_ORDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al vaciar la base de datos";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Vació la base de datos",
      modulo: "Configuraciones",
    });
  } catch {}

  return NextResponse.json({ ok: true, mensaje: "Base de datos vaciada" });
}
