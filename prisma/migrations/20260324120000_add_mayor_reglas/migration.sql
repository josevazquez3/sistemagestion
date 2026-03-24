-- Idempotente: la tabla puede existir ya (p. ej. creada por ensureMayorTables en runtime).
CREATE TABLE IF NOT EXISTS "mayor_reglas" (
    "id" SERIAL NOT NULL,
    "palabra" TEXT NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mayor_reglas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mayor_reglas_palabra_key" ON "mayor_reglas"("palabra");
CREATE INDEX IF NOT EXISTS "mayor_reglas_cuentaId_idx" ON "mayor_reglas"("cuentaId");

DO $f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mayor_reglas_cuentaId_fkey'
  ) THEN
    ALTER TABLE "mayor_reglas"
      ADD CONSTRAINT "mayor_reglas_cuentaId_fkey"
      FOREIGN KEY ("cuentaId") REFERENCES "mayor_cuentas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $f$;
