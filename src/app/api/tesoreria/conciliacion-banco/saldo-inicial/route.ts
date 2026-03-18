import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateConfiguracionTesoreria } from "@/lib/tesoreria/configuracionTesoreria";

const ROLES_CARGA = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function puedeCargar(roles: string[]) {
  return ROLES_CARGA.some((r) => roles.includes(r));
}

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!puedeCargar(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const row = await getOrCreateConfiguracionTesoreria();
  return NextResponse.json({
    monto: Number(row.saldoInicialConciliacion),
    cargado: row.saldoInicialConciliacionCargado,
    actualizadoEn: row.actualizadoEn.toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!puedeCargar(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { monto?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const monto =
    typeof body.monto === "number" && Number.isFinite(body.monto) ? body.monto : NaN;
  if (Number.isNaN(monto) || monto < 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const row = await getOrCreateConfiguracionTesoreria();
  if (row.saldoInicialConciliacionCargado) {
    return NextResponse.json(
      { error: "El saldo inicial ya fue cargado. Solo SUPER_ADMIN puede modificarlo desde Configuración." },
      { status: 409 }
    );
  }

  await prisma.configuracionTesoreria.update({
    where: { id: row.id },
    data: {
      saldoInicialConciliacion: new Decimal(Math.round(monto * 100) / 100),
      saldoInicialConciliacionCargado: true,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Solo SUPER_ADMIN puede editar el saldo inicial." }, { status: 403 });
  }

  let body: { monto?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const monto =
    typeof body.monto === "number" && Number.isFinite(body.monto) ? body.monto : NaN;
  if (Number.isNaN(monto) || monto < 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const row = await getOrCreateConfiguracionTesoreria();
  await prisma.configuracionTesoreria.update({
    where: { id: row.id },
    data: {
      saldoInicialConciliacion: new Decimal(Math.round(monto * 100) / 100),
      saldoInicialConciliacionCargado: true,
    },
  });

  const actualizado = await prisma.configuracionTesoreria.findUnique({ where: { id: row.id } });
  return NextResponse.json({
    ok: true,
    monto: Number(actualizado?.saldoInicialConciliacion ?? 0),
    actualizadoEn: actualizado?.actualizadoEn.toISOString(),
  });
}
