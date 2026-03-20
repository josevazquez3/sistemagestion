import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

type RegistroInterno = {
  id: string;
  codigoOperacion: string;
  fecha: string;
  concepto: string;
  importe: number;
  submodulo: "CobroCertificaciones" | "FondoFijo" | "CuentasBancarias";
};

type MovimientoExtractoDto = {
  id: number;
  codigoOperacion: string;
  fecha: string;
  concepto: string;
  importe: number;
  origen: "ExtractoBanco";
};

function normalizarCodigo(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase();
}

function parseNum(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function getRegistrosInternos(cuentaId: number, mes: number, anio: number): Promise<RegistroInterno[]> {
  const cuenta = await prisma.cuentaBancaria.findUnique({
    where: { id: cuentaId },
    select: { codigo: true, codOperativo: true },
  });

  if (!cuenta) return [];

  const tokens = new Set<string>();
  tokens.add(normalizarCodigo(cuenta.codigo));
  String(cuenta.codOperativo ?? "")
    .replace(/[/|\r\n]+/g, " ")
    .split(/\s+/)
    .map((t) => normalizarCodigo(t))
    .filter(Boolean)
    .forEach((t) => tokens.add(t));

  const [cobros, fondo, extractoMismoCodigo] = await Promise.all([
    prisma.cobroCertificacion.findMany({
      where: {
        mes,
        anio,
        codigoOperativo: { not: null },
      },
      select: { id: true, fecha: true, concepto: true, importe: true, codigoOperativo: true },
    }),
    prisma.fondoFijo.findMany({
      where: {
        mes,
        anio,
        codOperativo: { not: null },
      },
      select: { id: true, fecha: true, concepto: true, importePesos: true, codOperativo: true },
    }),
    prisma.movimientoExtracto.findMany({
      where: {
        cuentaId,
        fecha: {
          gte: new Date(anio, mes - 1, 1),
          lte: new Date(anio, mes, 0, 23, 59, 59, 999),
        },
        codOperativo: { not: null },
      },
      select: { id: true, fecha: true, concepto: true, importePesos: true, codOperativo: true },
    }),
  ]);

  const internos: RegistroInterno[] = [];

  for (const c of cobros) {
    const codigo = normalizarCodigo(c.codigoOperativo);
    if (!codigo || !tokens.has(codigo)) continue;
    internos.push({
      id: `cobro-${c.id}`,
      codigoOperacion: codigo,
      fecha: c.fecha.toISOString(),
      concepto: c.concepto,
      importe: Number(c.importe),
      submodulo: "CobroCertificaciones",
    });
  }

  for (const f of fondo) {
    const codigo = normalizarCodigo(f.codOperativo);
    if (!codigo || !tokens.has(codigo)) continue;
    internos.push({
      id: `fondo-${f.id}`,
      codigoOperacion: codigo,
      fecha: f.fecha.toISOString(),
      concepto: f.concepto,
      importe: Number(f.importePesos),
      submodulo: "FondoFijo",
    });
  }

  for (const m of extractoMismoCodigo) {
    const codigo = normalizarCodigo(m.codOperativo);
    if (!codigo) continue;
    internos.push({
      id: `cuentas-${m.id}`,
      codigoOperacion: codigo,
      fecha: m.fecha.toISOString(),
      concepto: m.concepto,
      importe: Number(m.importePesos),
      submodulo: "CuentasBancarias",
    });
  }

  return internos;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!ROLES.some((r) => roles.includes(r))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cuentaId = parseNum(searchParams.get("cuentaId"));
  const mes = parseNum(searchParams.get("mes"));
  const anio = parseNum(searchParams.get("anio"));

  if (!cuentaId || !mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const [movimientosExtractoRaw, registrosInternos] = await Promise.all([
    prisma.movimientoExtracto.findMany({
      where: {
        cuentaId,
        fecha: {
          gte: new Date(anio, mes - 1, 1),
          lte: new Date(anio, mes, 0, 23, 59, 59, 999),
        },
      },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fecha: true,
        codOperativo: true,
        concepto: true,
        importePesos: true,
      },
    }),
    getRegistrosInternos(cuentaId, mes, anio),
  ]);

  const movimientosExtracto: MovimientoExtractoDto[] = movimientosExtractoRaw.map((m) => ({
    id: m.id,
    codigoOperacion: normalizarCodigo(m.codOperativo),
    fecha: m.fecha.toISOString(),
    concepto: m.concepto,
    importe: Number(m.importePesos),
    origen: "ExtractoBanco",
  }));

  return NextResponse.json({
    data: {
      movimientosExtracto,
      registrosInternos,
    },
  });
}
