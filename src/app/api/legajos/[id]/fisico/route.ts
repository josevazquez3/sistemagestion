import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { isSuperAdmin } from "@/lib/auth.utils";
import path from "path";
import { unlink } from "fs/promises";

/** DELETE - Eliminar físicamente un legajo y todos sus datos (solo SUPER_ADMIN) */
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
      { error: "Solo SUPER_ADMIN puede eliminar legajos de forma permanente." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const legajo = await prisma.legajo.findUnique({
    where: { id },
    select: { id: true, numeroLegajo: true, apellidos: true, nombres: true, fotoUrl: true },
  });

  if (!legajo) {
    return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
  }

  const detalle = `Legajo N°${legajo.numeroLegajo} - ${legajo.apellidos} ${legajo.nombres}`;

  try {
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { legajoId: id },
        data: { legajoId: null },
      }),
      prisma.observacionLicencia.deleteMany({
        where: { licencia: { legajoId: id } },
      }),
      prisma.certificado.deleteMany({ where: { legajoId: id } }),
      prisma.licencia.deleteMany({ where: { legajoId: id } }),
      prisma.solicitudVacaciones.deleteMany({ where: { legajoId: id } }),
      prisma.configuracionVacaciones.deleteMany({ where: { legajoId: id } }),
      prisma.novedadLiquidacion.deleteMany({ where: { legajoId: id } }),
      prisma.telefonoContacto.deleteMany({
        where: { contacto: { legajoId: id } },
      }),
      prisma.contactoAdicional.deleteMany({ where: { legajoId: id } }),
      prisma.legajo.delete({ where: { id } }),
    ]);

    if (legajo.fotoUrl?.startsWith("/")) {
      try {
        const filePath = path.join(process.cwd(), legajo.fotoUrl.replace(/^\//, ""));
        await unlink(filePath);
      } catch {
        // Ignorar si el archivo no existe
      }
    }

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó físicamente el legajo",
      modulo: "Legajos",
      detalle,
      ip: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/legajos/[id]/fisico]", e);
    return NextResponse.json(
      { error: "Error al eliminar el legajo" },
      { status: 500 }
    );
  }
}
