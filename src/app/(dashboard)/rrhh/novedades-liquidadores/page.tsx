import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NovedadesLiquidadoresContent } from "./_components/NovedadesLiquidadoresContent";

export default async function NovedadesLiquidadoresPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("RRHH");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Novedades Liquidadores</h1>
        <p className="text-gray-500 mt-1">
          Planilla de novedades para liquidadores y días pendientes de liquidar.
        </p>
      </div>
      <NovedadesLiquidadoresContent />
    </div>
  );
}
