import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!ROLES.some((r) => roles.includes(r))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { activo: true },
    orderBy: [{ codigo: "asc" }, { nombre: "asc" }],
    select: { id: true, codigo: true, nombre: true, codOperativo: true },
  });

  return NextResponse.json({
    data: cuentas.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      codOperativo: c.codOperativo ?? "",
    })),
  });
}
