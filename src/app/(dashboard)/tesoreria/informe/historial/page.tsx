import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HistorialInformeContent } from "@/components/tesoreria/informe/HistorialInformeContent";

export default async function HistorialInformeTesoreriaPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Historial Info. Tesorería</h1>
        <p className="text-gray-500 mt-1">
          Repositorio de informes importados desde Excel con búsqueda y acciones rápidas.
        </p>
      </div>
      <HistorialInformeContent />
    </div>
  );
}

