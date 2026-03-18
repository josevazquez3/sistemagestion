import { prisma } from "@/lib/prisma";

/** Crea la tabla si aún no existe (p. ej. migración no aplicada en esta BD). */
async function ensureConfiguracionTesoreriaTable() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "configuracion_tesoreria" (
    "id" SERIAL NOT NULL,
    "saldoInicialConciliacion" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoInicialConciliacionCargado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "configuracion_tesoreria_pkey" PRIMARY KEY ("id")
);
`);
}

export async function getOrCreateConfiguracionTesoreria() {
  await ensureConfiguracionTesoreriaTable();
  const existing = await prisma.configuracionTesoreria.findFirst();
  if (existing) return existing;
  return prisma.configuracionTesoreria.create({
    data: {},
  });
}

export type SaldoAnteriorContexto = {
  saldoAnterior: number;
  esUsandoSaldoInicial: boolean;
  saldoInicialConfigurado: boolean;
  faltaConfigurarSaldoInicial: boolean;
  hayConciliacionMesPrevio: boolean;
};

/** Saldo anterior del período (mes/anio): cadena mensual o saldo manual de arranque. */
export async function resolverSaldoAnteriorPeriodo(
  mes: number,
  anio: number
): Promise<SaldoAnteriorContexto> {
  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anioAnt = mes === 1 ? anio - 1 : anio;
  const anterior = await prisma.conciliacionBanco.findUnique({
    where: { mes_anio: { mes: mesAnt, anio: anioAnt } },
    select: { totalConciliado: true },
  });
  const cfg = await getOrCreateConfiguracionTesoreria();
  if (anterior) {
    return {
      saldoAnterior: Number(anterior.totalConciliado),
      esUsandoSaldoInicial: false,
      saldoInicialConfigurado: cfg.saldoInicialConciliacionCargado,
      faltaConfigurarSaldoInicial: false,
      hayConciliacionMesPrevio: true,
    };
  }
  const saldoAnterior = Number(cfg.saldoInicialConciliacion);
  const cargado = cfg.saldoInicialConciliacionCargado;
  return {
    saldoAnterior,
    esUsandoSaldoInicial: true,
    saldoInicialConfigurado: cargado,
    faltaConfigurarSaldoInicial: !cargado,
    hayConciliacionMesPrevio: false,
  };
}
