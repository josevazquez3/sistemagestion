"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos.");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Error al iniciar sesión. Intente nuevamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E8F5E9] p-6">
      <Card className="w-full max-w-xl shadow-xl rounded-2xl border-0 bg-white p-8">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-2xl bg-[#4CAF50] text-white text-4xl font-bold">
            SG
          </div>
          <CardTitle className="text-4xl font-semibold text-gray-800">
            Sistema de Gestión
          </CardTitle>
          <CardDescription className="text-lg">
            Ingresá con tu cuenta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-xl bg-red-50 p-4 text-base text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl h-14 text-lg px-4"
                autoComplete="email"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-base">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl h-14 text-lg px-4"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#4CAF50] hover:bg-[#388E3C] text-white rounded-xl h-14 text-lg font-medium"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#E8F5E9]">
        <div className="text-gray-500">Cargando...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
