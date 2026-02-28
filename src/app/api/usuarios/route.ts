import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import bcrypt from "bcryptjs";

/** GET - Listar todos los usuarios (solo ADMIN) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      activo: true,
      legajoId: true,
      legajo: { select: { id: true, numeroLegajo: true, apellidos: true, nombres: true } },
      roles: { include: { role: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      nombre: `${u.nombre} ${u.apellido}`,
      email: u.email,
      roles: u.roles.map((r) => r.role.nombre),
      activo: u.activo,
      legajoId: u.legajoId,
      legajo: u.legajo
        ? { id: u.legajo.id, numeroLegajo: u.legajo.numeroLegajo, label: `${u.legajo.apellidos}, ${u.legajo.nombres}` }
        : null,
    }))
  );
}

/** POST - Crear nuevo usuario (solo ADMIN) */
export async function POST(req: Request) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, apellido, email, password, roleIds = [], permissionIds = [] } = body;

    if (!nombre || !apellido || !email || !password) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        nombre,
        apellido,
        email,
        passwordHash,
        activo: true,
      },
    });

    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId: string) => ({ userId: user.id, roleId })),
        skipDuplicates: true,
      });
    }

    if (permissionIds.length > 0) {
      await prisma.userPermission.createMany({
        data: permissionIds.map((permissionId: string) => ({ userId: user.id, permissionId })),
        skipDuplicates: true,
      });
    }

    const sessionUser = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: sessionUser?.id ?? "",
        userNombre: sessionUser?.name ?? "",
        userEmail: sessionUser?.email ?? "",
        accion: "Creó un usuario",
        modulo: "Usuarios",
        detalle: `${nombre} ${apellido} - ${email}`,
      });
    } catch {}

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (e) {
    console.error("Error creando usuario:", e);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
