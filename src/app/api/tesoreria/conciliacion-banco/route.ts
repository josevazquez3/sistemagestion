import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MovimientoConciliacion = Prisma.MovimientoExtractoGetPayload<{
  include: {
    cuenta: { select: { codigo: true; codOperativo: true; nombre: true } };
  };
}>;

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** Concepto para UI: nunca mostrar el nº de cuenta / cód. op. como si fuera descripción. */
function conceptoMovimientoParaUI(
  concepto: string,
  codOpMov: string | null | undefined,
  cuentaCodigoAsignada: string,
  referencia: string | null | undefined
): string {
  const c = (concepto ?? "").trim();
  const op = (codOpMov ?? "").trim();
  const cc = (cuentaCodigoAsignada ?? "").trim();
  const ref = (referencia ?? "").trim();
  if (!c) return ref || "—";
  if (c === cc || c === op) return ref || "—";
  return c;
}

/** Cód. operativo real (distinto del código de cuenta) o "—". */
function codOperativoParaMostrar(
  movCodOp: string | null | undefined,
  cuenta: { codigo: string; codOperativo: string | null } | null | undefined
): string {
  const cod = (cuenta?.codigo ?? "").trim();
  const cOpCuenta = (cuenta?.codOperativo ?? "")
    .replace(/[/|\r\n]+/g, " ")
    .trim();
  const tokens = cOpCuenta.split(/\s+/).filter(Boolean);
  const distinto = tokens.find((t) => t !== cod);
  if (distinto) return distinto;
  const m = (movCodOp ?? "").trim();
  if (m && m !== cod) return m;
  return "—";
}

function nombreCuentaParaMostrar(
  cuentaCodigo: string,
  nombreAsignacion: string,
  nombreCuentaDb: string | null | undefined
): string {
  const cc = cuentaCodigo.trim();
  const na = (nombreAsignacion ?? "").trim();
  const nd = (nombreCuentaDb ?? "").trim();
  const candidato =
    na && na !== cc && !/^\d{3,8}$/.test(na) ? na : nd && nd !== cc ? nd : na || nd;
  if (!candidato || candidato === cc || /^Cuenta\s+\d+$/i.test(candidato))
    return "—";
  return candidato;
}

async function getSaldoAnteriorInicial(mes: number, anio: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ saldo: string }[]>`
    SELECT saldo
    FROM conciliacion_saldo_anterior
    WHERE "cuentaId" = 0
      AND mes = ${mes}
      AND anio = ${anio}
    LIMIT 1
  `;
  const saldo = rows[0]?.saldo;
  return saldo != null ? Number(saldo) : 0;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "", 10);
  const anio = parseInt(searchParams.get("anio") ?? "", 10);

  if (isNaN(mes) || isNaN(anio) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  let conciliacion = await prisma.conciliacionBanco.findUnique({
    where: { mes_anio: { mes, anio } },
    include: { asignaciones: { orderBy: { orden: "asc" } } },
  });

  if (!conciliacion) {
    const saldoInicial = await getSaldoAnteriorInicial(mes, anio);
    conciliacion = await prisma.conciliacionBanco.create({
      data: {
        mes,
        anio,
        saldoAnterior: saldoInicial,
      },
      include: { asignaciones: { orderBy: { orden: "asc" } } },
    });
  }

  /** Saldo de apertura del mes: el guardado en BD (modal / creación), no se pisa con el automático en cada GET. */
  const saldoAnteriorCalculado = Number(conciliacion.saldoAnterior);

  const fechaInicio = new Date(anio, mes - 1, 1);
  const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999);

  const codigosIngreso = conciliacion.asignaciones
    .filter((a) => a.tipo === "INGRESO")
    .map((a) => a.cuentaCodigo.trim());
  const codigosSalida = conciliacion.asignaciones
    .filter((a) => a.tipo === "SALIDA")
    .map((a) => a.cuentaCodigo.trim());
  const codigosGasto = conciliacion.asignaciones
    .filter((a) => a.tipo === "GASTO")
    .map((a) => a.cuentaCodigo.trim());

  const cuentasActivas = await prisma.cuentaBancaria.findMany({
    where: { activo: true },
  });

  function tokensParaMovimientos(claveCuenta: string): string[] {
    const k = claveCuenta.trim();
    const row = cuentasActivas.find((c) => c.codigo.trim() === k);
    if (row) {
      const t = (row.codOperativo ?? "")
        .replace(/[/|\r\n]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      return t.length ? t : [k];
    }
    return [k];
  }

  const toTokenSet = (arr: string[]) => {
    const s = new Set<string>();
    for (const c of arr) {
      tokensParaMovimientos(c).forEach((t) => s.add(t));
    }
    return s;
  };

  const setIngreso = toTokenSet(codigosIngreso);
  const setSalida = toTokenSet(codigosSalida);
  const setGasto = toTokenSet(codigosGasto);
  const todosLosCodigos = [...new Set([...setIngreso, ...setSalida, ...setGasto])];

  const tokenToAsignacion = new Map<
    string,
    { cuentaCodigo: string; cuentaNombre: string; tipo: string }
  >();
  const asigOrden = [...conciliacion.asignaciones].sort((a, b) => a.orden - b.orden);
  for (const a of asigOrden) {
    for (const op of tokensParaMovimientos(a.cuentaCodigo)) {
      tokenToAsignacion.set(op, {
        cuentaCodigo: a.cuentaCodigo.trim(),
        cuentaNombre: a.cuentaNombre,
        tipo: a.tipo,
      });
    }
  }

  let idsExcluidos: number[] = [];
  try {
    const ex = (
      prisma as unknown as {
        conciliacionExclusion?: {
          findMany: (args: {
            where: { conciliacionId: number };
            select: { movimientoId: true };
          }) => Promise<{ movimientoId: number }[]>;
        };
      }
    ).conciliacionExclusion;
    if (ex) {
      const exclusiones = await ex.findMany({
        where: { conciliacionId: conciliacion.id },
        select: { movimientoId: true },
      });
      idsExcluidos = exclusiones.map((e) => e.movimientoId);
    }
  } catch {
    idsExcluidos = [];
  }

  let movimientos: MovimientoConciliacion[] = [];

  if (todosLosCodigos.length > 0) {
    movimientos = await prisma.movimientoExtracto.findMany({
      where: {
        fecha: { gte: fechaInicio, lte: fechaFin },
        codOperativo: { in: todosLosCodigos },
        ...(idsExcluidos.length > 0 ? { id: { notIn: idsExcluidos } } : {}),
      },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
      include: {
        cuenta: { select: { codigo: true, codOperativo: true, nombre: true } },
      },
    });
  }

  let totalIngresos = 0;
  let totalSalidas = 0;
  let totalGastos = 0;

  for (const mov of movimientos) {
    const code = (mov.codOperativo ?? "").trim();
    const importe = Math.abs(Number(mov.importePesos));
    if (setIngreso.has(code)) {
      totalIngresos += importe;
    } else if (setSalida.has(code)) {
      totalSalidas += importe;
    } else if (setGasto.has(code)) {
      totalGastos += importe;
    }
  }

  const saldoAnterior = saldoAnteriorCalculado;
  const subtotal = totalIngresos + saldoAnterior;
  const totalConciliado = subtotal - totalSalidas - totalGastos;

  await prisma.conciliacionBanco.update({
    where: { id: conciliacion.id },
    data: {
      saldoAnterior,
      totalIngresos,
      totalSalidas,
      totalGastos,
      subtotal,
      totalConciliado,
    },
  });

  const conciliacionActualizada = await prisma.conciliacionBanco.findUnique({
    where: { id: conciliacion.id },
    include: { asignaciones: { orderBy: { orden: "asc" } } },
  });

  if (!conciliacionActualizada) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({
    conciliacion: {
      ...conciliacionActualizada,
      saldoAnterior,
      totalIngresos,
      totalSalidas,
      totalGastos,
      subtotal,
      totalConciliado,
    },
    movimientos: movimientos.map((m) => {
      const op = (m.codOperativo ?? "").trim();
      const meta = tokenToAsignacion.get(op);
      const cuentaCodigo = meta?.cuentaCodigo ?? op;
      const cuentaNombre = nombreCuentaParaMostrar(
        cuentaCodigo,
        meta?.cuentaNombre ?? "",
        m.cuenta?.nombre
      );
      return {
        id: m.id,
        fecha: m.fecha.toISOString(),
        concepto: conceptoMovimientoParaUI(m.concepto, m.codOperativo, cuentaCodigo, m.referencia),
        codOperativo: codOperativoParaMostrar(m.codOperativo, m.cuenta),
        cuentaCodigo,
        cuentaNombre,
        tipo: (meta?.tipo ?? "INGRESO") as string,
        monto: Number(m.importePesos),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    mes: number;
    anio: number;
    saldoAnterior?: number;
    asignaciones: Array<{
      cuentaCodigo: string;
      codOperativo?: string | null;
      cuentaNombre: string;
      tipo: string;
      orden: number;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { mes, anio, asignaciones, saldoAnterior: saldoBody } = body;
  if (
    typeof mes !== "number" ||
    typeof anio !== "number" ||
    !Array.isArray(asignaciones)
  ) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  let conciliacion = await prisma.conciliacionBanco.findUnique({
    where: { mes_anio: { mes, anio } },
  });
  if (!conciliacion) {
    const saldoInicial = await getSaldoAnteriorInicial(mes, anio);
    conciliacion = await prisma.conciliacionBanco.create({
      data: {
        mes,
        anio,
        saldoAnterior: saldoInicial,
      },
    });
  }

  if (conciliacion.cerrado) {
    return NextResponse.json({ error: "El período está cerrado" }, { status: 403 });
  }

  await prisma.conciliacionAsignacion.deleteMany({
    where: { conciliacionId: conciliacion.id },
  });

  if (asignaciones.length > 0) {
    await prisma.conciliacionAsignacion.createMany({
      data: asignaciones.map((a) => {
        const co = a.codOperativo != null ? String(a.codOperativo).trim() : "";
        return {
          conciliacionId: conciliacion.id,
          cuentaCodigo: String(a.cuentaCodigo).trim(),
          codOperativo: co || null,
          cuentaNombre: String(a.cuentaNombre ?? a.cuentaCodigo).trim(),
          tipo: a.tipo,
          orden: Number(a.orden) || 0,
        };
      }),
    });
  }

  if (
    typeof saldoBody === "number" &&
    Number.isFinite(saldoBody) &&
    saldoBody >= 0
  ) {
    await prisma.conciliacionBanco.update({
      where: { id: conciliacion.id },
      data: {
        saldoAnterior: new Decimal(Math.round(saldoBody * 100) / 100),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
