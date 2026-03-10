import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Forzar recálculo de saldos (parte del saldo anterior configurado). Body o query: mes, anio */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let mes = 0;
  let anio = 0;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      mes = parseInt(String(body.mes ?? 0), 10);
      anio = parseInt(String(body.anio ?? 0), 10);
    }
    if (!mes || !anio) {
      const { searchParams } = new URL(req.url);
      mes = parseInt(searchParams.get("mes") ?? "0", 10);
      anio = parseInt(searchParams.get("anio") ?? "0", 10);
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo o parámetros inválidos" }, { status: 400 });
  }

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json(
      { error: "mes y anio son obligatorios (mes 1-12)" },
      { status: 400 }
    );
  }

  await recalcularSaldos(prisma, mes, anio);
  return NextResponse.json({ ok: true, mes, anio });
}
