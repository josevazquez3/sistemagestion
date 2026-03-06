import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EstadoReunion } from "@prisma/client";

const ROLES = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;

function canAccess(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list
    .map((r: unknown) =>
      typeof r === "string" ? r : (r as { nombre?: string })?.nombre ?? (r as { name?: string })?.name
    )
    .filter(Boolean) as string[];
  return ROLES.some((r) => names.includes(r));
}

/** GET - Próxima reunión pendiente y total de pendientes (fechaReunion >= hoy) */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccess((session?.user as { roles?: unknown })?.roles ?? [])) {
    return NextResponse.json({ proxima: null, totalPendientes: 0 });
  }

  const hoy = new Date();
  const hoyNorm = new Date(
    hoy.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
  );

  const [proxima, totalPendientes] = await Promise.all([
    prisma.reunion.findFirst({
      where: {
        estado: EstadoReunion.PENDIENTE,
        fechaReunion: { gte: hoyNorm },
      },
      orderBy: [{ fechaReunion: "asc" }, { hora: "asc" }],
    }),
    prisma.reunion.count({
      where: {
        estado: EstadoReunion.PENDIENTE,
        fechaReunion: { gte: hoyNorm },
      },
    }),
  ]);

  return NextResponse.json({ proxima, totalPendientes });
}
