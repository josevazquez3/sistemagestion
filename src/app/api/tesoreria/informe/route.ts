import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  canAccess,
  ensureInformeTables,
  getRolesFromSession,
  parseDateOrNull,
} from "./_shared";

const COMPROMISOS_DEFAULT = [
  "Luz, Gas, T.E, Imp. Y Serv.",
  "Cargas Sociales",
  "Sindicato UTEDYC",
  "Asesoría Legal",
  "Asesoría Contable",
  "Asesoría Comunicación Pág. Web C.S.",
  "Mantenimiento pág. Web C.S.",
  "Tarj. de crédito C.S.",
  "Gustavo Papa (com. Prof. -radio)",
  "SP (alarma)",
  "FEPUBA CTA.",
  "The Site",
  "Sparkling (Dispenser agua)",
  "La Segunda (Seguro casa)",
  "Berkley (Seguro de vida Personal)",
  "Mensajería",
] as const;

function serializeBase(i: {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  createdAt: Date;
}) {
  return {
    id: i.id,
    fechaDesde: i.fechaDesde.toISOString(),
    fechaHasta: i.fechaHasta.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}

export async function GET() {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  try {
    const prismaAny = prisma as any;
    const rows = await prismaAny.informeTesoreria.findMany({
      select: { id: true, fechaDesde: true, fechaHasta: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows.map(serializeBase));
  } catch (err) {
    console.error("informe GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar informes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  let body: { fechaDesde?: string; fechaHasta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const fechaDesde = parseDateOrNull(body.fechaDesde);
  const fechaHasta = parseDateOrNull(body.fechaHasta);
  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json(
      { error: "fechaDesde y fechaHasta son obligatorias (ISO/YYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (fechaDesde.getTime() > fechaHasta.getTime()) {
    return NextResponse.json(
      { error: "fechaDesde no puede ser mayor a fechaHasta" },
      { status: 400 }
    );
  }

  try {
    const prismaAny = prisma as any;
    const creado = await prismaAny.informeTesoreria.create({
      data: {
        fechaDesde,
        fechaHasta,
        chequesADepositar: new Decimal(0),
        compromisos: {
          create: COMPROMISOS_DEFAULT.map((concepto, idx) => ({
            concepto,
            importe: new Decimal(0),
            orden: idx,
            numero: null,
          })),
        },
      },
      include: {
        egresos: true,
        compromisos: true,
        textBoxes: true,
        ultimosAportes: true,
      },
    });
    return NextResponse.json({
      ...creado,
      fechaDesde: creado.fechaDesde.toISOString(),
      fechaHasta: creado.fechaHasta.toISOString(),
      createdAt: creado.createdAt.toISOString(),
      updatedAt: creado.updatedAt.toISOString(),
      chequesADepositar:
        creado.chequesADepositar != null ? Number(creado.chequesADepositar) : null,
      saldoBancoRioOverride:
        creado.saldoBancoRioOverride != null
          ? Number(creado.saldoBancoRioOverride)
          : null,
      saldoFondoFijoOverride:
        creado.saldoFondoFijoOverride != null
          ? Number(creado.saldoFondoFijoOverride)
          : null,
      egresos: (creado.egresos as Array<Record<string, unknown>>).map(
        (x: Record<string, unknown>) => ({ ...x, importe: Number(x.importe) })
      ),
      compromisos: (creado.compromisos as Array<Record<string, unknown>>).map(
        (x: Record<string, unknown>) => ({ ...x, importe: Number(x.importe) })
      ),
      textBoxes: creado.textBoxes,
      ultimosAportes: (creado.ultimosAportes as Array<Record<string, unknown>>).map(
        (x: Record<string, unknown>) => ({
        ...x,
        fechaOverride:
          x.fechaOverride && x.fechaOverride instanceof Date
            ? x.fechaOverride.toISOString()
            : null,
      })
      ),
    });
  } catch (err) {
    console.error("informe POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear informe" },
      { status: 500 }
    );
  }
}
