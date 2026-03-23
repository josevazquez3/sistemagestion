import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldosIngresosDistritos } from "@/lib/tesoreria/recalcularSaldosIngresosDistritos";
import { parsearConceptoIngresoDistrito } from "@/lib/tesoreria/parsearConceptoIngresoDistrito";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseFechaDDMMYYYY(str: string): Date {
  const raw = (str ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  const [d, m, y] = raw.split("/");
  if (!d || !m || !y) return new Date();
  return new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000-03:00`
  );
}

/** GET - Lista registros por mes, anio y códigos (hasSome) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "0", 10);
  const anio = parseInt(searchParams.get("anio") ?? "0", 10);
  const codigosStr = searchParams.get("codigos")?.trim();
  const buscar = searchParams.get("buscar")?.trim();

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const codigos = codigosStr
    ? codigosStr.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const where: { mes: number; anio: number; codigos?: { hasSome: string[] }; concepto?: { contains: string; mode: "insensitive" } } = {
    mes,
    anio,
  };
  if (codigos.length > 0) where.codigos = { hasSome: codigos };
  if (buscar) where.concepto = { contains: buscar, mode: "insensitive" };

  const registros = await prisma.ingresoDistrito.findMany({
    where,
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });

  const data = registros.map((r) => ({
    ...r,
    ctaColeg: r.ctaColeg != null ? Number(r.ctaColeg) : null,
    nMatriculados: r.nMatriculados != null ? Number(r.nMatriculados) : null,
    importe: Number(r.importe),
    saldo: Number(r.saldo),
  }));

  return NextResponse.json(data);
}

/** POST - Crear registro; recalcula saldos del mes */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    mes: number;
    anio: number;
    codigos?: string[];
    fecha: string;
    recibo?: string | null;
    distrito?: string | null;
    concepto: string;
    periodo?: string | null;
    ctaColeg?: number | null;
    nMatriculados?: number | null;
    importe: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const mes = body.mes ?? 0;
  const anio = body.anio ?? 0;
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios" }, { status: 400 });
  }

  const concepto = (body.concepto ?? "").trim();
  if (!concepto) {
    return NextResponse.json({ error: "concepto es obligatorio" }, { status: 400 });
  }

  const importeVal = Number(body.importe);
  if (Number.isNaN(importeVal)) {
    return NextResponse.json({ error: "importe inválido" }, { status: 400 });
  }

  const codigos = Array.isArray(body.codigos) ? body.codigos : [];
  const fecha = parseFechaDDMMYYYY(body.fecha);

  let ctaColeg: number | null = body.ctaColeg != null ? Number(body.ctaColeg) : null;
  let nMatriculados: number | null = body.nMatriculados != null ? Number(body.nMatriculados) : null;
  if (ctaColeg === null && nMatriculados === null) {
    const parsed = parsearConceptoIngresoDistrito(concepto, importeVal);
    ctaColeg = parsed.ctaColeg;
    nMatriculados = parsed.nMatriculados;
  }
  if (Number.isNaN(ctaColeg!)) ctaColeg = null;
  if (Number.isNaN(nMatriculados!)) nMatriculados = null;

  const periodoRaw = body.periodo != null ? String(body.periodo).trim() : "";
  const periodo = periodoRaw || null;

  const creado = await prisma.ingresoDistrito.create({
    data: {
      mes,
      anio,
      codigos,
      fecha,
      recibo: (body.recibo ?? "").trim() || null,
      distrito: (body.distrito ?? "").trim() || null,
      concepto,
      periodo,
      ctaColeg: ctaColeg != null ? new Decimal(ctaColeg) : null,
      nMatriculados: nMatriculados != null ? new Decimal(nMatriculados) : null,
      importe: new Decimal(importeVal),
      saldo: new Decimal(0),
    },
  });

  await recalcularSaldosIngresosDistritos(prisma, mes, anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Creó registro en Ingresos Distritos",
      modulo: "Tesorería",
      detalle: String(creado.id),
    });
  } catch {}

  const actualizado = await prisma.ingresoDistrito.findUnique({ where: { id: creado.id } });
  const r = actualizado!;
  return NextResponse.json(
    {
      ...r,
      ctaColeg: r.ctaColeg != null ? Number(r.ctaColeg) : null,
      nMatriculados: r.nMatriculados != null ? Number(r.nMatriculados) : null,
      importe: Number(r.importe),
      saldo: Number(r.saldo),
    },
    { status: 201 }
  );
}
