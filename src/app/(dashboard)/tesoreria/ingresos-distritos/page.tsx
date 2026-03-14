import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IngresosDistritosContent } from "@/components/tesoreria/ingresos-distritos/IngresosDistritosContent";

export default async function IngresosDistritosPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Ingresos Distritos</h1>
      <p className="text-gray-500 mt-1">
        Planilla de recaudación por distritos.
      </p>
      <IngresosDistritosContent />
    </div>
  );
}
