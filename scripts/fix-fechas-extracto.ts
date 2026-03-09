import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE movimientos_extracto
    SET fecha = fecha + INTERVAL '1 day'
  `;

  console.log(`Fechas corregidas: ${result} registros actualizados`);

  const muestra = await prisma.$queryRaw<
    Array<{ fecha: Date; referencia: string | null; concepto: string }>
  >`
    SELECT fecha, referencia, concepto
    FROM movimientos_extracto
    ORDER BY fecha DESC
    LIMIT 10
  `;

  console.log("Muestra de los ultimos 10 movimientos:");
  console.table(
    muestra.map((m) => ({
      fecha: m.fecha.toISOString(),
      referencia: m.referencia,
      concepto: m.concepto,
    }))
  );
}

main()
  .catch((err) => {
    console.error("Error al corregir fechas:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
