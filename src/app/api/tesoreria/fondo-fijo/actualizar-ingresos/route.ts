import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";
import { TipoMovimientoFondo } from "@prisma/client";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Importar ingresos desde movimientos_extracto por codigosOperativos del config y período */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes?: number; anio?: number };
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

  const config = await prisma.configFondoFijo.findUnique({
    where: { mes_anio: { mes, anio } },
  });

  const codigosOperativos =
    (config?.codigosOperativos?.length ?? 0) > 0
      ? config!.codigosOperativos
      : config?.codOperativo?.trim()
        ? [config.codOperativo.trim()]
        : [];

  if (codigosOperativos.length === 0) {
    return NextResponse.json(
      { error: "Configurá al menos un código operativo para este mes/año." },
      { status: 400 }
    );
  }

  const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0));
  const fechaFin = new Date(Date.UTC(anio, mes, 1, 3, 0, 0));

  const movExtracto = await prisma.movimientoExtracto.findMany({
    where: {
      codOperativo: { in: codigosOperativos },
      fecha: { gte: fechaInicio, lt: fechaFin },
    },
    orderBy: { fecha: "asc" },
  });

  await prisma.fondoFijo.deleteMany({
    where: { mes, anio, tipo: TipoMovimientoFondo.INGRESO, importado: true },
  });

  for (const mov of movExtracto) {
    await prisma.fondoFijo.create({
      data: {
        fecha: mov.fecha,
        concepto: mov.concepto,
        importePesos: new Decimal(Math.abs(Number(mov.importePesos))),
        saldoPesos: new Decimal(0),
        mes,
        anio,
        tipo: TipoMovimientoFondo.INGRESO,
        codOperativo: mov.codOperativo ?? undefined,
        importado: true,
      },
    });
  }

  await recalcularSaldos(prisma, mes, anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Actualizó ingresos del Fondo Fijo (${mes}/${anio}): ${movExtracto.length} movimientos`,
      modulo: "Tesorería",
      detalle: String(movExtracto.length),
    });
  } catch {}

  return NextResponse.json({ importados: movExtracto.length });
}
