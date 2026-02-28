import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

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
      legajoId: true,
      legajo: { select: { id: true, numeroLegajo: true, apellidos: true, nombres: true } },
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
    legajoId: user.legajoId,
    legajo: user.legajo
      ? { id: user.legajo.id, numeroLegajo: user.legajo.numeroLegajo, label: `${user.legajo.apellidos}, ${user.legajo.nombres}` }
      : null,
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
    const { roleIds, permissionIds, activo, legajoId } = body;

    const updateData: { activo?: boolean; legajoId?: string | null } = {};
    if (typeof activo === "boolean") updateData.activo = activo;
    if (legajoId !== undefined) updateData.legajoId = legajoId === null || legajoId === "" ? null : legajoId;

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id }, data: updateData });
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

    const sessionUser = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: sessionUser?.id ?? "",
        userNombre: sessionUser?.name ?? "",
        userEmail: sessionUser?.email ?? "",
        accion: "Editó un usuario",
        modulo: "Usuarios",
        detalle: `${user.nombre} ${user.apellido} - ${user.email}`,
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error actualizando usuario:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
