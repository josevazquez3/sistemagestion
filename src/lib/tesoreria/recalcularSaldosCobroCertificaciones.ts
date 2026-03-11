import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/** Recalcula saldos de cobro certificaciones (solo ingresos, acumulado desde 0). */
export async function recalcularSaldosCobroCertificaciones(
  prisma: PrismaClient,
  mes: number,
  anio: number
): Promise<void> {
  let saldo = 0;

  const movs = await prisma.cobroCertificacion.findMany({
    where: { mes, anio },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });

  for (const mov of movs) {
    saldo += Number(mov.importe);
    await prisma.cobroCertificacion.update({
      where: { id: mov.id },
      data: { saldo: new Decimal(saldo) },
    });
  }
}
