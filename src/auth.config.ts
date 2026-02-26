import type { NextAuthConfig } from "next-auth";

/**
 * Configuración mínima para el middleware (Edge).
 * NO importar Prisma, bcrypt ni providers - reduce el bundle < 1MB.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-cambiar-en-produccion",
  trustHost: true, // Necesario para Vercel - evita ERR_TOO_MANY_REDIRECTS
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  providers: [],
} satisfies NextAuthConfig;
