import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldosCobroCertificaciones } from "@/lib/tesoreria/recalcularSaldosCobroCertificaciones";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parsearFechaExtracto(fecha: string): Date {
  const raw = (fecha ?? "").trim();
  const normalized = /^\d{4}-\d{2}-\d{2}(T|$)/.test(raw)
    ? raw
    : /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)
      ? (() => {
          const [d, m, y] = raw.split("/");
          return `${y!}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T12:00:00.000-03:00`;
        })()
      : raw;
  return new Date(normalized);
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

  const movimientos = await prisma.cobroCertificacion.findMany({
    where: {
      mes,
      anio,
      ...(buscar
        ? { concepto: { contains: buscar, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });

  const data = movimientos.map((m) => ({
    ...m,
    importe: Number(m.importe),
    saldo: Number(m.saldo),
  }));

  return NextResponse.json(data);
}

/** POST - Crear movimiento (ingreso); recalcula saldos */
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

  const importeVal = Math.abs(Number(body.importePesos ?? 0));
  const fechaStr = (body.fecha ?? "").trim();
  if (!fechaStr) {
    return NextResponse.json({ error: "fecha es obligatoria" }, { status: 400 });
  }

  const fecha = parsearFechaExtracto(fechaStr);

  const creado = await prisma.cobroCertificacion.create({
    data: {
      fecha,
      concepto,
      importe: new Decimal(importeVal),
      saldo: new Decimal(0),
      mes,
      anio,
      importado: false,
    },
  });

  await recalcularSaldosCobroCertificaciones(prisma, mes, anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Registró cobro en Cobro Certificaciones: ${concepto} $${importeVal.toFixed(2)}`,
      modulo: "Tesorería",
      detalle: String(creado.id),
    });
  } catch {}

  const actualizado = await prisma.cobroCertificacion.findUnique({ where: { id: creado.id } });
  return NextResponse.json(
    {
      ...actualizado,
      importe: Number(actualizado!.importe),
      saldo: Number(actualizado!.saldo),
    },
    { status: 201 }
  );
}
