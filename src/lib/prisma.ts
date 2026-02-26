import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma singleton para Next.js.
 * En desarrollo evita múltiples instancias por el hot-reload.
 *
 * Para Neon/Vercel serverless: connection_limit=1 evita el error
 * "Error in PostgreSQL connection: Error { kind: Closed }" al reutilizar
 * conexiones cerradas entre invocaciones.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=1`;
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
