-- AlterTable (IF NOT EXISTS: compatible si la columna ya se creó vía runtime o manualmente)
ALTER TABLE "Proveedor" ADD COLUMN IF NOT EXISTS "noEmiteFactura" BOOLEAN NOT NULL DEFAULT false;
