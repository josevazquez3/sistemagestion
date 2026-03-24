import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsearFechaInputAPI } from "@/lib/utils/fecha";

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

export function parseDateOrNull(s: string | null | undefined): Date | null {
  const raw = (s ?? "").trim();
  if (!raw) return null;
  const d = parsearFechaInputAPI(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ROMAN: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

export function distritoNumeroDesdeTexto(raw: string | null | undefined): number | null {
  const s = (raw ?? "").toUpperCase().trim();
  if (!s) return null;
  const romanMatch = s.match(/\b(X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  if (romanMatch) return ROMAN[romanMatch[1]!] ?? null;
  const numMatch = s.match(/\b(10|[1-9])\b/);
  if (numMatch) return parseInt(numMatch[1]!, 10);
  return null;
}

export function formatoPeriodoMeses(fechas: Date[]): string {
  const uniq = new Set<string>();
  for (const f of fechas) {
    if (!f || Number.isNaN(f.getTime())) continue;
    const key = `${String(f.getUTCMonth() + 1).padStart(2, "0")}/${f.getUTCFullYear()}`;
    uniq.add(key);
  }
  const list = [...uniq];
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} y ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

let informeSchemaReady: Promise<void> | undefined;

/**
 * Crea tablas del submódulo Informe en forma idempotente para entornos con drift
 * donde no se pudo aplicar migrate dev/deploy.
 */
export async function ensureInformeTables(): Promise<void> {
  if (!informeSchemaReady) {
    informeSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InformeTesoreria" (
          "id" SERIAL NOT NULL,
          "fechaDesde" TIMESTAMP(3) NOT NULL,
          "fechaHasta" TIMESTAMP(3) NOT NULL,
          "chequesADepositar" DECIMAL(15,2),
          "saldoBancoRioOverride" DECIMAL(15,2),
          "saldoFondoFijoOverride" DECIMAL(15,2),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "InformeTesoreria_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "InformeTesoreria"
        ADD COLUMN IF NOT EXISTS "chequesADepositar" DECIMAL(15,2),
        ADD COLUMN IF NOT EXISTS "saldoBancoRioOverride" DECIMAL(15,2),
        ADD COLUMN IF NOT EXISTS "saldoFondoFijoOverride" DECIMAL(15,2);
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "InformeTesoreria"
        SET "chequesADepositar" = 0
        WHERE "chequesADepositar" IS NULL;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InformeEgreso" (
          "id" SERIAL NOT NULL,
          "informeId" INTEGER NOT NULL,
          "numero" TEXT,
          "concepto" TEXT NOT NULL,
          "importe" DECIMAL(15,2) NOT NULL,
          "orden" INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT "InformeEgreso_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InformeCompromiso" (
          "id" SERIAL NOT NULL,
          "informeId" INTEGER NOT NULL,
          "numero" TEXT,
          "concepto" TEXT NOT NULL,
          "importe" DECIMAL(15,2) NOT NULL,
          "orden" INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT "InformeCompromiso_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InformeTextBox" (
          "id" SERIAL NOT NULL,
          "informeId" INTEGER NOT NULL,
          "numero" INTEGER NOT NULL,
          "contenido" TEXT NOT NULL,
          "orden" INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT "InformeTextBox_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InformeUltimoAporte" (
          "id" SERIAL NOT NULL,
          "informeId" INTEGER NOT NULL,
          "distritoNumero" INTEGER NOT NULL,
          "fechaOverride" TIMESTAMP(3),
          CONSTRAINT "InformeUltimoAporte_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InformeEgreso_informeId_idx" ON "InformeEgreso"("informeId");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InformeCompromiso_informeId_idx" ON "InformeCompromiso"("informeId");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InformeTextBox_informeId_idx" ON "InformeTextBox"("informeId");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InformeUltimoAporte_informeId_idx" ON "InformeUltimoAporte"("informeId");`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "InformeUltimoAporte_informeId_distritoNumero_key" ON "InformeUltimoAporte"("informeId","distritoNumero");`);

      await prisma.$executeRawUnsafe(`
        DO $f$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InformeEgreso_informeId_fkey') THEN
            ALTER TABLE "InformeEgreso"
            ADD CONSTRAINT "InformeEgreso_informeId_fkey"
            FOREIGN KEY ("informeId") REFERENCES "InformeTesoreria"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InformeCompromiso_informeId_fkey') THEN
            ALTER TABLE "InformeCompromiso"
            ADD CONSTRAINT "InformeCompromiso_informeId_fkey"
            FOREIGN KEY ("informeId") REFERENCES "InformeTesoreria"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InformeTextBox_informeId_fkey') THEN
            ALTER TABLE "InformeTextBox"
            ADD CONSTRAINT "InformeTextBox_informeId_fkey"
            FOREIGN KEY ("informeId") REFERENCES "InformeTesoreria"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InformeUltimoAporte_informeId_fkey') THEN
            ALTER TABLE "InformeUltimoAporte"
            ADD CONSTRAINT "InformeUltimoAporte_informeId_fkey"
            FOREIGN KEY ("informeId") REFERENCES "InformeTesoreria"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $f$;
      `);
    })().catch((err) => {
      informeSchemaReady = undefined;
      throw err;
    });
  }
  await informeSchemaReady;
}
