import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Próximo código disponible (máximo numérico + 1, formateado) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const cuentas = await prisma.cuentaBancaria.findMany({
    select: { codigo: true },
  });
  let max = 0;
  for (const c of cuentas) {
    const n = parseInt(c.codigo.trim(), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const next = max + 1;
  const codigo = next < 10 ? `0${next}` : String(next);
  return NextResponse.json({ codigo });
}
