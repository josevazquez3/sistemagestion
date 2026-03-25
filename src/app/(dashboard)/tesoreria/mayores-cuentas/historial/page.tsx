import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HistorialMayorCuentasContent } from "@/components/tesoreria/mayores-cuentas/HistorialMayorCuentasContent";

export default async function HistorialMayorCuentasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Historial Mayores - cuentas</h1>
        <p className="mt-1 text-gray-500">
          Repositorio de planillas Excel del módulo Mayores - Cuentas, con búsqueda y acciones rápidas.
        </p>
      </div>
      <HistorialMayorCuentasContent />
    </div>
  );
}
