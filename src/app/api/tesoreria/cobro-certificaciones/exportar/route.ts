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

/** GET - Exportar movimientos del mes/anio como JSON (para que el cliente genere XLS/PDF) */
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

    if (!mes || !anio || mes < 1 || mes > 12) {
      return NextResponse.json({ error: "mes y anio son obligatorios" }, { status: 400 });
    }

    const movimientos = await prisma.cobroCertificacion.findMany({
      where: { mes, anio },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    });

    const nombreMes = MESES[mes - 1];
    const filas = movimientos.map((m) => ({
      fecha: formatearFecha(m.fecha),
      concepto: m.concepto,
      importe: Number(m.importe),
      importeFormato: formatearImporte(Number(m.importe)),
      saldo: Number(m.saldo),
      saldoFormato: formatearImporte(Number(m.saldo)),
    }));

    const totalIngresos = movimientos.reduce((s, m) => s + Number(m.importe), 0);
    const saldoFinal = filas.length > 0 ? filas[filas.length - 1].saldo : 0;

    return NextResponse.json({
      titulo: `Cobro Certificaciones - ${nombreMes} ${anio}`,
      nombreMes,
      anio,
      movimientos: filas,
      totalIngresos,
      saldoFinal,
      totalIngresosFormato: formatearImporte(totalIngresos),
      saldoFinalFormato: formatearImporte(saldoFinal),
    });
  } catch (err) {
    console.error("Error en exportar cobro-certificaciones:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
