import type { NextConfig } from "next";

/**
 * Fallback de NEXTAUTH_URL en Vercel usando VERCEL_URL.
 * Si no está configurada manualmente, se usa la URL del deployment.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.39"],
  env: {
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  },
};

export default nextConfig;
