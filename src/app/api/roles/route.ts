import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET - Listar roles y permisos (solo ADMIN) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [rolesList, permissionsList] = await Promise.all([
    prisma.role.findMany({ orderBy: { nombre: "asc" } }),
    prisma.permission.findMany({ orderBy: [{ modulo: "asc" }, { accion: "asc" }] }),
  ]);

  const permissionsByModule = permissionsList.reduce(
    (acc, p) => {
      if (!acc[p.modulo]) acc[p.modulo] = [];
      acc[p.modulo].push({ id: p.id, accion: p.accion });
      return acc;
    },
    {} as Record<string, { id: string; accion: string }[]>
  );

  return NextResponse.json({ roles: rolesList, permissionsByModule });
}
