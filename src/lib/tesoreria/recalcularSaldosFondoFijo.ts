import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/** Recalcula saldos de fondo fijo partiendo del saldo anterior configurado (no desde cero). */
export async function recalcularSaldos(
  prisma: PrismaClient,
  mes: number,
  anio: number
): Promise<void> {
  const config = await prisma.configFondoFijo.findUnique({
    where: { mes_anio: { mes, anio } },
  });
  // Partir SIEMPRE del saldo anterior (0 si no hay config o no está definido)
  let saldo = toNumber(config?.saldoAnterior);

  const movs = await prisma.fondoFijo.findMany({
    where: { mes, anio },
    orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
  });

  for (const mov of movs) {
    const valor = toNumber(mov.importePesos);
    // GASTO resta, INGRESO suma (por si algún registro tiene importe con signo distinto)
    const delta = mov.tipo === "GASTO" ? -Math.abs(valor) : Math.abs(valor);
    saldo += delta;
    await prisma.fondoFijo.update({
      where: { id: mov.id },
      data: { saldoPesos: new Decimal(saldo) },
    });
  }
}
