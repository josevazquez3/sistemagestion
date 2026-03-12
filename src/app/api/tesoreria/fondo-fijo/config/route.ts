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

/** GET - Obtener config por mes/anio (codigosOperativos, saldoAnterior). Compatible con legacy codOperativo. */
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
      codigosOperativos: [],
      saldoAnterior: null,
    });
  }

  const codigosOperativos =
    config.codigosOperativos?.length > 0
      ? config.codigosOperativos
      : config.codOperativo?.trim()
        ? [config.codOperativo.trim()]
        : [];

  return NextResponse.json({
    ...config,
    codigosOperativos,
    saldoAnterior: config.saldoAnterior != null ? Number(config.saldoAnterior) : null,
  });
}

/** PUT - Crear o actualizar config (codigosOperativos: string[], saldoAnterior) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    mes?: number;
    anio?: number;
    codigosOperativos?: string[];
    saldoAnterior?: number | null;
  };
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

  const codigosOperativos = Array.isArray(body.codigosOperativos)
    ? body.codigosOperativos.map((c) => String(c).trim()).filter(Boolean)
    : existente?.codigosOperativos ?? [];

  const saldoAnterior =
    body.saldoAnterior !== undefined
      ? (body.saldoAnterior != null ? new Decimal(Number(body.saldoAnterior)) : null)
      : existente?.saldoAnterior ?? null;

  const config = await prisma.configFondoFijo.upsert({
    where: { mes_anio: { mes, anio } },
    create: { mes, anio, codigosOperativos, saldoAnterior },
    update: { codigosOperativos, codOperativo: null, saldoAnterior },
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
    if (codigosOperativos.length > 0) {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: `Configuró códigos operativos Fondo Fijo (${mes}/${anio}): ${codigosOperativos.join(", ")}`,
        modulo: "Tesorería",
      });
    }
  } catch {}

  const outCodigos =
    config.codigosOperativos?.length > 0
      ? config.codigosOperativos
      : config.codOperativo?.trim()
        ? [config.codOperativo.trim()]
        : [];

  return NextResponse.json({
    ...config,
    codigosOperativos: outCodigos,
    saldoAnterior: config.saldoAnterior != null ? Number(config.saldoAnterior) : null,
  });
}
