import path from "path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// El CLI con prisma.config a veces no carga .env.local; lo forzamos antes de leer el schema.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

// Evita P1012 si solo tenés DATABASE_URL. Para Neon con P1002 (pooler), definí DIRECT_URL
// con la URL “Direct” (host sin “-pooler”) en .env.local.
if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

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
