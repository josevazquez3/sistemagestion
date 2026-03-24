import { prisma } from "@/lib/prisma";

let tsdSchemaReady: Promise<void> | undefined;

/**
 * Crea enum y tablas TSD si no existen (entornos donde `migrate deploy` no corrió).
 */
export async function ensureTsdTables(): Promise<void> {
  if (!tsdSchemaReady) {
    tsdSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $e$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TsdEstado') THEN
            CREATE TYPE "TsdEstado" AS ENUM ('PARA_TRATAR', 'CEDULA_NOTIFICACION', 'APELACION', 'DEVUELTO_A_DTO', 'SENTENCIA');
          END IF;
        END $e$;
      `);

      const sentenciaExiste = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum e
          INNER JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'TsdEstado' AND e.enumlabel = 'SENTENCIA'
        ) AS ok
      `;
      if (sentenciaExiste[0]?.ok === false) {
        await prisma.$executeRawUnsafe(`ALTER TYPE "TsdEstado" ADD VALUE 'SENTENCIA'`);
      }

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tsd_expedientes" (
          "id" SERIAL NOT NULL,
          "nroExpte" TEXT NOT NULL,
          "caratula" TEXT NOT NULL,
          "distrito" TEXT NOT NULL,
          "finalizado" BOOLEAN NOT NULL DEFAULT false,
          "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "tsd_expedientes_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`
        DO $g$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tsd_expedientes' AND column_name = 'finalizado'
          ) THEN
            ALTER TABLE "tsd_expedientes" ADD COLUMN "finalizado" BOOLEAN NOT NULL DEFAULT false;
          END IF;
        END $g$;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "tsd_expedientes_nroExpte_key" ON "tsd_expedientes"("nroExpte");
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tsd_movimientos" (
          "id" SERIAL NOT NULL,
          "expedienteId" INTEGER NOT NULL,
          "fecha" TIMESTAMP(3) NOT NULL,
          "estado" "TsdEstado" NOT NULL,
          "observacion" TEXT,
          "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "tsd_movimientos_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "tsd_movimientos_expedienteId_idx" ON "tsd_movimientos"("expedienteId");
      `);

      await prisma.$executeRawUnsafe(`
        DO $f$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tsd_movimientos_expedienteId_fkey') THEN
            ALTER TABLE "tsd_movimientos"
              ADD CONSTRAINT "tsd_movimientos_expedienteId_fkey"
              FOREIGN KEY ("expedienteId") REFERENCES "tsd_expedientes"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $f$;
      `);
    })().catch((err) => {
      tsdSchemaReady = undefined;
      throw err;
    });
  }
  await tsdSchemaReady;
}
