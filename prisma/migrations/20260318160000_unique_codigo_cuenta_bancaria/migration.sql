-- ANTES en local/Neon: npm run deduplicar:cuentas
-- La tabla puede no existir en la shadow DB si el historial no incluye su creación inicial.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cuentas_bancarias'
  ) THEN
    ALTER TABLE "cuentas_bancarias" DROP CONSTRAINT IF EXISTS "cuentas_bancarias_codigo_codOperativo_key";
    ALTER TABLE "cuentas_bancarias" DROP CONSTRAINT IF EXISTS "CuentaBancaria_codigo_codOperativo_key";
    DROP INDEX IF EXISTS "cuentas_bancarias_codigo_codOperativo_key";
    -- IF NOT EXISTS vía catálogo (CREATE INDEX IF NOT EXISTS dentro de DO no es válido en todos los PG)
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'cuentas_bancarias_codigo_key'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX "cuentas_bancarias_codigo_key" ON "cuentas_bancarias"("codigo")';
    END IF;
  END IF;
END $$;
