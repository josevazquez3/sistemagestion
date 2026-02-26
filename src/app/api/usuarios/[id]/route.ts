import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET - Obtener usuario por ID con roles y permisos (solo ADMIN) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      activo: true,
      roles: { include: { role: true } },
      permisos: { include: { permission: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    activo: user.activo,
    roleIds: user.roles.map((r) => r.roleId),
    permissionIds: user.permisos.map((p) => p.permissionId),
  });
}

/** PATCH - Actualizar usuario: roles, permisos, activo (solo ADMIN) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { roleIds, permissionIds, activo } = body;

    if (typeof activo === "boolean") {
      await prisma.user.update({ where: { id }, data: { activo } });
    }

    if (Array.isArray(roleIds)) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await prisma.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    if (Array.isArray(permissionIds)) {
      await prisma.userPermission.deleteMany({ where: { userId: id } });
      if (permissionIds.length > 0) {
        await prisma.userPermission.createMany({
          data: permissionIds.map((permissionId: string) => ({ userId: id, permissionId })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando usuario:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
