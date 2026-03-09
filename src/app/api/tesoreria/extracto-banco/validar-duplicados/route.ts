import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Validar duplicados: mismo fecha + referencia + importePesos */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Array<{ fecha: string; referencia?: string; importePesos: number }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Se requiere un array" }, { status: 400 });
  }

  const resultados = await Promise.all(
    body.map(async (m) => {
      const fecha = new Date(m.fecha);
      const start = new Date(fecha);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(fecha);
      end.setUTCHours(23, 59, 59, 999);
      const ref = (m.referencia ?? "").trim();
      const imp = new Decimal(m.importePesos ?? 0);

      const existente = await prisma.movimientoExtracto.findFirst({
        where: {
          fecha: { gte: start, lte: end },
          referencia: ref || null,
          importePesos: imp,
        },
      });
      return { ...m, duplicado: !!existente };
    })
  );

  return NextResponse.json(resultados);
}
