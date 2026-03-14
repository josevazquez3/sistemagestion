import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

const TZ = "America/Argentina/Buenos_Aires";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatearFecha(d: Date): string {
  return new Date(d).toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatearImporte(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** GET - Exportar registros del mes/anio/codigos como JSON (para Excel/PDF) */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const roles = (session?.user as { roles?: string[] })?.roles ?? [];
    if (!canAccess(roles)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mes = parseInt(searchParams.get("mes") ?? "0", 10);
    const anio = parseInt(searchParams.get("anio") ?? "0", 10);
    const codigosStr = searchParams.get("codigos")?.trim();

    if (!mes || !anio || mes < 1 || mes > 12) {
      return NextResponse.json({ error: "mes y anio son obligatorios" }, { status: 400 });
    }

    const codigos = codigosStr
      ? codigosStr.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

    const where: { mes: number; anio: number; codigos?: { hasSome: string[] } } = {
      mes,
      anio,
    };
    if (codigos.length > 0) where.codigos = { hasSome: codigos };

    const [registros, config] = await Promise.all([
      prisma.ingresoDistrito.findMany({
        where,
        orderBy: [{ fecha: "asc" }, { id: "asc" }],
      }),
      prisma.configIngresoDistrito.findUnique({
        where: { mes_anio: { mes, anio } },
      }),
    ]);

    const nombreMes = MESES[mes - 1];
    const codigosUsados = config?.codigosOperativos ?? codigos;
    const filas = registros.map((r) => ({
      fecha: formatearFecha(r.fecha),
      recibo: r.recibo ?? "",
      distrito: r.distrito ?? "",
      concepto: r.concepto,
      ctaColeg: r.ctaColeg != null ? Number(r.ctaColeg) : null,
      nMatriculados: r.nMatriculados != null ? Number(r.nMatriculados) : null,
      importe: Number(r.importe),
      saldo: Number(r.saldo),
      ctaColegFormato: r.ctaColeg != null ? formatearImporte(Number(r.ctaColeg)) : "",
      nMatriculadosFormato: r.nMatriculados != null ? formatearImporte(Number(r.nMatriculados)) : "",
      importeFormato: formatearImporte(Number(r.importe)),
      saldoFormato: formatearImporte(Number(r.saldo)),
    }));

    const totalCtaColeg = filas.reduce((s, f) => s + (f.ctaColeg ?? 0), 0);
    const totalNMatriculados = filas.reduce((s, f) => s + (f.nMatriculados ?? 0), 0);
    const totalImporte = filas.reduce((s, f) => s + f.importe, 0);
    const saldoFinal = filas.length > 0 ? filas[filas.length - 1].saldo : 0;

    return NextResponse.json({
      titulo: `Ingresos Distritos - ${nombreMes} ${anio}`,
      nombreMes,
      anio,
      codigosUsados,
      movimientos: filas,
      totalCtaColeg,
      totalNMatriculados,
      totalImporte,
      saldoFinal,
      totalCtaColegFormato: formatearImporte(totalCtaColeg),
      totalNMatriculadosFormato: formatearImporte(totalNMatriculados),
      totalImporteFormato: formatearImporte(totalImporte),
      saldoFinalFormato: formatearImporte(saldoFinal),
    });
  } catch (err) {
    console.error("Error en exportar ingresos-distritos:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
