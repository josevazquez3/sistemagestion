import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;

export function canAccess(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list
    .map((r: unknown) =>
      typeof r === "string"
        ? r
        : (r as { nombre?: string })?.nombre ?? (r as { name?: string })?.name
    )
    .filter(Boolean) as string[];
  return ROLES.some((r) => names.includes(r));
}

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as { id?: string; name?: string; roles?: unknown };
}

export function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

let temasSchemaReady: Promise<void> | undefined;

/**
 * Crea enum/tablas de Temas si no existen (evita bloquear por drift de migrations).
 */
export async function ensureTemasTables(): Promise<void> {
  if (!temasSchemaReady) {
    temasSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $e$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoTema') THEN
            CREATE TYPE "EstadoTema" AS ENUM ('PENDIENTE', 'FINALIZADO');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAsignacion') THEN
            CREATE TYPE "TipoAsignacion" AS ENUM ('AL_ORDEN_DEL_DIA', 'AL_INFORME_GUIA', 'GIRAR_A_DISTRITOS', 'ARCHIVAR', 'OTROS');
          END IF;
        END $e$;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Tema" (
          "id" SERIAL NOT NULL,
          "numero" INTEGER NOT NULL,
          "fecha" TIMESTAMP(3) NOT NULL,
          "tema" TEXT NOT NULL,
          "observacion" TEXT,
          "usuarioId" TEXT NOT NULL,
          "estado" "EstadoTema" NOT NULL DEFAULT 'PENDIENTE',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Tema_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Tema_numero_key" ON "Tema"("numero");
      `);

      await prisma.$executeRawUnsafe(`
        DO $f$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tema_usuarioId_fkey') THEN
            ALTER TABLE "Tema"
              ADD CONSTRAINT "Tema_usuarioId_fkey"
              FOREIGN KEY ("usuarioId") REFERENCES "users"("id")
              ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $f$;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TemaUso" (
          "id" SERIAL NOT NULL,
          "temaId" INTEGER NOT NULL,
          "fechaOD" TIMESTAMP(3),
          "guiaMesa" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TemaUso_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "TemaUso_temaId_idx" ON "TemaUso"("temaId");
      `);

      await prisma.$executeRawUnsafe(`
        DO $fu$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TemaUso_temaId_fkey') THEN
            ALTER TABLE "TemaUso"
              ADD CONSTRAINT "TemaUso_temaId_fkey"
              FOREIGN KEY ("temaId") REFERENCES "Tema"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $fu$;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TemaAsignacion" (
          "id" SERIAL NOT NULL,
          "temaId" INTEGER NOT NULL,
          "tipo" "TipoAsignacion" NOT NULL,
          "otroTexto" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TemaAsignacion_pkey" PRIMARY KEY ("id")
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "TemaAsignacion_temaId_idx" ON "TemaAsignacion"("temaId");
      `);

      await prisma.$executeRawUnsafe(`
        DO $fa$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TemaAsignacion_temaId_fkey') THEN
            ALTER TABLE "TemaAsignacion"
              ADD CONSTRAINT "TemaAsignacion_temaId_fkey"
              FOREIGN KEY ("temaId") REFERENCES "Tema"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $fa$;
      `);
    })().catch((err) => {
      temasSchemaReady = undefined;
      throw err;
    });
  }
  await temasSchemaReady;
}

