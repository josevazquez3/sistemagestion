import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Listar legajos para selector de comisiones (búsqueda por nombre o número) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  const where: { fechaBaja?: null; OR?: object[] } = { fechaBaja: null };

  if (q) {
    const numLegajo = parseInt(q, 10);
    const or: object[] = [
      { nombres: { contains: q, mode: "insensitive" as const } },
      { apellidos: { contains: q, mode: "insensitive" as const } },
      { dni: { contains: q } },
    ];
    if (!isNaN(numLegajo)) or.push({ numeroLegajo: numLegajo });
    (where as { OR?: object[] }).OR = or;
  }

  const legajos = await prisma.legajo.findMany({
    where,
    select: { id: true, numeroLegajo: true, nombres: true, apellidos: true },
    orderBy: { numeroLegajo: "asc" },
    take: limit,
  });

  const data = legajos.map((l) => ({
    id: l.id,
    numeroLegajo: l.numeroLegajo,
    nombre: `${l.apellidos}, ${l.nombres}`.trim(),
  }));

  return NextResponse.json({ data });
}
