import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Configuración de NextAuth v5 con CredentialsProvider.
 * Usa JWT para sesión (recomendado con credentials).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-cambiar-en-produccion",
  trustHost: true, // Necesario para Vercel y plataformas con proxy
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            roles: { include: { role: true } },
            permisos: { include: { permission: true } },
          },
        });

        if (!user || !user.activo) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.nombre} ${user.apellido}`,
          legajoId: user.legajoId ?? undefined,
          roles: user.roles.map((r) => r.role.nombre),
          permisos: user.permisos.map((p) => ({
            modulo: p.permission.modulo,
            accion: p.permission.accion,
          })),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.legajoId = (user as { legajoId?: string }).legajoId;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.permisos = (user as { permisos?: { modulo: string; accion: string }[] }).permisos ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { legajoId?: string }).legajoId = token.legajoId as string | undefined;
        (session.user as { roles?: string[] }).roles = (token.roles as string[]) ?? [];
        (session.user as { permisos?: { modulo: string; accion: string }[] }).permisos =
          (token.permisos as { modulo: string; accion: string }[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
