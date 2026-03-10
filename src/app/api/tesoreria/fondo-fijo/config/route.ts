import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Obtener config por mes/anio (codOperativo, saldoAnterior) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "0", 10);
  const anio = parseInt(searchParams.get("anio") ?? "0", 10);

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const config = await prisma.configFondoFijo.findUnique({
    where: { mes_anio: { mes, anio } },
  });

  if (!config) {
    return NextResponse.json({
      mes,
      anio,
      codOperativo: null,
      saldoAnterior: null,
    });
  }

  return NextResponse.json({
    ...config,
    saldoAnterior: config.saldoAnterior != null ? Number(config.saldoAnterior) : null,
  });
}

/** PUT - Crear o actualizar config (codOperativo, saldoAnterior) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes?: number; anio?: number; codOperativo?: string | null; saldoAnterior?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const mes = body.mes ?? 0;
  const anio = body.anio ?? 0;
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const existente = await prisma.configFondoFijo.findUnique({
    where: { mes_anio: { mes, anio } },
  });

  const codOperativo =
    body.codOperativo !== undefined
      ? ((body.codOperativo ?? "").trim() || null)
      : existente?.codOperativo ?? null;
  const saldoAnterior =
    body.saldoAnterior !== undefined
      ? (body.saldoAnterior != null ? new Decimal(Number(body.saldoAnterior)) : null)
      : existente?.saldoAnterior ?? null;

  const config = await prisma.configFondoFijo.upsert({
    where: { mes_anio: { mes, anio } },
    create: { mes, anio, codOperativo, saldoAnterior },
    update: { codOperativo, saldoAnterior },
  });

  await recalcularSaldos(prisma, mes, anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    if (saldoAnterior != null) {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: `Configuró Saldo Anterior del Fondo Fijo (${mes}/${anio}): $${Number(saldoAnterior)}`,
        modulo: "Tesorería",
      });
    }
    if (codOperativo != null) {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: `Configuró Código Operativo del Fondo Fijo: ${codOperativo}`,
        modulo: "Tesorería",
      });
    }
  } catch {}

  return NextResponse.json({
    ...config,
    saldoAnterior: config.saldoAnterior != null ? Number(config.saldoAnterior) : null,
  });
}
