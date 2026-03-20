import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { isSuperAdmin } from "@/lib/auth.utils";

/** DELETE - Eliminar físicamente un usuario (solo SUPER_ADMIN) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];

  let esSuperAdmin = isSuperAdmin(roles);
  const currentUserIdForRole = (session?.user as { id?: string })?.id;
  // Si el JWT no trae el rol (ej. no re-logó), verificar en BD
  if (!esSuperAdmin && currentUserIdForRole) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: currentUserIdForRole },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.nombre);
    esSuperAdmin = roleNames.includes("SUPER_ADMIN");
  }

  if (!esSuperAdmin) {
    return NextResponse.json(
      { error: "Solo SUPER_ADMIN puede eliminar usuarios de forma permanente." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const currentUserId = (session?.user as { id?: string })?.id;

  if (currentUserId === id) {
    return NextResponse.json(
      { error: "No podés eliminarte a vos mismo." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nombre: true, apellido: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { nombre: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (superAdminRole) {
    const otrosSuperAdmins = await prisma.userRole.count({
      where: {
        roleId: superAdminRole.id,
        userId: { not: id },
      },
    });
    const esteEsSuperAdmin = await prisma.userRole.count({
      where: { userId: id, roleId: superAdminRole.id },
    });
    if (esteEsSuperAdmin && otrosSuperAdmins === 0) {
      return NextResponse.json(
        { error: "No se puede eliminar al último SUPER_ADMIN del sistema." },
        { status: 400 }
      );
    }
  }

  const detalle = `${user.nombre} ${user.apellido} - ${user.email}`;

  try {
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userPermission.deleteMany({ where: { userId: id } }),
      prisma.notificacion.deleteMany({ where: { usuarioId: id } }),
      prisma.auditoriaLog.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (e) {
    console.error("[DELETE /api/usuarios/[id]/fisico]", e);
    return NextResponse.json(
      { error: "Error al eliminar el usuario" },
      { status: 500 }
    );
  }

  const sessionUser = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: sessionUser?.id ?? "",
    userNombre: sessionUser?.name ?? "",
    userEmail: sessionUser?.email ?? "",
    accion: "Eliminó físicamente al usuario",
    modulo: "Usuarios",
    detalle,
    ip: undefined,
  });

  return NextResponse.json({ success: true });
}
