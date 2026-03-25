import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

export function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function getRolesFromSession(): Promise<string[]> {
  const session = await auth();
  return (session?.user as { roles?: string[] })?.roles ?? [];
}

export function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

let mayorHistorialSchemaReady: Promise<void> | undefined;

/** Tabla idempotente para Excel archivados del módulo Mayores - Cuentas. */
export async function ensureMayorHistorialTables(): Promise<void> {
  if (!mayorHistorialSchemaReady) {
    mayorHistorialSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "HistorialMayorCuentas" (
          "id" SERIAL NOT NULL,
          "nombreArchivo" TEXT NOT NULL,
          "fechaArchivo" TIMESTAMP(3),
          "sheetName" TEXT NOT NULL,
          "sheetData" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "HistorialMayorCuentas_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "HistorialMayorCuentas_fechaArchivo_idx" ON "HistorialMayorCuentas"("fechaArchivo");`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "HistorialMayorCuentas_createdAt_idx" ON "HistorialMayorCuentas"("createdAt");`
      );
    })().catch((err) => {
      mayorHistorialSchemaReady = undefined;
      throw err;
    });
  }
  await mayorHistorialSchemaReady;
}
