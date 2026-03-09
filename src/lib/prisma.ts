import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma singleton para Next.js.
 * En desarrollo evita múltiples instancias por el hot-reload.
 *
 * Para Neon (serverless):
 * - Usar la URL "pooled" del dashboard (host con -pooler).
 * - connection_limit=1 evita reutilizar conexiones cerradas.
 * - connect_timeout ayuda a no colgar si la conexión cayó (Error kind: Closed).
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  const sep = url.indexOf("?");
  const base = sep >= 0 ? url.slice(0, sep) : url;
  const params = new URLSearchParams(sep >= 0 ? url.slice(sep + 1) : "");
  if (!params.has("connection_limit")) params.set("connection_limit", "1");
  if (!params.has("connect_timeout")) params.set("connect_timeout", "15");
  return `${base}?${params.toString()}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: getDatabaseUrl() },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
