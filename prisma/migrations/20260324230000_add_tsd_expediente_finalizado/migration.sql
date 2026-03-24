-- AlterTable (IF NOT EXISTS: compatible si la columna ya fue creada por ensureTsdTables)
ALTER TABLE "tsd_expedientes" ADD COLUMN IF NOT EXISTS "finalizado" BOOLEAN NOT NULL DEFAULT false;
