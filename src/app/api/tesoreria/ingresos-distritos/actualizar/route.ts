import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recalcularSaldosIngresosDistritos } from "@/lib/tesoreria/recalcularSaldosIngresosDistritos";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Sincronizar Ingresos Distritos desde movimientos del extracto (por mes, anio, codigos) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes?: number; anio?: number; codigos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const mes = body.mes ?? 0;
  const anio = body.anio ?? 0;
  const codigos = Array.isArray(body.codigos) ? body.codigos.filter(Boolean) : [];

  if (codigos.length === 0) {
    return NextResponse.json(
      { error: "Agregá al menos un código para actualizar." },
      { status: 400 }
    );
  }
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json(
      { error: "mes y anio son obligatorios (mes 1-12)" },
      { status: 400 }
    );
  }

  try {
    const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0));
    const fechaFin = new Date(Date.UTC(anio, mes, 1, 3, 0, 0));

    const movimientos = await prisma.movimientoExtracto.findMany({
      where: {
        codOperativo: { in: codigos },
        fecha: { gte: fechaInicio, lt: fechaFin },
      },
      orderBy: { fecha: "asc" },
    });

    const existentes = await prisma.ingresoDistrito.findMany({
      where: { mes, anio, extractoBancoId: { not: null } },
    });
    const porExtractoId = new Map(existentes.map((e) => [e.extractoBancoId!, e]));

    let created = 0;
    let updated = 0;

    for (const mov of movimientos) {
      const importeAbs = Math.abs(Number(mov.importePesos));
      const existente = mov.id != null ? porExtractoId.get(mov.id) : undefined;

      if (existente) {
        await prisma.ingresoDistrito.update({
          where: { id: existente.id },
          data: {
            fecha: mov.fecha,
            concepto: mov.concepto,
            importe: new Decimal(importeAbs),
          },
        });
        updated++;
      } else {
        await prisma.ingresoDistrito.create({
          data: {
            mes,
            anio,
            codigos,
            fecha: mov.fecha,
            recibo: null,
            distrito: null,
            concepto: mov.concepto,
            ctaColeg: null,
            nMatriculados: null,
            importe: new Decimal(importeAbs),
            saldo: new Decimal(0),
            extractoBancoId: mov.id,
          },
        });
        created++;
      }
    }

    await recalcularSaldosIngresosDistritos(prisma, mes, anio);

    const total = created + updated;
    const user = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: `Actualizó Ingresos Distritos (${mes}/${anio}): ${created} nuevos, ${updated} actualizados`,
        modulo: "Tesorería",
        detalle: String(total),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      created,
      updated,
      total,
    });
  } catch (err) {
    console.error("ingresos-distritos/actualizar:", err);
    return NextResponse.json(
      { error: "Error al actualizar ingresos" },
      { status: 500 }
    );
  }
}
