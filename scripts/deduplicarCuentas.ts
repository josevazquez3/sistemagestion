/**
 * Ejecutar ANTES de aplicar la migración que hace único el campo `codigo`:
 *   npx tsx scripts/deduplicarCuentas.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deduplicar() {
  console.log("Iniciando deduplicación de cuentas bancarias...");

  const todas = await prisma.cuentaBancaria.findMany({
    orderBy: [{ codigo: "asc" }, { id: "asc" }],
  });

  const porCodigo = new Map<string, typeof todas>();
  for (const c of todas) {
    const key = c.codigo.trim();
    if (!porCodigo.has(key)) porCodigo.set(key, []);
    porCodigo.get(key)!.push(c);
  }

  let unificadas = 0;

  for (const [codigo, filas] of porCodigo.entries()) {
    if (filas.length <= 1) continue;

    const maestra = filas[0];
    const duplicadas = filas.slice(1);
    const todosLosCods = new Set<string>();

    for (const f of filas) {
      if (f.codOperativo) {
        f.codOperativo.trim()
          .split(/\s+/)
          .forEach((t) => {
            if (t) todosLosCods.add(t);
          });
      }
    }

    const codOperativoUnificado = Array.from(todosLosCods).join(" ");

    for (const dup of duplicadas) {
      await prisma.movimientoExtracto.updateMany({
        where: { cuentaId: dup.id },
        data: { cuentaId: maestra.id },
      });
    }

    await prisma.cuentaBancaria.update({
      where: { id: maestra.id },
      data: { codOperativo: codOperativoUnificado || null },
    });

    await prisma.cuentaBancaria.deleteMany({
      where: { id: { in: duplicadas.map((d) => d.id) } },
    });

    console.log(
      `Unificado código "${codigo}": ${filas.length} filas → 1, codOperativo: "${codOperativoUnificado}"`
    );
    unificadas++;
  }

  console.log(`\nDeduplicación completa. ${unificadas} código(s) unificado(s).`);
}

deduplicar()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
