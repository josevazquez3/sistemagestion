import { prisma } from "@/lib/prisma";

let schemaReady: Promise<void> | undefined;

/**
 * Crea la tabla si no existe (entornos donde `migrate deploy` no corrió).
 * Alineado con el modelo Prisma `LegalHistorialTsd`.
 */
export async function ensureLegalHistorialTsdTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "legal_historial_tsd" (
          "id" SERIAL NOT NULL,
          "titulo" TEXT NOT NULL,
          "fechaOficio" TIMESTAMP(3) NOT NULL,
          "archivoNombre" TEXT,
          "archivoUrl" TEXT,
          "archivoKey" TEXT,
          "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "legal_historial_tsd_pkey" PRIMARY KEY ("id")
        );
      `)
      .then(() => {})
      .catch((err) => {
        schemaReady = undefined;
        throw err;
      });
  }
  await schemaReady;
}
