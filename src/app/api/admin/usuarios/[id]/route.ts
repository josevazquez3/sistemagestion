import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasAdminAccess(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const sessionRoles = ((session?.user as { roles?: string[] })?.roles ?? []).filter(Boolean);

  if (!hasAdminAccess(sessionRoles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawPassword = typeof body.password === "string" ? body.password : "";

    if (!rawEmail && !rawPassword) {
      return NextResponse.json(
        { error: "Debe enviar email y/o password" },
        { status: 400 }
      );
    }

    if (rawEmail && !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    if (rawPassword && rawPassword.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: { include: { role: true } },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const targetIsSuperAdmin = targetUser.roles.some((r) => r.role.nombre === "SUPER_ADMIN");
    const actorIsSuperAdmin = sessionRoles.includes("SUPER_ADMIN");

    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      return NextResponse.json(
        { error: "No puede editar un usuario SUPER_ADMIN" },
        { status: 403 }
      );
    }

    if (rawEmail) {
      const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
      if (existing && existing.id !== targetUser.id) {
        return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
      }
    }

    const data: { email?: string; passwordHash?: string } = {};
    if (rawEmail) data.email = rawEmail;
    if (rawPassword) data.passwordHash = await bcrypt.hash(rawPassword, 10);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: true });
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error editando usuario (email/password):", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}
