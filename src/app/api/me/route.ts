import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET - Devuelve el usuario actual con roles cargados desde la BD (para UI que necesita roles actualizados sin re-login) */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      roles: { include: { role: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const roles = user.roles.map((r) => r.role.nombre);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    roles,
  });
}
