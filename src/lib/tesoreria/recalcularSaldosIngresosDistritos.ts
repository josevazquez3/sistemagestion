import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/** Recalcula saldos de ingresos distritos (acumulado: saldo[n] = saldo[n-1] + importe[n]). */
export async function recalcularSaldosIngresosDistritos(
  prisma: PrismaClient,
  mes: number,
  anio: number
): Promise<void> {
  let saldo = 0;

  const registros = await prisma.ingresoDistrito.findMany({
    where: { mes, anio },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });

  for (const r of registros) {
    saldo += Number(r.importe);
    await prisma.ingresoDistrito.update({
      where: { id: r.id },
      data: { saldo: new Decimal(saldo) },
    });
  }
}
