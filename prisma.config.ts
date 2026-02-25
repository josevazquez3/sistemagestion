import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Configuración del CLI de Prisma.
 * Reemplaza package.json#prisma (deprecado en Prisma 7).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
