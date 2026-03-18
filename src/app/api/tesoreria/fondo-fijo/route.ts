import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";
import { parsearFechaInputAPI } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Lista movimientos por mes, anio y opcional buscar */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "0", 10);
  const anio = parseInt(searchParams.get("anio") ?? "0", 10);
  const buscar = searchParams.get("buscar")?.trim();

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const movimientos = await prisma.fondoFijo.findMany({
    where: {
      mes,
      anio,
      ...(buscar
        ? { concepto: { contains: buscar, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
  });

  const data = movimientos.map((m) => ({
    ...m,
    importePesos: Number(m.importePesos),
    saldoPesos: Number(m.saldoPesos),
  }));

  return NextResponse.json(data);
}

/** POST - Crear gasto manual (o movimiento); recalcula saldos */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    fecha?: string;
    concepto?: string;
    importePesos?: number;
    mes?: number;
    anio?: number;
    tipo?: "INGRESO" | "GASTO";
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

  const concepto = (body.concepto ?? "").trim();
  if (!concepto) {
    return NextResponse.json({ error: "concepto es obligatorio" }, { status: 400 });
  }

  const importe = Number(body.importePesos ?? 0);
  const tipo = body.tipo ?? "GASTO";
  const fechaStr = (body.fecha ?? "").trim();
  if (!fechaStr) {
    return NextResponse.json({ error: "fecha es obligatoria" }, { status: 400 });
  }

  const fecha = parsearFechaInputAPI(fechaStr);

  const creado = await prisma.fondoFijo.create({
    data: {
      fecha,
      concepto,
      importePesos: new Decimal(importe),
      saldoPesos: new Decimal(0),
      mes,
      anio,
      tipo,
      importado: false,
    },
  });

  await recalcularSaldos(prisma, mes, anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Registró gasto en Fondo Fijo: ${concepto} $${Math.abs(importe).toFixed(2)}`,
      modulo: "Tesorería",
      detalle: String(creado.id),
    });
  } catch {}

  return NextResponse.json(
    {
      ...creado,
      importePesos: Number(creado.importePesos),
      saldoPesos: Number(creado.saldoPesos),
    },
    { status: 201 }
  );
}
