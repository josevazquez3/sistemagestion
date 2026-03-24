import { prisma } from "@/lib/prisma";
import {
  distritoNumeroDesdeTexto,
  formatoPeriodoMeses,
  toNumber,
} from "@/app/api/tesoreria/informe/_shared";

type DistAgg = {
  distritoNumero: number;
  periodos: string;
  ctaColegImporte: number;
  nMatriculadosImporte: number;
};

function rangoMesAnio(from: Date, to: Date): Array<{ mes: number; anio: number }> {
  const out: Array<{ mes: number; anio: number }> = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1, 12, 0, 0));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1, 12, 0, 0));
  while (d.getTime() <= end.getTime()) {
    out.push({ mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

function normalizarPeriodo(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const mm = Number(m[1]);
  const yyyy = Number(m[2]);
  if (!Number.isFinite(mm) || mm < 1 || mm > 12 || !Number.isFinite(yyyy)) return null;
  return `${String(mm).padStart(2, "0")}/${yyyy}`;
}

export type InformeDatosComputados = {
  ingresosDistrito: DistAgg[];
  totalIngresosA: number;
  cobroCertificaciones: {
    importe: number;
    periodoDesde: string;
    periodoHasta: string;
  };
  totalIngresosB: number;
  totalGeneralIngresos: number;
  egresosCuentas: Array<{
    cuentaId: number;
    nombreCuenta: string;
    totalMovimientos: number;
  }>;
  totalEgresos: number;
  ultimosAportes: Array<{
    distritoNumero: number;
    ultimaFecha: string | null;
    tieneOverride: boolean;
    fechaOverride: string | null;
  }>;
  conciliacion: {
    saldoBancoRio: number;
    saldoFondoFijo: number;
    chequesADepositar: number;
    total: number;
  };
  badges: {
    ingresosSinDatos: boolean;
    cobroSinDatos: boolean;
    egresosSinDatos: boolean;
    extractoSinDatos: boolean;
    fondoSinDatos: boolean;
  };
};

export async function computeInformeDatos(params: {
  informeId: number;
  fechaDesde: Date;
  fechaHasta: Date;
  certDesde: Date;
  certHasta: Date;
}): Promise<InformeDatosComputados> {
  const { informeId: id, fechaDesde, fechaHasta, certDesde, certHasta } = params;
  const prismaAny = prisma as any;

  const informe = await prismaAny.informeTesoreria.findUnique({
    where: { id },
    select: {
      id: true,
      chequesADepositar: true,
      saldoBancoRioOverride: true,
      saldoFondoFijoOverride: true,
    },
  });
  if (!informe) {
    throw new Error("Informe no encontrado");
  }

  const mesesCert = rangoMesAnio(certDesde, certHasta);

  const [
    ingresos,
    cobros,
    mayorMovs,
    mayorCuentas,
    overrides,
    extractoPeriodo,
    extractoUltimo,
    extractoConfig,
    extractoAgg,
    fondoPeriodo,
    fondoUltimo,
  ] = await Promise.all([
    prismaAny.ingresoDistrito.findMany({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    }),
    prismaAny.cobroCertificacion.findMany({
      where: {
        OR: mesesCert.map((m) => ({ mes: m.mes, anio: m.anio })),
        fecha: { gte: certDesde, lte: certHasta },
      },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    }),
    prismaAny.mayorMovimiento.findMany({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      select: { cuentaId: true, importe: true },
    }),
    prismaAny.mayorCuenta.findMany({ select: { id: true, nombre: true } }),
    prismaAny.informeUltimoAporte.findMany({ where: { informeId: id } }),
    prismaAny.movimientoExtracto.findFirst({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      select: { saldoPesos: true },
    }),
    prismaAny.movimientoExtracto.findFirst({
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      select: { saldoPesos: true },
    }),
    prismaAny.extractoBancoConfig.findFirst({
      select: { saldoInicial: true },
      orderBy: { id: "desc" },
    }),
    prismaAny.movimientoExtracto.aggregate({
      _sum: { importePesos: true },
    }),
    prismaAny.fondoFijo.findFirst({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      select: { saldoPesos: true },
    }),
    prismaAny.fondoFijo.findFirst({
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      select: { saldoPesos: true },
    }),
  ]);

  const distritos: DistAgg[] = [];
  for (let n = 1; n <= 10; n++) {
    const rows = (ingresos as Array<Record<string, unknown>>).filter(
      (r: Record<string, unknown>) =>
        distritoNumeroDesdeTexto((r.distrito as string | null | undefined) ?? null) === n
    );
    const ctaColegImporte = rows.reduce(
      (acc: number, r: Record<string, unknown>) => acc + toNumber(r.ctaColeg),
      0
    );
    const nMatriculadosImporte = rows.reduce(
      (acc: number, r: Record<string, unknown>) => acc + toNumber(r.nMatriculados),
      0
    );
    const periodosDesdeCampo = [
      ...new Set(
        rows
          .map((r: Record<string, unknown>) => normalizarPeriodo(r.periodo))
          .filter((p): p is string => p != null)
      ),
    ];
    const periodos =
      periodosDesdeCampo.length > 0
        ? periodosDesdeCampo.join(" y ")
        : formatoPeriodoMeses(
            rows
              .map((r: Record<string, unknown>) => r.fecha)
              .filter((f): f is Date => f instanceof Date)
          );
    distritos.push({
      distritoNumero: n,
      periodos,
      ctaColegImporte,
      nMatriculadosImporte,
    });
  }
  const totalIngresosA = distritos.reduce(
    (acc, d) => acc + d.ctaColegImporte + d.nMatriculadosImporte,
    0
  );

  const totalIngresosB = (cobros as Array<Record<string, unknown>>).reduce(
    (acc: number, c: Record<string, unknown>) => acc + toNumber(c.importe),
    0
  );
  const cobroCertificaciones = {
    importe: totalIngresosB,
    periodoDesde: certDesde.toISOString(),
    periodoHasta: certHasta.toISOString(),
  };

  const byCuenta = new Map<number, number>();
  for (const m of mayorMovs as Array<Record<string, unknown>>) {
    const cuentaId = Number(m.cuentaId);
    if (!Number.isFinite(cuentaId)) continue;
    byCuenta.set(cuentaId, (byCuenta.get(cuentaId) ?? 0) + toNumber(m.importe));
  }
  const egresosCuentas = [...byCuenta.entries()]
    .filter(([, total]) => Math.abs(total) > 0.000001)
    .map(([cuentaId, total]) => ({
      cuentaId,
      nombreCuenta:
        (mayorCuentas as Array<Record<string, unknown>>).find(
          (c) => Number(c.id) === cuentaId
        )?.nombre?.toString() ?? `Cuenta ${cuentaId}`,
      totalMovimientos: total,
    }))
    .sort((a, b) => a.nombreCuenta.localeCompare(b.nombreCuenta, "es"));
  const totalEgresos = egresosCuentas.reduce((acc, e) => acc + e.totalMovimientos, 0);

  const overrideMap = new Map<number, Date | null>();
  for (const o of overrides as Array<Record<string, unknown>>) {
    const dn = Number(o.distritoNumero);
    if (!Number.isFinite(dn)) continue;
    overrideMap.set(dn, (o.fechaOverride as Date | null | undefined) ?? null);
  }
  const ultimosAportes = [];
  for (let n = 1; n <= 10; n++) {
    const rows = (ingresos as Array<Record<string, unknown>>)
      .filter(
        (r) =>
          distritoNumeroDesdeTexto((r.distrito as string | null | undefined) ?? null) === n
      )
      .sort(
        (a, b) =>
          ((b.fecha as Date | undefined)?.getTime() ?? 0) -
          ((a.fecha as Date | undefined)?.getTime() ?? 0)
      );
    const conMat = rows.find((r) => toNumber(r.nMatriculados) > 0);
    const ultimaFecha = ((conMat ?? rows[0])?.fecha as Date | undefined) ?? null;
    const fechaOverride = overrideMap.has(n) ? overrideMap.get(n) ?? null : null;
    ultimosAportes.push({
      distritoNumero: n,
      ultimaFecha: ultimaFecha ? ultimaFecha.toISOString() : null,
      tieneOverride: overrideMap.has(n),
      fechaOverride: fechaOverride ? fechaOverride.toISOString() : null,
    });
  }

  const saldoInicialExtracto = toNumber(extractoConfig?.saldoInicial ?? 0);
  const sumaMovimientosExtracto = toNumber(extractoAgg?._sum?.importePesos ?? 0);
  const saldoBancoRioBase = saldoInicialExtracto + sumaMovimientosExtracto;
  const saldoFondoFijoBase = toNumber(fondoPeriodo?.saldoPesos ?? fondoUltimo?.saldoPesos);
  const saldoBancoRio =
    informe.saldoBancoRioOverride != null ? toNumber(informe.saldoBancoRioOverride) : saldoBancoRioBase;
  const saldoFondoFijo =
    informe.saldoFondoFijoOverride != null
      ? toNumber(informe.saldoFondoFijoOverride)
      : saldoFondoFijoBase;
  const chequesADepositar = toNumber(informe.chequesADepositar ?? 0);
  const conciliacion = {
    saldoBancoRio,
    saldoFondoFijo,
    chequesADepositar,
    total: saldoBancoRio + saldoFondoFijo + chequesADepositar,
  };

  return {
    ingresosDistrito: distritos,
    totalIngresosA,
    cobroCertificaciones,
    totalIngresosB,
    totalGeneralIngresos: totalIngresosA + totalIngresosB,
    egresosCuentas,
    totalEgresos,
    ultimosAportes,
    conciliacion,
    badges: {
      ingresosSinDatos: ingresos.length === 0,
      cobroSinDatos: cobros.length === 0,
      egresosSinDatos: mayorMovs.length === 0,
      extractoSinDatos: extractoPeriodo == null && extractoUltimo == null,
      fondoSinDatos: fondoPeriodo == null && fondoUltimo == null,
    },
  };
}
