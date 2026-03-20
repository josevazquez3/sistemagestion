import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Mes y año calendario en Argentina (para alinear con submódulos de tesorería). */
function mesAnioActualAR(): { mes: number; anio: number } {
  const s = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const datePart = s.split(" ")[0] ?? "";
  const [y, m] = datePart.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const d = new Date();
    return { mes: d.getMonth() + 1, anio: d.getFullYear() };
  }
  return { mes: m, anio: y };
}

export type TesoreriaResumenDto = {
  extractoBanco: number | null;
  fondoFijo: number | null;
  cobroCertificaciones: number | null;
  ingresosDistritos: number | null;
};

async function getExtractoBancoTotal(): Promise<number> {
  const [config, agg] = await Promise.all([
    prisma.extractoBancoConfig.findFirst(),
    prisma.movimientoExtracto.aggregate({ _sum: { importePesos: true } }),
  ]);
  const inicial = config ? Number(config.saldoInicial) : 0;
  const sumMovs = agg._sum.importePesos != null ? Number(agg._sum.importePesos) : 0;
  return round2(inicial + sumMovs);
}

async function getFondoFijoSaldoMes(mes: number, anio: number): Promise<number> {
  const [config, movs] = await Promise.all([
    prisma.configFondoFijo.findUnique({ where: { mes_anio: { mes, anio } } }),
    prisma.fondoFijo.findMany({
      where: { mes, anio },
      orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
      select: { saldoPesos: true },
    }),
  ]);
  if (movs.length > 0) {
    const last = movs[movs.length - 1]!;
    return round2(Number(last.saldoPesos));
  }
  return round2(config?.saldoAnterior != null ? Number(config.saldoAnterior) : 0);
}

async function getCobroCertSumMes(mes: number, anio: number): Promise<number> {
  const agg = await prisma.cobroCertificacion.aggregate({
    where: { mes, anio },
    _sum: { importe: true },
  });
  return round2(agg._sum.importe != null ? Number(agg._sum.importe) : 0);
}

async function getIngresosDistritosSumMes(mes: number, anio: number): Promise<number> {
  const agg = await prisma.ingresoDistrito.aggregate({
    where: { mes, anio },
    _sum: { importe: true },
  });
  return round2(agg._sum.importe != null ? Number(agg._sum.importe) : 0);
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { mes, anio } = mesAnioActualAR();

  const [extractoBanco, fondoFijo, cobroCertificaciones, ingresosDistritos] = await Promise.all([
    safe(() => getExtractoBancoTotal()),
    safe(() => getFondoFijoSaldoMes(mes, anio)),
    safe(() => getCobroCertSumMes(mes, anio)),
    safe(() => getIngresosDistritosSumMes(mes, anio)),
  ]);

  const body: TesoreriaResumenDto = {
    extractoBanco,
    fondoFijo,
    cobroCertificaciones,
    ingresosDistritos,
  };

  return NextResponse.json(body);
}
