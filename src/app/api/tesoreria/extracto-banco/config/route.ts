import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Obtener configuración global de Extracto Banco (saldo inicial) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const config = await prisma.extractoBancoConfig.findFirst();
  const saldoInicial = config ? Number(config.saldoInicial) : 0;

  return NextResponse.json({ saldoInicial });
}

/** PUT - Crear o actualizar configuración (saldoInicial >= 0) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { saldoInicial?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const rawSaldo = body.saldoInicial;
  const saldoInicial = Number(rawSaldo);
  if (
    rawSaldo == null ||
    Number.isNaN(saldoInicial) ||
    saldoInicial < 0
  ) {
    return NextResponse.json(
      { error: "saldoInicial debe ser un número mayor o igual a 0" },
      { status: 400 }
    );
  }

  const existente = await prisma.extractoBancoConfig.findFirst();
  const data = { saldoInicial };

  const config = existente
    ? await prisma.extractoBancoConfig.update({
        where: { id: existente.id },
        data,
      })
    : await prisma.extractoBancoConfig.create({ data });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Actualizó saldo inicial Extracto Banco a $${saldoInicial.toFixed(2)}`,
      modulo: "Tesorería",
      detalle: String(config.id),
    });
  } catch {}

  return NextResponse.json({ saldoInicial: Number(config.saldoInicial) });
}

