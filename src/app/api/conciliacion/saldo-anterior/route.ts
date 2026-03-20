import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseNum(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cuentaId = parseNum(searchParams.get("cuentaId"));
  const mes = parseNum(searchParams.get("mes"));
  const anio = parseNum(searchParams.get("anio"));

  // cuentaId 0 = vista unificada (todas las cuentas)
  if (!Number.isFinite(cuentaId) || cuentaId < 0 || !mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<{ saldo: string; updatedAt: Date }[]>`
    SELECT saldo, "updatedAt"
    FROM conciliacion_saldo_anterior
    WHERE "cuentaId" = ${cuentaId}
      AND mes = ${mes}
      AND anio = ${anio}
    LIMIT 1
  `;
  const item = rows[0] ?? null;

  if (!item) {
    return NextResponse.json({ saldo: null });
  }
  return NextResponse.json({
    saldo: item.saldo.toString(),
    updatedAt: item.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    | { cuentaId?: number; mes?: number; anio?: number; saldo?: number }
    | null;
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const cuentaId = Number(body.cuentaId);
  const mes = Number(body.mes);
  const anio = Number(body.anio);
  const saldo = Number(body.saldo);

  if (!Number.isFinite(cuentaId) || cuentaId < 0 || !mes || !anio || !Number.isFinite(saldo) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const saldoDecimal = Math.round(saldo * 100) / 100;

  await prisma.$executeRaw`
    INSERT INTO conciliacion_saldo_anterior ("cuentaId", mes, anio, saldo, "updatedAt")
    VALUES (${cuentaId}, ${mes}, ${anio}, ${saldoDecimal}, NOW())
    ON CONFLICT ("cuentaId", mes, anio)
    DO UPDATE SET saldo = EXCLUDED.saldo, "updatedAt" = NOW()
  `;

  const saved = await prisma.$queryRaw<{ saldo: string }[]>`
    SELECT saldo FROM conciliacion_saldo_anterior
    WHERE "cuentaId" = ${cuentaId}
      AND mes = ${mes}
      AND anio = ${anio}
    LIMIT 1
  `;

  const first = saved[0];
  if (!first) {
    return NextResponse.json({ error: "No se pudo leer el saldo guardado" }, { status: 500 });
  }
  return NextResponse.json({ saldo: first.saldo.toString() });
}
