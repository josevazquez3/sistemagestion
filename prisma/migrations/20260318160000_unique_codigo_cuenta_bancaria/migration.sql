-- ANTES en local/Neon: npm run deduplicar:cuentas
ALTER TABLE "cuentas_bancarias" DROP CONSTRAINT IF EXISTS "cuentas_bancarias_codigo_codOperativo_key";
ALTER TABLE "cuentas_bancarias" DROP CONSTRAINT IF EXISTS "CuentaBancaria_codigo_codOperativo_key";
DROP INDEX IF EXISTS "cuentas_bancarias_codigo_codOperativo_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_bancarias_codigo_key" ON "cuentas_bancarias"("codigo");
