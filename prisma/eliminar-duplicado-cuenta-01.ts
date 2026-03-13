/**
 * Script único: elimina el registro duplicado de cuenta "01" con codOperativo "—"
 * (o vacío/null), dejando solo el original "01 - transferencia Distritos" con
 * codOperativo "3002 2377".
 *
 * Ejecutar una sola vez: npx tsx prisma/eliminar-duplicado-cuenta-01.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const eliminados = await prisma.cuentaBancaria.deleteMany({
    where: {
      codigo: "01",
      OR: [
        { codOperativo: "—" },
        { codOperativo: null },
        { codOperativo: "" },
      ],
    },
  });
  console.log(`Registros eliminados: ${eliminados.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
